import logging
import threading
from contextlib import asynccontextmanager
from datetime import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app import briefing, collect, config, review
from app.agents.graph import build_graph
from app.db import connect
from app.routers import approvals, auth, briefings, chat, history, notifications, orders, policy, reservations, safety, snapshot, watchlist


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 대화 그래프의 체크포인트(멈춘 업무 포함)를 PostgreSQL에 저장한다. 서버를 재시작해도 남는다 (NFR-06).
    # 체크포인트 테이블은 PostgresSaver.setup()이 직접 만든다 (migrations/에 없음).
    with ConnectionPool(
        app.state.database_url, min_size=1, max_size=5,
        kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row},
    ) as pool:
        checkpointer = PostgresSaver(pool)
        checkpointer.setup()
        app.state.graph = build_graph(checkpointer)
        if config.MARKET_CLOCK:
            logging.getLogger(__name__).warning("개발용 MARKET_CLOCK=%s: 장 운영 시간을 실제 시계로 검사하지 않아요", config.MARKET_CLOCK)
        stop = threading.Event()
        for hour in app.state.auto_collect_hours:
            threading.Thread(target=collect.run_daily, args=(stop, hour), daemon=True).start()
        if app.state.morning_brief_time is not None:  # 사용자마다 Gemini 호출이 생기므로 .env에서 켤 때만
            threading.Thread(target=briefing.run_daily, args=(stop, app.state.morning_brief_time), daemon=True).start()
        if app.state.close_summary_time is not None:
            threading.Thread(target=briefing.run_daily, args=(stop, app.state.close_summary_time, briefing.build_close),
                             daemon=True).start()
        if app.state.close_review_time is not None:
            threading.Thread(target=briefing.run_daily, args=(stop, app.state.close_review_time, review.build_review),
                             daemon=True).start()
        yield
        stop.set()


def create_app(database_url: str | None = None, auto_collect_hours: tuple[int, ...] = (),
               morning_brief_time: time | None = None, close_summary_time: time | None = None,
               close_review_time: time | None = None) -> FastAPI:
    """auto_collect_hours: 매일 이 시각들에 분석용 데이터 수집. morning_brief_time: 거래일 이 시각에 아침 브리핑.
    None이면 안 함 (테스트는 둘 다 안 함)."""
    app = FastAPI(title="invest-agent-api", lifespan=lifespan)
    app.state.database_url = database_url or config.DATABASE_URL
    app.state.auto_collect_hours = auto_collect_hours
    app.state.morning_brief_time = morning_brief_time
    app.state.close_summary_time = close_summary_time  # 거래일 이 시각에 장 마감 요약 (LLM 없음)
    app.state.close_review_time = close_review_time    # 거래일 이 시각에 AI 회고·내일 계획 (Gemini 비용)
    if config.CORS_ORIGINS:
        # 웹 개발 서버(다른 포트)에서 오는 요청 허용. 로그인은 쿠키가 아니라 Authorization 헤더라서 credentials는 끈다
        app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
    for module in (auth, policy, chat, snapshot, approvals, history, orders, briefings, watchlist, notifications, reservations, safety):
        app.include_router(module.router)

    @app.exception_handler(RequestValidationError)
    def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
        # 오류 형식을 {"detail": "사람이 읽을 수 있는 이유"}로 맞춘다 (06-api-spec.md)
        first = error.errors()[0]
        field = ".".join(str(part) for part in first["loc"][1:])
        reason = first["msg"].removeprefix("Value error, ")
        return JSONResponse({"detail": f"{field}: {reason}" if field else reason}, status_code=422)

    @app.get("/api/health")
    def health() -> JSONResponse:
        try:
            with connect(app.state.database_url) as conn:
                conn.execute("SELECT 1")
        except Exception:
            return JSONResponse({"status": "degraded", "db": "error"}, status_code=503)
        return JSONResponse({"status": "ok", "db": "ok"})

    return app


app = create_app(
    auto_collect_hours=() if config.AUTO_COLLECT_HOUR == "off" else tuple(int(h) for h in config.AUTO_COLLECT_HOUR.split(",")),
    morning_brief_time=time.fromisoformat(config.MORNING_BRIEF_TIME) if config.MORNING_BRIEF_TIME else None,
    close_summary_time=None if config.CLOSE_SUMMARY_TIME == "off" else time.fromisoformat(config.CLOSE_SUMMARY_TIME),
    close_review_time=time.fromisoformat(config.CLOSE_REVIEW_TIME) if config.CLOSE_REVIEW_TIME else None,
)
