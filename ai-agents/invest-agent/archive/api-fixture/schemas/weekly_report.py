from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

ReportRangeKey = Literal["week", "month", "quarter"]

ReportTopicKey = Literal[
    "return", "risk", "cash", "benchmark", "alpha", "samsung", "hynix", "naver",
    "approved", "rejected", "blocked", "source", "volatility", "slippage", "tax",
]

ReportRowTone = Literal["gain", "loss", "neutral", "warning"]


class ReportRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    shortLabel: str
    start: str
    end: str
    profit: str
    portfolio: str
    benchmark: str
    alpha: str
    drawdown: str
    drawdownLabel: str
    formula: str
    portfolioBar: int
    benchmarkBar: int
    alphaBar: int


class ReportFact(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    value: str


class ReportRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: ReportTopicKey
    group: str
    label: str
    value: str
    meta: str
    tone: ReportRowTone


class ReportRiskItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: ReportTopicKey
    label: str


class ReportDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: ReportTopicKey
    title: str
    # Pre-resolved per range instead of the frontend calling a function with
    # the current range — a detail that doesn't actually vary by range just
    # repeats the same value under all three keys.
    summaryByRange: dict[ReportRangeKey, str]
    factsByRange: dict[ReportRangeKey, list[ReportFact]]


class WeeklyReportData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    safetyCopy: str
    ranges: dict[ReportRangeKey, ReportRange]
    rows: list[ReportRow] = Field(min_length=1)
    risks: list[ReportRiskItem] = Field(min_length=1)
    details: dict[ReportTopicKey, ReportDetail]


class WeeklyReportEnvelope(FixtureEnvelope):
    data: WeeklyReportData
