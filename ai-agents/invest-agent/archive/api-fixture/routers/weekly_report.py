from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.weekly_report import (
    WEEKLY_REPORT_DATA_AS_OF,
    WEEKLY_REPORT_DISCLAIMER,
    WEEKLY_REPORT_SOURCE_LABEL,
    build_weekly_report_data,
)
from app.schemas.weekly_report import WeeklyReportEnvelope

router = APIRouter(prefix="/api", tags=["weekly-report"])


@router.get("/weekly-report", response_model=WeeklyReportEnvelope)
def get_weekly_report() -> WeeklyReportEnvelope:
    return WeeklyReportEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=WEEKLY_REPORT_DATA_AS_OF,
        sourceLabel=WEEKLY_REPORT_SOURCE_LABEL,
        disclaimer=WEEKLY_REPORT_DISCLAIMER,
        data=build_weekly_report_data(),
    )
