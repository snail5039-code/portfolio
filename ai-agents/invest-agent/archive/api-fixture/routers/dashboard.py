import logging

import httpx
from fastapi import APIRouter, Request

from app.clock import now_kst_iso
from app.config import KIS_PAPER_ACNT_PRDT_CD, KIS_PAPER_APP_KEY, KIS_PAPER_APP_SECRET, KIS_PAPER_CANO
from app.fixtures.dashboard import (
    DASHBOARD_DATA_AS_OF,
    DASHBOARD_DISCLAIMER,
    DASHBOARD_DISCLAIMER_WITH_LIVE_HOLDINGS,
    DASHBOARD_SOURCE_LABEL,
    build_dashboard_data,
)
from app.fixtures.decisions import DEC_1042
from app.integrations import kis
from app.schemas.dashboard import DashboardData, DashboardEnvelope, DashboardHolding

router = APIRouter(prefix="/api", tags=["dashboard"])

logger = logging.getLogger(__name__)


def _holding_from_kis(row: dict, total_valuation: float) -> DashboardHolding:
    quantity = int(row.get("hldg_qty", "0") or "0")
    value = int(row.get("evlu_amt", "0") or "0")
    weight = round(value / total_valuation * 100, 2) if total_valuation else 0.0
    return DashboardHolding(
        name=row.get("prdt_name") or row.get("pdno", ""),
        code=row.get("pdno", ""),
        quantity=quantity,
        averagePrice=int(float(row.get("pchs_avg_pric", "0") or "0")),
        currentPrice=int(row.get("prpr", "0") or "0"),
        value=value,
        profit=int(row.get("evlu_pfls_amt", "0") or "0"),
        profitRate=round(float(row.get("evlu_pfls_rt", "0") or "0"), 2),
        weight=weight,
        # KIS returns raw position data only, no AI commentary — this app's
        # own analysis agent never ran against a live position, so we say so
        # plainly instead of inventing a status/tone the fixture rows carry.
        status="실시간 연동 · AI 분석 없음",
        tone="info",
    )


async def _with_live_holdings(data: DashboardData) -> DashboardData:
    if not (KIS_PAPER_APP_KEY and KIS_PAPER_APP_SECRET and KIS_PAPER_CANO and KIS_PAPER_ACNT_PRDT_CD):
        return data

    try:
        holdings, summary = await kis.get_balance(
            KIS_PAPER_APP_KEY, KIS_PAPER_APP_SECRET, KIS_PAPER_CANO, KIS_PAPER_ACNT_PRDT_CD
        )
    except (kis.KisApiError, httpx.HTTPError):
        logger.warning("KIS 모의투자 잔고조회 실패; fixture 보유종목으로 폴백", exc_info=True)
        return data

    if not holdings:
        return data

    total_valuation = float(summary.get("tot_evlu_amt", "0") or "0")
    return data.model_copy(
        update={
            "holdings": [_holding_from_kis(row, total_valuation) for row in holdings],
            "holdingsConnected": True,
        }
    )


@router.get("/dashboard", response_model=DashboardEnvelope)
async def get_dashboard(request: Request) -> DashboardEnvelope:
    """Return the local dashboard fixture.

    `holdings` is overlaid with a live KIS 모의투자(paper trading) balance
    when `KIS_PAPER_*` is configured (see app/integrations/kis.py) — no real
    money moves either way, since KIS's own paper account is virtual.
    Everything else (chart, AI decision panel) stays fixture.

    The featured decision (DEC-1042) reads its live pending/approved/rejected
    state from the same approval store the approvals queue writes to, so
    approving it from either screen is reflected on both immediately.
    """
    order = request.app.state.approval_store.get(DEC_1042.id)
    decision_status = order.decisionStatus if order is not None else "pending"
    decided_at = order.decidedAt if order is not None else None
    kis_order_no = order.kisOrderNo if order is not None else None

    data = await _with_live_holdings(
        build_dashboard_data(decision_status=decision_status, decided_at=decided_at, kis_order_no=kis_order_no)
    )

    live = data.holdingsConnected or bool(data.decision.kisOrderNo)
    return DashboardEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=DASHBOARD_DATA_AS_OF,
        sourceLabel=DASHBOARD_SOURCE_LABEL,
        disclaimer=DASHBOARD_DISCLAIMER_WITH_LIVE_HOLDINGS if live else DASHBOARD_DISCLAIMER,
        externalConnections=1 if live else 0,
        data=data,
    )
