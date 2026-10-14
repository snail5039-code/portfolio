"""알림 (2-1): 폰이 FCM 토큰을 등록하고, 앱이 알림 목록을 본다. Firebase가 없어도 목록은 쌓인다."""

from typing import Literal

from fastapi import APIRouter
from pydantic import Field

from app.agents.interrupts import Strict
from app.db import Conn
from app.routers.auth import UserId

router = APIRouter(prefix="/api", tags=["notifications"])


class Device(Strict):
    token: str = Field(min_length=10, max_length=4096)
    platform: Literal["android", "ios"]


@router.put("/devices", status_code=204)
def register_device(body: Device, conn: Conn, user_id: UserId) -> None:
    """같은 토큰이 다른 계정에 있었으면 지금 계정으로 옮긴다 (폰 하나에서 계정을 바꿔 로그인한 경우)"""
    conn.execute(
        "INSERT INTO devices (token, user_id, platform) VALUES (%s, %s, %s)"
        " ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, seen_at = now()",
        (body.token, user_id, body.platform),
    )
    conn.commit()


@router.get("/notifications")
def list_notifications(conn: Conn, user_id: UserId) -> list[dict]:
    return conn.execute(
        "SELECT id, kind, title, body, data, created_at, sent_at IS NOT NULL AS pushed FROM notifications"
        " WHERE user_id = %s ORDER BY created_at DESC, id DESC LIMIT 50",
        (user_id,),
    ).fetchall()
