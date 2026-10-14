from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

PolicyNumberKey = Literal["maxWeight", "maxOrder", "maxLoss", "minCash", "volatility", "expiry"]
PolicyCheckKey = Literal["limitOrder", "marketOrder", "blockUnknown", "blockCorrection"]


class PolicyNumberRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: PolicyNumberKey
    label: str
    unit: str
    min: float
    max: float
    step: float
    decimals: int
    # Kept as a string, not a number: this is a form default bound directly to
    # a text input and validated as text (decimal-place regex, step alignment
    # on the raw string). Converting it to a number and back would risk
    # dropping a trailing zero (e.g. "8.0" -> 8 -> "8").
    value: str
    help: str


class PolicyCheckRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: PolicyCheckKey
    label: str
    value: bool


class PolicyPreview(BaseModel):
    """Mirrors the DEC-1042 proposal shown by the dashboard and approvals
    queue — its amount/weight come from `app/fixtures/decisions.py` rather
    than a separate literal, so this preview cannot quote different numbers
    for the same decision."""

    model_config = ConfigDict(extra="forbid")

    decisionId: str
    calculation: str
    amount: int
    currentWeight: float
    nextWeight: float
    orderType: str
    sourceState: str


class PolicySettingsData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    safetyCopy: str
    numberRules: list[PolicyNumberRule] = Field(min_length=1)
    checks: list[PolicyCheckRule] = Field(min_length=1)
    preview: PolicyPreview
    # None until the first "가상 정책 적용" — set to that apply's server time
    # afterward, so a restart still shows the persisted values, not silently
    # reverted-looking fixture defaults.
    appliedAt: str | None = None


class PolicySettingsEnvelope(FixtureEnvelope):
    data: PolicySettingsData


class PolicyApplyRequest(BaseModel):
    """Mirrors the frontend's `PolicyValues` shape — one field per number
    rule and check key, all required, so a partial apply can't leave some
    keys silently unset."""

    model_config = ConfigDict(extra="forbid")

    maxWeight: str
    maxOrder: str
    maxLoss: str
    minCash: str
    volatility: str
    expiry: str
    limitOrder: bool
    marketOrder: bool
    blockUnknown: bool
    blockCorrection: bool
