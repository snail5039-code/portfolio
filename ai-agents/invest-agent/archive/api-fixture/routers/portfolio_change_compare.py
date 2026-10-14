from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.portfolio_change_compare import (
    PORTFOLIO_CHANGE_COMPARE_DATA_AS_OF,
    PORTFOLIO_CHANGE_COMPARE_DISCLAIMER,
    PORTFOLIO_CHANGE_COMPARE_SOURCE_LABEL,
    build_portfolio_change_compare_data,
)
from app.schemas.portfolio_change_compare import PortfolioChangeCompareEnvelope

router = APIRouter(prefix="/api", tags=["portfolio-change-compare"])


@router.get("/portfolio-change-compare", response_model=PortfolioChangeCompareEnvelope)
def get_portfolio_change_compare() -> PortfolioChangeCompareEnvelope:
    return PortfolioChangeCompareEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=PORTFOLIO_CHANGE_COMPARE_DATA_AS_OF,
        sourceLabel=PORTFOLIO_CHANGE_COMPARE_SOURCE_LABEL,
        disclaimer=PORTFOLIO_CHANGE_COMPARE_DISCLAIMER,
        data=build_portfolio_change_compare_data(),
    )
