from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.clock import now_kst_iso
from app.config import KIS_PAPER_ACNT_PRDT_CD, KIS_PAPER_APP_KEY, KIS_PAPER_APP_SECRET, KIS_PAPER_CANO
from app.fixtures.approvals import (
    APPROVALS_DATA_AS_OF,
    APPROVALS_DISCLAIMER,
    APPROVALS_DISCLAIMER_WITH_LIVE_ORDERS,
    APPROVALS_SOURCE_LABEL,
)
from app.integrations import kis
from app.schemas.approvals import ApprovalActionEnvelope, ApprovalOrder, ApprovalsData, ApprovalsEnvelope
from app.store.approvals import ApprovalStore, DecisionConflictError

router = APIRouter(prefix="/api", tags=["approvals"])

_SIDE_TO_KIS: dict[str, Literal["buy", "sell"]] = {"매수": "buy", "매도": "sell"}


def _store(request: Request) -> ApprovalStore:
    return request.app.state.approval_store


def _kis_configured() -> bool:
    return bool(KIS_PAPER_APP_KEY and KIS_PAPER_APP_SECRET and KIS_PAPER_CANO and KIS_PAPER_ACNT_PRDT_CD)


@router.get("/approvals", response_model=ApprovalsEnvelope)
def list_approvals(request: Request) -> ApprovalsEnvelope:
    orders = _store(request).list()
    # "Live" here means at least one listed order actually went to KIS in the
    # past (it carries a real order number) — not merely that credentials
    # are configured but have never been used yet.
    live = any(order.kisOrderNo for order in orders)
    return ApprovalsEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=APPROVALS_DATA_AS_OF,
        sourceLabel=APPROVALS_SOURCE_LABEL,
        disclaimer=APPROVALS_DISCLAIMER_WITH_LIVE_ORDERS if live else APPROVALS_DISCLAIMER,
        externalConnections=1 if live else 0,
        data=ApprovalsData(orders=orders),
    )


async def _place_kis_order_if_configured(order: ApprovalOrder) -> str | None:
    """Places a real limit order against KIS's own 모의투자(paper trading)
    account when credentials are configured. Returns KIS's order number, or
    `None` if KIS isn't configured (unchanged, purely-local approve).

    Raises `HTTPException` rather than silently falling back on a KIS error:
    once credentials are configured, "approve" means "actually submit this
    order to KIS", so a failed submission must not be reported as a
    successful approval.
    """
    if not _kis_configured():
        return None

    try:
        result = await kis.place_paper_order(
            KIS_PAPER_APP_KEY,
            KIS_PAPER_APP_SECRET,
            KIS_PAPER_CANO,
            KIS_PAPER_ACNT_PRDT_CD,
            stock_code=order.code,
            side=_SIDE_TO_KIS[order.side],
            quantity=order.quantity,
            price=order.price,
        )
    except (kis.KisApiError, httpx.HTTPError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"KIS 모의투자 서버로 주문을 전송하지 못해 승인을 완료하지 못했습니다: {exc}",
        ) from exc

    order_no = result.get("ODNO")
    if not order_no:
        raise HTTPException(
            status_code=502,
            detail="KIS 모의투자 주문 응답에 주문번호가 없어 승인을 완료하지 못했습니다.",
        )
    return order_no


async def _decide(request: Request, decision_id: str, status: Literal["approved", "rejected"]) -> ApprovalActionEnvelope:
    store = _store(request)
    order = store.get(decision_id)
    if order is None:
        raise HTTPException(status_code=404, detail=f"unknown decision id: {decision_id}")
    if order.decisionStatus != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"{decision_id}은(는) 이미 {order.decisionStatus} 상태라 다시 결정할 수 없습니다.",
        )

    # Only "approve" ever places an order — rejecting never talks to KIS.
    kis_order_no = await _place_kis_order_if_configured(order) if status == "approved" else None

    try:
        updated = store.decide(decision_id, status, kis_order_no=kis_order_no)
    except DecisionConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail=f"{decision_id}은(는) 이미 {exc.order.decisionStatus} 상태라 다시 결정할 수 없습니다.",
        ) from exc

    return ApprovalActionEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=APPROVALS_DATA_AS_OF,
        sourceLabel=APPROVALS_SOURCE_LABEL,
        disclaimer=APPROVALS_DISCLAIMER_WITH_LIVE_ORDERS if updated.kisOrderNo else APPROVALS_DISCLAIMER,
        externalConnections=1 if updated.kisOrderNo else 0,
        data=updated,
    )


@router.post("/approvals/{decision_id}/approve", response_model=ApprovalActionEnvelope)
async def approve_order(decision_id: str, request: Request) -> ApprovalActionEnvelope:
    """Approve a local demo order. When KIS 모의투자 credentials are configured
    (see app/config.py), this also places a real limit order against KIS's
    own paper-trading account and records its order number — that order
    fills against a virtual balance KIS itself manages, so no real order is
    ever created and no real money ever moves, with or without KIS configured.
    """
    return await _decide(request, decision_id, "approved")


@router.post("/approvals/{decision_id}/reject", response_model=ApprovalActionEnvelope)
async def reject_order(decision_id: str, request: Request) -> ApprovalActionEnvelope:
    """Mark a local demo order rejected. This only changes local demo state —
    rejecting never places an order, on KIS or anywhere else."""
    return await _decide(request, decision_id, "rejected")
