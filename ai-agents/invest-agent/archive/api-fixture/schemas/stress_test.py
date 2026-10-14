from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

StressScenarioKey = Literal["rates", "chips", "fx", "liquidity"]
StressAssetKey = Literal["cash", "market", "samsung", "sk", "naver"]


class StressAsset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: StressAssetKey
    name: str
    ticker: str
    weight: float


class StressScenario(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    description: str
    loss: float
    drawdown: float
    cash: str
    alerts: int
    shock: dict[StressAssetKey, float]
    assumption: str
    weak: str
    policy: str
    responses: list[str]


class StressAssetImpact(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: StressAssetKey
    name: str
    ticker: str
    weight: float
    shock: float
    contribution: float
    state: Literal["높음", "주의", "관리"]


class StressTestData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    safetyCopy: str
    baseAmount: int
    assets: list[StressAsset] = Field(min_length=1)
    scenarios: dict[StressScenarioKey, StressScenario]
    # Precomputed per scenario — the frontend used to call
    # getStressRows(scenario); that formula now runs once here for all four.
    rowsByScenario: dict[StressScenarioKey, list[StressAssetImpact]]


class StressTestEnvelope(FixtureEnvelope):
    data: StressTestData
