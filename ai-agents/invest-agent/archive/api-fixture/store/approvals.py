import sqlite3
import threading
from typing import Literal

from app.clock import now_kst_iso
from app.fixtures.approvals import build_approval_orders
from app.schemas.approvals import ApprovalOrder


class DecisionConflictError(Exception):
    """Raised when approve/reject targets an order that already left 'pending'."""

    def __init__(self, order: ApprovalOrder) -> None:
        self.order = order
        super().__init__(f"{order.id} is already {order.decisionStatus}")


class ApprovalStore:
    """Pending/approved/rejected state for the demo orders, backed by SQLite.

    The four orders' facts (company, price, quantity, ...) always come fresh
    from `build_approval_orders()` — this class only persists the one thing
    that changes: which decision_id was approved/rejected, and when. That's
    also why a restart doesn't need to re-seed anything: any decision_id with
    no row in `approval_decisions` is still "pending" by construction.

    `db_path=":memory:"` (the default, and what every test's bare
    `create_app()` gets) keeps each store fully isolated and non-persistent —
    exactly the old in-memory dict's behavior. `app/main.py` passes a real
    file path so a restart of the actual app keeps approval history.
    """

    def __init__(self, db_path: str = ":memory:") -> None:
        self._orders: dict[str, ApprovalOrder] = {
            order.id: order for order in build_approval_orders()
        }
        self._lock = threading.Lock()
        # FastAPI runs sync path functions in a threadpool, so a request can
        # land on a different thread than __init__ ran on; check_same_thread
        # would reject that. `_lock` serializes actual access instead.
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS approval_decisions ("
            "decision_id TEXT PRIMARY KEY, status TEXT NOT NULL, decided_at TEXT NOT NULL, "
            "kis_order_no TEXT)"
        )
        self._conn.commit()

    def _with_decision(self, order: ApprovalOrder, row: tuple[str, str, str | None] | None) -> ApprovalOrder:
        if row is None:
            return order
        status, decided_at, kis_order_no = row
        return order.model_copy(update={"decisionStatus": status, "decidedAt": decided_at, "kisOrderNo": kis_order_no})

    def list(self) -> list[ApprovalOrder]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT decision_id, status, decided_at, kis_order_no FROM approval_decisions"
            ).fetchall()
        overrides = {decision_id: (status, decided_at, kis_order_no) for decision_id, status, decided_at, kis_order_no in rows}
        return [self._with_decision(order, overrides.get(order.id)) for order in self._orders.values()]

    def get(self, decision_id: str) -> ApprovalOrder | None:
        order = self._orders.get(decision_id)
        if order is None:
            return None
        with self._lock:
            row = self._conn.execute(
                "SELECT status, decided_at, kis_order_no FROM approval_decisions WHERE decision_id = ?",
                (decision_id,),
            ).fetchone()
        return self._with_decision(order, row)

    def decide(
        self,
        decision_id: str,
        status: Literal["approved", "rejected"],
        kis_order_no: str | None = None,
    ) -> ApprovalOrder:
        order = self._orders.get(decision_id)
        if order is None:
            raise KeyError(decision_id)

        with self._lock:
            row = self._conn.execute(
                "SELECT status, decided_at, kis_order_no FROM approval_decisions WHERE decision_id = ?",
                (decision_id,),
            ).fetchone()
            current = self._with_decision(order, row)
            if current.decisionStatus != "pending":
                raise DecisionConflictError(current)

            decided_at = now_kst_iso()
            self._conn.execute(
                "INSERT INTO approval_decisions (decision_id, status, decided_at, kis_order_no) "
                "VALUES (?, ?, ?, ?) "
                "ON CONFLICT(decision_id) DO UPDATE SET status = excluded.status, "
                "decided_at = excluded.decided_at, kis_order_no = excluded.kis_order_no",
                (decision_id, status, decided_at, kis_order_no),
            )
            self._conn.commit()

        return current.model_copy(update={"decisionStatus": status, "decidedAt": decided_at, "kisOrderNo": kis_order_no})
