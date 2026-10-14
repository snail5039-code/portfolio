from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope, Tone

# The three agent screens are stage views of one pipeline (분석 → 검증 → 실행),
# so they share this shape and differ only in fixture content.
#
# Nothing here describes a real agent run. `executionGrade` never reaches
# "자동 실행" in the fixtures: the execution stage is always held at a grade that
# requires the user, and `executed` on the envelope is always false.

AgentStage = Literal["analysis", "verification", "execution"]

ExecutionGrade = Literal["자동 실행", "간편 승인", "강화 승인", "실행 금지"]

AgentWorkItemLinkPage = Literal["evidence", "company", "taxFee", "approvals", "decisionReview", "compare", "audit"]


class AgentMetric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    value: str
    tone: Tone = "neutral"


class AgentCapability(BaseModel):
    """One thing the agent would do if it were connected to anything.

    `connected` is false everywhere in the fixtures. The screen renders it as a
    미연결 state so the capability list cannot be read as a live integration.
    """

    model_config = ConfigDict(extra="forbid")

    label: str
    detail: str
    connected: Literal[False] = False


class AgentWorkField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    value: str


class AgentWorkItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    subtitle: str
    decisionId: str
    action: str
    status: str
    statusTone: Tone
    userApprovalRequired: bool
    fields: list[AgentWorkField]
    notes: list[str]
    summary: str
    linkPage: AgentWorkItemLinkPage
    linkLabel: str


class AgentStageStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: AgentStage
    label: str
    state: Literal["done", "current", "waiting", "blocked"]
    detail: str


class AgentScreenData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: AgentStage
    title: str
    agentName: str
    roleSummary: str
    status: str
    statusTone: Tone
    executionGrade: ExecutionGrade | None = None
    pipeline: list[AgentStageStep] = Field(min_length=3)
    metrics: list[AgentMetric] = Field(min_length=1)
    capabilities: list[AgentCapability] = Field(min_length=1)
    items: list[AgentWorkItem] = Field(min_length=1)
    safetyCopy: str


class AgentScreenEnvelope(FixtureEnvelope):
    data: AgentScreenData
