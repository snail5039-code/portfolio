from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.risk_alerts import (
    RISK_ALERTS_DATA_AS_OF,
    RISK_ALERTS_DISCLAIMER,
    RISK_ALERTS_SOURCE_LABEL,
    build_risk_alerts_data,
)
from app.schemas.risk_alerts import RiskAlertsEnvelope

router = APIRouter(prefix="/api", tags=["risk-alerts"])


@router.get("/risk-alerts", response_model=RiskAlertsEnvelope)
def get_risk_alerts() -> RiskAlertsEnvelope:
    return RiskAlertsEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=RISK_ALERTS_DATA_AS_OF,
        sourceLabel=RISK_ALERTS_SOURCE_LABEL,
        disclaimer=RISK_ALERTS_DISCLAIMER,
        data=build_risk_alerts_data(),
    )
