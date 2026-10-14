"""5단계 백테스트: 이 앱의 종목 고르기 규칙을 과거 데이터로 되돌려 본다 (docs/plan/12-todo-by-stage.md 5단계).

실행:
    uv run python -m app.backtest --fetch 365     # 시장 전체 1년치 시세를 받는다 (공공데이터포털, 무료)
    uv run python -m app.backtest                 # 백테스트 결과를 출력하고 docs/reports/에 저장

규칙
- 미래 정보 금지: t일 장 마감 뒤에 정하는 선택은 t일까지의 종가와 t-1일까지 접수된 공시만 쓴다 (`History.until`이 자른다).
  고른 종목은 t일 종가에 사서 t+1일 종가에 판다 (하루 보유, 매일 다시 고름). 테스트가 미래 값을 바꿔도 선택이 같은지 확인한다
- 생존 편향 검사: 대상 종목을 날마다 "그날 기준" 시가총액 상위(코스피 100 + 코스닥 50)로 다시 고른다 (상장폐지 종목 포함).
  같은 전략을 "오늘 기준 대상 150종목"으로만 돌린 결과와 나란히 보여서 편향 크기를 보인다
- 비용: 매일 전부 사고팔면 왕복 수수료 0.015% × 2 + 매도세 0.20%
전략
- 공시 최신순: 앱의 아침 브리핑 후보 규칙 (최근 공시가 있는 종목을 최신 공시 순으로 3개). 공시는 지금 대상 종목만 있어서 생존 편향이 남는다
- 5일 상승 상위 3 (모멘텀), 5일 하락 상위 3 (역추세)
- 기준: 대상 종목 전체 동일 비중 (시장 대신)
ponytail: 성향 규칙(변동성·위험등급으로 빼기)과 AI 판단은 되돌려 보지 않는다. 규칙 기반 선택만 본다
"""

import argparse
from bisect import bisect_right
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path

from psycopg.rows import dict_row

from app import config
from app.clock import KST
from app.collect import TARGETS
from app.db import connect
from app.integrations import market_data

PICKS = 3
COST_PER_DAY = 0.00015 * 2 + 0.0020  # 매일 다 바꾼다고 보고 왕복 비용 (보수적)
REPORT_DIR = Path(__file__).resolve().parents[3] / "docs" / "reports"


# ---------- 데이터 ----------

def fetch_history(days: int) -> int:
    """시장 전체 일별 시세를 한 달씩 받아 market_history에 넣는다. 이미 있는 날은 덮어쓴다"""
    end = datetime.now(KST).date()
    total = 0
    with connect(config.DATABASE_URL) as conn:
        start = end - timedelta(days=days)
        while start < end:
            stop = min(start + timedelta(days=30), end)
            for market in TARGETS:
                rows = market_data.daily_prices(config.DATA_GO_KR_API_KEY, start, stop, market=market)
                with conn.cursor() as cur:
                    cur.executemany(
                        "INSERT INTO market_history VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT (trade_date, stock_code)"
                        " DO UPDATE SET close = EXCLUDED.close, market_cap = EXCLUDED.market_cap",
                        [(r["trade_date"], r["stock_code"], r["stock_name"], market, r["close"], r["market_cap"])
                         for r in rows if r["close"] > 0])
                total += len(rows)
                conn.commit()
                print(f"[시세] {market} {start}~{stop} {len(rows)}줄")
            start = stop + timedelta(days=1)
    return total


@dataclass
class History:
    """종가·시가총액·시장과 종목별 공시일. limit을 정하면 그날까지만 보인다 (미래 정보 금지). 자료는 복사하지 않고 볼 때 자른다"""
    all_dates: list                  # 거래일 (오름차순)
    close: dict                      # (날짜, 종목) → 종가
    cap_by_date: dict                # 날짜 → {종목: 시가총액}
    market: dict                     # 종목 → 시장
    filings: dict                    # 종목 → 공시일 목록 (오름차순)
    limit: date | None = None

    def until(self, t: date) -> "History":
        return History(self.all_dates, self.close, self.cap_by_date, self.market, self.filings, t)

    @property
    def dates(self) -> list:
        return self.all_dates if self.limit is None else self.all_dates[:bisect_right(self.all_dates, self.limit)]

    def price(self, d: date, code: str) -> int | None:
        return None if self.limit is not None and d > self.limit else self.close.get((d, code))

    def caps(self, d: date) -> dict:
        return {} if self.limit is not None and d > self.limit else self.cap_by_date.get(d, {})

    def last_filing(self, code: str) -> date | None:
        """limit 전날까지 접수된 마지막 공시일 (그날 장 마감 뒤 공시는 모른다고 본다)"""
        days = self.filings.get(code, [])
        i = bisect_right(days, self.limit - timedelta(days=1)) if self.limit else len(days)
        return days[i - 1] if i else None


def load_history(conn) -> History:
    close, caps, market, dates = {}, defaultdict(dict), {}, set()
    for r in conn.execute("SELECT trade_date, stock_code, market, close, market_cap FROM market_history"):
        close[(r["trade_date"], r["stock_code"])] = r["close"]
        caps[r["trade_date"]][r["stock_code"]] = r["market_cap"]
        market[r["stock_code"]] = r["market"]
        dates.add(r["trade_date"])
    filings = defaultdict(list)
    for r in conn.execute("SELECT stock_code, filed_at FROM disclosures ORDER BY filed_at"):
        filings[r["stock_code"]].append(r["filed_at"])
    return History(sorted(dates), close, dict(caps), market, dict(filings))


# ---------- 대상과 전략 (모두 h = history.until(t)만 본다) ----------

def universe_on(h: History, t: date) -> list[str]:
    """그날 기준 시가총액 상위: 코스피 100 + 코스닥 50 (상장폐지 종목도 그날 있었으면 들어간다)"""
    caps, picked = h.caps(t), []
    for market, count in TARGETS.items():
        picked += sorted((c for c in caps if h.market.get(c) == market), key=caps.get, reverse=True)[:count]
    return picked


def five_day_return(h: History, code: str, t: date) -> float | None:
    dates = h.dates
    if len(dates) < 6 or dates[-1] != t:
        return None
    now, before = h.price(t, code), h.price(dates[-6], code)
    return None if now is None or before is None else now / before - 1


def pick_recent_filings(h: History, t: date, universe: list[str]) -> list[str]:
    """앱의 아침 브리핑 규칙: 최근(30일) 공시가 있는 종목을 최신 공시 순으로"""
    recent = [(d, c) for c in universe if (d := h.last_filing(c)) and d >= t - timedelta(days=30)]
    return [c for _, c in sorted(recent, reverse=True)[:PICKS]]


def pick_momentum(h: History, t: date, universe: list[str], reverse: bool = True) -> list[str]:
    scored = [(r, c) for c in universe if (r := five_day_return(h, c, t)) is not None]
    return [c for _, c in sorted(scored, reverse=reverse)[:PICKS]]


STRATEGIES = {
    "공시 최신순 (앱 브리핑 규칙)": pick_recent_filings,
    "5일 상승 상위 3 (모멘텀)": lambda h, t, u: pick_momentum(h, t, u, True),
    "5일 하락 상위 3 (역추세)": lambda h, t, u: pick_momentum(h, t, u, False),
}


# ---------- 실행 ----------

def next_return(full: History, code: str, t: date, t1: date) -> float | None:
    a, b = full.close.get((t, code)), full.close.get((t1, code))
    return None if a is None or b is None else b / a - 1  # 다음 날 시세가 없으면(거래정지·상장폐지) 그날은 뺀다


def run(full: History, survivors: list[str] | None = None) -> dict:
    """survivors가 있으면 대상을 그 종목(오늘 기준 대상)으로 고정한다 (생존 편향 비교용)"""
    daily = defaultdict(list)
    for i in range(5, len(full.all_dates) - 1):
        t, t1 = full.all_dates[i], full.all_dates[i + 1]
        h = full.until(t)
        universe = universe_on(h, t) if survivors is None else [c for c in survivors if h.price(t, c) is not None]
        bench = [r for c in universe if (r := next_return(full, c, t, t1)) is not None]
        daily["기준: 대상 전체 동일 비중"].append(sum(bench) / len(bench) if bench else 0.0)
        for name, pick in STRATEGIES.items():
            rets = [r for c in pick(h, t, universe) if (r := next_return(full, c, t, t1)) is not None]
            daily[name].append((sum(rets) / len(rets) - COST_PER_DAY) if rets else 0.0)
    return {name: summarize(rets, daily["기준: 대상 전체 동일 비중"]) for name, rets in daily.items()}


def summarize(rets: list[float], bench: list[float]) -> dict:
    value, peak, drawdown = 1.0, 1.0, 0.0
    for r in rets:
        value *= 1 + r
        peak = max(peak, value)
        drawdown = min(drawdown, value / peak - 1)
    wins = sum(1 for r, b in zip(rets, bench) if r > b)
    return {"days": len(rets), "total": value - 1, "max_drawdown": drawdown, "beat_bench": wins / len(rets) if rets else 0}


def report(full: History, survivors: list[str]) -> str:
    fair, biased = run(full), run(full, survivors)
    lines = [f"# 백테스트 ({full.all_dates[0]} ~ {full.all_dates[-1]}, {len(full.all_dates)}거래일)", "",
             "하루 보유·매일 다시 고르기, 매일 왕복 비용 0.23% 반영. 과거 결과는 미래 수익을 보장하지 않는다.", "",
             "| 전략 | 대상 | 일수 | 누적 수익률 | 최대 낙폭 | 기준보다 나은 날 |", "|---|---|---|---|---|---|"]
    for name in fair:
        for label, result in (("그날 기준 대상", fair[name]), ("오늘 기준 대상(생존 편향)", biased[name])):
            beat = "—" if name.startswith("기준") else f"{result['beat_bench']:.0%}"
            lines.append(f"| {name} | {label} | {result['days']} | {result['total']:+.1%} | {result['max_drawdown']:.1%} | {beat} |")
    bench = "기준: 대상 전체 동일 비중"
    lines += ["", "## 읽는 법", "",
              f"- 생존 편향의 크기: 같은 기준(동일 비중)이 오늘 기준 대상으로는 {biased[bench]['total']:+.1%}, "
              f"그날 기준 대상으로는 {fair[bench]['total']:+.1%}다. 오늘 살아남은 큰 종목만 보면 결과가 부풀려진다",
              "- 그래서 전략 비교는 \"그날 기준 대상\" 줄로 본다. 오늘 기준 대상 줄은 편향을 보여주려고 함께 둔다",
              "- 공시 최신순은 공시 자료가 지금 대상 150종목에만 있어서, 그날 기준 대상으로 돌려도 지금 대상에 든 종목만 고를 수 있다."
              " 생존 편향이 일부 남는다 (공시를 시장 전체로 모으면 없앨 수 있다)",
              "- 성향 규칙(변동성·위험등급으로 빼기)과 투자 AI·검증 AI 판단은 되돌려 보지 않았다. 규칙만으로 고른 결과다",
              "- 종가에 사고 다음 날 종가에 판다고 본다. 실제로는 장중 가격·호가 차이·체결 실패가 있다",
              "- 1년(약 230거래일) 한 번의 기간이다. 다른 기간에도 같은지는 미확인"]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="종목 고르기 규칙 백테스트")
    parser.add_argument("--fetch", type=int, help="시장 전체 시세를 이 일수만큼 받는다")
    args = parser.parse_args()
    if args.fetch:
        print(f"{fetch_history(args.fetch)}줄 받음")
        return
    with connect(config.DATABASE_URL, row_factory=dict_row) as conn:
        full = load_history(conn)
        survivors = [r["code"] for r in conn.execute("SELECT code FROM stocks WHERE is_target")]
    text = report(full, survivors)
    print(text)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / f"backtest-{datetime.now(KST):%Y%m%d}.md"
    path.write_text(text + "\n", encoding="utf-8")
    print(f"저장: {path}")


if __name__ == "__main__":
    main()
