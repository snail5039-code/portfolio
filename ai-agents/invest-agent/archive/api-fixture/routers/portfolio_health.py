from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.portfolio_health import (
    PORTFOLIO_HEALTH_DATA_AS_OF,
    PORTFOLIO_HEALTH_DISCLAIMER,
    PORTFOLIO_HEALTH_SOURCE_LABEL,
    build_portfolio_health_data,
)
from app.schemas.portfolio_health import PortfolioHealthEnvelope

router = APIRouter(prefix="/api", tags=["portfolio-health"])


@router.get("/portfolio-health", response_model=PortfolioHealthEnvelope)
def get_portfolio_health() -> PortfolioHealthEnvelope:
    return PortfolioHealthEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=PORTFOLIO_HEALTH_DATA_AS_OF,
        sourceLabel=PORTFOLIO_HEALTH_SOURCE_LABEL,
        disclaimer=PORTFOLIO_HEALTH_DISCLAIMER,
        data=build_portfolio_health_data(),
    )
