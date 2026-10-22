"""계좌 스냅샷: 폰이 증권사에서 조회한 계좌 요약을 올리고, 웹이 그것으로 잔고를 보여준다 (docs/plan/02-architecture.md 5장).

계좌번호는 받지 않는다 (Balance는 정해진 칸 외에는 거부). 그 사용자에게만 보여준다 (NFR-05a).
"""

from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from psycopg.types.json import Jsonb

from app.agents.interrupts import Balance
from app.agents.query import latest_snapshot
from app.db import Conn
from app.routers.auth import UserId

router = APIRouter(prefix="/api", tags=["snapshot"])


class Snapshot(Balance):
    """그때 코스피·코스닥 전일 대비 % (2026-10-22: 아침 하락 뒤 반등하는지 계좌와 나란히 보려고 쌓는다)"""
    kospi_pct: float | None = Field(default=None, ge=-30, le=30)
    kosdaq_pct: float | None = Field(default=None, ge=-30, le=30)


@router.post("/snapshot", status_code=204)
def post_snapshot(body: Snapshot, conn: Conn, user_id: UserId) -> None:
    holdings = body.model_dump(mode="json")["holdings"]
    conn.execute(
        "INSERT INTO account_snapshots (user_id, cash_krw, holdings, fetched_at, total_krw, kospi_pct, kosdaq_pct)"
        " VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (user_id, body.cash_krw, Jsonb(holdings), body.fetched_at, body.total_krw, body.kospi_pct, body.kosdaq_pct),
    )
    conn.commit()


class Deferral(BaseModel):
    """자동매매가 매도 판단을 미룬 것 (auto_trader.dart deferSell). 점수표가 종가와 비교한다"""
    stock_code: str = Field(pattern=r"^\d{6}$")
    reason: Literal["stop", "drop", "giveback", "market"]
    price: int = Field(gt=0, le=100_000_000)
    market_pct: float | None = Field(default=None, ge=-30, le=30)
    stock_pct: float | None = Field(default=None, ge=-30, le=30)


@router.post("/auto/deferrals", status_code=204)
def post_deferral(body: Deferral, conn: Conn, user_id: UserId) -> None:
    if not conn.execute("SELECT 1 FROM stocks WHERE code = %s", (body.stock_code,)).fetchone():
        raise HTTPException(404, "분석 대상 종목이 아니에요")
    conn.execute("INSERT INTO sell_deferrals (user_id, stock_code, reason, price, market_pct, stock_pct) VALUES (%s, %s, %s, %s, %s, %s)",
                 (user_id, body.stock_code, body.reason, body.price, body.market_pct, body.stock_pct))
    conn.commit()


@router.get("/equity")
def get_equity(conn: Conn, user_id: UserId, day: date | None = None) -> dict:
    """총자산 기록 (자산 탭 그래프): 날짜별은 그날 마지막 값, 장중은 day(달력에서 고른 날, 없으면 기록이 있는 가장 최근 날)의 값 전부.
    폰이 계산해 올린 값만 쓴다."""
    rows = conn.execute(
        "SELECT (fetched_at AT TIME ZONE 'Asia/Seoul')::date AS day, to_char(fetched_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS time,"
        " total_krw, cash_krw, holdings FROM account_snapshots WHERE user_id = %s AND total_krw IS NOT NULL"
        " AND fetched_at >= now() - interval '120 days' ORDER BY fetched_at",
        (user_id,),
    ).fetchall()
    # 날짜별 표 (2026-10-21 사용자 요청): 그날 마지막 기록의 총자산·현금·주식 매입금액. 평가금액 = 총자산 − 현금
    days = {str(r["day"]): {"date": str(r["day"]), "time": r["time"], "total_krw": r["total_krw"], "cash_krw": r["cash_krw"],
                            "cost_krw": sum(h["qty"] * h["avg_price"] for h in r["holdings"])}
            for r in rows}  # 시간순이라 마지막 값이 남는다
    last = str(day) if day else str(rows[-1]["day"]) if rows else None
    return {"days": list(days.values()),
            "intraday": {"date": last, "points": [{"time": r["time"], "total_krw": r["total_krw"]}
                                                  for r in rows if str(r["day"]) == last]}}


@router.get("/snapshot")
def get_snapshot(conn: Conn, user_id: UserId) -> dict:
    row = latest_snapshot(conn, user_id)
    if row is None:
        raise HTTPException(404, "아직 동기화된 계좌가 없어요. 폰 앱을 열어 주세요.")
    return row
