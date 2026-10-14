"""체결 갱신: KIS 주문은 "접수"로 먼저 기록되고 체결은 나중에 일어난다.

폰이 열릴 때·대화를 보낼 때 아직 체결이 끝나지 않은 오늘 주문을 받아(GET /api/orders/open),
증권사 주문 내역에서 체결 수량·평균가를 확인해 올린다(POST /api/orders/fills). 계좌번호는 오가지 않는다.
증권사 주문 내역 조회는 오늘 것만 되므로 오늘(한국 시각) 주문만 다룬다.
"""

from fastapi import APIRouter
from pydantic import Field, model_validator

from app.agents.interrupts import MAX_KRW, Strict
from app.agents.query import SIDE_LABELS
from app.db import Conn, audit
from app.functions.orders import TODAY_ORDERED_SQL
from app.notify import notify
from app.routers.auth import UserId

router = APIRouter(prefix="/api/orders", tags=["orders"])

OPEN_STATUSES = ("accepted", "partially_filled", "unknown_checked")


class Fill(Strict):
    idempotency_key: str = Field(max_length=100)
    filled_qty: int = Field(ge=0)
    filled_price: int | None = Field(default=None, gt=0, le=MAX_KRW)

    @model_validator(mode="after")
    def check_price(self) -> "Fill":
        if self.filled_qty > 0 and self.filled_price is None:
            raise ValueError("체결 수량이 있으면 filled_price가 필요해요")
        return self


class Fills(Strict):
    fills: list[Fill] = Field(max_length=50)


@router.get("/today")
def today(conn: Conn, user_id: UserId) -> dict:
    """홈의 링: 오늘 주문 금액 / 1일 한도, 규칙에 걸린 요청 없이 지난 날 수 (한국 날짜 기준).

    clean_days: 마지막으로 정책 검사에 걸린 날(없으면 가입한 날)부터 오늘까지의 날 수. 오늘 걸렸으면 0
    """
    used = int(conn.execute(TODAY_ORDERED_SQL, (user_id,)).fetchone()["total"])
    row = conn.execute(
        """
        SELECT pol.max_daily_krw,
               current_date - COALESCE(
                   (SELECT max(pc.created_at) FROM policy_checks pc JOIN proposals p ON p.id = pc.proposal_id
                    WHERE p.user_id = u.id AND NOT pc.ok), u.created_at)::date AS clean_days
        FROM users u JOIN policies pol ON pol.user_id = u.id WHERE u.id = %s
        """,
        (user_id,),
    ).fetchone()
    return {"daily_used_krw": used, "daily_limit_krw": row["max_daily_krw"], "clean_days": row["clean_days"]}


@router.get("/open")
def open_orders(conn: Conn, user_id: UserId) -> list[dict]:
    return conn.execute(
        """
        SELECT o.idempotency_key, p.stock_code, o.broker_order_no, o.side, o.qty, o.filled_qty
        FROM orders o JOIN approvals a ON a.id = o.approval_id JOIN proposals p ON p.id = a.proposal_id
        WHERE p.user_id = %s AND o.kind <> 'cancel' AND o.status = ANY(%s) AND o.broker_order_no IS NOT NULL
          AND o.created_at >= date_trunc('day', now())
        ORDER BY o.created_at
        """,
        (user_id, list(OPEN_STATUSES)),
    ).fetchall()


@router.post("/fills")
def post_fills(body: Fills, conn: Conn, user_id: UserId) -> dict:
    """체결 수량은 줄어들 수 없고 주문 수량을 넘을 수 없다. 이 사용자의 아직 열린 주문만 바꾼다."""
    updated = []
    for fill in body.fills:
        row = conn.execute(
            """
            UPDATE orders o SET
                filled_qty = %(qty)s,
                filled_price = COALESCE(%(price)s, o.filled_price),
                status = CASE WHEN %(qty)s = o.qty THEN 'filled' WHEN %(qty)s > 0 THEN 'partially_filled' ELSE o.status END,
                checked_at = now()
            FROM approvals a JOIN proposals p ON p.id = a.proposal_id
            WHERE o.approval_id = a.id AND p.user_id = %(user_id)s AND o.idempotency_key = %(key)s
              AND o.status = ANY(%(open)s) AND %(qty)s BETWEEN o.filled_qty AND o.qty
            RETURNING o.idempotency_key, o.status, o.filled_qty, o.filled_price
            """,
            {"qty": fill.filled_qty, "price": fill.filled_price, "user_id": user_id, "key": fill.idempotency_key,
             "open": list(OPEN_STATUSES)},
        ).fetchone()
        if row:
            updated.append(row)
            audit(conn, user_id, "order_fill", dict(row))
            if row["status"] == "filled":
                name = conn.execute("SELECT s.name, o.side FROM orders o JOIN approvals a ON a.id = o.approval_id"
                                    " JOIN proposals p ON p.id = a.proposal_id JOIN stocks s ON s.code = p.stock_code"
                                    " WHERE o.idempotency_key = %s", (fill.idempotency_key,)).fetchone()
                notify(conn, user_id, "filled", "체결됐어요 (모의투자)",
                       f"{name['name']} {row['filled_qty']:,}주 {SIDE_LABELS[name['side']]} · 평균 {row['filled_price']:,}원")
    conn.commit()
    return {"updated": updated}
