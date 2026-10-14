"""Local company detail fixture. Ported from `src/fixtures/companyDetail.ts`.

The price/holding panel restates the exact 005930 position the dashboard
already reports (120 shares, 68,420원 average price, 8,544,000원 value, etc.) —
this fixture pulls those numbers from `build_dashboard_data()`'s holdings
instead of retyping them, so the two screens cannot silently disagree on the
same position.
"""

from app.fixtures.dashboard import build_dashboard_data
from app.schemas.company_detail import (
    CompanyChartPoint,
    CompanyDetailData,
    CompanyEvidenceItem,
    CompanyMetric,
    CompanyPricePanel,
)

COMPANY_DETAIL_DATA_AS_OF = "2026-08-25T14:32:00+09:00"

COMPANY_DETAIL_SOURCE_LABEL = "로컬 fixture"

COMPANY_DETAIL_DISCLAIMER = "모의투자 · 가상 예시 · 실제 시세·공시·계좌·API 미연결 · 투자 권유 아님"
# Only true once `filings` is live OpenDART data (see app/routers/company_detail.py) —
# price/chart/metrics/account stay synthetic either way.
COMPANY_DETAIL_DISCLAIMER_WITH_LIVE_FILINGS = (
    "모의투자 · 가상 예시 · 시세·계좌 미연결 · 공시는 OpenDART 실제 데이터 · 투자 권유 아님"
)


def _samsung_holding():
    return next(h for h in build_dashboard_data().holdings if h.code == "005930")


def build_company_detail_data() -> CompanyDetailData:
    holding = _samsung_holding()

    return CompanyDetailData(
        company="삼성전자",
        code="005930",
        market="KOSPI",
        sector="전기전자",
        safetyCopy=COMPANY_DETAIL_DISCLAIMER,
        price=CompanyPricePanel(
            currentPrice=holding.currentPrice,
            changeAmount=800,
            changeRatePercent=1.14,
            quantity=holding.quantity,
            averagePrice=holding.averagePrice,
            value=holding.value,
            profit=holding.profit,
            profitRate=holding.profitRate,
            weight=holding.weight,
        ),
        chart=[
            CompanyChartPoint(index=1, price=64800, y=102),
            CompanyChartPoint(index=2, price=65900, y=87),
            CompanyChartPoint(index=3, price=65300, y=95),
            CompanyChartPoint(index=4, price=67400, y=65),
            CompanyChartPoint(index=5, price=68100, y=55),
            CompanyChartPoint(index=6, price=67700, y=61),
            CompanyChartPoint(index=7, price=69600, y=34),
            CompanyChartPoint(index=8, price=70400, y=23),
            CompanyChartPoint(index=9, price=69800, y=31),
            CompanyChartPoint(index=10, price=71000, y=14),
            CompanyChartPoint(index=11, price=70600, y=20),
            CompanyChartPoint(index=12, price=71200, y=10),
        ],
        metrics=[
            CompanyMetric(label="매출", value="302.2조원", note="+6.4%", tone="success"),
            CompanyMetric(label="영업이익", value="26.6조원", note="이익률 8.8%", tone="neutral"),
            CompanyMetric(label="영업현금흐름", value="44.1조원", note="+11.5%", tone="success"),
            CompanyMetric(label="부채비율", value="26.4%", note="예시 평균 41.8%", tone="neutral"),
            CompanyMetric(label="PER", value="14.8배", note="예시 비교 16.2배", tone="neutral"),
            CompanyMetric(label="PBR", value="1.3배", note="예시 비교 1.6배", tone="neutral"),
        ],
        evidence=[
            CompanyEvidenceItem(
                id="ev-cashflow", kind="positive", title="영업현금흐름 개선", subtitle="예시 수치 기반 해석",
                body="44.1조원, 전년 대비 +11.5%로 설정된 화면용 예시입니다.", sourceLabel="근거 예시", tone="success",
            ),
            CompanyEvidenceItem(
                id="ev-debt", kind="positive", title="낮은 부채비율", subtitle="예시 산업 평균 대비",
                body="26.4%와 예시 산업 평균 41.8%를 비교한 가상 근거입니다.", sourceLabel="근거 예시", tone="success",
            ),
            CompanyEvidenceItem(
                id="ev-profit", kind="positive", title="영업이익 회복", subtitle="이익률 8.8% 예시",
                body="영업이익 26.6조원과 이익률 8.8%를 사용한 화면 예시입니다.", sourceLabel="근거 예시", tone="success",
            ),
            CompanyEvidenceItem(
                id="ev-volatility", kind="negative", title="단기 가격 변동성", subtitle="가격 경로 불확실성",
                body="최근 가격 변화가 확대됐다고 가정한 화면용 경고입니다.", sourceLabel="근거 예시", tone="warning",
            ),
            CompanyEvidenceItem(
                id="ev-cycle", kind="negative", title="업황 회복 지연 가능성", subtitle="전망 불확실성",
                body="전기전자 업황 회복이 지연될 수 있다는 가상 반대 시나리오입니다.", sourceLabel="근거 예시", tone="warning",
            ),
            CompanyEvidenceItem(
                id="ev-limit", kind="negative", title="예시 데이터 한계", subtitle="실제 검증 미수행",
                body="실제 시세와 공시를 연결하지 않아 투자 판단에 사용할 수 없습니다.", sourceLabel="근거 예시", tone="danger",
            ),
        ],
        filings=[
            CompanyEvidenceItem(
                id="DEMO-FIL-001", kind="filing", title="2026년 반기보고서 예시", subtitle="2026.08.14 · 미확인",
                body="실제 공시 원문과 연결되지 않은 화면 구조 검토용 항목입니다. 실제 공시 검증은 수행되지 않았습니다.",
                sourceLabel="OpenDART 미연결 · 미확인", tone="warning",
            ),
            CompanyEvidenceItem(
                id="DEMO-FIL-002", kind="filing", title="영업실적 잠정치 예시", subtitle="2026.07.31 · 미확인",
                body="실제 공시 원문과 연결되지 않은 화면 구조 검토용 항목입니다. 실제 공시 검증은 수행되지 않았습니다.",
                sourceLabel="OpenDART 미연결 · 미확인", tone="warning",
            ),
            CompanyEvidenceItem(
                id="DEMO-FIL-003", kind="filing", title="주요 경영사항 예시", subtitle="2026.07.12 · 미확인",
                body="실제 공시 원문과 연결되지 않은 화면 구조 검토용 항목입니다. 실제 공시 검증은 수행되지 않았습니다.",
                sourceLabel="OpenDART 미연결 · 미확인", tone="warning",
            ),
        ],
    )
