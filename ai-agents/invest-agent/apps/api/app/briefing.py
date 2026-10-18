"""아침 브리핑 (docs/plan/12-todo-by-stage.md 1-1).

사용자마다 하루 한 번 만든다.
  1. 보유·관심 종목 소식: 최근 공시 제목·원문 링크 (공개 데이터)
  2. 오늘 한도: 1일 한도, 규칙에 걸린 요청 없는 날
  3. 오늘의 매수 제안 (맞춤 모드만): 후보는 코드가 고르고, 지금 분석과 똑같이 투자 AI → 검증 AI를 거친다.
     투자 AI가 매수 검토라고 하고 검증 AI가 승인·조건부 승인한 것만 싣는다.
     주문은 만들지 않는다 (승인 만료 10분이라 장 전에 만료됨). 앱의 "주문하기"가 평소 주문 흐름을 시작한다.

장 마감 요약 (12-todo-by-stage.md 2-4, build_close): LLM 없이 서버 기록만 정리한다 (비용 없음).
  오늘 주문·체결, 오늘 한도 사용, 오늘 규칙에 걸린 요청, 오늘 분석 수, 보유·관심 종목 오늘 공시

실행: uv run python -m app.briefing [--close] [--email 사용자]
자동: .env MORNING_BRIEF_TIME(기본 꺼짐, Gemini 비용), CLOSE_SUMMARY_TIME(기본 15:40, 비용 없음)
"""

import argparse
import logging
import statistics
import threading
from datetime import datetime, time, timedelta
from types import SimpleNamespace

from psycopg.rows import dict_row

from app.agents.analysis import (gather_node, invest_agent_node, route_after_verify, save_proposal, verify_agent_node,
                                 volatility_ranks, with_titles, CLAIM_LABELS)
from app.agents.query import latest_close, latest_snapshot
from app.agents.state import new_request
from app.clock import KST, seconds_until
from app.db import connect, jsonb
from app.notify import notify
from app.functions.orders import WORST_CASE_DROP_PCT, is_trading_day
from app.functions.suitability import buy_block_reason, stock_risk_grade
from app.routers.orders import today as today_summary
from app.routers.policy import profile_summary

MAX_CANDIDATES = 3   # 하루에 분석하는 후보 수 = Gemini 비용 상한 (후보마다 투자·검증 AI, 재검토 최대 2번)
NEWS_DAYS = 3        # 이 날 수 안의 공시를 "최근 소식"으로 본다 (주말을 넘겨도 금요일 공시가 보이게)


def trend_ranks(conn) -> dict[str, tuple[bool, float]]:
    """분석 대상 종목마다 (상승 추세인가, 약 20거래일 등락률 %). 상승 추세 = 종가가 20일 평균 위이고 20일 평균이 5거래일 전보다 높음
    (analysis.trend_text와 같은 기준). 종가가 25일 안 되면 빠진다"""
    closes: dict[str, list[int]] = {}
    for row in conn.execute(
        "SELECT s.code, p.close FROM stocks s CROSS JOIN LATERAL"
        " (SELECT close, trade_date FROM stock_prices WHERE stock_code = s.code ORDER BY trade_date DESC LIMIT 25) p"
        " WHERE s.is_target ORDER BY s.code, p.trade_date"):
        closes.setdefault(row["code"], []).append(row["close"])
    ranks = {}
    for code, c in closes.items():
        if len(c) == 25:
            ma, before = sum(c[-20:]) / 20, sum(c[-25:-5]) / 20
            ranks[code] = (c[-1] >= ma and ma >= before, (c[-1] - c[-21]) * 100 / c[-21])
    return ranks


def pick_candidates(conn, profile: dict, held: set[str], watching: list[str] = (), movers: list[str] = (),
                    skip: set[str] = frozenset()) -> list[dict]:
    """아직 갖고 있지 않고 내 성향 규칙상 매수를 제안할 수 있는 분석 대상. 장중 급등·거래대금 상위(movers, 폰이 증권사 순위에서 받음)를
    먼저, 그다음 관심 종목, 그다음 상승 추세 종목을 20거래일 등락률(강한 순)로.
    skip: 최근에 이미 '관찰'로 판단한 종목 (같은 종목을 매시간 다시 보지 않게).
    2026-10-15: 전에는 '최근 공시가 있는 종목'으로 골라 하락 추세 종목 3개(현대건설 등)를 다섯 번 다시 보고 다섯 번 다 관찰로 끝났다.
    """
    trend = trend_ranks(conn)
    movers, watching = list(movers), list(watching)

    def order(row: dict) -> tuple:
        up, change = trend.get(row["code"], (False, -1e9))
        return (movers.index(row["code"]) if row["code"] in movers else len(movers), row["code"] not in watching, not up, -change)
    rows = sorted(conn.execute("SELECT code, name FROM stocks WHERE is_target").fetchall(), key=order)
    picks, ranks = [], volatility_ranks(conn)
    for row in rows:
        if row["code"] in held or row["code"] in skip:
            continue
        reason = buy_block_reason(profile["mode"], profile.get("risk_level"), profile.get("flags") or [],
                                  stock_risk_grade(conn, row["code"]), ranks.get(row["code"]))
        if reason is None:
            picks.append({"code": row["code"], "name": row["name"], "uptrend": trend.get(row["code"], (False, 0))[0]})
        if len(picks) == MAX_CANDIDATES:
            break
    return picks


def analyze(database_url: str, base: dict, code: str, name: str) -> dict:
    """채팅의 분석 그래프와 같은 노드를 차례로 부른다 (fetch 멈춤 대신 서버의 최근 스냅샷을 쓴다)."""
    runtime = SimpleNamespace(context=SimpleNamespace(database_url=database_url))
    state = {**base, "stock_code": code, "stock_name": name, "query": f"{name} 오늘 매수할 만한가"}
    state |= gather_node(state, runtime)
    while True:
        state |= invest_agent_node(state)
        state |= verify_agent_node(state, runtime)
        if route_after_verify(state) != "invest_agent":
            return state


VOL_DAYS = 20  # 앱이 변동성 기준 수량을 정할 때 쓰는 기간 (2026-10-18 백테스트와 같은 기준)


def daily_vol_pct(closes: list[int]) -> float | None:
    """최근 VOL_DAYS거래일 하루 등락률의 표준편차(%). closes는 오래된 것부터. 모자라면 None (앱은 종목당 몫만 쓴다)"""
    recent = closes[-(VOL_DAYS + 1):]
    if len(recent) < VOL_DAYS + 1:
        return None
    return round(statistics.pstdev(b / a - 1 for a, b in zip(recent, recent[1:])) * 100, 3)


def pick_entry(conn, state: dict, proposal_id: str) -> dict:
    proposal, verification, sources = state["proposal"], state["verifications"][-1], state["sources"]
    close = latest_close(conn, state["stock_code"])
    return {
        "stock_code": state["stock_code"], "stock_name": state["stock_name"], "proposal_id": proposal_id,
        "verdict": verification["verdict"], "summary": verification["summary"], "conditions": verification["conditions"],
        "claims": [{"type": CLAIM_LABELS[c["type"]], "text": c["text"],
                    "sources": list(dict.fromkeys(sources[s]["title"] for s in c["source_ids"] if s in sources))} for c in proposal["claims"][:3]],
        "risks": [with_titles(r, sources) for r in proposal["risks"][:3]],
        "last_close": close and close["close"], "close_date": close and str(close["trade_date"]),
        # 절반 매수: 앱이 종목당 몫의 절반만 먼저 산다. 다음 판단에서 '전부'가 나오면 나머지를 산다 (2026-10-14)
        "portion": proposal.get("buy_portion") or "all",
        # 1주 기준 최악의 경우 (처리안과 같은 기준)
        "worst_case_loss": close and close["close"] * WORST_CASE_DROP_PCT // 100,
        # 변동성 기준 수량: 앱이 "평소 변동의 2배 빠지면 계좌의 2%"만큼만 산다 (2026-10-18 사용자 결정)
        "daily_vol_pct": daily_vol_pct([r["close"] for r in conn.execute(
            "SELECT close FROM (SELECT close, trade_date FROM stock_prices WHERE stock_code = %s"
            " ORDER BY trade_date DESC LIMIT %s) p ORDER BY trade_date", (state["stock_code"], VOL_DAYS + 1))]),
    }


def save_briefing(database_url: str, user_id: str, day, kind: str, content: dict) -> None:
    """그날의 아침 브리핑(morning)·장 마감 요약(close)을 저장한다. 다시 만들면 덮어쓴다."""
    with connect(database_url) as conn:
        conn.execute(
            "INSERT INTO briefings (user_id, brief_date, kind, content) VALUES (%s, %s, %s, %s)"
            " ON CONFLICT (user_id, brief_date, kind) DO UPDATE SET content = EXCLUDED.content, created_at = now()",
            (user_id, day, kind, jsonb(content)),
        )
        if kind == "morning":
            picks = len(content.get("picks") or [])
            notify(conn, user_id, "briefing", "아침 브리핑", f"오늘의 매수 제안 {picks}개가 왔어요" if picks else "오늘 브리핑이 왔어요")
        elif kind == "close":
            notify(conn, user_id, "close", "장 마감 요약", f"{day:%m월 %d일} 장 마감 요약이 왔어요")


def build_briefing(database_url: str, user_id: str, now: datetime | None = None, movers: list[str] = ()) -> dict:
    now = now or datetime.now(KST)
    with connect(database_url, row_factory=dict_row) as conn:
        profile = profile_summary(conn, user_id)
        snapshot = latest_snapshot(conn, user_id)
        held = {h["stock_code"] for h in snapshot["holdings"]} if snapshot else set()
        watching = [r["stock_code"] for r in conn.execute(
            "SELECT stock_code FROM watchlist WHERE user_id = %s ORDER BY created_at", (user_id,)).fetchall()]
        news = conn.execute(
            """
            SELECT d.stock_code, s.name AS stock_name, d.title, d.url, d.filed_at,
                   CASE WHEN d.stock_code = ANY(%(held)s) THEN '보유' ELSE '관심' END AS why
            FROM disclosures d JOIN stocks s ON s.code = d.stock_code
            WHERE d.stock_code = ANY(%(codes)s) AND d.filed_at >= %(since)s ORDER BY d.filed_at DESC LIMIT 20
            """,
            {"held": list(held), "codes": list(held | set(watching)), "since": now.date() - timedelta(days=NEWS_DAYS)},
        ).fetchall()
        limits = today_summary(conn, user_id)
        # 2시간 안에 '관찰'로 판단한 종목은 이번에 빼고 다른 후보를 본다 (그 뒤에는 다시 볼 수 있다)
        recent_watch = {r["stock_code"] for r in conn.execute(
            "SELECT stock_code FROM proposals WHERE user_id = %s AND action = 'watch' AND created_at > %s",
            (user_id, now - timedelta(hours=2)))}
        candidates = pick_candidates(conn, profile, held, watching, movers, recent_watch) if profile["mode"] == "custom" else []
        thread_id = None
        if candidates:  # 제안서는 대화(thread)에 묶여 저장된다. 브리핑마다 대화 하나를 만든다
            thread_id = str(conn.execute("INSERT INTO threads (user_id) VALUES (%s) RETURNING id", (user_id,)).fetchone()["id"])
            conn.commit()

    base = {**new_request("", [], profile), "user_id": user_id, "thread_id": thread_id, "client": "web",
            "snapshot": snapshot and {**snapshot, "fetched_at": snapshot["fetched_at"].isoformat(), "source": "server"}}
    picks, rechecks, checked = [], [], []
    for candidate in candidates:
        state = analyze(database_url, base, candidate["code"], candidate["name"])
        verdict = state["verifications"][-1]["verdict"]
        with connect(database_url) as conn:
            proposal_id = save_proposal(conn, state)  # 기록 화면에서 근거·검증 과정을 볼 수 있게 저장
        checked.append({"stock_name": candidate["name"], "action": state["proposal"]["action"], "verdict": verdict})
        if state["proposal"]["action"] == "buy" and verdict in ("approve", "conditional"):
            with connect(database_url, row_factory=dict_row) as conn:
                picks.append(pick_entry(conn, state, proposal_id))
        elif state["proposal"]["action"] == "watch" and candidate.get("uptrend") and verdict in ("approve", "conditional"):
            # 상승 추세인데 관찰: 서버에는 실시간 시세가 없어 반등을 볼 수 없다. 앱이 실시간 시세·1분봉으로 다시 판단하게 넘기고,
            # 사게 되면 절반만 (2026-10-15: 반등 매수 규칙이 이 단계에서 막혀 한 번도 시험되지 못했다)
            with connect(database_url, row_factory=dict_row) as conn:
                rechecks.append({**pick_entry(conn, state, proposal_id), "portion": "half"})

    content = {
        "mode": profile["mode"],
        "news": [{**n, "filed_at": str(n["filed_at"])} for n in news],
        "limits": limits,
        "picks": picks,
        "rechecks": rechecks,  # 앱 자동매매만 쓴다 (실시간으로 다시 판단할 상승 추세 관찰 종목). 화면의 매수 제안에는 안 보인다
        "checked": checked,  # 분석했지만 제안하지 않은 것도 남긴다 (왜 비었는지 보이게)
        "snapshot_at": snapshot and snapshot["fetched_at"].isoformat(),
    }
    save_briefing(database_url, user_id, now.date(), "morning", content)
    return content


def build_close(database_url: str, user_id: str, now: datetime | None = None) -> dict:
    """장 마감 요약. 숫자는 모두 서버 기록이다. 평가손익은 서버에 장 마감 시세가 없어 넣지 않는다 (앱 자산 탭에서 실시간)."""
    now = now or datetime.now(KST)
    with connect(database_url, row_factory=dict_row) as conn:
        orders = conn.execute(
            """
            SELECT s.name AS stock_name, o.side, o.qty, o.price, o.status, o.filled_qty, o.filled_price, o.broker_order_no,
                   o.created_at
            FROM orders o JOIN approvals a ON a.id = o.approval_id JOIN proposals p ON p.id = a.proposal_id
            JOIN stocks s ON s.code = p.stock_code
            WHERE p.user_id = %s AND o.created_at::date = current_date ORDER BY o.created_at
            """,
            (user_id,),
        ).fetchall()
        blocked = conn.execute(
            """
            SELECT s.name AS stock_name, p.action, pc.rules FROM policy_checks pc JOIN proposals p ON p.id = pc.proposal_id
            JOIN stocks s ON s.code = p.stock_code
            WHERE p.user_id = %s AND NOT pc.ok AND pc.created_at::date = current_date
            ORDER BY pc.created_at
            """,
            (user_id,),
        ).fetchall()
        analyses = conn.execute("SELECT count(*) AS n FROM proposals WHERE user_id = %s"
                                " AND created_at::date = current_date", (user_id,)).fetchone()["n"]
        snapshot = latest_snapshot(conn, user_id)
        held = [h["stock_code"] for h in snapshot["holdings"]] if snapshot else []
        watching = [r["stock_code"] for r in conn.execute("SELECT stock_code FROM watchlist WHERE user_id = %s", (user_id,))]
        news = conn.execute(
            """
            SELECT s.name AS stock_name, d.title, d.url, d.filed_at,
                   CASE WHEN d.stock_code = ANY(%(held)s) THEN '보유' ELSE '관심' END AS why
            FROM disclosures d JOIN stocks s ON s.code = d.stock_code
            WHERE d.stock_code = ANY(%(codes)s) AND d.filed_at = current_date ORDER BY s.name
            """,
            {"held": held, "codes": held + watching},
        ).fetchall()
        limits = today_summary(conn, user_id)

    filled = [o for o in orders if o["filled_qty"]]
    content = {
        "orders": [{**o, "created_at": o["created_at"].isoformat()} for o in orders],
        "bought_krw": sum(o["filled_qty"] * o["filled_price"] for o in filled if o["side"] == "buy"),
        "sold_krw": sum(o["filled_qty"] * o["filled_price"] for o in filled if o["side"] == "sell"),
        "blocked": [{"stock_name": b["stock_name"], "action": b["action"],
                     "rules": [r["label"] for r in b["rules"] if not r["ok"]]} for b in blocked],
        "analyses": analyses,
        "news": [{**n, "filed_at": str(n["filed_at"])} for n in news],
        "limits": limits,
        "snapshot_at": snapshot and snapshot["fetched_at"].isoformat(),
    }
    save_briefing(database_url, user_id, now.date(), "close", content)
    return content


def run_all(database_url: str | None = None, email: str | None = None, build=build_briefing) -> int:
    """build(아침 브리핑·장 마감 요약)를 만든다 (email이 없으면 모든 사용자). 만든 수를 돌려준다.
    한 사람이 실패해도 다음 사람은 만든다."""
    with connect(database_url, row_factory=dict_row) as conn:
        users = conn.execute("SELECT id FROM users WHERE %s::text IS NULL OR email = %s", (email, email)).fetchall()
    made = 0
    for user in users:
        try:
            build(database_url, str(user["id"]))
            made += 1
        except Exception:
            logging.getLogger(__name__).exception("%s 실패: %s", build.__name__, user["id"])
    return made


CATCH_UP_UNTIL = time(15, 20)  # 아침 브리핑을 놓쳤을 때 이 시각 전에 서버가 켜지면 바로 만든다 (자동매매가 사는 시간)


def missed_morning(database_url: str | None, at: time, now: datetime) -> bool:
    """오늘 거래일이고 at 시각이 지났는데(장중) 아침 브리핑이 아직 없다.
    2026-10-16: 서버가 08:20에 꺼져 있어 브리핑을 놓쳤고, 9시 넘어 켜도 만들지 않았다"""
    if not (is_trading_day(now.date()) and at <= now.time() < CATCH_UP_UNTIL):
        return False
    with connect(database_url) as conn:
        return conn.execute("SELECT 1 FROM briefings WHERE brief_date = %s AND kind = 'morning'", (now.date(),)).fetchone() is None


def run_daily(stop: threading.Event, at: time, build=build_briefing) -> None:
    """서버가 켜져 있는 동안 거래일마다 at 시각에 만든다. 아침 브리핑은 놓쳤으면 켜지자마자 만든다."""
    if build is build_briefing and missed_morning(None, at, datetime.now(KST)):
        run_all(build=build)
    while not stop.wait(seconds_until(at, datetime.now(KST))):
        run_all(build=build)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="아침 브리핑(Gemini 호출이 생긴다) 또는 장 마감 요약 만들기")
    parser.add_argument("--email", help="이 사용자만")
    parser.add_argument("--close", action="store_true", help="장 마감 요약 (LLM 없음)")
    args = parser.parse_args()
    print(f"만든 것: {run_all(email=args.email, build=build_close if args.close else build_briefing)}개")
