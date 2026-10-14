"""Local dashboard fixture.

Every number here is a screen review example. It is not market data, not an
account balance, and not an order. Nothing in this module reads an external
source; the values are literals checked into the repository.
"""

from app.fixtures.decisions import (
    DEC_1042,
    DEC_1042_EXPIRES_AT,
    DEC_1042_TARGET_WEIGHT_FROM,
    DEC_1042_TARGET_WEIGHT_TO,
)
from app.schemas.common import DecisionStatus
from app.schemas.dashboard import (
    DashboardChartPoint,
    DashboardCheck,
    DashboardData,
    DashboardDecision,
    DashboardEvidence,
    DashboardHolding,
    DashboardSummary,
)

# Reference instant for the fixture body. Not a real quote timestamp.
DASHBOARD_DATA_AS_OF = "2026-08-27T15:20:00+09:00"

DASHBOARD_SOURCE_LABEL = "로컬 fixture"

DASHBOARD_DISCLAIMER = (
    "화면 검토용 가상 예시이며 실제 금융 데이터·계좌·주문·체결·외부 API와 "
    "연결되지 않습니다."
)

# Shown instead of DASHBOARD_DISCLAIMER when `holdings` came from a live KIS
# 모의투자 balance inquiry — see app/routers/dashboard.py.
DASHBOARD_DISCLAIMER_WITH_LIVE_HOLDINGS = (
    "보유 종목은 한국투자증권 모의투자(가상계좌) 서버의 실제 잔고입니다 · "
    "실제 자금은 이동하지 않습니다 · 나머지 화면(차트·판단 근거)은 여전히 "
    "화면 검토용 가상 예시입니다."
)


def build_dashboard_data(
    decision_status: DecisionStatus = "pending",
    decided_at: str | None = None,
    kis_order_no: str | None = None,
) -> DashboardData:
    """Build the dashboard fixture.

    `decision_status`/`decided_at`/`kis_order_no` are live values for
    DEC-1042, read by the router from the same approval store the approvals
    queue writes to. They default to "pending"/`None`/`None` only so tests
    and other direct callers that don't care about live state can call this
    with no arguments.

    `holdings`/`holdingsConnected` here are always the fixture list/`False` —
    the router overlays a live KIS 모의투자 balance on top afterward when
    configured (`app/routers/dashboard.py`), the same way Company Detail
    overlays live OpenDART filings.
    """
    return DashboardData(
        title="투자 운영",
        accountLabel="시뮬레이션 계좌",
        currency="KRW",
        summary=DashboardSummary(
            totalAsset=128_450_000,
            todayProfit=1_042_000,
            todayProfitRate=0.82,
            principal=112_000_000,
            accumulatedProfit=16_450_000,
            cashWeight=18.4,
            lastVerifiedAt="2026-08-27T14:31:00+09:00",
        ),
        chart=[
            DashboardChartPoint(label="6월 1주", portfolio=-1.2, benchmark=-0.8),
            DashboardChartPoint(label="6월 3주", portfolio=0.4, benchmark=0.2),
            DashboardChartPoint(label="7월 1주", portfolio=1.8, benchmark=1.1),
            DashboardChartPoint(label="7월 3주", portfolio=3.7, benchmark=2.4),
            DashboardChartPoint(label="8월 1주", portfolio=5.2, benchmark=3.1),
            DashboardChartPoint(
                label="8월 2주",
                portfolio=6.42,
                benchmark=3.18,
                event="검증 후 삼성전자 10주 모의승인 후보",
            ),
            DashboardChartPoint(label="8월 4주", portfolio=6.9, benchmark=3.7),
        ],
        holdings=[
            DashboardHolding(
                name="삼성전자",
                code="005930",
                quantity=120,
                averagePrice=68_420,
                currentPrice=71_200,
                value=8_544_000,
                profit=333_600,
                profitRate=4.06,
                weight=6.65,
                status="비중 확대 검토",
                tone="warning",
                selected=True,
            ),
            DashboardHolding(
                name="SK하이닉스",
                code="000660",
                quantity=96,
                averagePrice=172_400,
                currentPrice=186_000,
                value=17_856_000,
                profit=1_305_600,
                profitRate=7.89,
                weight=13.90,
                status="관찰",
                tone="neutral",
            ),
            DashboardHolding(
                name="NAVER",
                code="035420",
                quantity=48,
                averagePrice=207_800,
                currentPrice=200_000,
                value=9_600_000,
                profit=-374_400,
                profitRate=-3.75,
                weight=7.47,
                status="유지",
                tone="neutral",
            ),
            DashboardHolding(
                name="KODEX 200",
                code="069500",
                quantity=610,
                averagePrice=33_980,
                currentPrice=35_000,
                value=21_350_000,
                profit=622_200,
                profitRate=3.00,
                weight=16.62,
                status="유지",
                tone="neutral",
            ),
            DashboardHolding(
                name="TIGER 미국S&P500",
                code="360750",
                quantity=2_260,
                averagePrice=19_320,
                currentPrice=21_000,
                value=47_460_000,
                profit=3_796_800,
                profitRate=8.70,
                weight=36.95,
                status="관찰",
                tone="neutral",
            ),
            DashboardHolding(
                name="현금성 자산",
                code="KRW",
                quantity=None,
                averagePrice=None,
                currentPrice=None,
                value=23_640_000,
                profit=None,
                profitRate=None,
                weight=18.40,
                status="대기",
                tone="info",
            ),
        ],
        decision=DashboardDecision(
            company=DEC_1042.company,
            code=DEC_1042.code,
            decisionId=DEC_1042.id,
            status="조건부 승인 후보",
            statusTone="warning",
            proposal=f"{DEC_1042.company} {DEC_1042.quantity}주 지정가 {DEC_1042.side}",
            limitPrice=DEC_1042.price,
            limitAmount=DEC_1042.amount,
            targetWeightFrom=DEC_1042_TARGET_WEIGHT_FROM,
            targetWeightTo=DEC_1042_TARGET_WEIGHT_TO,
            expiresAt=DEC_1042_EXPIRES_AT,
            decisionStatus=decision_status,
            decidedAt=decided_at,
            kisOrderNo=kis_order_no,
            evidence=[
                DashboardEvidence(
                    title="영업현금흐름 전년 동기 대비 개선",
                    detail=(
                        "화면 구조 검토를 위한 가상 근거입니다. "
                        "실제 공시 원문은 연결되지 않았습니다."
                    ),
                    source="실제 공시 미연결 · 출처 미확인",
                    tone="warning",
                ),
                DashboardEvidence(
                    title="부채비율이 산업 평균보다 낮음",
                    detail="fixture에 포함된 예시 수치만 사용합니다.",
                    source="가상 재무 지표",
                    tone="neutral",
                ),
                DashboardEvidence(
                    title="메모리 가격 회복 구간 진입",
                    detail="실제 시세나 뉴스 API와 연결되지 않은 시나리오 문구입니다.",
                    source="화면 검토용 가설",
                    tone="warning",
                ),
            ],
            checks=[
                DashboardCheck(label="재무 수치", value="8/8 형식 일치", tone="success"),
                DashboardCheck(label="출처 연결", value="미확인", tone="warning"),
                DashboardCheck(label="정책 한도", value="통과 예시", tone="success"),
                DashboardCheck(label="실제 주문", value="생성 안 됨", tone="success"),
            ],
            invalidConditions=[
                "지정가가 71,200원을 초과할 때",
                "목표 비중이 8%를 초과할 때",
                "최신 정정 공시가 확인될 때",
            ],
        ),
    )
