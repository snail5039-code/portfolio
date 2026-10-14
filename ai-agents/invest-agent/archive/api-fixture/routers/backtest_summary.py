from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.backtest_summary import (
    BACKTEST_SUMMARY_DATA_AS_OF,
    BACKTEST_SUMMARY_DISCLAIMER,
    BACKTEST_SUMMARY_SOURCE_LABEL,
    build_backtest_summary_data,
)
from app.schemas.backtest_summary import BacktestSummaryEnvelope

router = APIRouter(prefix="/api", tags=["backtest-summary"])


@router.get("/backtest-summary", response_model=BacktestSummaryEnvelope)
def get_backtest_summary() -> BacktestSummaryEnvelope:
    return BacktestSummaryEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=BACKTEST_SUMMARY_DATA_AS_OF,
        sourceLabel=BACKTEST_SUMMARY_SOURCE_LABEL,
        disclaimer=BACKTEST_SUMMARY_DISCLAIMER,
        data=build_backtest_summary_data(),
    )
