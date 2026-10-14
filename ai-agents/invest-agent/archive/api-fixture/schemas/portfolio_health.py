from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

HealthStatus = Literal["확인 필요", "차단", "완료"]
HealthGroupKey = Literal["policy", "source", "risk", "approval", "strategy", "stress", "complete"]
HealthLinkPage = Literal["policy", "data", "risks", "approvals", "rebalance", "stress", "weekly"]


class HealthGroup(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: HealthGroupKey
    label: str
    score: int
    status: HealthStatus
    summary: str


class HealthCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    group: HealthGroupKey
    title: str
    status: HealthStatus
    impact: Literal["높음", "보통", "낮음"]
    next: str
    linkPage: HealthLinkPage
    basis: str
    summary: str
    data: str
    risk: str


class PortfolioHealthData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    groups: list[HealthGroup] = Field(min_length=1)
    checks: list[HealthCheck] = Field(min_length=1)
    # Computed server-side from `checks` (see build_portfolio_health_data) so
    # the frontend does not need its own copy of the scoring formula.
    overallScore: int
    safetyCopy: str


class PortfolioHealthEnvelope(FixtureEnvelope):
    data: PortfolioHealthData
