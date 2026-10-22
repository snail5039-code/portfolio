"""관찰·매수 판단 점수: AI가 '관찰'한 종목이 그날 얼마나 움직였나 (놓친 기회 vs 피한 손실).
매도 점수: 그날 판 종목이 판 가격 대비 종가로 어떻게 끝났나 (2026-10-20: 10/13·10/19 손으로 두 번 계산했다).
장 마감 요약(briefing.build_close)에 전 거래일 점수가 저절로 붙는다 (공공데이터 종가가 다음 날 14시에 들어와서).

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


def sell_score(sells: list[dict], closes: dict[str, int]) -> dict:
    """sells: [{stock_code, stock_name, qty, price}] 그날 체결된 매도, closes: 종목 → 그날 종가. 계산만 한다.
    after_pct: 판 가격 대비 종가 (+면 판 뒤 더 올랐다), missed_krw: 들고 있었으면 더 받았을 금액 (세금·수수료 전)."""
    rows = []
    for s in sells:
        close = closes.get(s["stock_code"])
        rows.append({**s, "close": close,
                     "after_pct": None if close is None else round((close - s["price"]) * 100 / s["price"], 2),
                     "missed_krw": None if close is None else (close - s["price"]) * s["qty"]})
    known = [r for r in rows if r["close"] is not None]
    return {"rows": rows, "missed_krw": sum(r["missed_krw"] for r in known) if known else None,
            "higher": sum(1 for r in known if r["after_pct"] > 0), "known": len(known)}


def day_decisions(conn, day: date, user_id: str | None = None) -> list[dict]:
    """그날 종목마다 마지막 매수·관찰 판단."""
    return conn.execute(
        "SELECT DISTINCT ON (p.stock_code) p.stock_code, s.name AS stock_name, p.action FROM proposals p"
        " JOIN stocks s ON s.code = p.stock_code"
        " WHERE (p.created_at AT TIME ZONE 'Asia/Seoul')::date = %s AND p.action IN ('watch', 'buy')"
        " AND (%s::uuid IS NULL OR p.user_id = %s)"
        " ORDER BY p.stock_code, p.created_at DESC", (day, user_id, user_id)).fetchall()


def day_sells(conn, day: date, user_id: str | None = None) -> list[dict]:
    """그날 체결된 매도 주문 (주문 한 건 = 한 줄, 체결 수량·가격)."""
    return conn.execute(
        "SELECT p.stock_code, s.name AS stock_name, o.filled_qty AS qty, o.filled_price AS price,"
        " to_char(o.created_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS at"
        " FROM orders o JOIN approvals a ON a.id = o.approval_id JOIN proposals p ON p.id = a.proposal_id"
        " JOIN stocks s ON s.code = p.stock_code"
        " WHERE o.side = 'sell' AND o.filled_qty > 0 AND (o.created_at AT TIME ZONE 'Asia/Seoul')::date = %s"
        " AND (%s::uuid IS NULL OR p.user_id = %s) ORDER BY o.created_at", (day, user_id, user_id)).fetchall()


def day_deferrals(conn, day: date, user_id: str | None = None) -> list[dict]:
    """그날 "시장 탓 하락"이라 매도 판단을 미룬 것 (폰 기록, 2026-10-20). price는 미룬 때 가격. 매도 점수와 같은 식으로
    종가와 비교한다: after_pct가 +면 미룬 게 맞았다 (미룬 때 팔았으면 손해)"""
    return conn.execute(
        "SELECT d.stock_code, s.name AS stock_name, 1 AS qty, d.price, to_char(d.created_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS at"
        " FROM sell_deferrals d JOIN stocks s ON s.code = d.stock_code"
        " WHERE (d.created_at AT TIME ZONE 'Asia/Seoul')::date = %s AND (%s::uuid IS NULL OR d.user_id = %s) ORDER BY d.created_at",
        (day, user_id, user_id)).fetchall()


def day_closes(conn, day: date, codes: list[str]) -> dict[str, int]:
    return {r["stock_code"]: r["close"] for r in conn.execute(
        "SELECT stock_code, close FROM stock_prices WHERE trade_date = %s AND stock_code = ANY(%s)", (day, codes))}


def latest(conn, user_id: str | None = None) -> dict | None:
    """종가가 들어온 가장 최근 거래일의 점수 (관찰 + 매도). 그날 판단·매도가 없으면 None"""
    day = conn.execute("SELECT max(trade_date) AS d FROM stock_prices").fetchone()["d"]
    if day is None:
        return None
    decisions, sells, deferred = day_decisions(conn, day, user_id), day_sells(conn, day, user_id), day_deferrals(conn, day, user_id)
    if not decisions and not sells and not deferred:
        return None
    watch = score(decisions, day_changes(conn, day, [d["stock_code"] for d in decisions]))
    closes = day_closes(conn, day, [s["stock_code"] for s in sells + deferred])
    sold, later = sell_score(sells, closes), sell_score(deferred, closes)
    return {"day": str(day), "watch_avg": watch["watch_avg"], "watched": sum(1 for r in watch["rows"] if r["action"] == "watch"),
            "missed": watch["missed"], "avoided": watch["avoided"], "sells": sold["rows"],
            "sell_missed_krw": sold["missed_krw"], "sell_higher": sold["higher"], "sell_known": sold["known"],
            # 미룬 매도: 미룬 때 가격 대비 종가. deferral_right = 미룬 게 맞은 수 (종가가 더 높음)
            "deferrals": later["rows"], "deferral_right": later["higher"], "deferral_known": later["known"]}


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
        sells, deferred = day_sells(conn, day), day_deferrals(conn, day)
        closes = day_closes(conn, day, [s["stock_code"] for s in sells + deferred])
        sold, later = sell_score(sells, closes), sell_score(deferred, closes)
    print(f"| 종목 | 마지막 판단 | {day} 등락 |\n|---|---|---|")
    for r in result["rows"]:
        change = "미확인 (종가 없음)" if r["change_pct"] is None else f"{r['change_pct']:+.2f}%"
        print(f"| {r['stock_name']} | {'관찰' if r['action'] == 'watch' else '매수 검토'} | {change} |")
    def pct(value: float | None) -> str:
        return "없음" if value is None else f"{value:+.2f}%"
    print(f"\n관찰 평균 {pct(result['watch_avg'])}, 매수 검토 평균 {pct(result['buy_avg'])}. "
          f"놓친 기회(+{MOVE_PCT}% 넘게): {', '.join(result['missed']) or '없음'}. "
          f"피한 손실(-{MOVE_PCT}% 넘게): {', '.join(result['avoided']) or '없음'}")
    if sold["rows"]:
        print(f"\n| 매도 시각 | 종목 | 수량 | 판 가격 | {day} 종가 | 판 가격 대비 |\n|---|---|---|---|---|---|")
        for r in sold["rows"]:
            after = "미확인 (종가 없음)" if r["close"] is None else f"{r['close']:,} | {r['after_pct']:+.2f}%"
            print(f"| {r['at']} | {r['stock_name']} | {r['qty']} | {r['price']:,} | {after} |")
        if sold["missed_krw"] is not None:
            print(f"\n판 뒤 더 오른 것 {sold['higher']}/{sold['known']}건, 들고 있었으면 {sold['missed_krw']:+,}원 (세금·수수료 전)")
    if later["rows"]:
        print(f"\n| 미룬 시각 | 종목 | 미룬 때 가격 | {day} 종가 | 미룬 때 대비 |\n|---|---|---|---|---|")
        for r in later["rows"]:
            after = "미확인 (종가 없음)" if r["close"] is None else f"{r['close']:,} | {r['after_pct']:+.2f}%"
            print(f"| {r['at']} | {r['stock_name']} | {r['price']:,} | {after} |")
        print(f"\n미룬 게 맞은 것(종가가 더 높음) {later['higher']}/{later['known']}건")


if __name__ == "__main__":
    main()
