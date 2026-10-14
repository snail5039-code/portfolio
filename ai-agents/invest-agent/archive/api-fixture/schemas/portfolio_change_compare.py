from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

PolicyType = Literal["pass", "check", "block"]


class PortfolioChangeAsset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    ticker: str
    currentWeight: float
    nextWeight: float
    amountChange: int
    policyLabel: str
    policyType: PolicyType
    riskLabel: str
    policyCheck: str
    sourceState: str
    direction: Literal["up", "down"]
    summary: str


class PortfolioChangeStats(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cashChange: str
    riskChange: str
    maxDrawdownChange: str
    sectorConcentrationChange: str
    approvalState: str


class PortfolioChangeCompareData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    summary: str
    baseAmount: int
    safetyCopy: str
    stats: PortfolioChangeStats
    assets: list[PortfolioChangeAsset] = Field(min_length=1)


class PortfolioChangeCompareEnvelope(FixtureEnvelope):
    data: PortfolioChangeCompareData
