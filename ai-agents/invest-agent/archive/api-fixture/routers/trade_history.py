from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.trade_history import (
    TRADE_HISTORY_DATA_AS_OF,
    TRADE_HISTORY_DISCLAIMER,
    TRADE_HISTORY_SOURCE_LABEL,
    build_trade_history_data,
)
from app.schemas.trade_history import TradeHistoryEnvelope

router = APIRouter(prefix="/api", tags=["trade-history"])


@router.get("/trade-history", response_model=TradeHistoryEnvelope)
def get_trade_history() -> TradeHistoryEnvelope:
    return TradeHistoryEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=TRADE_HISTORY_DATA_AS_OF,
        sourceLabel=TRADE_HISTORY_SOURCE_LABEL,
        disclaimer=TRADE_HISTORY_DISCLAIMER,
        data=build_trade_history_data(),
    )
