"""백테스트 (5단계): 미래 정보를 쓰지 않는지, 생존 편향 비교, 수익 계산을 확인한다. DB·인터넷 없이 작은 가짜 시장으로."""

from datetime import date, timedelta

from app import backtest
from app.backtest import History

DAYS = [date(2026, 9, 1) + timedelta(days=i) for i in range(10)]


def market(prices: dict[str, list[int]], caps: dict[str, int], filings=None) -> History:
    close, cap_by_date = {}, {}
    for i, d in enumerate(DAYS):
        cap_by_date[d] = {}
        for code, series in prices.items():
            if i < len(series):  # 짧은 종목은 중간에 상장폐지된 것
                close[(d, code)] = series[i]
                cap_by_date[d][code] = caps[code]
    return History(DAYS, close, cap_by_date, {c: "KOSPI" for c in prices}, filings or {})


def test_until_hides_future_prices_and_same_day_filings() -> None:
    h = market({"A": list(range(100, 110))}, {"A": 1}, {"A": [DAYS[3], DAYS[5]]}).until(DAYS[5])
    assert h.dates == DAYS[:6] and h.price(DAYS[5], "A") == 105 and h.price(DAYS[6], "A") is None
    assert h.last_filing("A") == DAYS[3]  # 그날(5일째) 접수된 공시는 장 마감 뒤일 수 있어 모른다고 본다


def test_picks_do_not_change_when_future_is_changed() -> None:
    base = {"A": [100, 101, 102, 103, 104, 105, 106, 107, 108, 109], "B": [100, 99, 98, 97, 96, 95, 94, 93, 92, 91]}
    spiked = {"A": base["A"][:7] + [1, 1, 1], "B": base["B"][:7] + [999, 999, 999]}  # 7일째 뒤만 다르다
    t = DAYS[6]
    for name, pick in backtest.STRATEGIES.items():
        a = market(base, {"A": 2, "B": 1}).until(t)
        b = market(spiked, {"A": 2, "B": 1}).until(t)
        assert pick(a, t, ["A", "B"]) == pick(b, t, ["A", "B"]), name


def test_point_in_time_universe_includes_later_delisted_stock() -> None:
    full = market({"A": [100] * 10, "GONE": [100] * 4}, {"A": 1, "GONE": 5})  # GONE은 4일째 뒤 없어짐
    assert backtest.universe_on(full.until(DAYS[2]), DAYS[2])[0] == "GONE"   # 그때는 시가총액 1위였다
    assert backtest.universe_on(full.until(DAYS[6]), DAYS[6]) == ["A"]


def test_run_computes_returns_with_costs_and_bias_comparison() -> None:
    up = [100 * 1.01 ** i for i in range(10)]
    full = market({"UP": [round(p) for p in up], "FLAT": [100] * 10}, {"UP": 1, "FLAT": 2})
    result = backtest.run(full)
    momentum = result["5일 상승 상위 3 (모멘텀)"]
    assert momentum["days"] == 4 and momentum["total"] > 0  # 6~9일째: 오르는 종목을 사서 다음 날 판다 (비용 빼고도 +)
    assert result["기준: 대상 전체 동일 비중"]["days"] == 4
    survivors_only = backtest.run(full, survivors=["FLAT"])
    assert survivors_only["기준: 대상 전체 동일 비중"]["total"] == 0  # 대상을 바꾸면 결과가 달라진다 (편향 비교)
