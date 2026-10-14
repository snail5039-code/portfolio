"""예약·조건부·분할 주문 (3-2, 3-3). 앱이 1분마다 목록을 받아 조건(가격·시각)을 확인하고,
조건이 되면 trigger로 "이번에 주문한다"를 한 번만 잡은 뒤 일반 주문 흐름으로 주문한다."""

from fastapi import APIRouter, HTTPException

from app.agents.query import SIDE_LABELS
from app.db import Conn, audit
from app.notify import notify
from app.routers.auth import UserId

router = APIRouter(prefix="/api/reservations", tags=["reservations"])


def expire_old(conn, user_id) -> None:
    conn.execute("UPDATE reservations SET status = 'expired' WHERE user_id = %s AND status = 'active' AND expires_at < now()",
                 (user_id,))


@router.get("")
def list_reservations(conn: Conn, user_id: UserId) -> list[dict]:
    """기다리는 예약 (만료된 것은 여기서 정리한다)"""
    expire_old(conn, user_id)
    conn.commit()
    return conn.execute(
        "SELECT r.id, r.stock_code, s.name AS stock_name, r.side, r.qty, r.kind, r.trigger_price, r.direction, r.due_at,"
        " r.expires_at, r.created_at FROM reservations r JOIN stocks s ON s.code = r.stock_code"
        " WHERE r.user_id = %s AND r.status = 'active' ORDER BY COALESCE(r.due_at, r.created_at), r.created_at",
        (user_id,),
    ).fetchall()


@router.delete("/{reservation_id}", status_code=204)
def cancel_reservation(reservation_id: str, conn: Conn, user_id: UserId) -> None:
    row = conn.execute("UPDATE reservations SET status = 'cancelled' WHERE id::text = %s AND user_id = %s AND status = 'active'"
                       " RETURNING id", (reservation_id, user_id)).fetchone()
    if row is None:
        raise HTTPException(404, "기다리는 예약이 아니에요")
    audit(conn, user_id, "reservation_cancelled", {"reservation_id": reservation_id})
    conn.commit()


@router.post("/{reservation_id}/trigger")
def trigger_reservation(reservation_id: str, conn: Conn, user_id: UserId) -> dict:
    """조건이 됐다: active → triggered를 한 번만 바꾼다 (폰이 두 번 불러도 주문은 한 번). 이미 처리됐으면 409"""
    row = conn.execute(
        "UPDATE reservations r SET status = 'triggered', triggered_at = now() FROM stocks s"
        " WHERE r.id::text = %s AND r.user_id = %s AND r.status = 'active' AND r.expires_at >= now() AND s.code = r.stock_code"
        " RETURNING r.id, s.name AS stock_name, r.side, r.qty",
        (reservation_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(409, "이미 처리됐거나 만료된 예약이에요")
    audit(conn, user_id, "reservation_triggered", {"reservation_id": reservation_id})
    notify(conn, user_id, "reservation", "예약 조건이 됐어요",
           f"{row['stock_name']} {row['qty']:,}주 {SIDE_LABELS[row['side']]}: 검증을 거쳐 처리안을 만들어요",
           {"reservation_id": reservation_id})
    conn.commit()
    return {"stock_name": row["stock_name"], "side": row["side"], "qty": row["qty"]}
