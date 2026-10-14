from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

AgentRoleState = Literal["대기", "승인 필요", "실패 이력"]
AgentRoleStatusLinkPage = Literal["decisionReview", "audit", "taxFee", "approvals"]


class AgentRoleStatusItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    role: str
    status: AgentRoleState
    badge: str
    task: str
    wait: str
    approval: bool
    history: str
    decision: str
    summary: str
    conflict: str
    linkPage: AgentRoleStatusLinkPage
    linkLabel: str


class AgentRoleStatusData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    safetyCopy: str
    roles: list[AgentRoleStatusItem] = Field(min_length=1)


class AgentRoleStatusEnvelope(FixtureEnvelope):
    data: AgentRoleStatusData
