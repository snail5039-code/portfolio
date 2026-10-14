from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

BacktestStrategyKey = Literal["conservative", "balanced", "aggressive"]
BacktestPeriodKey = Literal["3m", "6m", "1y"]


class BacktestConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str


class BacktestPeriod(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    range: str


class BacktestMetrics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ret: float
    bench: float
    dd: float
    vol: float
    win: int


class BacktestRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    month: str
    portfolio: float
    benchmark: float
    excess: float
    drawdown: float
    state: Literal["초과", "미달"]


class BacktestSummaryData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    safetyCopy: str
    configs: dict[BacktestStrategyKey, BacktestConfig]
    periods: dict[BacktestPeriodKey, BacktestPeriod]
    # Precomputed for every (strategy, period) combination — the frontend used
    # to call getBacktestMetrics()/getBacktestRows() with the current
    # selection; the same formula now runs once here for all nine combos.
    metrics: dict[BacktestStrategyKey, dict[BacktestPeriodKey, BacktestMetrics]]
    rows: dict[BacktestStrategyKey, dict[BacktestPeriodKey, list[BacktestRow]]] = Field(min_length=1)


class BacktestSummaryEnvelope(FixtureEnvelope):
    data: BacktestSummaryData
