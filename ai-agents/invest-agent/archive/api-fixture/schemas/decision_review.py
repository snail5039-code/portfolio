from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

DecisionReviewOutcome = Literal["승인", "반려", "보류"]
DecisionReviewLinkPage = Literal["approvals", "audit", "rebalance", "taxFee"]


class DecisionReviewItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    ticker: str
    decision: DecisionReviewOutcome
    memo: bool
    reviewedAt: str
    statusText: str
    reason: str
    memoText: str
    policy: str
    verification: str
    source: str
    pathDiff: str
    chosen: str
    alternate: str
    pathCopy: str
    focus: str
    linkPage: DecisionReviewLinkPage
    summary: str


class DecisionReviewData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    safetyCopy: str
    decisions: list[DecisionReviewItem] = Field(min_length=1)


class DecisionReviewEnvelope(FixtureEnvelope):
    data: DecisionReviewData
