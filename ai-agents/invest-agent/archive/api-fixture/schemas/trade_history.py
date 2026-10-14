from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

TradeStatus = Literal["모의승인", "반려", "정책 차단", "만료", "대기"]
TradeRelatedLinkPage = Literal["audit", "policy", "weekly"]


class TradeHistoryItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    days: int
    occurredAt: str
    name: str
    ticker: str
    side: Literal["매수", "매도"]
    # qty/price/amount/fee/tax/slippage stay pre-formatted display strings
    # (e.g. "지정가 71,200원", "약 107원", "0.10% 가정") rather than raw
    # numbers — the source values carry hedge words ("약", "가정", "해당 없음")
    # that aren't a number-plus-unit pair, so decomposing them would invent
    # a numeric contract this screen's content was never written to support.
    qty: str
    price: str
    amount: str
    status: TradeStatus
    summary: str
    fee: str
    tax: str
    slippage: str
    policyResult: str
    sourceState: str


class TradeRelatedLink(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    page: TradeRelatedLinkPage | None
    disabled: bool = False


class TradeHistoryData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TradeHistoryItem] = Field(min_length=1)
    relatedLinks: list[TradeRelatedLink]
    safetyCopy: str


class TradeHistoryEnvelope(FixtureEnvelope):
    data: TradeHistoryData
