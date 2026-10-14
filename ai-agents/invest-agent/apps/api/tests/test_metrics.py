import math
from decimal import Decimal

import pytest

from app.functions import metrics

SRC = ["dart:20260310002820"]


def test_per_pbr_debt_ratio_with_real_samsung_numbers() -> None:
    # 삼성전자 2025 사업보고서(연결) 값으로 손 계산과 맞춘다
    net_income, equity, liabilities = 45_206_805_000_000, 436_320_337_000_000, 130_621_773_000_000
    market_cap = 1_482_031_627_128_000

    assert metrics.per(market_cap, net_income, SRC)["value"] == Decimal("32.78")
    assert metrics.pbr(market_cap, equity, SRC)["value"] == Decimal("3.40")
    assert metrics.debt_ratio(liabilities, equity, SRC)["value"] == Decimal("29.94")


def test_metric_shape_keeps_formula_and_sources() -> None:
    result = metrics.debt_ratio(50, 100, SRC)
    assert result == {"metric_id": "debt_ratio", "value": Decimal("50.00"), "unit": "%",
                      "formula": "부채총계 ÷ 자본총계 × 100", "inputs": SRC}


@pytest.mark.parametrize(
    "result",
    [
        metrics.per(1000, 0, SRC),
        metrics.per(1000, -5, SRC),        # 적자
        metrics.pbr(1000, 0, SRC),
        metrics.debt_ratio(10, -1, SRC),   # 자본잠식
        metrics.yoy_growth("revenue_yoy", "매출액", 100, 0, SRC),
    ],
)
def test_uncomputable_metrics_return_none_with_reason(result: dict) -> None:
    assert result["value"] is None
    assert result["reason"]


@pytest.mark.parametrize(
    "current, previous, expected",
    [(110, 100, Decimal("10.00")), (90, 100, Decimal("-10.00")), (50, -100, Decimal("150.00")), (1, 3, Decimal("-66.67"))],
)
def test_yoy_growth(current: int, previous: int, expected: Decimal) -> None:
    # 전년이 적자(-100)에서 흑자(50)로 바뀌면 분모는 절댓값을 쓴다
    assert metrics.yoy_growth("op_income_yoy", "영업이익", current, previous, SRC)["value"] == expected


def test_volatility_needs_days_plus_one_closes() -> None:
    assert metrics.volatility([100] * 20, 20, SRC)["value"] is None
    assert metrics.volatility([100] * 61, 60, SRC)["metric_id"] == "volatility_60d"


def test_volatility_of_flat_and_alternating_prices() -> None:
    assert metrics.volatility([100] * 21, 20, SRC)["value"] == Decimal("0.00")
    # 100 ↔ 110 반복: 로그수익률 ±ln(1.1), 표본 표준편차를 손으로 계산
    closes = [100, 110] * 10 + [100]
    returns = [math.log(b / a) for a, b in zip(closes, closes[1:])]
    mean = sum(returns) / 20
    expected = math.sqrt(sum((r - mean) ** 2 for r in returns) / 19) * math.sqrt(252) * 100
    assert metrics.volatility(closes, 20, SRC)["value"] == metrics.rounded(expected)


def test_volatility_uses_only_last_21_closes() -> None:
    assert metrics.volatility([1, 1000] + [100] * 21, 20, SRC)["value"] == Decimal("0.00")


@pytest.mark.parametrize(
    "position, total, order, side, expected",
    [
        (0, 1_000_000, 200_000, "buy", Decimal("20.00")),
        (300_000, 1_000_000, 100_000, "buy", Decimal("40.00")),
        (300_000, 1_000_000, 300_000, "sell", Decimal("0.00")),
        (1, 3, 0, "buy", Decimal("33.33")),
    ],
)
def test_weight_after_order(position: int, total: int, order: int, side: str, expected: Decimal) -> None:
    assert metrics.weight_after_order(position, total, order, side, SRC)["value"] == expected


def test_weight_after_order_rejects_impossible_inputs() -> None:
    assert metrics.weight_after_order(100, 0, 10, "buy", SRC)["value"] is None
    assert metrics.weight_after_order(100, 1000, 200, "sell", SRC)["value"] is None  # 보유보다 많이 팖
