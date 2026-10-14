"""Local stress test fixture. Ported from `src/fixtures/stressTest.ts`.

The frontend fixture computed per-asset impact rows from a
`getStressRows(scenario)` function. That formula now runs once here for all
four scenarios instead of being re-run client-side.
"""

from app.schemas.stress_test import StressAsset, StressAssetImpact, StressScenario, StressScenarioKey, StressTestData

STRESS_TEST_DATA_AS_OF = "2026-08-27T15:20:00+09:00"

STRESS_TEST_SOURCE_LABEL = "로컬 fixture"

STRESS_TEST_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문 아님 · 손실 회피 보장 아님 · "
    "실제 계좌·API·DB 미연결 · 외부 요청 0건"
)

STRESS_BASE_AMOUNT = 130_180_000

_ASSETS = [
    StressAsset(key="cash", name="현금성 자산", ticker="KRW", weight=18.4),
    StressAsset(key="market", name="KODEX 200", ticker="069500", weight=31.6),
    StressAsset(key="samsung", name="삼성전자", ticker="005930", weight=7.2),
    StressAsset(key="sk", name="SK하이닉스", ticker="000660", weight=22.8),
    StressAsset(key="naver", name="NAVER", ticker="035420", weight=20.0),
]

_SCENARIOS: dict[StressScenarioKey, StressScenario] = {
    "rates": StressScenario(
        label="금리 급등", description="채권·성장주 압박을 화면용 고정 충격값으로 점검합니다.",
        loss=-6.8, drawdown=-9.4, cash="보통", alerts=3,
        shock={"cash": 0.2, "market": -4.8, "samsung": -6.2, "sk": -8.4, "naver": -10.6},
        assumption="기준금리 +100bp, 성장주 할인율 상승", weak="NAVER·반도체 비중",
        policy="현금 18.4%로 방어 여력 보통",
        responses=["현금 목표 22% 검토", "성장주 비중 축소 후보", "승인 대기 전 위험 알림 확인"],
    ),
    "chips": StressScenario(
        label="반도체 급락", description="반도체 업종 동반 하락을 고정 손실 예시로 비교합니다.",
        loss=-8.9, drawdown=-12.7, cash="취약", alerts=4,
        shock={"cash": 0.1, "market": -5.4, "samsung": -13.8, "sk": -16.2, "naver": -4.1},
        assumption="반도체 업종 -15% 동시 충격", weak="삼성전자·SK하이닉스 집중",
        policy="종목·업종 집중 경계 예시",
        responses=["반도체 합산 비중 경고", "KODEX 200 대체 검토", "추가 매수 차단 후보"],
    ),
    "fx": StressScenario(
        label="환율 충격", description="원화 약세와 수입 비용 압박을 화면용으로 점검합니다.",
        loss=-4.6, drawdown=-6.8, cash="양호", alerts=2,
        shock={"cash": 0, "market": -3.2, "samsung": -2.8, "sk": -3.6, "naver": -8.5},
        assumption="USD/KRW +7%, 외국인 수급 둔화", weak="내수·플랫폼 민감도",
        policy="외부 환율 데이터 미연결",
        responses=["환율 민감 종목 표시", "현금 유지 후보", "데이터 연결 상태 확인"],
    ),
    "liquidity": StressScenario(
        label="유동성 경색", description="거래대금 축소와 스프레드 확대를 고정 가정으로 봅니다.",
        loss=-7.3, drawdown=-10.5, cash="보통", alerts=3,
        shock={"cash": 0, "market": -6.8, "samsung": -5.5, "sk": -9.1, "naver": -12.4},
        assumption="스프레드 확대, 체결 비용 증가 가정", weak="변동성 높은 종목",
        policy="슬리피지 단순 가정",
        responses=["시장가 금지 유지", "지정가 폭 축소 후보", "승인 만료 시간 단축 검토"],
    ),
}


def _rows_for(scenario_key: StressScenarioKey) -> list[StressAssetImpact]:
    scenario = _SCENARIOS[scenario_key]
    rows = []
    for asset in _ASSETS:
        shock = scenario.shock[asset.key]
        contribution = round((asset.weight * shock) / 100, 2)
        state = "높음" if shock <= -10 else "주의" if shock <= -6 else "관리"
        rows.append(
            StressAssetImpact(
                key=asset.key, name=asset.name, ticker=asset.ticker, weight=asset.weight,
                shock=shock, contribution=contribution, state=state,
            )
        )
    return rows


def build_stress_test_data() -> StressTestData:
    return StressTestData(
        safetyCopy=STRESS_TEST_DISCLAIMER,
        baseAmount=STRESS_BASE_AMOUNT,
        assets=_ASSETS,
        scenarios=_SCENARIOS,
        rowsByScenario={key: _rows_for(key) for key in _SCENARIOS},
    )
