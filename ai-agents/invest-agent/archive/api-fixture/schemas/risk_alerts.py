from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

RiskCategory = Literal["정책", "출처", "시장", "승인", "데이터"]
RiskSeverity = Literal["중대", "높음", "보통", "낮음"]
RiskEventLinkPage = Literal["data", "policy", "trades"]


class RiskEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    occurredAt: str
    title: str
    decisionRef: str
    category: RiskCategory
    severity: RiskSeverity
    status: str
    summary: str
    cause: str
    action: str
    policy: str
    linkPage: RiskEventLinkPage | None
    linkText: str


class RiskAlertsData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[RiskEvent] = Field(min_length=1)
    safetyCopy: str


class RiskAlertsEnvelope(FixtureEnvelope):
    data: RiskAlertsData
