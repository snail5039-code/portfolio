from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

TaxFeeStatus = Literal["영향 작음", "재검토", "보류 권장"]
TaxFeeOrderLinkPage = Literal["approvals", "policy", "rebalance", "data"]


class TaxFeeOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    ticker: str
    side: Literal["매수", "매도"]
    market: str
    currency: str
    gross: int
    fee: int
    tax: int
    slippage: int
    fx: int
    status: TaxFeeStatus
    basis: str
    period: str
    assumption: str
    summary: str
    next: str
    linkPage: TaxFeeOrderLinkPage


class TaxFeeImpactData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    safetyCopy: str
    orders: list[TaxFeeOrder] = Field(min_length=1)


class TaxFeeImpactEnvelope(FixtureEnvelope):
    data: TaxFeeImpactData
