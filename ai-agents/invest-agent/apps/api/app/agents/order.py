"""주문 그래프 (docs/plan/04-graph-design.md 5장).

    find_stock → check_target → order_values → get_account → set_price
                              └ (정정·취소) find_order ┘
                              order_values → (조건·분할) reserve → 예약 저장 (조건이 되면 폰이 위의 흐름으로 주문)
      → gather → invest_agent ⇄ verify_agent (가벼운 분석: 경고 위주)
      → policy ─┬─ 위반 → blocked (기록하고 막음)
                └─ 통과 → prepare_approval → approval ─┬─ 승인 → execute ─┬─ 결과 → 기록
                                                       ├─ 수정 → policy  └─ 가격 1% 넘게 변동 → policy (다시 승인)
                                                       └─ 거절·만료 → 기록
    분석에서 "이대로 주문할까요?"로 왔으면(from_analysis): order_values → set_price → policy (분석·계좌 조회는 이미 함)

- 정책 검사·금액·행동 코치는 코드(functions/orders.py)가 한다
- 사용자가 직접 지시한 주문은 검증 AI가 반려해도 막지 않고, 처리안에 "확인 필요"로 올려 확인을 받는다 (2026-10-06 결정).
  정책 위반(한도·현금·장 시간)은 확인과 상관없이 막는다
- 주문은 서버가 내지 않는다. execute 멈춤으로 폰에 부탁하고, 폰이 증권사에 주문한 결과를 받아 기록한다
- 정정·취소(3-1)도 새 주문과 같은 길(투자 AI → 검증 AI → 정책 검사 → 처리안 → 승인 → 폰 실행)을 간다.
  오늘 낸 이 종목의 미체결 주문(가장 최근)을 대상으로, 남은 수량 전부를 취소하거나 지정가를 바꾼다 (2026-10-08 사용자 결정)
"""

import re
from datetime import datetime, timedelta
from decimal import Decimal

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from psycopg.rows import dict_row

from app import clock, config, signals
from app.agents import llm
from app.agents.analysis import (
    ACTION_LABELS, VERDICT_LABELS, check_target_node, gather_node, get_account_node, invest_agent_node, save_proposal,
    verify_agent_node, with_titles,
)
from app.agents.interrupts import pause
from app.agents.query import SIDE_LABELS, end_if_answered, find_stock_node, latest_close, won
from app.agents.state import Context, InvestState
from app.db import audit, connect, jsonb
from app.functions import orders
from app.functions.behavior import behavior
from app.notify import notify

CHANGE_LABELS = {"cancel": "취소", "modify": "정정"}
OPEN_STATUSES = ("accepted", "partially_filled", "unknown_checked")
RESULT_LABELS = {
    "accepted": "주문이 접수됐어요", "filled": "주문이 체결됐어요", "partially_filled": "주문이 일부 체결됐어요",
    "failed": "주문이 실패했어요", "unknown_checked": "응답이 불확실해 주문 내역을 확인했어요",
}
MODE_LABELS = {"mock": "모의투자", "real": "실전투자"}
BROKERS = {"mock": "kis_mock", "real": "kb"}  # 모의는 KIS 모의투자, 실전은 KB증권 (4-1, 2026-10-09 사용자 결정)


def mode_of(state) -> str:
    return "real" if state.get("real_mode") else "mock"


def parse_qty(text: str) -> int | None:
    match = re.search(r"\d[\d,]*", text or "")
    return int(match.group().replace(",", "")) if match else None


# ---------- 값 모으기 ----------

def order_values_node(state: InvestState) -> dict:
    """매수·매도와 수량이 없으면 묻는다 (FR-11). 0주 이하나 너무 큰 수량은 막는다."""
    side = state.get("side")
    if side is None:
        reply = pause("question", text=f"{state['stock_name']}을(를) 살까요, 팔까요?",
                      choices=[{"id": "buy", "label": "매수"}, {"id": "sell", "label": "매도"}])
        answer = reply.get("choice_id") or reply.get("text") or ""
        side = "buy" if answer == "buy" or "사" in answer else "sell" if answer == "sell" or "팔" in answer else None
        if side is None:
            return {"answer": "매수인지 매도인지 알아듣지 못했어요. 다시 말해 주세요."}
    qty = state.get("qty")
    if qty is None:
        verb = "살까요" if side == "buy" else "팔까요"
        qty = parse_qty(pause("question", text=f"몇 주 {verb}?", choices=None).get("text"))
        if qty is None:
            return {"answer": "수량을 알아듣지 못했어요. '4주'처럼 다시 말해 주세요."}
    if not 1 <= qty <= orders.MAX_QTY:
        return {"answer": f"수량은 1주부터 {orders.MAX_QTY:,}주까지 주문할 수 있어요."}
    return {"side": side, "qty": qty}


def find_order_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """정정·취소할 원래 주문: 오늘 낸 이 종목의 아직 다 체결되지 않은 주문. 여러 개면 고르게 하고, 정정 가격이 없으면 묻는다.
    수량을 말했으면("2주만 취소") 남은 수량 중 그만큼만, 아니면 남은 수량 전부."""
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        rows = conn.execute(
            "SELECT o.id, o.broker_order_no, o.side, o.qty - o.filled_qty AS qty, o.price, o.created_at FROM orders o"
            " JOIN approvals a ON a.id = o.approval_id JOIN proposals p ON p.id = a.proposal_id"
            " WHERE p.user_id = %s AND p.stock_code = %s AND o.kind <> 'cancel' AND o.status = ANY(%s)"
            " AND o.broker_order_no IS NOT NULL AND o.filled_qty < o.qty AND o.created_at >= date_trunc('day', now())"
            " ORDER BY o.created_at DESC",
            (state["user_id"], state["stock_code"], list(OPEN_STATUSES)),
        ).fetchall()
    change = CHANGE_LABELS[state["order_change"]]
    if not rows:
        return {"answer": f"{change}할 {state['stock_name']} 주문이 없어요. 오늘 낸 주문 중 아직 체결되지 않은 것만 {change}할 수 있어요."}
    row = rows[0]
    if len(rows) > 1:
        choices = [{"id": str(r["id"]), "label": f"{r['created_at']:%H:%M} {SIDE_LABELS[r['side']]} 미체결 {r['qty']:,}주 · "
                                                f"{won(r['price'])} (주문번호 {r['broker_order_no']})"} for r in rows]
        picked = pause("question", text=f"{state['stock_name']} 미체결 주문이 {len(rows)}개예요. 어느 주문을 {change}할까요?",
                       choices=choices).get("choice_id")
        row = next((r for r in rows if str(r["id"]) == picked), None)
        if row is None:
            return {"answer": f"어느 주문인지 알아듣지 못했어요. {change}하지 않았어요."}
    target = {**{k: v for k, v in row.items() if k != "created_at"}, "id": str(row["id"])}
    qty = state.get("qty") or target["qty"]
    if not 1 <= qty <= target["qty"]:
        return {"answer": f"{change}할 수 있는 수량은 미체결 {target['qty']:,}주까지예요."}
    price = target["price"]
    if state["order_change"] == "modify":
        price = state.get("limit_price") or parse_qty(pause(
            "question", text=f"{state['stock_name']} 주문(지정가 {won(target['price'])})을 얼마로 바꿀까요?", choices=None).get("text"))
        if not price or price <= 0:
            return {"answer": "바꿀 가격을 알아듣지 못했어요. '105,000원으로'처럼 다시 말해 주세요."}
        if price == target["price"]:
            return {"answer": f"지금 주문 가격과 같아요 ({won(price)}). 정정하지 않았어요."}
    return {"target_order": target, "side": target["side"], "qty": qty, "limit_price": price}


RESERVE_DAYS = 7          # 가격 조건 예약은 7일 지나면 끝
SPLIT_GAP = timedelta(minutes=30)  # 분할 주문 사이 간격
MAX_SPLITS = 10


def reserve_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """예약·조건부(3-2)·분할(3-3) 주문: 조건만 저장한다. 조건이 되면 폰이 그때 일반 주문 흐름(투자 AI → 검증 AI → 정책 → 승인)을 돌린다."""
    side, qty = state["side"], state["qty"]  # 시각은 DB now()로 (폰이 실제 시계로 비교하고, 만료도 DB가 본다)
    label = f"{state['stock_name']} {SIDE_LABELS[side]}"
    with connect(runtime.context.database_url) as conn:
        if state.get("trigger_price"):
            direction = state.get("trigger_direction") or ("below" if side == "buy" else "above")
            conn.execute(
                "INSERT INTO reservations (user_id, stock_code, side, qty, kind, trigger_price, direction, expires_at)"
                " VALUES (%s, %s, %s, %s, 'price', %s, %s, now() + %s)",
                (state["user_id"], state["stock_code"], side, qty, state["trigger_price"], direction,
                 timedelta(days=RESERVE_DAYS)))
            when = f"{won(state['trigger_price'])} {'이하로 내려오면' if direction == 'below' else '이상으로 오르면'}"
            text = f"예약했어요: {label} {qty:,}주, 현재가가 {when} 주문해요 ({RESERVE_DAYS}일 동안)."
        else:
            count = state["split_count"]
            if not 2 <= count <= min(MAX_SPLITS, qty):
                return {"answer": f"나눠 주문하는 횟수는 2번부터 {min(MAX_SPLITS, qty)}번까지 할 수 있어요."}
            parts = [qty // count + (1 if i < qty % count else 0) for i in range(count)]
            group = conn.execute("SELECT gen_random_uuid()").fetchone()[0]
            for i, part in enumerate(parts):
                conn.execute(
                    "INSERT INTO reservations (user_id, stock_code, side, qty, kind, due_at, group_id, expires_at)"
                    " VALUES (%s, %s, %s, %s, 'split', now() + %s, %s, now() + %s)",
                    (state["user_id"], state["stock_code"], side, part, SPLIT_GAP * i, group,
                     SPLIT_GAP * i + timedelta(days=1)))
            text = (f"예약했어요: {label} {qty:,}주를 {count}번({', '.join(f'{p:,}주' for p in parts)})에 나눠, "
                    f"지금부터 {int(SPLIT_GAP.total_seconds() // 60)}분마다 주문해요.")
        audit(conn, state["user_id"], "reservation_created", {"stock_code": state["stock_code"], "side": side, "qty": qty,
                                                              "trigger_price": state.get("trigger_price"),
                                                              "split_count": state.get("split_count")})
    return {"answer": text + "\n조건이 되면 앱이 그때 투자 AI → 검증 AI → 한도 검사를 거쳐 처리안을 만들어요. "
                      "앱이 켜져 있어야 하고, 장중(평일 09:05~15:20)에만 확인해요. 더보기 > 예약 주문에서 취소할 수 있어요."}


def tick_below(price: int) -> int:
    """한 호가 아래 가격 (한국거래소 호가 단위, 코스피·코스닥 같음)"""
    below = price - 1
    tick = next(t for limit, t in ((2_000, 1), (5_000, 5), (20_000, 10), (50_000, 50), (200_000, 100), (500_000, 500),
                                    (float("inf"), 1_000)) if below < limit)
    return max(tick, below // tick * tick)


def set_price_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """지정가: 사용자가 말한 가격, 없으면 폰이 받은 현재가, 웹이면 최근 종가. 시장가는 MVP에서 지원하지 않는다.
    자동매매 매도는 현재가보다 한 호가 낮게 낸다 (2026-10-21 HLB: 현재가 42,450원 매도가 그 아래에 머물러 체결 0주)"""
    if state.get("limit_price"):
        return {}
    if state.get("prices"):
        price = state["prices"][0]["price"]
        return {"limit_price": tick_below(price) if state.get("auto_origin") and state.get("side") == "sell" else price}
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        last = latest_close(conn, state["stock_code"])
    if last is None:
        return {"answer": "주문 가격을 정할 수 없어요. '7만원에'처럼 가격을 말해 주세요."}
    return {"limit_price": last["close"]}


# ---------- 정책 검사와 처리안 ----------

def closes_of(conn, codes: list[str]) -> dict[str, int]:
    rows = conn.execute(
        "SELECT DISTINCT ON (stock_code) stock_code, close FROM stock_prices WHERE stock_code = ANY(%s)"
        " ORDER BY stock_code, trade_date DESC", (codes,),
    ).fetchall()
    return {row["stock_code"]: row["close"] for row in rows}


def five_day_rank(conn, code: str) -> tuple[float | None, Decimal | None]:
    """최근 5거래일 상승률과, 분석 대상 안에서 그 순위 (0~1, 1이면 가장 많이 오름)."""
    closes: dict[str, list[int]] = {}  # 종목 → 최근 6거래일 종가 (최신부터). 대상 전체를 쿼리 한 번으로
    for row in conn.execute(
        "SELECT s.code, p.close FROM stocks s CROSS JOIN LATERAL"
        " (SELECT close, trade_date FROM stock_prices WHERE stock_code = s.code ORDER BY trade_date DESC LIMIT 6) p"
        " WHERE s.is_target ORDER BY s.code, p.trade_date DESC"):
        closes.setdefault(row["code"], []).append(row["close"])
    returns = {c: (Decimal(v[0]) / v[5] - 1) * 100 for c, v in closes.items() if len(v) == 6}
    if code not in returns:
        return None, None
    rank = sum(1 for value in returns.values() if value <= returns[code]) / len(returns)
    return rank, returns[code].quantize(Decimal("0.1"))


def policy_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    side, qty, price, code = state["side"], state["qty"], state["limit_price"], state["stock_code"]
    snapshot = state.get("snapshot")
    holdings = snapshot["holdings"] if snapshot else []
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        policy = conn.execute("SELECT * FROM policies WHERE user_id = %s", (state["user_id"],)).fetchone()
        today_ordered = int(conn.execute(orders.TODAY_ORDERED_SQL, (state["user_id"],)).fetchone()["total"])
        recent_trades = conn.execute(
            "SELECT count(*) AS n FROM orders o JOIN approvals a ON a.id = o.approval_id"
            " JOIN proposals p ON p.id = a.proposal_id WHERE p.user_id = %s AND p.stock_code = %s"
            " AND o.status IN ('accepted', 'filled', 'partially_filled') AND o.created_at >= now() - %s::interval",
            (state["user_id"], code, f"{orders.FREQUENT_TRADE_DAYS} days"),
        ).fetchone()["n"]
        market = conn.execute("SELECT market FROM stocks WHERE code = %s", (code,)).fetchone()["market"]
        closes = closes_of(conn, [h["stock_code"] for h in holdings])
        hot_rank, five_day_return = five_day_rank(conn, code)
        habits = behavior(conn, state["user_id"]) if "frequent_trading" in state["flags"] else None

    change, target = state.get("order_change"), state.get("target_order")
    result = orders.policy_check(side, qty, price, policy, today_ordered, snapshot, closes, code, clock.market_now(),
                                 ["snapshot"] if snapshot else [], change=change,
                                 replacing_krw=target["qty"] * target["price"] if change == "modify" else 0,
                                 account_pct=orders.ACCOUNT_ORDER_PCT[state.get("risk_level") or 1], mock=mode_of(state) == "mock" and not config.MOCK_ORDER_LIMITS)
    amount = orders.order_amount(qty, price)
    fee = orders.fee_estimate(amount, policy["fee_rate_pct"])
    tax = orders.sell_tax(amount, market) if side == "sell" else 0
    held = next((h for h in holdings if h["stock_code"] == code), None)
    gain_pct = (Decimal(price - held["avg_price"]) / held["avg_price"] * 100).quantize(Decimal("0.1")) \
        if side == "sell" and held and held["avg_price"] else None
    losers = [h["stock_name"] for h in holdings
              if h["stock_code"] != code and closes.get(h["stock_code"], h["avg_price"]) < h["avg_price"]]
    warnings = [] if change == "cancel" else orders.coach_warnings(  # 취소는 새로 사고팔지 않으니 행동 코치가 없다
        side, recent_trades, hot_rank, five_day_return, "chases_hot_stocks" in state["flags"],
        result["weight_after"], policy["max_weight_pct"], gain_pct, losers,
        (fee or 0) + tax, hot_buys_habit="hot_buys" in state["flags"], monthly_fills=habits and habits["fills"])

    confirm = []
    if state["mode"] != "custom":
        confirm.append("성향 퀴즈를 하지 않은 일반 모드라 내 성향에 맞는지 확인하지 않은 주문이에요.")
    elif side == "buy" and state.get("buy_block_reason") and change != "cancel":
        confirm.append(f"성향보다 위험한 주문이에요: {state['buy_block_reason']}.")
    verification = state["verifications"][-1]
    if state.get("auto_origin") and state["proposal"]["action"] != side:
        confirm.append(f"투자 AI가 지금은 {SIDE_LABELS[side]}하지 말고 관찰하자고 했어요 (자동매매 주문).")
    if verification["verdict"] in ("reject", "user_judgement"):
        confirm.append(f"검증 AI 판정이 '{VERDICT_LABELS[verification['verdict']]}'이에요: {verification['summary']}")
    if state.get("real_mode"):  # 4-2 실전 안전장치
        confirm.append("실전 주문이에요. 실제 돈이 나가고 손실이 날 수 있어요.")
        if amount >= orders.REAL_HIGH_AMOUNT:
            confirm.append(f"고액 실전 주문이에요 ({won(amount)}). 금액을 한 번 더 확인해 주세요.")
        if state.get("auto_origin") and amount > orders.REAL_AUTO_MAX:
            confirm.append(f"실전 자동 주문은 {won(orders.REAL_AUTO_MAX)}까지만 자동으로 승인해요.")
    # 퀴즈 답이든 실제 습관이든 급등주를 바로 사는 편이면 급등 매수 때 한 번 더 확인한다
    if orders.needs_hot_confirm(warnings, bool({"chases_hot_stocks", "hot_buys"} & set(state["flags"]))):
        confirm.append("급등 직후 매수예요. 한 번 더 생각해 보셨나요?")
    # 5-4 대화 속 성향 신호 (분석 자료를 모을 때 본 것). 취소는 새로 사고팔지 않으니 보지 않는다
    signal = None if change == "cancel" else state.get("conversation_signal")
    if signal_text := signals.signal_warning(signal, side):
        warnings.append(signal_text)
        if side == "buy":
            confirm.append("대화에서 투자 위험 신호가 보였어요. 이 돈으로 투자해도 괜찮은지 확인해 주세요.")

    card = {
        "stock_code": code, "stock_name": state["stock_name"], "side": side, "qty": qty, "limit_price": price,
        "amount": amount, "fee": fee, "tax": tax,
        "weight_after": None if result["weight_after"] is None else str(result["weight_after"]),
        "worst_case_loss": amount * orders.WORST_CASE_DROP_PCT // 100 if side == "buy" else None,
        "verdict": verification["verdict"], "summary": verification["summary"],
        "conditions": verification["conditions"], "disagreements": verification["disagreements"],
        "claims": [{"text": c["text"], "type": c["type"]} for c in state["proposal"]["claims"]],
        "counter_arguments": [with_titles(x, state["sources"]) for x in state["proposal"]["counter_arguments"]],
        "risks": [with_titles(x, state["sources"]) for x in state["proposal"]["risks"]],
        "policy": result["rules"], "warnings": warnings, "confirm_required": confirm,
        "broker": BROKERS[mode_of(state)], "mode": mode_of(state), "user_directed": state["user_directed"],
        "auto_origin": bool(state.get("auto_origin")),  # 앱 자동매매·예약 주문. 내 투자 습관에는 세지 않는다 (functions/behavior.py)
        "order_change": change, "original_order_no": target and target["broker_order_no"],
        "original_price": target and target["price"],
    }
    if change == "cancel":  # 취소는 돈이 새로 나가지 않는다
        card |= {"amount": 0, "fee": 0, "tax": 0, "worst_case_loss": None}
    return {"policy_result": {**result, "weight_after": card["weight_after"]}, "coach_warnings": warnings,
            "confirm_required": confirm, "card": card}


def auto_declined(state: InvestState) -> bool:
    """자동매매 주문인데 투자 AI가 지금은 그쪽(사기·팔기)이 아니라고 했다 (새 주문일 때만, 가격 재확인은 아님)"""
    return bool(state.get("auto_origin")) and state["proposal"]["action"] != state["side"] and not state.get("approval_id")


def route_after_policy(state: InvestState) -> str:
    if auto_declined(state):
        return "auto_declined"
    return "prepare_approval" if state["policy_result"]["ok"] else "blocked"


def auto_declined_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """자동매매 주문을 AI가 관찰로 돌렸으면 처리안을 만들지 않는다. 제안·검증·정책 검사는 기록한다.
    2026-10-20: 아무도 승인하지 않는 처리안이 21개 쌓여 10분 뒤 모두 "만료"로 남았다 (놓친 주문처럼 보였다).
    앱은 처리안이 없으면 그 종목을 30분 뒤 다시 묻는다 (auto_trader.dart autoBuyRetryGap)"""
    with connect(runtime.context.database_url) as conn:
        proposal_id = save_proposal(conn, state)
        save_policy_check(conn, proposal_id, state["policy_result"])
        audit(conn, state["user_id"], "auto_order_declined", {"proposal_id": str(proposal_id)})
    side = SIDE_LABELS[state["side"]]
    return {"answer": f"투자 AI가 지금은 {side}하지 말고 {ACTION_LABELS.get(state['proposal']['action'], '관찰')}하자고 했어요. "
                      f"자동매매는 {side}하지 않고 처리안도 만들지 않아요 (30분 뒤 다시 판단)."}


def save_policy_check(conn, proposal_id: str, result: dict) -> None:
    conn.execute(
        "INSERT INTO policy_checks (proposal_id, ok, rules) VALUES (%s, %s, %s)"
        " ON CONFLICT (proposal_id) DO UPDATE SET ok = EXCLUDED.ok, rules = EXCLUDED.rules, created_at = now()",
        (proposal_id, result["ok"], jsonb(result["rules"])),
    )


def blocked_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """정책 위반: 처리안을 만들지 않고 이유를 알려준다 (FR-22). 제안·검증·정책 검사 결과는 기록한다.
    수정·가격 변동 뒤 다시 검사해서 걸린 것이면 기존 처리안을 취소한다."""
    with connect(runtime.context.database_url) as conn:
        if state.get("approval_id"):
            proposal_id = conn.execute("SELECT proposal_id FROM approvals WHERE id = %s",
                                       (state["approval_id"],)).fetchone()[0]
            conn.execute("UPDATE approvals SET status = 'rejected', decided_at = now() WHERE id = %s",
                         (state["approval_id"],))
        else:
            proposal_id = save_proposal(conn, state)
        save_policy_check(conn, proposal_id, state["policy_result"])
        audit(conn, state["user_id"], "order_blocked", {"proposal_id": str(proposal_id), "approval_id": state.get("approval_id")})
    reasons = [f"- {r['label']}: 한도 {format_value(r['limit'])}, 이번 {format_value(r['actual'])}"
               for r in state["policy_result"]["rules"] if not r["ok"]]
    return {"answer": "주문할 수 없어요. 아래 규칙에 걸렸어요.\n" + "\n".join(reasons)}


def format_value(value) -> str:
    return f"{value:,}원" if isinstance(value, int) else str(value)


def prepare_approval_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """처리안을 저장하고 승인 대기로 둔다. 수정·가격 변동으로 다시 온 것이면 같은 처리안을 고쳐 다시 승인 대기로."""
    expires_at = clock.now() + timedelta(minutes=orders.APPROVAL_MINUTES)
    with connect(runtime.context.database_url) as conn:
        if state.get("approval_id"):
            approval_id = state["approval_id"]
            proposal_id = conn.execute("SELECT proposal_id FROM approvals WHERE id = %s", (approval_id,)).fetchone()[0]
            conn.execute("UPDATE proposals SET qty = %s, limit_price = %s WHERE id = %s",
                         (state["qty"], state["limit_price"], proposal_id))
            conn.execute("UPDATE approvals SET status = 'pending', card = %s, expires_at = %s, decided_at = NULL,"
                         " decided_channel = NULL WHERE id = %s",
                         (jsonb(state["card"]), expires_at, approval_id))
            event = "approval_renewed"
        else:
            proposal_id = save_proposal(conn, state)
            approval_id = str(conn.execute(
                "INSERT INTO approvals (proposal_id, expires_at, card) VALUES (%s, %s, %s) RETURNING id",
                (proposal_id, expires_at, jsonb(state["card"])),
            ).fetchone()[0])
            event = "approval_requested"
        save_policy_check(conn, proposal_id, state["policy_result"])
        audit(conn, state["user_id"], event, {"approval_id": approval_id, "qty": state["qty"], "price": state["limit_price"]})
    return {"approval_id": approval_id, "expires_at": expires_at.isoformat(),
            "card": {**state["card"], "approval_id": approval_id, "expires_at": expires_at.isoformat()}}


def format_card(card: dict) -> str:
    """처리안을 글로 (앱·웹 화면은 card 값을 직접 그린다)."""
    side = SIDE_LABELS[card["side"]]
    fee = f"{card['fee']:,}원" if card["fee"] is not None else "수수료율 미입력"
    change = card.get("order_change")
    if change:
        what = (f"지정가 {won(card['original_price'])} → {won(card['limit_price'])}" if change == "modify"
                else f"지정가 {won(card['limit_price'])}")
        lines = [f"[처리안 · {MODE_LABELS[card['mode']]}] {card['stock_name']}({card['stock_code']}) {side} 주문 {CHANGE_LABELS[change]}"
                 f" · 미체결 {card['qty']:,}주 · {what} (주문번호 {card['original_order_no']})"]
        if change == "modify":
            lines.append(f"정정 후 금액 {won(card['amount'])} · 수수료 추정 {fee}")
    else:
        lines = [
            f"[처리안 · {MODE_LABELS[card['mode']]}] {card['stock_name']}({card['stock_code']}) {card['qty']:,}주 {side} · 지정가 {won(card['limit_price'])}",
            f"예상 금액 {won(card['amount'])} · 수수료 추정 {fee}" + (f" · 세금 {won(card['tax'])}" if card["side"] == "sell" else ""),
        ]
    if card["weight_after"] is not None:
        lines.append(f"주문 후 이 종목 비중 {card['weight_after']}%")
    if card["worst_case_loss"]:
        lines.append(f"최악의 경우: {orders.WORST_CASE_DROP_PCT}% 하락하면 −{won(card['worst_case_loss'])}")
    lines.append(f"검증 AI: {VERDICT_LABELS[card['verdict']]} — {card['summary']}")
    lines += [f"- 조건: {c}" for c in card["conditions"]] + [f"- 의견 차이: {d}" for d in card["disagreements"]]
    lines += [f"주의: {w}" for w in card["warnings"]]
    lines += [f"확인 필요: {c}" for c in card["confirm_required"]]
    lines.append(f"{datetime.fromisoformat(card['expires_at']):%H:%M}까지 승인하지 않으면 만료돼요.")
    return "\n".join(lines)


# ---------- 승인과 실행 ----------

def approval_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    reply = pause("approval", approval_id=state["approval_id"], card=state["card"], text=format_card(state["card"]),
                  expires_at=state["expires_at"], confirm_required=state["confirm_required"])
    approval_id, decision = state["approval_id"], reply["decision"]
    with connect(runtime.context.database_url) as conn:
        if clock.now() > datetime.fromisoformat(state["expires_at"]):
            # 답이 늦으면 승인으로 보지 않는다 (FR-25)
            conn.execute("UPDATE approvals SET status = 'expired' WHERE id = %s", (approval_id,))
            audit(conn, state["user_id"], "approval_expired", {"approval_id": approval_id})
            return {"answer": "승인 시간이 지나 처리안이 만료됐어요. 주문하지 않았어요."}
        if decision == "reject":
            conn.execute("UPDATE approvals SET status = 'rejected', decided_at = now(), decided_channel = %s WHERE id = %s",
                         (reply["client"], approval_id))
            audit(conn, state["user_id"], "approval_rejected", {"approval_id": approval_id})
            return {"answer": "처리안을 거절했어요. 주문하지 않았어요."}
        if decision == "edit":
            edit = edited_values(reply["text"], state)
            audit(conn, state["user_id"], "approval_edit", {"approval_id": approval_id, "text": reply["text"], **edit})
            return {**edit, "decision": "edit"}
        conn.execute("UPDATE approvals SET status = 'approved', decided_at = now(), decided_channel = %s WHERE id = %s",
                     (reply["client"], approval_id))
        if reply["client"] == "web":  # 웹에서 승인하면 주문은 폰에서 실행해야 한다
            card = state["card"]
            notify(conn, state["user_id"], "needs_execution", "폰에서 주문을 실행해 주세요",
                   f"웹에서 승인한 {card['stock_name']} {card['qty']:,}주 {SIDE_LABELS[card['side']]} 처리안이 기다려요",
                   {"approval_id": approval_id})
        audit(conn, state["user_id"], "approval_approved", {"approval_id": approval_id, "confirm_risk": reply.get("confirm_risk")})
    return {"decision": "approve"}


def edited_values(text: str, state: InvestState) -> dict:
    """"5주만" 같은 수정. "N주"는 코드로 읽고, 그 밖의 말(가격 등)은 LLM으로 뽑는다."""
    match = re.search(r"(\d[\d,]*)\s*주", text)
    if match:
        return {"qty": int(match.group(1).replace(",", ""))}
    edit = llm.parse_order_edit(text, f"{state['stock_name']} {state['qty']}주 {won(state['limit_price'])}")
    return {key: value for key, value in (("qty", edit.qty), ("limit_price", edit.limit_price)) if value}


def route_after_approval(state: InvestState) -> str:
    """승인만 실행으로 간다. 수정은 바뀐 값이 있으면 다시 검사하고, 알아듣지 못했으면 같은 처리안을 다시 묻는다."""
    if state.get("answer"):
        return END
    if state["decision"] == "approve":
        return "execute"
    changed = state["card"]["qty"] != state["qty"] or state["card"]["limit_price"] != state["limit_price"]
    return "check_edit" if changed else "approval"


def check_edit_node(state: InvestState) -> dict:
    if not 1 <= state["qty"] <= orders.MAX_QTY or state["limit_price"] <= 0:
        return {"answer": "수정한 수량이나 가격이 올바르지 않아요. 주문하지 않았어요."}
    return {}


def execute_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """폰에 주문을 부탁한다. 폰은 가격 재확인 → 생체인증 → 증권사 주문 → 결과를 보낸다 (06-api-spec.md 4장)."""
    request = {
        "approval_id": state["approval_id"], "stock_code": state["stock_code"], "side": state["side"],
        "qty": state["qty"], "limit_price": state["limit_price"], "approved_price": state["limit_price"],
        "max_price_drift_pct": orders.MAX_PRICE_DRIFT_PCT, "idempotency_key": state["approval_id"], "mode": mode_of(state),
        **({"order_change": state["order_change"], "original_order_no": state["target_order"]["broker_order_no"],
            "all_qty": state["qty"] == state["target_order"]["qty"]} if state.get("order_change") else {}),
    }
    result = pause("execute", request=request, text="폰 앱에서 가격을 다시 확인하고 실행해 주세요.")["result"]
    with connect(runtime.context.database_url) as conn:
        if result["status"] == "price_changed":
            audit(conn, state["user_id"], "price_changed",
                  {"approval_id": state["approval_id"], "approved": state["limit_price"], "current": result["current_price"]})
            return {"limit_price": result["current_price"]}  # 새 가격으로 다시 검사·승인 (FR-26)
        conn.execute(  # 같은 idempotency_key 결과가 또 오면 무시한다 (중복 주문 기록 방지)
            "INSERT INTO orders (approval_id, idempotency_key, broker, mode, side, qty, price, broker_order_no, status,"
            " filled_qty, filled_price, message, kind, original_order_id)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            " ON CONFLICT (idempotency_key) DO NOTHING",
            (state["approval_id"], result["idempotency_key"], BROKERS[mode_of(state)], mode_of(state), state["side"], state["qty"],
             state["limit_price"], result.get("broker_order_no"), result["status"], result.get("filled_qty", 0),
             result.get("filled_price"), result.get("message"), state.get("order_change") or "new",
             state["target_order"]["id"] if state.get("target_order") else None),
        )
        if state.get("order_change") and result["status"] == "accepted":  # 증권사가 받아 줬을 때만 원래 주문을 바꾼다
            if state["qty"] == state["target_order"]["qty"]:  # 남은 수량 전부: 원래 주문을 닫는다
                conn.execute("UPDATE orders SET status = %s WHERE id = %s",
                             ("cancelled" if state["order_change"] == "cancel" else "replaced", state["target_order"]["id"]))
            else:  # 일부: 원래 주문의 수량을 그만큼 줄인다 (나머지는 원래 주문으로 남는다)
                conn.execute("UPDATE orders SET qty = qty - %s WHERE id = %s", (state["qty"], state["target_order"]["id"]))
        audit(conn, state["user_id"], "order_result", {"approval_id": state["approval_id"], **result})
    return {"answer": format_result(state, result)}


def route_after_execute(state: InvestState) -> str:
    return END if state.get("answer") else "policy"


def format_result(state: InvestState, result: dict) -> str:
    change = state.get("order_change")
    head = (f"{CHANGE_LABELS[change]} {'요청이 접수됐어요' if result['status'] == 'accepted' else RESULT_LABELS[result['status']]}"
            if change else RESULT_LABELS[result["status"]]) + f" ({MODE_LABELS[mode_of(state)]})"
    order = f"{state['stock_name']} {state['qty']:,}주 {SIDE_LABELS[state['side']]} · 지정가 {won(state['limit_price'])}"
    if change:
        order += f" {CHANGE_LABELS[change]} (원래 주문번호 {state['target_order']['broker_order_no']})"
    lines = [head, order]
    if result.get("filled_qty"):
        lines.append(f"체결 {result['filled_qty']:,}주 × {won(result['filled_price'])}")
    if result.get("broker_order_no"):
        lines.append(f"주문번호 {result['broker_order_no']}")
    if result.get("message"):
        lines.append(result["message"])
    return "\n".join(lines)


# ---------- 그래프 ----------

def route_start(state: InvestState) -> str:
    return "order_values" if state.get("from_analysis") else "find_stock"


def route_after_target(state: InvestState) -> str:
    if state.get("answer"):
        return END
    return "find_order" if state.get("order_change") else "order_values"


def route_after_values(state: InvestState) -> str:
    if state.get("answer"):
        return END
    if state.get("trigger_price") or (state.get("split_count") or 0) > 1:
        return "reserve"
    return "set_price" if state.get("from_analysis") else "get_account"


def route_after_price(state: InvestState) -> str:
    if state.get("answer"):
        return END
    return "policy" if state.get("from_analysis") else "gather"


def route_after_verify(state: InvestState) -> str:
    return "invest_agent" if state["verifications"][-1]["verdict"] == "reject" else "policy"


def build_order_graph():
    builder = StateGraph(InvestState, context_schema=Context)
    for name, node in [
        ("find_stock", find_stock_node), ("check_target", check_target_node), ("order_values", order_values_node),
        ("find_order", find_order_node), ("reserve", reserve_node),
        ("get_account", get_account_node), ("set_price", set_price_node), ("gather", gather_node),
        ("invest_agent", invest_agent_node), ("verify_agent", verify_agent_node), ("policy", policy_node),
        ("blocked", blocked_node), ("auto_declined", auto_declined_node), ("prepare_approval", prepare_approval_node),
        ("approval", approval_node),
        ("check_edit", check_edit_node), ("execute", execute_node),
    ]:
        builder.add_node(name, node)

    builder.add_conditional_edges(START, route_start, ["order_values", "find_stock"])
    builder.add_conditional_edges("find_stock", end_if_answered("check_target"), ["check_target", END])
    builder.add_conditional_edges("check_target", route_after_target, ["order_values", "find_order", END])
    builder.add_conditional_edges("find_order", end_if_answered("get_account"), ["get_account", END])
    builder.add_conditional_edges("order_values", route_after_values, ["set_price", "get_account", "reserve", END])
    builder.add_edge("reserve", END)
    builder.add_conditional_edges("get_account", end_if_answered("set_price"), ["set_price", END])
    builder.add_conditional_edges("set_price", route_after_price, ["policy", "gather", END])
    builder.add_edge("gather", "invest_agent")
    builder.add_edge("invest_agent", "verify_agent")
    builder.add_conditional_edges("verify_agent", route_after_verify, ["invest_agent", "policy"])
    builder.add_conditional_edges("policy", route_after_policy, ["prepare_approval", "blocked", "auto_declined"])
    builder.add_edge("blocked", END)
    builder.add_edge("auto_declined", END)
    builder.add_edge("prepare_approval", "approval")
    builder.add_conditional_edges("approval", route_after_approval, ["check_edit", "execute", "approval", END])
    builder.add_conditional_edges("check_edit", end_if_answered("policy"), ["policy", END])
    builder.add_conditional_edges("execute", route_after_execute, ["policy", END])
    return builder.compile()
