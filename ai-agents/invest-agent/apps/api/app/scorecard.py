"""관찰·매수 판단 점수: AI가 '관찰'한 종목이 그날 얼마나 움직였나 (놓친 기회 vs 피한 손실).

실행: uv run python -m app.scorecard 2026-10-14

그날 AI가 매수 후보로 본 종목(보유 종목은 보유·매도만 고르므로 빠진다)의 마지막 판단과
그날 종가 등락률(전 거래일 종가 대비)을 맞춰 본다. 공공데이터 종가는 다음 영업일 14시 수집 뒤에 생기므로 하루 뒤에 돌린다.
2026-10-14: 상승 추세 삼성SDI를 위험을 이유로 관찰했는데 +5.00%로 마감. AI가 너무 조심스러운지 숫자로 보려고 만들었다.
"""

import argparse
from datetime import date

from psycopg.rows import dict_row

from app import config
from app.db import connect

MOVE_PCT = 2.0  # 관찰한 종목이 이만큼 넘게 오르면 '놓친 기회', 내리면 '피한 손실'


def score(decisions: list[dict], change: dict[str, float]) -> dict:
    """decisions: [{stock_code, stock_name, action}], change: 종목 → 그날 등락률(%). 계산만 한다."""
    rows = [{**d, "change_pct": change.get(d["stock_code"])} for d in decisions]
    known = [r for r in rows if r["change_pct"] is not None]

    def average(action: str) -> float | None:
        values = [r["change_pct"] for r in known if r["action"] == action]
        return round(sum(values) / len(values), 2) if values else None
    watched = [r for r in known if r["action"] == "watch"]
    return {"rows": rows, "watch_avg": average("watch"), "buy_avg": average("buy"),
            "missed": [r["stock_name"] for r in watched if r["change_pct"] >= MOVE_PCT],
            "avoided": [r["stock_name"] for r in watched if r["change_pct"] <= -MOVE_PCT]}


def day_decisions(conn, day: date) -> list[dict]:
    """그날 종목마다 마지막 매수·관찰 판단."""
    return conn.execute(
        "SELECT DISTINCT ON (p.stock_code) p.stock_code, s.name AS stock_name, p.action FROM proposals p"
        " JOIN stocks s ON s.code = p.stock_code"
        " WHERE (p.created_at AT TIME ZONE 'Asia/Seoul')::date = %s AND p.action IN ('watch', 'buy')"
        " ORDER BY p.stock_code, p.created_at DESC", (day,)).fetchall()


def day_changes(conn, day: date, codes: list[str]) -> dict[str, float]:
    """그날 종가 ÷ 전 거래일 종가 (금융위원회 시세). 종가가 아직 없으면 빠진다."""
    rows = conn.execute(
        "SELECT t.stock_code, t.close, (SELECT close FROM stock_prices p WHERE p.stock_code = t.stock_code"
        " AND p.trade_date < t.trade_date ORDER BY trade_date DESC LIMIT 1) AS prev"
        " FROM stock_prices t WHERE t.trade_date = %s AND t.stock_code = ANY(%s)", (day, codes)).fetchall()
    return {r["stock_code"]: round((r["close"] - r["prev"]) * 100 / r["prev"], 2) for r in rows if r["prev"]}


def main() -> None:
    parser = argparse.ArgumentParser(description="관찰·매수 판단 점수 (놓친 기회 vs 피한 손실)")
    parser.add_argument("day", type=date.fromisoformat)
    day = parser.parse_args().day
    with connect(config.DATABASE_URL, row_factory=dict_row) as conn:
        decisions = day_decisions(conn, day)
        result = score(decisions, day_changes(conn, day, [d["stock_code"] for d in decisions]))
    print(f"| 종목 | 마지막 판단 | {day} 등락 |\n|---|---|---|")
    for r in result["rows"]:
        change = "미확인 (종가 없음)" if r["change_pct"] is None else f"{r['change_pct']:+.2f}%"
        print(f"| {r['stock_name']} | {'관찰' if r['action'] == 'watch' else '매수 검토'} | {change} |")
    def pct(value: float | None) -> str:
        return "없음" if value is None else f"{value:+.2f}%"
    print(f"\n관찰 평균 {pct(result['watch_avg'])}, 매수 검토 평균 {pct(result['buy_avg'])}. "
          f"놓친 기회(+{MOVE_PCT}% 넘게): {', '.join(result['missed']) or '없음'}. "
          f"피한 손실(-{MOVE_PCT}% 넘게): {', '.join(result['avoided']) or '없음'}")


if __name__ == "__main__":
    main()
