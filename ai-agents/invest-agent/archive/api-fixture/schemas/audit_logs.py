from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope, Tone


class AuditDecisionRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    company: str
    status: str
    runId: str
    tone: Tone
    initial: list[str]
    verified: list[str]
    changed: list[bool]


class AuditStepEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    type: str
    input: str
    result: str
    risk: str


class AuditStages(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analysis: AuditStepEntry
    verification: AuditStepEntry
    approval: AuditStepEntry


class AuditSources(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metrics: AuditStepEntry
    filing: AuditStepEntry
    policy: AuditStepEntry


class AuditLogData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    safetyCopy: str
    labels: list[str]
    decisions: list[AuditDecisionRow] = Field(min_length=1)
    steps: AuditStages
    sources: AuditSources


class AuditLogEnvelope(FixtureEnvelope):
    data: AuditLogData
