from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.audit_logs import (
    AUDIT_LOGS_DATA_AS_OF,
    AUDIT_LOGS_DISCLAIMER,
    AUDIT_LOGS_SOURCE_LABEL,
    build_audit_log_data,
)
from app.schemas.audit_logs import AuditLogEnvelope

router = APIRouter(prefix="/api", tags=["audit-logs"])


@router.get("/audit-logs", response_model=AuditLogEnvelope)
def get_audit_logs() -> AuditLogEnvelope:
    return AuditLogEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=AUDIT_LOGS_DATA_AS_OF,
        sourceLabel=AUDIT_LOGS_SOURCE_LABEL,
        disclaimer=AUDIT_LOGS_DISCLAIMER,
        data=build_audit_log_data(),
    )
