"""Local portfolio change compare fixture. Ported from
`src/fixtures/portfolioChangeCompare.ts`.
"""

from app.schemas.portfolio_change_compare import (
    PortfolioChangeAsset,
    PortfolioChangeCompareData,
    PortfolioChangeStats,
)

PORTFOLIO_CHANGE_COMPARE_DATA_AS_OF = "2026-08-27T15:20:00+09:00"

PORTFOLIO_CHANGE_COMPARE_SOURCE_LABEL = "로컬 fixture · 화면용 가상 예시"

PORTFOLIO_CHANGE_COMPARE_DISCLAIMER = "모의투자 · 가상 예시 · 실제 주문·체결 없음 · 외부 API 미연결"


def build_portfolio_change_compare_data() -> PortfolioChangeCompareData:
    return PortfolioChangeCompareData(
        id="DEC-1056",
        title="포트폴리오 변경 전/후 비교",
        summary="현재 비중과 변경 후 가정 비중, 위험 변화, 정책 확인 항목을 한 화면에서 비교합니다.",
        baseAmount=10_000_000,
        safetyCopy=PORTFOLIO_CHANGE_COMPARE_DISCLAIMER,
        stats=PortfolioChangeStats(
            cashChange="18.4% -> 16.0%",
            riskChange="13.2% -> 12.6%",
            maxDrawdownChange="-8.4% -> -7.9%",
            sectorConcentrationChange="30.0% -> 28.0%",
            approvalState="사용자 승인 대기 전",
        ),
        assets=[
            PortfolioChangeAsset(
                id="cash", name="현금성 자산", ticker="KRW", currentWeight=18.4, nextWeight=16.0,
                amountChange=-240000, policyLabel="최소 현금 충족", policyType="pass",
                riskLabel="현금 완충 여지 감소", policyCheck="최소 현금 15% 이상 예시 충족",
                sourceState="실제 계좌 잔고 미연결", direction="down",
                summary="현금 비중은 줄지만 화면용 최소 현금 조건은 충족한 예시입니다.",
            ),
            PortfolioChangeAsset(
                id="kodex", name="KODEX 200", ticker="069500", currentWeight=31.6, nextWeight=33.0,
                amountChange=140000, policyLabel="통과 예시", policyType="pass",
                riskLabel="시장 대표 지수 비중 확대", policyCheck="ETF 편입 한도 예시 통과",
                sourceState="실제 ETF 시세 미연결", direction="up",
                summary="국내 지수 비중을 소폭 늘리는 가상 승인 전 비교입니다.",
            ),
            PortfolioChangeAsset(
                id="samsung", name="삼성전자", ticker="005930", currentWeight=7.2, nextWeight=8.0,
                amountChange=80000, policyLabel="한도 경계 예시", policyType="pass",
                riskLabel="단일 종목 한도 근접",
                policyCheck="종목 한도 8% 경계 예시를 표시하지만 종합 확인 필요 건수에는 넣지 않습니다.",
                sourceState="공시·시세 실제 연결 없음", direction="up",
                summary="비중 증가 후 단일 종목 한도 경계에 가까워지는 예시입니다.",
            ),
            PortfolioChangeAsset(
                id="sk", name="SK하이닉스", ticker="000660", currentWeight=22.8, nextWeight=20.0,
                amountChange=-280000, policyLabel="집중도 완화 예시", policyType="pass",
                riskLabel="반도체 집중도 완화", policyCheck="섹터 집중도 예시 완화",
                sourceState="실제 세금·수수료 계산 아님", direction="down",
                summary="반도체 합산 비중을 낮추는 화면용 조정 예시입니다.",
            ),
            PortfolioChangeAsset(
                id="naver", name="NAVER", ticker="035420", currentWeight=20.0, nextWeight=18.0,
                amountChange=-200000, policyLabel="변동성 확인 필요", policyType="check",
                riskLabel="변동성 확인 필요", policyCheck="최근 변동성 근거 미연결",
                sourceState="뉴스·가격 실제 연결 없음", direction="down",
                summary="비중은 줄지만 변동성 근거 확인이 남아 있는 예시입니다.",
            ),
            PortfolioChangeAsset(
                id="sp500", name="TIGER 미국S&P500", ticker="360750", currentWeight=0.0, nextWeight=5.0,
                amountChange=500000, policyLabel="환율·출처 확인 필요", policyType="check",
                riskLabel="환율 가정 확인 필요", policyCheck="신규 편입 전 출처 확인 필요",
                sourceState="실제 환율 조회 없음", direction="up",
                summary="신규 편입 후보이며 환율과 출처 확인이 필요한 화면용 예시입니다.",
            ),
        ],
    )
