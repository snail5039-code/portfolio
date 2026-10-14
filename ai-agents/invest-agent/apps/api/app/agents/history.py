"""내 기록 질문: "지난번에 SK하이닉스 왜 반려됐지?", "이번 달에 뭐 샀지?" (docs/plan/12-todo-by-stage.md 2-7).

LLM 없이 이 사용자의 제안서·검증 판정·주문 기록을 SQL로 찾아 코드가 답한다 (11-rag-expansion.md 2-3).
다른 사용자의 기록은 보지 않는다 (NFR-05a). 종목·기간(오늘·최근 7일·최근 30일)·종류(주문·반려)·매수/매도로 좁힌다.
"""

from langgraph.runtime import Runtime
from psycopg.rows import dict_row

from app.agents.analysis import ACTION_LABELS, VERDICT_LABELS
from app.agents.query import SIDE_LABELS, stock_codes, won
from app.agents.result import ORDER_LABELS, hhmm
from app.agents.state import Context, InvestState
from app.db import connect

MAX_ITEMS = 10
PERIODS = {"today": ("오늘", None), "week": ("최근 7일", "7 days"), "month": ("최근 30일", "30 days")}
KINDS = {"orders": "주문", "rejected": "검증을 통과하지 못한 제안", None: "제안·주문"}

HISTORY_SQL = """
    SELECT p.created_at, p.stock_code, s.name AS stock_name, p.action, p.qty, p.user_directed,
           v.verdict, v.summary, v.challenges, o.status AS order_status, o.filled_qty, o.filled_price
    FROM proposals p
    JOIN stocks s ON s.code = p.stock_code
    LEFT JOIN LATERAL (SELECT verdict, summary, challenges FROM verifications
                       WHERE proposal_id = p.id ORDER BY round DESC LIMIT 1) v ON true
    LEFT JOIN approvals a ON a.proposal_id = p.id
    LEFT JOIN LATERAL (SELECT * FROM orders WHERE approval_id = a.id ORDER BY created_at LIMIT 1) o ON true
    WHERE p.user_id = %(user_id)s
      AND p.created_at >= CASE WHEN %(interval)s::interval IS NULL
                               THEN date_trunc('day', now())  -- 연결 시간대가 서울 (db.connect)
                               ELSE now() - %(interval)s::interval END
      AND (%(codes)s::text[] IS NULL OR p.stock_code = ANY(%(codes)s))
      AND (%(side)s::text IS NULL OR p.action = %(side)s)
      AND (%(kind)s::text IS DISTINCT FROM 'orders' OR o.id IS NOT NULL)
      AND (%(kind)s::text IS DISTINCT FROM 'rejected' OR v.verdict IN ('reject', 'user_judgement'))
    ORDER BY p.created_at DESC LIMIT %(limit)s
"""


def history_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    period_label, interval = PERIODS[state.get("period") or "month"]
    kind = state.get("history_kind")
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        codes = stock_codes(conn, state.get("stock_name"))
        if codes == []:
            return {"answer": f"'{state['stock_name']}' 종목을 찾지 못했어요."}
        rows = conn.execute(HISTORY_SQL, {"user_id": state["user_id"], "interval": interval, "codes": codes,
                                          "side": state.get("side"), "kind": kind, "limit": MAX_ITEMS + 1}).fetchall()
    target = " ".join(filter(None, [period_label, rows[0]["stock_name"] if codes and rows else state.get("stock_name"),
                                    SIDE_LABELS.get(state.get("side")), KINDS[kind]]))
    if not rows:
        return {"answer": f"{target} 기록이 없어요."}
    lines = [f"{target} {min(len(rows), MAX_ITEMS)}건" + (f" (최근 {MAX_ITEMS}건만 보여드려요)" if len(rows) > MAX_ITEMS else "")]
    for row in rows[:MAX_ITEMS]:
        lines += item_lines(row)
    lines.append("\n근거와 검증 과정은 기록 탭에서 자세히 볼 수 있어요. (이 앱 서버에 남은 내 기록 기준)")
    return {"answer": "\n".join(lines)}


def item_lines(row: dict) -> list[str]:
    action = (SIDE_LABELS.get(row["action"], row["action"]) + " 주문") if row["user_directed"] else ACTION_LABELS[row["action"]]
    qty = f" {row['qty']:,}주" if row["qty"] else ""
    head = f"\n{hhmm(row['created_at'])} {row['stock_name']}({row['stock_code']}) {action}{qty}"
    if row["verdict"]:
        head += f" · 검증 {VERDICT_LABELS[row['verdict']]}"
    if row["order_status"]:
        head += f" · {ORDER_LABELS.get(row['order_status'], row['order_status'])}"
        if row["filled_qty"]:
            head += f" ({row['filled_qty']:,}주 × {won(row['filled_price'])})"
    lines = [head]
    if row["verdict"] in ("reject", "user_judgement"):  # 왜 통과하지 못했는지: 검증 AI의 요약과 반박
        lines.append(f"- 검증 AI: {row['summary']}")
        lines += [f"- 반박: {c}" for c in (row["challenges"] or [])[:3]]
    return lines
