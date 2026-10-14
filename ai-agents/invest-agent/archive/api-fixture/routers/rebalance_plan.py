from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.rebalance_plan import (
    REBALANCE_PLAN_DATA_AS_OF,
    REBALANCE_PLAN_DISCLAIMER,
    REBALANCE_PLAN_SOURCE_LABEL,
    build_rebalance_plan_data,
)
from app.schemas.rebalance_plan import RebalancePlanEnvelope

router = APIRouter(prefix="/api", tags=["rebalance-plan"])


@router.get("/rebalance-plan", response_model=RebalancePlanEnvelope)
def get_rebalance_plan() -> RebalancePlanEnvelope:
    return RebalancePlanEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=REBALANCE_PLAN_DATA_AS_OF,
        sourceLabel=REBALANCE_PLAN_SOURCE_LABEL,
        disclaimer=REBALANCE_PLAN_DISCLAIMER,
        data=build_rebalance_plan_data(),
    )
