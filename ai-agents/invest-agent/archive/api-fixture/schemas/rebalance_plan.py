from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

RebalanceStrategyKey = Literal["conservative", "balanced", "aggressive"]
RebalanceAssetKey = Literal["cash", "market", "samsung", "sk", "naver"]


class CurrentAllocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: RebalanceAssetKey
    name: str
    ticker: str
    weight: float


class RebalanceStrategy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    expectedReturn: str
    volatility: str
    drawdown: str
    targets: dict[RebalanceAssetKey, float]


class RebalanceProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: RebalanceAssetKey
    name: str
    ticker: str
    weight: float
    target: float
    delta: float
    direction: Literal["비중 확대", "비중 축소"]
    amount: str
    policy: str
    source: str
    effect: str


class RebalancePlanData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    baseAmount: int
    safetyCopy: str
    currentAllocations: list[CurrentAllocation] = Field(min_length=1)
    strategies: dict[RebalanceStrategyKey, RebalanceStrategy]
    # Precomputed per strategy — the frontend used to call a pure function
    # with the current strategy; that computation now happens once here
    # instead of being duplicated client-side.
    proposalsByStrategy: dict[RebalanceStrategyKey, list[RebalanceProposal]]


class RebalancePlanEnvelope(FixtureEnvelope):
    data: RebalancePlanData
