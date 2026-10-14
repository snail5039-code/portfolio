"""장 마감 AI 회고 · 내일 계획 (docs/plan/12-todo-by-stage.md 2-4b).

장 마감 요약(briefing.build_close) 위에 AI가 쓴다. 분석과 같은 규칙을 쓴다.
  1. 투자 AI: 오늘 매매 회고(산 이유가 맞았는지, 규칙, 분산, 비용)와 보유·관심 종목마다 내일 볼 것(관찰·매수 검토·매도 검토)
  2. 코드 검사: 출처 ID가 있는지, 종목이 맞는지, 성향 규칙상 허용 행동인지 (허용 안 되면 코드가 '관찰'로 바꾼다)
  3. 검증 AI: 투자 AI의 입력이 아니라 근거의 출처 ID만 받아 원문을 DB에서 다시 읽고 판정. 반려면 최대 2번 다시 쓴다
주문은 만들지 않는다. 결과는 그날 장 마감 요약(briefings kind='close')의 content.review에 붙는다.
일반 모드는 허용 행동이 '관찰'뿐이라 사라·팔라 판단 없이 회고와 사실만 남는다.

비용: 사용자 한 명당 Gemini 2~6번. 자동 실행은 .env CLOSE_REVIEW_TIME (기본 꺼짐)
실행: uv run python -m app.review [--email 사용자]
"""

import argparse
from datetime import datetime, timedelta

from psycopg.rows import dict_row

from app.agents import llm
from app.agents.analysis import (ACTION_LABELS, CLAIM_LABELS, MAX_REVISIONS, VERDICT_LABELS, claim_check, load_source,
                                 source_lines, source_time, user_lines, volatility_ranks)
from app.agents.query import SIDE_LABELS, latest_close, latest_snapshot, won
from app.briefing import NEWS_DAYS, build_close, run_all
from app.clock import KST
from app.db import connect, jsonb
from app.functions.orders import fee_estimate, sell_tax
from app.functions.suitability import allowed_actions, stock_risk_grade
from app.routers.policy import profile_summary

MAX_STOCKS = 8         # 내일 계획을 쓰는 종목 수 (보유 먼저, 그다음 관심)
DISCLOSURES_PER_STOCK = 3
REVIEW_ACTIONS = ("watch", "buy", "sell")
STATUS_LABELS = {"accepted": "접수(체결 전)", "filled": "체결", "partially_filled": "일부 체결", "failed": "실패",
                 "unknown_checked": "확인 필요", "cancelled": "취소됨", "replaced": "정정됨"}

# ---------- 출처 ----------
# 분석의 출처 ID(price:, dart:)에 더해
#   today            오늘 장 마감 요약 (서버의 주문·체결·한도·검사 기록) + 비용 추정
#   proposal:{id}    오늘 주문의 제안서 (산·판 이유)와 검증 판정
#   portfolio        최근 계좌 스냅샷 × 최근 종가로 계산한 종목 비중


def load_review_source(conn, source_id: str, user_id: str, day) -> dict | None:
    """출처 ID → {kind, title, url, as_of, content}. 투자 AI 자료도, 검증 AI가 다시 읽는 원문도 이 함수로 만든다."""
    kind, _, rest = source_id.partition(":")
    if source_id == "today":
        row = conn.execute("SELECT content, created_at FROM briefings WHERE user_id = %s AND brief_date = %s AND kind = 'close'",
                           (user_id, day)).fetchone()
        return row and {"kind": "record", "title": f"{day} 장 마감 요약 (서버 기록)", "url": None,
                        "as_of": row["created_at"].isoformat(), "content": today_text(conn, user_id, row["content"])}
    if kind == "proposal":
        row = conn.execute(
            "SELECT p.action, p.claims, p.risks, p.created_at, s.name, p.user_id FROM proposals p"
            " JOIN stocks s ON s.code = p.stock_code WHERE p.id::text = %s", (rest,)).fetchone()
        if row is None or str(row["user_id"]) != user_id:
            return None
        verdict = conn.execute("SELECT verdict, summary FROM verifications WHERE proposal_id::text = %s"
                               " ORDER BY round DESC LIMIT 1", (rest,)).fetchone()
        lines = [f"제안: {ACTION_LABELS[row['action']]}"]
        lines += [f"근거({CLAIM_LABELS[c['type']]}): {c['text']}" for c in row["claims"]]
        lines += [f"위험: {r}" for r in row["risks"]]
        if verdict:
            lines.append(f"검증 AI: {VERDICT_LABELS[verdict['verdict']]} · {verdict['summary']}")
        return {"kind": "proposal", "title": f"{row['name']} 제안서", "url": None,
                "as_of": row["created_at"].isoformat(), "content": "\n  ".join(lines)}
    if source_id == "portfolio":
        snapshot = latest_snapshot(conn, user_id)
        return snapshot and {"kind": "snapshot", "title": "내 계좌 비중 (최근 스냅샷 × 최근 종가, 코드 계산)", "url": None,
                             "as_of": snapshot["fetched_at"].isoformat(), "content": portfolio_text(conn, snapshot)}
    return load_source(conn, source_id, {})  # price:, dart:


def today_text(conn, user_id: str, content: dict) -> str:
    policy = conn.execute("SELECT max_order_krw, max_daily_krw, max_weight_pct, fee_rate_pct FROM policies WHERE user_id = %s",
                          (user_id,)).fetchone()
    lines = [f"산 금액(체결) {won(content['bought_krw'])}, 판 금액(체결) {won(content['sold_krw'])}"]
    fees, taxes = [], 0
    for o in content["orders"]:
        filled = f", {o['filled_qty']:,}주 × {won(o['filled_price'])} 체결" if o["filled_qty"] else ""
        lines.append(f"주문: {o['stock_name']} {o['qty']:,}주 {SIDE_LABELS[o['side']]} {won(o['price'])}"
                     f" · {STATUS_LABELS.get(o['status'], o['status'])}{filled}")
        if o["filled_qty"]:
            amount = o["filled_qty"] * o["filled_price"]
            fees.append(fee_estimate(amount, policy and policy["fee_rate_pct"]))
            taxes += sell_tax(amount, "KOSPI") if o["side"] == "sell" else 0  # 코스피·코스닥 모두 0.20%
    if not content["orders"]:
        lines.append("오늘 주문 없음")
    elif fees:
        fee = "수수료율 미입력이라 미확인" if None in fees else won(sum(fees))
        lines.append(f"비용 추정(체결분): 수수료 {fee}, 매도 세금 {won(taxes)} (실제 청구액은 증권사 기준)")
    limits = content["limits"]
    lines.append(f"1일 한도 {won(limits['daily_used_krw'])} / {won(limits['daily_limit_krw'])} 사용,"
                 f" 규칙에 걸린 요청 없는 날 {limits['clean_days']}일째")
    if policy:
        lines.append(f"규칙: 1회 {won(policy['max_order_krw'])}, 1일 {won(policy['max_daily_krw'])}, 한 종목 비중 {policy['max_weight_pct']}% 이하")
    lines += [f"규칙에 걸린 요청: {b['stock_name']} ({', '.join(b['rules'])})" for b in content["blocked"]]
    lines.append(f"오늘 분석·제안 {content['analyses']}번")
    return "\n  ".join(lines)


def portfolio_text(conn, snapshot: dict) -> str:
    """종목 비중 = 평가금액 ÷ (현금 + 평가금액 합). 평가금액 = 수량 × 최근 종가 (종가가 없으면 평균 매입가)."""
    rows = []
    for h in snapshot["holdings"]:
        close = latest_close(conn, h["stock_code"])
        price, basis = (close["close"], f"{close['trade_date']} 종가") if close else (h["avg_price"], "평균 매입가")
        rows.append((h, h["qty"] * price, basis))
    total = snapshot["cash_krw"] + sum(value for _, value, _ in rows)
    lines = [f"현금 {won(snapshot['cash_krw'])}" + (f" (비중 {snapshot['cash_krw'] * 100 / total:.1f}%)" if total else "")]
    lines += [f"{h['stock_name']}({h['stock_code']}) {h['qty']:,}주, 평균 매입가 {won(h['avg_price'])},"
              f" 평가 {won(value)} ({basis}), 비중 {value * 100 / total:.1f}%" for h, value, basis in rows]
    return "\n  ".join(lines)


# ---------- AI에게 넘길 글 ----------

def stock_lines(stocks: list[dict]) -> list[str]:
    return [f"- {s['code']} {s['name']} | {'보유' if s['held'] else '관심'} | 위험등급 {s['grade']}등급"
            f" | 허용 행동: {', '.join(s['allowed'])}" for s in stocks]


def review_context(day, profile: dict, stocks: list[dict], sources: dict, verifications: list) -> str:
    parts = [f"[오늘] {day}", "[사용자]\n" + "\n".join(user_lines(profile)), "[종목]\n" + "\n".join(stock_lines(stocks)),
             "[자료]\n" + "\n".join(source_lines(sources))]
    if verifications:
        parts.append("[검증 AI 반박] 아래를 고쳐 다시 써라\n" + "\n".join(f"- {c}" for c in verifications[-1]["challenges"]))
    return "\n\n".join(parts)


def all_claims(draft: dict) -> list[tuple[str, dict]]:
    """(근거 번호, 근거). 회고는 r0, r1 … 내일 계획은 t0.0 (첫 종목의 첫 근거) …"""
    return ([(f"r{n}", c) for n, c in enumerate(draft["retrospective"])]
            + [(f"t{i}.{j}", c) for i, item in enumerate(draft["tomorrow"]) for j, c in enumerate(item["reasons"])])


def review_checks(draft: dict, reloaded: dict, stocks: dict) -> list[dict]:
    """AI 없이 확실히 잡을 수 있는 것. 하나라도 fail이면 승인하지 않는다."""
    checks = [claim_check(target, claim, reloaded, None) for target, claim in all_claims(draft)]
    for i, item in enumerate(draft["tomorrow"]):
        problems = []
        if item["stock_code"] not in stocks:
            problems.append(f"[종목]에 없는 종목 코드 {item['stock_code']}")
        if item["action"] != "watch" and not item["invalid_if"]:
            problems.append("매수·매도 검토인데 틀리는 조건이 없음")
        checks.append({"target": f"t{i}", "result": "fail" if problems else "pass",
                       "detail": "; ".join(problems) or "종목·조건 확인", "source_ids": []})
    checks.append({"target": "risks", "result": "pass" if draft["risks"] else "fail",
                   "detail": f"위험 {len(draft['risks'])}개" if draft["risks"] else "위험이 없음", "source_ids": []})
    return checks


def verify_context(profile: dict, stocks: list[dict], draft: dict, reloaded: dict, checks: list[dict]) -> str:
    """검증 AI에게는 회고의 근거·출처 ID와 다시 읽은 원문만 준다. 투자 AI의 지시문·자료 목록은 주지 않는다."""
    names = {s["code"]: s["name"] for s in stocks}
    claims = [f"{target}. ({c['type']}) {c['text']} | 출처: {', '.join(c['source_ids']) or '없음'}"
              for target, c in all_claims(draft)]
    plans = [f"t{i}. {names.get(item['stock_code'], item['stock_code'])}: {ACTION_LABELS[item['action']]}"
             f" | 틀리는 조건: {'; '.join(item['invalid_if']) or '없음'}" for i, item in enumerate(draft["tomorrow"])]
    return "\n\n".join([
        "[사용자]\n" + "\n".join(user_lines(profile)), "[종목]\n" + "\n".join(stock_lines(stocks)),
        "[내일 계획]\n" + "\n".join(plans), "[근거]\n" + "\n".join(claims),
        "[위험]\n" + "\n".join(f"- {r}" for r in draft["risks"]),
        "[원문] (출처 ID로 다시 읽은 것)\n" + "\n".join(source_lines(reloaded)),
        "[코드 검사]\n" + "\n".join(f"- {c['target']}: {c['result']} ({c['detail']})" for c in checks),
    ])


# ---------- 만들기 ----------

def build_review(database_url: str, user_id: str, now: datetime | None = None) -> dict | None:
    """오늘 장 마감 요약에 AI 회고를 붙이고 돌려준다. 오늘 매매·보유·관심 종목이 모두 없으면 만들지 않는다 (None, 비용 없음)."""
    now = now or datetime.now(KST)
    day = now.date()
    build_close(database_url, user_id, now)  # 요약을 지금 기록으로 다시 만든다 (그 뒤의 매매가 빠지지 않게, LLM 없음)

    with connect(database_url, row_factory=dict_row) as conn:
        profile = profile_summary(conn, user_id)
        snapshot = latest_snapshot(conn, user_id)
        held = [h["stock_code"] for h in snapshot["holdings"]] if snapshot else []
        watching = [r["stock_code"] for r in conn.execute(
            "SELECT stock_code FROM watchlist WHERE user_id = %s ORDER BY created_at", (user_id,))]
        codes = list(dict.fromkeys(held + watching))[:MAX_STOCKS]
        stocks, ranks = [], volatility_ranks(conn)
        for row in conn.execute("SELECT code, name FROM stocks WHERE code = ANY(%s)", (codes,)).fetchall():
            grade, holds = stock_risk_grade(conn, row["code"]), row["code"] in held
            allowed = allowed_actions(profile["mode"], profile.get("risk_level"), profile.get("flags") or [], grade, holds,
                                      ranks.get(row["code"]))
            stocks.append({"code": row["code"], "name": row["name"], "grade": grade, "held": holds,
                           "allowed": [a for a in REVIEW_ACTIONS if a in allowed]})
        stocks.sort(key=lambda s: codes.index(s["code"]))
        proposal_ids = [str(r["id"]) for r in conn.execute(
            "SELECT DISTINCT p.id FROM proposals p JOIN approvals a ON a.proposal_id = p.id JOIN orders o ON o.approval_id = a.id"
            " WHERE p.user_id = %s AND o.created_at::date = %s", (user_id, day))]
        if not stocks and not proposal_ids:
            return None
        ids = ["today", *(f"proposal:{p}" for p in proposal_ids)] + (["portfolio"] if snapshot else [])
        for s in stocks:
            latest = latest_close(conn, s["code"])
            if latest:
                ids.append(f"price:{s['code']}:{latest['trade_date']}")
            ids += [f"dart:{r['rcept_no']}" for r in conn.execute(
                "SELECT rcept_no FROM disclosures WHERE stock_code = %s AND filed_at >= %s ORDER BY filed_at DESC LIMIT %s",
                (s["code"], day - timedelta(days=NEWS_DAYS), DISCLOSURES_PER_STOCK))]
        sources = {sid: src for sid in ids if (src := load_review_source(conn, sid, user_id, day))}

    by_code = {s["code"]: s for s in stocks}
    verifications = []
    while True:
        draft = llm.write_review(review_context(day, profile, stocks, sources, verifications)).model_dump()
        for item in draft["tomorrow"]:
            stock = by_code.get(item["stock_code"])
            if stock and item["action"] not in stock["allowed"]:
                # 성향 규칙은 AI가 아니라 코드가 지킨다
                draft["risks"].append(f"성향 규칙에 따라 {stock['name']}은(는) '{ACTION_LABELS[item['action']]}' 대신 '관찰'로 바꿨어요.")
                item["action"] = "watch"
        cited = [sid for _, claim in all_claims(draft) for sid in claim["source_ids"]]
        with connect(database_url, row_factory=dict_row) as conn:
            reloaded = {sid: src for sid in dict.fromkeys(cited) if (src := load_review_source(conn, sid, user_id, day))}
        checks = review_checks(draft, reloaded, by_code)
        verdict = llm.verify_review(verify_context(profile, stocks, draft, reloaded, checks)).model_dump()
        failed = [c for c in checks if c["result"] == "fail"]
        if failed and verdict["verdict"] in ("approve", "conditional"):
            verdict["verdict"] = "reject"  # 코드 검사에서 틀린 것이 나오면 AI가 승인해도 반려
            verdict["challenges"] += [f"{c['target']}: {c['detail']}" for c in failed]
        if verdict["verdict"] == "reject" and len(verifications) >= MAX_REVISIONS:
            verdict["verdict"] = "user_judgement"  # 2번 고쳐도 합의가 안 되면 사용자가 판단
            verdict["summary"] = f"{MAX_REVISIONS}번 수정했지만 검증을 통과하지 못했어요. " + verdict["summary"]
        verifications.append({**verdict, "checks": checks + verdict["checks"]})
        if verdict["verdict"] != "reject":
            break

    def shown(claim: dict) -> dict:
        return {"type": CLAIM_LABELS[claim["type"]], "text": claim["text"],
                "sources": list(dict.fromkeys(sources[s]["title"] for s in claim["source_ids"] if s in sources))}

    used = dict.fromkeys(sid for _, claim in all_claims(draft) for sid in claim["source_ids"] if sid in sources)
    review = {
        "verdict": verdict["verdict"], "verdict_label": VERDICT_LABELS[verdict["verdict"]], "summary": verdict["summary"],
        "conditions": verdict["conditions"], "disagreements": verdict["disagreements"], "rounds": len(verifications),
        "general": profile["mode"] != "custom",
        "retrospective": [shown(c) for c in draft["retrospective"]],
        "tomorrow": [{"stock_code": item["stock_code"], "stock_name": by_code[item["stock_code"]]["name"],
                      "action": ACTION_LABELS[item["action"]], "reasons": [shown(c) for c in item["reasons"]],
                      "invalid_if": item["invalid_if"]} for item in draft["tomorrow"] if item["stock_code"] in by_code],
        "risks": draft["risks"],
        "sources": [{"title": sources[s]["title"], "url": sources[s]["url"],
                     "as_of": sources[s]["as_of"] and source_time(sources[s]["as_of"])} for s in used],
        "made_at": now.isoformat(),
    }
    with connect(database_url) as conn:
        conn.execute("UPDATE briefings SET content = content || jsonb_build_object('review', %s::jsonb)"
                     " WHERE user_id = %s AND brief_date = %s AND kind = 'close'",
                     (jsonb(review), user_id, day))
    return review


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="장 마감 AI 회고·내일 계획 만들기 (Gemini 호출이 생긴다)")
    parser.add_argument("--email", help="이 사용자만")
    print(f"만든 것: {run_all(email=parser.parse_args().email, build=build_review)}개")
