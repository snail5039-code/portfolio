"""대화 API: 메시지 보내기, 멈춤에 답하기, 멈춘 업무 목록 (docs/plan/06-api-spec.md 2·3장).

POST /api/chat, POST /api/chat/resume는 진행 상황을 이벤트 스트림(SSE)으로 보낸다.
    progress  {"step", "label"}         노드를 지날 때마다
    interrupt {"kind", "interrupt_id", ...}  멈춤 (question / fetch / approval / execute)
    message   {"text"}                  답
    error     {"detail"}                실패
    done      {"thread_id"}             이번 턴 끝
"""

import json
import logging
from collections.abc import Iterator
from typing import Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from langgraph.types import Command
from pydantic import BaseModel, Field, ValidationError

from app.agents.interrupts import ANSWER_MODELS, APP_ONLY_KINDS
from app.agents.llm import LLMUnavailable
from app.agents.state import Context, new_request
from app.db import Conn, connect
from app.routers.auth import UserId
from app.routers.policy import profile_summary

router = APIRouter(prefix="/api", tags=["chat"])
logger = logging.getLogger(__name__)

HISTORY_TURNS = 5
PENDING_THREADS_LIMIT = 20
PROGRESS_LABELS = {
    "understand": "요청 이해 중",
    "find_stock": "종목 찾는 중",
    "get_market": "계좌·시세 확인 중",
    "read_orders": "주문 내역 확인 중",
    "history": "내 기록 찾는 중",
    "check_target": "분석 대상인지 확인 중",
    "get_account": "계좌·현재가 확인 중",
    "gather": "공시·재무 자료 모으는 중",
    "invest_agent": "투자 AI 분석 중",
    "verify_agent": "검증 AI 확인 중",
    "record": "기록 저장 중",
    "order_values": "주문 내용 확인 중",
    "policy": "투자 정책 검사 중",
    "prepare_approval": "처리안 만드는 중",
    "execute": "주문 결과 기록 중",
    "result": "주문 기록 확인 중",
    "explain": "용어 찾는 중",
}


class ChatRequest(BaseModel):
    thread_id: UUID | None = None  # 없으면 새 대화
    text: str = Field(min_length=1, max_length=1000)
    client: Literal["app", "web"]
    stock_code: str | None = Field(default=None, pattern=r"^[0-9A-Z]{6}$")  # 새 대화를 종목 방에서 시작할 때
    origin: Literal["user", "auto"] = "user"  # auto: 앱의 자동매매·예약이 보낸 주문 (3-4). AI가 매수 시점을 따진다
    mode: Literal["mock", "real"] = "mock"  # 4-1: 폰이 실전 모드를 켰으면 real (주문 기록·처리안·안전장치가 달라진다)


class ResumeRequest(BaseModel):
    thread_id: UUID
    interrupt_id: str = Field(max_length=100)
    payload: dict
    client: Literal["app", "web"] | None = None  # 지금 답하는 쪽. 없으면 대화를 시작한 쪽 (웹에서 승인 → 폰에서 실행)


# ---------- 대화(thread)와 메시지 ----------

def graph_config(thread_id: UUID) -> dict:
    return {"configurable": {"thread_id": str(thread_id)}}


def own_thread(conn: psycopg.Connection, user_id: UUID, thread_id: UUID) -> None:
    """남의 대화거나 없는 대화면 404. 있다는 사실도 알리지 않는다."""
    if not conn.execute("SELECT 1 FROM threads WHERE id = %s AND user_id = %s", (thread_id, user_id)).fetchone():
        raise HTTPException(404, "대화를 찾을 수 없어요")


def recent_history(conn: psycopg.Connection, thread_id: UUID) -> list[dict]:
    """최근 대화 5턴 [{request, answer}] (오래된 것부터). understand가 "그거"를 풀 때 본다."""
    rows = conn.execute(
        "SELECT role, text FROM messages WHERE thread_id = %s ORDER BY created_at DESC LIMIT %s",
        (thread_id, HISTORY_TURNS * 2),
    ).fetchall()
    turns, answer = [], None
    for row in rows:  # 최신부터: 답이 먼저 나오고 그 앞에 요청이 나온다
        if row["role"] == "assistant":
            answer = row["text"]
        elif answer is not None:
            turns.append({"request": row["text"], "answer": answer})
            answer = None
    return turns[::-1]


def save_message(database_url: str, thread_id: UUID, role: str, text: str, client: str) -> None:
    with connect(database_url) as conn:
        conn.execute(
            "INSERT INTO messages (thread_id, role, text, client) VALUES (%s, %s, %s, %s)",
            (thread_id, role, text, client),
        )


# ---------- 이벤트 스트림 ----------

def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


def run_graph(request: Request, graph_input, thread_id: UUID, client: str) -> StreamingResponse:
    """그래프를 돌리며 진행 상황을 흘려보낸다. 끝까지 가면 답을 messages에 저장한다."""
    graph = request.app.state.graph
    database_url = request.app.state.database_url
    config = graph_config(thread_id)

    def events() -> Iterator[str]:
        sent_interrupts = set()  # 하위 그래프의 멈춤은 상위 그래프에서도 한 번 더 보고되므로 한 번만 보낸다
        try:
            for _, update in graph.stream(graph_input, config, context=Context(database_url),
                                          stream_mode="updates", subgraphs=True):
                for node, _values in update.items():
                    if node == "__interrupt__":
                        pending = update[node][0]
                        if pending.id not in sent_interrupts:
                            sent_interrupts.add(pending.id)
                            yield sse("interrupt", {**pending.value, "interrupt_id": pending.id})
                    elif node in PROGRESS_LABELS:
                        yield sse("progress", {"step": node, "label": PROGRESS_LABELS[node]})

            state = graph.get_state(config)
            if not state.interrupts and state.values.get("answer"):
                save_message(database_url, thread_id, "assistant", state.values["answer"], client)
                yield sse("message", {"text": state.values["answer"]})
        except LLMUnavailable:
            logger.exception("Gemini 호출 실패")
            yield sse("error", {"detail": "AI 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요."})
        except Exception:
            logger.exception("그래프 실행 실패")
            yield sse("error", {"detail": "처리 중 오류가 났어요. 잠시 후 다시 시도해 주세요."})
        yield sse("done", {"thread_id": str(thread_id)})

    return StreamingResponse(events(), media_type="text/event-stream")


# ---------- API ----------

@router.post("/chat")
def chat(body: ChatRequest, request: Request, conn: Conn, user_id: UserId) -> StreamingResponse:
    """새 요청. 같은 대화에 멈춘 업무가 있었다면 버리고 새로 시작한다."""
    if body.thread_id is None:
        if body.stock_code and not conn.execute("SELECT 1 FROM stocks WHERE code = %s", (body.stock_code,)).fetchone():
            raise HTTPException(404, "종목을 찾을 수 없어요")
        thread_id = conn.execute("INSERT INTO threads (user_id, stock_code) VALUES (%s, %s) RETURNING id",
                                 (user_id, body.stock_code)).fetchone()["id"]
    else:
        thread_id = body.thread_id
        own_thread(conn, user_id, thread_id)
    room = conn.execute("SELECT s.name FROM threads t JOIN stocks s ON s.code = t.stock_code WHERE t.id = %s",
                        (thread_id,)).fetchone()

    graph_input = {
        **new_request(body.text, recent_history(conn, thread_id), profile_summary(conn, user_id)),
        "user_id": str(user_id), "thread_id": str(thread_id), "client": body.client,
        "room_stock": room and room["name"], "auto_origin": body.origin == "auto", "real_mode": body.mode == "real",
    }
    conn.execute(
        "INSERT INTO messages (thread_id, role, text, client) VALUES (%s, 'user', %s, %s)",
        (thread_id, body.text, body.client),
    )
    conn.commit()
    return run_graph(request, graph_input, thread_id, body.client)


@router.post("/chat/resume")
def resume(body: ResumeRequest, request: Request, conn: Conn, user_id: UserId) -> StreamingResponse:
    """멈춤에 답하고 이어서 진행한다. 지금 멈춰 있는 interrupt_id가 아니면 받지 않는다 (오래된 답 방지)."""
    own_thread(conn, user_id, body.thread_id)
    state = request.app.state.graph.get_state(graph_config(body.thread_id))
    if not state.interrupts or state.interrupts[0].id != body.interrupt_id:
        raise HTTPException(409, "이미 처리됐거나 없는 멈춤이에요")

    waiting = state.interrupts[0].value
    kind = waiting["kind"]
    client = body.client or state.values["client"]
    if kind in APP_ONLY_KINDS and client != "app":
        raise HTTPException(403, "증권사 조회·주문 결과는 앱만 보낼 수 있어요")
    try:
        answer = ANSWER_MODELS[kind].model_validate(body.payload)
    except ValidationError as error:
        reason = error.errors()[0]["msg"].removeprefix("Value error, ")
        raise HTTPException(422, f"멈춤에 대한 답이 올바르지 않아요: {reason}") from None
    if kind == "approval" and answer.decision == "approve" and waiting.get("confirm_required") and not answer.confirm_risk:
        raise HTTPException(422, "확인이 필요한 위험이 있어요. 내용을 확인했다면 confirm_risk를 true로 보내 주세요")
    if kind == "execute" and answer.result.idempotency_key != waiting["request"]["idempotency_key"]:
        raise HTTPException(422, "다른 주문의 결과예요 (idempotency_key가 달라요)")

    return run_graph(request, Command(resume={**answer.model_dump(mode="json", exclude_none=True), "client": client}),
                     body.thread_id, client)


@router.get("/chat/rooms/{stock_code}")
def stock_room(stock_code: str, conn: Conn, user_id: UserId) -> dict:
    """종목 대화방: 이 종목 방의 가장 최근 대화와 메시지 (없으면 thread_id가 null). 이어서 보내면 같은 대화에 쌓인다."""
    stock = conn.execute("SELECT code, name FROM stocks WHERE code = %s", (stock_code,)).fetchone()
    if stock is None:
        raise HTTPException(404, "종목을 찾을 수 없어요")
    thread = conn.execute(
        "SELECT id FROM threads WHERE user_id = %s AND stock_code = %s ORDER BY created_at DESC LIMIT 1",
        (user_id, stock_code),
    ).fetchone()
    messages = [] if thread is None else conn.execute(
        "SELECT role, text, created_at FROM (SELECT * FROM messages WHERE thread_id = %s ORDER BY created_at DESC LIMIT 50) m"
        " ORDER BY created_at", (thread["id"],),
    ).fetchall()
    return {"stock_code": stock["code"], "stock_name": stock["name"], "thread_id": thread and thread["id"], "messages": messages}


@router.get("/chat/pending")
def pending(request: Request, conn: Conn, user_id: UserId) -> list[dict]:
    """멈춰 있는 업무 목록 (앱을 열 때). 서버를 재시작해도 체크포인트에 남아 있다 (NFR-06)."""
    # ponytail: 최근 대화 20개만 하나씩 확인. 대화가 많아지면 멈춤 목록을 DB에 따로 둔다
    threads = conn.execute(
        "SELECT id FROM threads WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
        (user_id, PENDING_THREADS_LIMIT),
    ).fetchall()
    result = []
    for thread in threads:
        for waiting in request.app.state.graph.get_state(graph_config(thread["id"])).interrupts:
            result.append({"thread_id": thread["id"], "interrupt_id": waiting.id, **waiting.value})
    return result
