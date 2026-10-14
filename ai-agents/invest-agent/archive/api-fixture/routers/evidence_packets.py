from fastapi import APIRouter, Request

from app.clock import now_kst_iso
from app.fixtures.decisions import DEC_1042
from app.fixtures.evidence_packets import (
    EVIDENCE_PACKETS_DATA_AS_OF,
    EVIDENCE_PACKETS_DISCLAIMER,
    EVIDENCE_PACKETS_SOURCE_LABEL,
    build_evidence_packets_data,
)
from app.schemas.evidence_packets import EvidencePacketsEnvelope

router = APIRouter(prefix="/api", tags=["evidence-packets"])


@router.get("/evidence-packets", response_model=EvidencePacketsEnvelope)
def get_evidence_packets(request: Request) -> EvidencePacketsEnvelope:
    order = request.app.state.approval_store.get(DEC_1042.id)
    decision_status = order.decisionStatus if order is not None else "pending"
    decided_at = order.decidedAt if order is not None else None

    return EvidencePacketsEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=EVIDENCE_PACKETS_DATA_AS_OF,
        sourceLabel=EVIDENCE_PACKETS_SOURCE_LABEL,
        disclaimer=EVIDENCE_PACKETS_DISCLAIMER,
        data=build_evidence_packets_data(decision_status=decision_status, decided_at=decided_at),
    )
