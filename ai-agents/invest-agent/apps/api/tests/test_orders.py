"""주문 금액·정책 검사·행동 코치 (코드 계산) 테스트."""

from datetime import datetime
from decimal import Decimal

import pytest

from app.clock import KST
from app.functions import orders

OPEN = datetime(2026, 10, 6, 10, 0, tzinfo=KST)  # 화요일 10시
POLICY = {"max_order_krw": 1_000_000, "max_daily_krw": 2_000_000, "max_weight_pct": Decimal("30")}
SNAPSHOT = {"cash_krw": 2_000_000, "holdings": [
    {"stock_code": "000660", "stock_name": "SK하이닉스", "qty": 2, "avg_price": 200_000},
    {"stock_code": "005930", "stock_name": "삼성전자", "qty": 10, "avg_price": 70_000},
]}


def check(side="buy", qty=4, price=200_000, today=0, snapshot=SNAPSHOT, now=OPEN, closes=None):
    return orders.policy_check(side, qty, price, POLICY, today, snapshot, closes or {"005930": 80_000},
                               "000660", now, ["snapshot"])


def failed(result) -> list[str]:
    return [r["rule"] for r in result["rules"] if not r["ok"]]


def test_amount_fee_tax_worst_case() -> None:
    assert orders.order_amount(4, 210_000) == 840_000
    assert orders.fee_estimate(840_000, Decimal("0.015")) == 126           # 126원
    assert orders.fee_estimate(840_000, None) is None                      # 수수료율 미입력
    assert orders.sell_tax(840_000, "KOSPI") == 1_680                      # 0.20%
    assert orders.sell_tax(999, "KOSPI") == 1                              # 1.998원 → 원 미만 버림


@pytest.mark.parametrize(
    "now, is_open",
    [
        (datetime(2026, 10, 6, 9, 0, tzinfo=KST), True),
        (datetime(2026, 10, 6, 15, 30, tzinfo=KST), True),
        (datetime(2026, 10, 6, 8, 59, tzinfo=KST), False),
        (datetime(2026, 10, 6, 15, 31, tzinfo=KST), False),
        (datetime(2026, 10, 10, 10, 0, tzinfo=KST), False),  # 토요일
        (datetime(2026, 10, 9, 10, 0, tzinfo=KST), False),   # 한글날 (금)
        (datetime(2026, 10, 5, 10, 0, tzinfo=KST), False),   # 개천절 대체공휴일 (월)
        (datetime(2026, 12, 31, 10, 0, tzinfo=KST), False),  # 연말 휴장
    ],
)
def test_market_hours(now, is_open) -> None:
    assert orders.is_market_open(now) is is_open


def test_policy_passes_within_limits() -> None:
    # 1주 × 20만. 계좌: 현금 200만 + 하이닉스 2주 40만 + 삼성 10주(종가 8만) 80만 = 320만
    # 주문 후 비중: (2+1)주 × 20만 = 60만 ÷ 320만 = 18.75%
    result = check(qty=1)
    assert result["ok"], result
    assert result["weight_after"] == Decimal("18.75")


@pytest.mark.parametrize(
    "kwargs, rule",
    [
        ({"qty": 6}, "max_order"),                                   # 120만 > 1회 100만
        ({"today": 1_500_000}, "max_daily"),                         # 150만 + 80만 > 200만
        ({"qty": 4, "snapshot": {**SNAPSHOT, "cash_krw": 500_000}}, "cash"),
        ({"now": datetime(2026, 10, 6, 16, 0, tzinfo=KST)}, "market_hours"),
        ({"side": "sell", "qty": 3}, "holdings"),                    # 2주 보유인데 3주 매도
        ({"snapshot": None}, "account"),                             # 계좌 정보 없음
    ],
)
def test_policy_violations(kwargs: dict, rule: str) -> None:
    result = check(**kwargs)
    assert not result["ok"]
    assert rule in failed(result)


def test_weight_limit_only_for_buy() -> None:
    # 매수 4주: (2+4)×20만 = 120만 ÷ 320만 = 37.5% > 30%
    assert "max_weight" in failed(check())
    assert "max_weight" not in [r["rule"] for r in check(side="sell", qty=1)["rules"]]


def test_account_values_use_close_then_avg_price() -> None:
    held, position, total = orders.account_values(SNAPSHOT, "000660", 200_000, {})  # 종가 없으면 평균 매입가
    assert (held, position, total) == (2, 400_000, 2_000_000 + 400_000 + 700_000)


def warnings(**kwargs) -> list[str]:
    base = dict(side="buy", recent_trades=0, hot_rank=None, five_day_return=None, chases_hot_stocks=False,
                weight_after=None, max_weight_pct=Decimal("30"), gain_pct=None, losing_holdings=[], cost_krw=None)
    return orders.coach_warnings(**{**base, **kwargs})


def test_no_warnings_for_ordinary_order() -> None:
    assert warnings() == []


def test_frequent_trading_warning_with_cost() -> None:
    [text] = warnings(recent_trades=2, cost_krw=1_806)
    assert "최근 7일 동안 이 종목을 2번 거래" in text and "1,806원" in text


def test_hot_stock_warning_and_extra_confirm() -> None:
    [text] = warnings(hot_rank=0.95, five_day_return=Decimal("18.5"), chases_hot_stocks=True)
    assert "18.5% 올라" in text and "급등주를 바로 사는 편" in text
    assert orders.needs_hot_confirm([text], chases_hot_stocks=True)
    assert not orders.needs_hot_confirm([text], chases_hot_stocks=False)
    assert warnings(hot_rank=0.85, five_day_return=Decimal("10")) == []      # 상위 10% 아님
    assert warnings(side="sell", hot_rank=0.95, five_day_return=Decimal("18")) == []  # 매도는 해당 없음


def test_concentration_warning() -> None:
    assert warnings(weight_after=Decimal("24.01")) != []   # 30%의 80% = 24% 초과
    assert warnings(weight_after=Decimal("24")) == []


def test_disposition_warning_for_selling_winner_keeping_losers() -> None:
    [text] = warnings(side="sell", gain_pct=Decimal("12.3"), losing_holdings=["삼성전자"])
    assert "+12.3%" in text and "삼성전자" in text
    assert warnings(side="sell", gain_pct=Decimal("-5"), losing_holdings=["삼성전자"]) == []


def test_market_clock_moves_to_last_trading_day(monkeypatch):
    from app import clock, config
    saturday_night = datetime(2026, 10, 10, 23, 5, tzinfo=KST)
    monkeypatch.setattr(clock, "now", lambda: saturday_night)
    monkeypatch.setattr(config, "MARKET_CLOCK", None)
    assert clock.market_now() == saturday_night
    monkeypatch.setattr(config, "MARKET_CLOCK", "10:00")
    assert clock.market_now() == datetime(2026, 10, 8, 10, 0, tzinfo=KST)  # 토 → 금(한글날) 건너뛰고 목
    assert orders.is_market_open(clock.market_now())
    monkeypatch.setattr(clock, "now", lambda: datetime(2026, 10, 6, 20, 0, tzinfo=KST))  # 거래일 밤
    assert clock.market_now() == datetime(2026, 10, 6, 10, 0, tzinfo=KST)  # 같은 날 10시


def test_habit_warnings() -> None:
    [text] = warnings(hot_rank=0.95, five_day_return=Decimal("18.5"), hot_buys_habit=True)
    assert "급등 경고를 받고도 산 적이 여러 번" in text and "퀴즈에서" not in text
    [text] = warnings(monthly_fills=12, cost_krw=1_500)
    assert "최근 30일 동안 12건 체결" in text and "1,500원" in text


def test_buy_limited_by_account_size() -> None:
    # 계좌 평가액 320만 원 (현금 200만 + SK하이닉스 2주 × 20만 + 삼성전자 10주 × 8만), 매수 2주 × 20만 = 40만 원
    def check_pct(pct, side="buy"):
        return orders.policy_check(side, 2, 200_000, POLICY, 0, SNAPSHOT, {"005930": 80_000}, "000660", OPEN, ["snapshot"],
                                   account_pct=pct)

    small = check_pct(10)
    assert failed(small) == ["account_share"]  # 1회 한도 100만 원 안이어도 계좌의 10%(32만)를 넘는다
    assert next(r for r in small["rules"] if r["rule"] == "account_share")["limit"] == 320_000
    assert check_pct(15)["ok"]  # 15%(48만)면 된다
    assert "account_share" not in [r["rule"] for r in check_pct(10, "sell")["rules"]]  # 매도는 막지 않는다


def test_sell_is_not_limited_by_daily_total() -> None:
    result = check(side="sell", qty=1, today=1_900_000)  # 오늘 190만 매수했어도 매도는 1일 한도와 상관없다
    assert "max_daily" not in [r["rule"] for r in result["rules"]]
    assert result["ok"], result


def test_mock_has_no_amount_limits() -> None:
    """모의투자는 금액 한도(1회·1일·계좌 비율) 없이 현금·비중·장 시간만 본다 (2026-10-13 사용자 결정)"""
    result = orders.policy_check("buy", 10, 200_000, POLICY, 9_000_000, SNAPSHOT, {"005930": 80_000}, "000660", OPEN,
                                 ["snapshot"], account_pct=10, mock=True)
    names = {r["rule"] for r in result["rules"]}
    assert not names & {"max_order", "max_daily", "account_share"}
    assert {"market_hours", "cash"} <= names
