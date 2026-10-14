"""Local backtest summary fixture. Ported from `src/fixtures/backtestSummary.ts`.

The frontend fixture computed metrics/rows from `getBacktestMetrics()`/
`getBacktestRows()` functions taking the current (strategy, period)
selection. That formula now runs once here for all nine combinations instead
of being re-run (and potentially re-implemented differently) on the client.
"""

from app.schemas.backtest_summary import (
    BacktestConfig,
    BacktestMetrics,
    BacktestPeriod,
    BacktestPeriodKey,
    BacktestRow,
    BacktestStrategyKey,
    BacktestSummaryData,
)

BACKTEST_SUMMARY_DATA_AS_OF = "2026-08-26T16:00:00+09:00"

BACKTEST_SUMMARY_SOURCE_LABEL = "로컬 fixture"

BACKTEST_SUMMARY_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문 아님 · 실제 과거 데이터 아님 · "
    "실제 성과 아님 · 실제 계좌·API·DB 미연결 · 외부 요청 0건"
)

_CONFIG_BASE = {
    "conservative": {"label": "보수형", "ret": 2.4, "bench": 1.8, "dd": -3.2, "vol": 8.6, "win": 58},
    "balanced": {"label": "균형형", "ret": 4.8, "bench": 3.1, "dd": -6.4, "vol": 13.2, "win": 62},
    "aggressive": {"label": "공격형", "ret": 7.1, "bench": 3.1, "dd": -11.8, "vol": 21.7, "win": 55},
}

_PERIODS = {
    "3m": {"label": "3개월", "range": "2026.05.26~08.25", "factor": 0.55, "months": ["2026.06", "2026.07", "2026.08"]},
    "6m": {"label": "6개월", "range": "2026.02.26~08.25", "factor": 1, "months": ["2026.04", "2026.05", "2026.06", "2026.07", "2026.08"]},
    "1y": {"label": "1년", "range": "2025.08.26~2026.08.25", "factor": 1.75, "months": ["2026.04", "2026.05", "2026.06", "2026.07", "2026.08"]},
}

_WAVE = [0.34, -0.16, 0.27, 0.08, 0.41]
_BENCH_WAVE = [0.12, -0.08, 0.15, 0.04, 0.17]


def _metrics_for(strategy: BacktestStrategyKey, period: BacktestPeriodKey) -> BacktestMetrics:
    base = _CONFIG_BASE[strategy]
    term = _PERIODS[period]
    dd_factor = 0.72 if period == "3m" else 1.35 if period == "1y" else 1
    vol_factor = 0.9 if period == "3m" else 1.08 if period == "1y" else 1
    win_delta = -3 if period == "3m" else 2 if period == "1y" else 0
    return BacktestMetrics(
        ret=round(base["ret"] * term["factor"], 4),
        bench=round(base["bench"] * term["factor"], 4),
        dd=round(base["dd"] * dd_factor, 4),
        vol=round(base["vol"] * vol_factor, 4),
        win=max(40, base["win"] + win_delta),
    )


def _rows_for(strategy: BacktestStrategyKey, period: BacktestPeriodKey) -> list[BacktestRow]:
    term = _PERIODS[period]
    metrics = _metrics_for(strategy, period)
    months = term["months"]
    rows = []
    for index, month in enumerate(months):
        wave = _WAVE[index]
        portfolio = round(metrics.ret / len(months) + wave * (2 if strategy == "aggressive" else 1), 1)
        benchmark = round(metrics.bench / len(months) + _BENCH_WAVE[index], 1)
        drawdown = round(-abs(wave) * (abs(metrics.dd) / 2.2) - 0.4, 1)
        rows.append(
            BacktestRow(
                month=month, portfolio=portfolio, benchmark=benchmark,
                excess=round(portfolio - benchmark, 1), drawdown=drawdown,
                state="초과" if portfolio >= benchmark else "미달",
            )
        )
    return rows


def build_backtest_summary_data() -> BacktestSummaryData:
    strategies: list[BacktestStrategyKey] = ["conservative", "balanced", "aggressive"]
    periods: list[BacktestPeriodKey] = ["3m", "6m", "1y"]

    return BacktestSummaryData(
        safetyCopy=BACKTEST_SUMMARY_DISCLAIMER,
        configs={key: BacktestConfig(label=_CONFIG_BASE[key]["label"]) for key in strategies},
        periods={key: BacktestPeriod(label=_PERIODS[key]["label"], range=_PERIODS[key]["range"]) for key in periods},
        metrics={
            strategy: {period: _metrics_for(strategy, period) for period in periods}
            for strategy in strategies
        },
        rows={
            strategy: {period: _rows_for(strategy, period) for period in periods}
            for strategy in strategies
        },
    )
