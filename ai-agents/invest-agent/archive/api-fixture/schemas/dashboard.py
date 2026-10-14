from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import DecisionStatus, FixtureEnvelope, Tone

# Numeric conventions for this contract:
# - Money fields are integers in the currency named by `DashboardData.currency`.
# - Percent fields are in percent units, not ratios: 6.65 means 6.65%.
# - Display formatting (thousands separators, signs, suffixes) belongs to the client.


class DashboardSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    totalAsset: int
    todayProfit: int
    todayProfitRate: float
    principal: int
    accumulatedProfit: int
    cashWeight: float
    lastVerifiedAt: str


class DashboardHolding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    code: str
    quantity: int | None = None
    averagePrice: int | None = None
    currentPrice: int | None = None
    value: int
    profit: int | None = None
    profitRate: float | None = None
    weight: float
    status: str
    tone: Tone
    selected: bool = False


class DashboardChartPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    portfolio: float
    benchmark: float
    event: str | None = None


class DashboardEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    detail: str
    source: str
    tone: Tone


class DashboardCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    value: str
    tone: Tone


class DashboardDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company: str
    code: str
    decisionId: str
    status: str
    statusTone: Tone
    proposal: str
    limitPrice: int
    limitAmount: int
    targetWeightFrom: float
    targetWeightTo: float
    expiresAt: str
    evidence: list[DashboardEvidence]
    checks: list[DashboardCheck]
    invalidConditions: list[str]
    # Live state for this decision, read from the same approval store the
    # approvals queue writes to. Approving/rejecting DEC-1042 from either
    # screen is immediately reflected on the other — there is one truth, not
    # two independent copies that can disagree.
    decisionStatus: DecisionStatus
    decidedAt: str | None = None
    # Same field as ApprovalOrder.kisOrderNo, read from the same approval
    # store — set only when approving this decision placed a live order
    # against KIS's 모의투자 account. See app/routers/dashboard.py.
    kisOrderNo: str | None = None


class DashboardData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    accountLabel: str
    currency: Literal["KRW"] = "KRW"
    summary: DashboardSummary
    chart: list[DashboardChartPoint] = Field(min_length=1)
    holdings: list[DashboardHolding] = Field(min_length=1)
    decision: DashboardDecision
    # True only when `holdings` just came from a live KIS 모의투자(paper
    # trading) balance inquiry instead of the fixture list below — see
    # app/routers/dashboard.py, app/integrations/kis.py. Everything else in
    # `DashboardData` (summary/chart/decision) stays fixture either way.
    holdingsConnected: bool = False


class DashboardEnvelope(FixtureEnvelope):
    data: DashboardData
