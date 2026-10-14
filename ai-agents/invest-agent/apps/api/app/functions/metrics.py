"""투자 지표 계산. 숫자는 AI가 아니라 이 코드가 계산한다 (FR-16, NFR-09).

모든 함수는 05-schemas.md의 Metric 형식(dict)을 돌려준다:
    {"metric_id", "value", "unit", "formula", "inputs"}
- value는 Decimal(소수 둘째 자리 반올림), 계산할 수 없으면 None과 그 이유(reason)
- inputs는 계산에 쓴 출처 ID 목록. 검증 AI는 같은 함수로 다시 계산해 값을 맞춰 본다
"""

import math
from decimal import ROUND_HALF_UP, Decimal

TRADING_DAYS_PER_YEAR = 252
VOLATILITY_DAYS = 60  # 20일은 흔들림이 커서 60일을 쓴다 (2026-10-06)


def rounded(value: Decimal | float) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def metric(metric_id: str, value, unit: str, formula: str, inputs: list[str], reason: str | None = None) -> dict:
    result = {"metric_id": metric_id, "value": None if value is None else rounded(value),
              "unit": unit, "formula": formula, "inputs": inputs}
    if value is None:
        result["reason"] = reason
    return result


def ratio_pct(numerator: int, denominator: int) -> Decimal:
    return Decimal(numerator) / Decimal(denominator) * 100


def per(market_cap: int, net_income: int, inputs: list[str]) -> dict:
    formula = "시가총액 ÷ 최근 4개 분기 당기순이익 (연결, 비지배지분 포함)"
    if net_income <= 0:
        return metric("per", None, "배", formula, inputs, "순이익이 0 이하라 계산할 수 없음")
    return metric("per", Decimal(market_cap) / Decimal(net_income), "배", formula, inputs)


def pbr(market_cap: int, equity: int, inputs: list[str]) -> dict:
    formula = "시가총액 ÷ 자본총계 (최근 정기보고서, 연결)"
    if equity <= 0:
        return metric("pbr", None, "배", formula, inputs, "자본이 0 이하라 계산할 수 없음")
    return metric("pbr", Decimal(market_cap) / Decimal(equity), "배", formula, inputs)


def debt_ratio(liabilities: int, equity: int, inputs: list[str]) -> dict:
    formula = "부채총계 ÷ 자본총계 × 100"
    if equity <= 0:
        return metric("debt_ratio", None, "%", formula, inputs, "자본이 0 이하라 계산할 수 없음")
    return metric("debt_ratio", ratio_pct(liabilities, equity), "%", formula, inputs)


def yoy_growth(metric_id: str, account: str, current: int, previous: int, inputs: list[str]) -> dict:
    formula = f"({account} 이번 기간 − 전년 같은 기간) ÷ |전년 같은 기간| × 100"
    if previous == 0:
        return metric(metric_id, None, "%", formula, inputs, "전년 값이 0이라 계산할 수 없음")
    return metric(metric_id, Decimal(current - previous) / abs(Decimal(previous)) * 100, "%", formula, inputs)


def volatility(closes: list[int], days: int, inputs: list[str]) -> dict:
    """최근 days거래일 일간 로그수익률의 표준편차를 연 단위로 바꾼 값(%). closes는 오래된 것부터."""
    metric_id = f"volatility_{days}d"
    formula = f"최근 {days}거래일 일간 로그수익률 표준편차 × √{TRADING_DAYS_PER_YEAR} × 100"
    recent = closes[-(days + 1):]
    if len(recent) < days + 1:
        return metric(metric_id, None, "%", formula, inputs, f"종가가 {days + 1}일치보다 적음")
    returns = [math.log(today / yesterday) for yesterday, today in zip(recent, recent[1:])]
    mean = sum(returns) / len(returns)
    stdev = math.sqrt(sum((r - mean) ** 2 for r in returns) / (len(returns) - 1))  # 표본 표준편차
    return metric(metric_id, stdev * math.sqrt(TRADING_DAYS_PER_YEAR) * 100, "%", formula, inputs)


def weight_after_order(position_value: int, total_value: int, order_amount: int, side: str,
                       inputs: list[str]) -> dict:
    """주문 후 이 종목이 계좌에서 차지하는 비중(%).

    position_value: 지금 이 종목 평가액, total_value: 현금 + 모든 보유 종목 평가액.
    매수는 현금이 주식으로 바뀌므로 전체 금액은 그대로이고, 매도는 그 반대다 (수수료·세금은 빼고 본다).
    """
    formula = "(이 종목 평가액 ± 주문 금액) ÷ (현금 + 전체 평가액) × 100"
    after = position_value + order_amount if side == "buy" else position_value - order_amount
    if total_value <= 0:
        return metric("weight_after_order", None, "%", formula, inputs, "계좌 평가액이 0이라 계산할 수 없음")
    if after < 0:
        return metric("weight_after_order", None, "%", formula, inputs, "보유보다 많이 팔 수 없음")
    return metric("weight_after_order", ratio_pct(after, total_value), "%", formula, inputs)
