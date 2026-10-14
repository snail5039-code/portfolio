from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.decision_review import (
    DECISION_REVIEW_DATA_AS_OF,
    DECISION_REVIEW_DISCLAIMER,
    DECISION_REVIEW_SOURCE_LABEL,
    build_decision_review_data,
)
from app.schemas.decision_review import DecisionReviewEnvelope

router = APIRouter(prefix="/api", tags=["decision-review"])


@router.get("/decision-review", response_model=DecisionReviewEnvelope)
def get_decision_review() -> DecisionReviewEnvelope:
    return DecisionReviewEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=DECISION_REVIEW_DATA_AS_OF,
        sourceLabel=DECISION_REVIEW_SOURCE_LABEL,
        disclaimer=DECISION_REVIEW_DISCLAIMER,
        data=build_decision_review_data(),
    )
