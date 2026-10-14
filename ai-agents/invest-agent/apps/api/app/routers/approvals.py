"""승인 대기 목록과 처리안 상세 (docs/plan/06-api-spec.md 1장, 화면 S-07·S-08).

승인·실행 자체는 대화 API(POST /api/chat/resume)로 한다. 여기는 보여주기만 한다.
목록의 thread_id로 GET /api/chat/pending에서 멈춤 ID를 찾아 답한다.
"""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.db import Conn
from app.routers.auth import UserId

router = APIRouter(prefix="/api", tags=["approvals"])

# 승인 대기 화면의 세 칸
#   needs_approval  승인을 기다림 (만료 전)
#   needs_execution 승인했지만 아직 폰에서 실행 안 함 (웹에서 승인한 것 포함, FR-30)
#   closed          거절·만료·주문 완료
STATE_SQL = """
    CASE
        WHEN a.status = 'pending' AND a.expires_at > now() THEN 'needs_approval'
        WHEN a.status = 'approved' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.approval_id = a.id) THEN 'needs_execution'
        ELSE 'closed'
    END
"""
SELECT_SQL = f"""
    SELECT a.id AS approval_id, p.thread_id, {STATE_SQL} AS state,
           CASE WHEN a.status = 'pending' AND a.expires_at <= now() THEN 'expired' ELSE a.status END AS status,
           a.card, a.expires_at, a.created_at, a.decided_at, a.decided_channel,
           (SELECT row_to_json(o) FROM (SELECT status, broker_order_no, filled_qty, filled_price, message, created_at
                                        FROM orders WHERE approval_id = a.id ORDER BY created_at LIMIT 1) o) AS order_result
    FROM approvals a JOIN proposals p ON p.id = a.proposal_id
    WHERE p.user_id = %(user_id)s
"""


@router.get("/approvals")
def list_approvals(conn: Conn, user_id: UserId,
                   status: Literal["needs_approval", "needs_execution", "closed"] | None = None) -> list[dict]:
    rows = conn.execute(
        f"SELECT * FROM ({SELECT_SQL}) x WHERE %(state)s::text IS NULL OR state = %(state)s"
        " ORDER BY created_at DESC LIMIT 100",
        {"user_id": user_id, "state": status},
    ).fetchall()
    return rows


@router.get("/approvals/{approval_id}")
def get_approval(approval_id: UUID, conn: Conn, user_id: UserId) -> dict:
    row = conn.execute(SELECT_SQL + " AND a.id = %(approval_id)s", {"user_id": user_id, "approval_id": approval_id}).fetchone()
    if row is None:
        raise HTTPException(404, "처리안을 찾을 수 없어요")
    return row
