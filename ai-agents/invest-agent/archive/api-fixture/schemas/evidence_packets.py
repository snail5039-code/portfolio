from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import DecisionStatus, FixtureEnvelope, Tone

EvidenceStatus = Literal["확인", "주의", "차단"]


class EvidenceChecklistItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    status: EvidenceStatus
    tone: Tone
    summary: str
    detail: str


class EvidenceCalculation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    formula: str
    result: str
    rounding: str


class EvidenceCost(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fee: str
    tax: str
    slippage: str


class EvidenceRisk(BaseModel):
    model_config = ConfigDict(extra="forbid")

    concentration: str
    volatility: str
    invalidCondition: str


class EvidenceRoleCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str
    check: str
    tone: Tone


class EvidencePacket(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    company: str
    code: str
    status: str
    statusTone: Tone
    proposal: str
    quantity: int
    price: int
    amount: int
    targetWeightFrom: float
    targetWeightTo: float
    expiresAt: str
    sourceState: str
    safetyCopy: str
    summary: str
    calculation: EvidenceCalculation
    cost: EvidenceCost
    risk: EvidenceRisk
    roles: list[EvidenceRoleCheck]
    approvalBoundary: str
    items: list[EvidenceChecklistItem]
    # Live state, same store approvals/dashboard read. This packet describes
    # DEC-1042, so it must not show a status that disagrees with the other
    # two screens.
    decisionStatus: DecisionStatus
    decidedAt: str | None = None


class EvidencePacketsData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    packets: list[EvidencePacket] = Field(min_length=1)


class EvidencePacketsEnvelope(FixtureEnvelope):
    data: EvidencePacketsData
