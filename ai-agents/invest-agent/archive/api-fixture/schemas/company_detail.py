from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope, Tone

CompanyEvidenceKind = Literal["positive", "negative", "filing"]


class CompanyChartPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    index: int
    price: int
    # Pre-plotted SVG y-coordinate, not a financial fact — kept as-is rather
    # than recomputed client-side from price, since it encodes a fixed chart
    # scale the frontend doesn't otherwise need to know.
    y: int


class CompanyMetric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    value: str
    note: str
    tone: Tone


class CompanyEvidenceItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    kind: CompanyEvidenceKind
    title: str
    subtitle: str
    body: str
    sourceLabel: str
    tone: Tone


class CompanyPricePanel(BaseModel):
    """Holding numbers here are the same position dashboard.py reports for
    005930 — see `build_company_detail_data()`, which reads them from the
    dashboard fixture instead of retyping them."""

    model_config = ConfigDict(extra="forbid")

    currentPrice: int
    changeAmount: int
    changeRatePercent: float
    quantity: int
    averagePrice: int
    value: int
    profit: int
    profitRate: float
    weight: float


class CompanyDetailData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company: str
    code: str
    market: str
    sector: str
    safetyCopy: str
    price: CompanyPricePanel
    chart: list[CompanyChartPoint] = Field(min_length=1)
    metrics: list[CompanyMetric]
    evidence: list[CompanyEvidenceItem]
    filings: list[CompanyEvidenceItem]
    # True only when `filings` just came back from a live OpenDART call this
    # request. False (the default) covers both "no OPENDART_API_KEY configured"
    # and "the call failed" — either way `filings` is the fixture's clearly
    # labeled placeholder list. The frontend must not claim "실제 공시" unless
    # this is true.
    filingsConnected: bool = False


class CompanyDetailEnvelope(FixtureEnvelope):
    data: CompanyDetailData
