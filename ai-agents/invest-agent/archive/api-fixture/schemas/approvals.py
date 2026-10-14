from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import DecisionStatus, FixtureEnvelope, Tone

# Numeric conventions match docs/backend/07-dashboard-api.md: money is an
# integer, no formatted strings in the payload.

ApprovalCategory = Literal["conditional", "verified", "attention"]


class ApprovalOrder(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    company: str
    code: str
    side: Literal["매수", "매도"]
    quantity: int
    price: int
    amount: int
    # Verification review label, fixed regardless of the user's decision
    # (e.g. "조건부 승인", "출처 미확인"). Does not change after approve/reject.
    reviewLabel: str
    category: ApprovalCategory
    # This is the field that changes. Starts "pending"; becomes "approved" or
    # "rejected" only through this app's own approve/reject endpoint.
    decisionStatus: DecisionStatus
    verification: str
    expiresAt: str
    policyLabel: str
    policyPassed: bool
    sourceLabel: str
    warningTitle: str
    warningDetail: str
    tone: Tone
    decidedAt: str | None = None
    # Set only when approving this order actually placed a live order against
    # KIS's 모의투자(paper trading) account (see app/integrations/kis.py) —
    # KIS's own order number, not a locally-invented id. `None` means this
    # approval only changed local demo state, same as before KIS existed.
    kisOrderNo: str | None = None


class ApprovalsData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    orders: list[ApprovalOrder] = Field(min_length=1)


class ApprovalsEnvelope(FixtureEnvelope):
    data: ApprovalsData


class ApprovalActionEnvelope(FixtureEnvelope):
    """Returned by approve/reject. `data` is the single order that changed."""

    data: ApprovalOrder
