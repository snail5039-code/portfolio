"""Local rebalance plan fixture. Ported from `src/fixtures/rebalancePlan.ts`.

The frontend fixture computed proposals from a `getRebalanceProposals(strategy)`
function. That formula now runs once here for all three strategies instead of
being re-run (and potentially re-implemented differently) on the client.
"""

from app.schemas.rebalance_plan import (
    CurrentAllocation,
    RebalancePlanData,
    RebalanceProposal,
    RebalanceStrategy,
    RebalanceStrategyKey,
)

REBALANCE_PLAN_DATA_AS_OF = "2026-08-27T15:20:00+09:00"

REBALANCE_PLAN_SOURCE_LABEL = "로컬 fixture"

REBALANCE_PLAN_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문 아님 · 실제 주문 생성 없음 · "
    "실제 체결 없음 · 실제 계좌·API·DB 미연결 · 외부 요청 0건"
)

REBALANCE_BASE_AMOUNT = 130_180_000

_CURRENT_ALLOCATIONS = [
    CurrentAllocation(key="cash", name="현금성 자산", ticker="KRW", weight=18.4),
    CurrentAllocation(key="market", name="KODEX 200", ticker="069500", weight=31.6),
    CurrentAllocation(key="samsung", name="삼성전자", ticker="005930", weight=7.2),
    CurrentAllocation(key="sk", name="SK하이닉스", ticker="000660", weight=22.8),
    CurrentAllocation(key="naver", name="NAVER", ticker="035420", weight=20.0),
]

_STRATEGIES: dict[RebalanceStrategyKey, RebalanceStrategy] = {
    "conservative": RebalanceStrategy(
        label="보수형", expectedReturn="연 +4.2%", volatility="8.6%", drawdown="-5.1%",
        targets={"cash": 30, "market": 34, "samsung": 7, "sk": 15, "naver": 14},
    ),
    "balanced": RebalanceStrategy(
        label="균형형", expectedReturn="연 +6.8%", volatility="13.2%", drawdown="-8.4%",
        targets={"cash": 18, "market": 32, "samsung": 8, "sk": 22, "naver": 20},
    ),
    "aggressive": RebalanceStrategy(
        label="공격형", expectedReturn="연 +9.4%", volatility="21.7%", drawdown="-14.8%",
        targets={"cash": 10, "market": 24, "samsung": 10, "sk": 31, "naver": 25},
    ),
}


def _proposals_for(strategy_key: RebalanceStrategyKey) -> list[RebalanceProposal]:
    targets = _STRATEGIES[strategy_key].targets
    proposals = []
    for asset in _CURRENT_ALLOCATIONS:
        target = targets[asset.key]
        delta = round(target - asset.weight, 1)
        if abs(delta) < 0.1:
            continue
        amount = round(((abs(delta) / 100) * REBALANCE_BASE_AMOUNT) / 1000) * 1000
        policy = "한도 경계" if asset.key == "samsung" and target >= 8 else "화면상 범위"
        proposals.append(
            RebalanceProposal(
                key=asset.key, name=asset.name, ticker=asset.ticker, weight=asset.weight,
                target=target, delta=delta, direction="비중 확대" if delta > 0 else "비중 축소",
                amount=f"약 {amount:,}원", policy=policy, source="가격·잔고 고정 예시",
                effect=f"{asset.name} 비중을 {asset.weight:.1f}%에서 {target:.1f}%로 조정하는 가상 제안입니다.",
            )
        )
    return proposals


def build_rebalance_plan_data() -> RebalancePlanData:
    return RebalancePlanData(
        baseAmount=REBALANCE_BASE_AMOUNT,
        safetyCopy=REBALANCE_PLAN_DISCLAIMER,
        currentAllocations=_CURRENT_ALLOCATIONS,
        strategies=_STRATEGIES,
        proposalsByStrategy={key: _proposals_for(key) for key in _STRATEGIES},
    )
