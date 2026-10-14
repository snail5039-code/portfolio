"""아침 브리핑 보기 (app/briefing.py가 만든 것). 그 사용자 것만 보여준다."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.briefing import build_briefing
from app.clock import KST
from app.db import Conn
from app.routers.auth import UserId

router = APIRouter(prefix="/api/briefings", tags=["briefings"])


@router.get("/latest")
def latest(conn: Conn, user_id: UserId, kind: Literal["morning", "close"] = "morning") -> dict:
    """가장 최근 아침 브리핑(morning) 또는 장 마감 요약(close)."""
    row = conn.execute(
        "SELECT id, brief_date, kind, content, created_at FROM briefings WHERE user_id = %s AND kind = %s"
        " ORDER BY brief_date DESC LIMIT 1",
        (user_id, kind),
    ).fetchone()
    if row is None:
        raise HTTPException(404, "아직 아침 브리핑이 없어요" if kind == "morning" else "아직 장 마감 요약이 없어요")
    return row


# 장중 브리핑 다시 만들기 간격 (Gemini 비용). 앱이 매시·14:35에 다시 찾는데 60분이면 59분 차이로 거절됐다 (2026-10-14)
REFRESH_GAP_MINUTES = 30


class RefreshBody(BaseModel):
    """폰이 증권사 순위(거래대금·상승률 상위)에서 받은 종목 코드. 분석 대상 종목만 후보가 된다"""

    model_config = ConfigDict(extra="forbid")
    candidates: list[str] = Field(default=[], max_length=30)


@router.post("/refresh")
def refresh(request: Request, conn: Conn, user_id: UserId, body: RefreshBody | None = None) -> dict:
    """장중 매수 후보 다시 찾기 (2026-10-12): 이 사용자의 오늘 아침 브리핑을 지금 자료로 다시 만든다 (덮어씀).
    자동매매가 켜진 앱이 정해진 시각에 부른다. 한 시간에 한 번까지만 (Gemini 비용)"""
    last = conn.execute(
        "SELECT created_at FROM briefings WHERE user_id = %s AND kind = 'morning' AND brief_date = %s",
        (user_id, datetime.now(KST).date()),
    ).fetchone()
    if last and datetime.now(KST) - last["created_at"] < timedelta(minutes=REFRESH_GAP_MINUTES):
        raise HTTPException(429, f"브리핑은 {REFRESH_GAP_MINUTES}분에 한 번만 다시 만들 수 있어요")
    build_briefing(request.app.state.database_url, str(user_id), movers=[c for c in (body.candidates if body else []) if c.isalnum()])
    return latest(conn, user_id)
