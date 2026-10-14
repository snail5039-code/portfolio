import logging

import httpx
from fastapi import APIRouter

from app.clock import now_kst_iso
from app.config import OPENDART_API_KEY
from app.fixtures.company_detail import (
    COMPANY_DETAIL_DATA_AS_OF,
    COMPANY_DETAIL_DISCLAIMER,
    COMPANY_DETAIL_DISCLAIMER_WITH_LIVE_FILINGS,
    COMPANY_DETAIL_SOURCE_LABEL,
    build_company_detail_data,
)
from app.integrations.opendart import OpenDartError, fetch_recent_disclosures
from app.schemas.company_detail import CompanyDetailData, CompanyDetailEnvelope, CompanyEvidenceItem

router = APIRouter(prefix="/api", tags=["company-detail"])

logger = logging.getLogger(__name__)


def _format_date(yyyymmdd: str) -> str:
    if len(yyyymmdd) != 8:
        return yyyymmdd
    return f"{yyyymmdd[:4]}.{yyyymmdd[4:6]}.{yyyymmdd[6:]}"


def _filing_from_disclosure(disclosure: dict) -> CompanyEvidenceItem:
    rcept_no = disclosure.get("rcept_no", "")
    rcept_dt = _format_date(disclosure.get("rcept_dt", ""))
    flr_nm = disclosure.get("flr_nm", "")
    return CompanyEvidenceItem(
        id=rcept_no or disclosure.get("report_nm", "unknown"),
        kind="filing",
        title=disclosure.get("report_nm", "(제목 없음)"),
        subtitle=f"{rcept_dt} · {flr_nm}" if flr_nm else rcept_dt,
        body=(
            f"OpenDART 실제 공시입니다. 접수번호 {rcept_no} — 원문은 "
            f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no} 에서 확인할 수 있습니다. "
            "이 화면은 원문 내용을 해석·검증하지 않았습니다."
        ),
        sourceLabel="OpenDART 실제 공시",
        tone="neutral",
    )


async def _with_live_filings(data: CompanyDetailData) -> CompanyDetailData:
    if not OPENDART_API_KEY:
        return data

    try:
        disclosures = await fetch_recent_disclosures(data.code, OPENDART_API_KEY, count=len(data.filings) or 5)
    except (OpenDartError, httpx.HTTPError):
        logger.warning("OpenDART fetch failed for %s; falling back to fixture filings", data.code, exc_info=True)
        return data

    if not disclosures:
        return data

    return data.model_copy(
        update={
            "filings": [_filing_from_disclosure(d) for d in disclosures],
            "filingsConnected": True,
        }
    )


@router.get("/company-detail", response_model=CompanyDetailEnvelope)
async def get_company_detail() -> CompanyDetailEnvelope:
    data = await _with_live_filings(build_company_detail_data())

    return CompanyDetailEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=COMPANY_DETAIL_DATA_AS_OF,
        sourceLabel=COMPANY_DETAIL_SOURCE_LABEL,
        disclaimer=COMPANY_DETAIL_DISCLAIMER_WITH_LIVE_FILINGS if data.filingsConnected else COMPANY_DETAIL_DISCLAIMER,
        # The one honest exception to "0 external connections" — see the
        # FixtureEnvelope docstring in app/schemas/common.py.
        externalConnections=1 if data.filingsConnected else 0,
        data=data,
    )
