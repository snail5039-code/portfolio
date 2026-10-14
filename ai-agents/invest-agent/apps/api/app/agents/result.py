"""결과 확인: "아까 주문 체결됐어?" (docs/plan/04-graph-design.md 6장).

LLM 없이 DB 기록으로 답한다. 대상은 이 사용자의 가장 최근 주문 요청(정책 검사까지 간 제안), 종목을 말했으면 그 종목.
주문 결과는 폰이 보낸 마지막 기록이다. 접수 뒤 체결은 폰이 열릴 때·대화를 보낼 때 증권사 주문 내역을 다시 보고
갱신한다(routers/orders.py). 그래서 폰에서 물으면 방금 확인한 값, 웹에서 물으면 폰이 마지막으로 확인한 값이다.
"""


from langgraph.runtime import Runtime
from psycopg.rows import dict_row

from app import clock
from app.agents.analysis import VERDICT_LABELS
from app.agents.query import SIDE_LABELS, hhmm, stock_codes, won
from app.agents.state import Context, InvestState
from app.db import connect

ORDER_LABELS = {
    "accepted": "접수됐어요. 아직 체결되지 않았어요",
    "filled": "체결됐어요",
    "partially_filled": "일부 체결됐어요",
    "failed": "실패했어요",
    "unknown_checked": "응답이 불확실해 주문 내역을 확인한 상태예요",
}
CHANNELS = {"app": "앱", "web": "웹"}

LATEST_SQL = """
    SELECT p.id, p.created_at, p.stock_code, s.name AS stock_name, p.action, p.qty, p.limit_price,
           pc.ok AS policy_ok,
           (SELECT verdict FROM verifications v WHERE v.proposal_id = p.id ORDER BY round DESC LIMIT 1) AS verdict,
           a.status AS approval_status, a.expires_at, a.decided_at, a.decided_channel,
           o.status AS order_status, o.broker_order_no, o.filled_qty, o.filled_price, o.message,
           COALESCE(o.checked_at, o.created_at) AS checked_at
    FROM proposals p
    JOIN stocks s ON s.code = p.stock_code
    JOIN policy_checks pc ON pc.proposal_id = p.id
    LEFT JOIN approvals a ON a.proposal_id = p.id
    LEFT JOIN LATERAL (SELECT * FROM orders WHERE approval_id = a.id ORDER BY created_at LIMIT 1) o ON true
    WHERE p.user_id = %(user_id)s AND (%(codes)s::text[] IS NULL OR p.stock_code = ANY(%(codes)s))
    ORDER BY p.created_at DESC LIMIT 1
"""


def result_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        codes = stock_codes(conn, state.get("stock_name"))
        if codes == []:
            return {"answer": f"'{state['stock_name']}' 종목을 찾지 못했어요."}
        row = conn.execute(LATEST_SQL, {"user_id": state["user_id"], "codes": codes}).fetchone()
    if row is None:
        target = f"{state['stock_name']} " if codes else ""
        return {"answer": f"{target}주문 기록이 없어요."}
    return {"answer": format_result(row)}


def format_result(row: dict) -> str:
    side = SIDE_LABELS.get(row["action"], row["action"])
    qty = f" {row['qty']:,}주" if row["qty"] else ""  # 예전 기록에는 수량이 없는 것이 있다
    price = f" · 지정가 {won(row['limit_price'])}" if row["limit_price"] else ""
    lines = [f"{row['stock_name']}({row['stock_code']}){qty} {side}{price} ({hhmm(row['created_at'])} 요청)"]
    if row["verdict"]:
        lines.append(f"- 검증 AI: {VERDICT_LABELS.get(row['verdict'], row['verdict'])}")
    if not row["policy_ok"]:
        lines.append("- 정책 검사에 걸려 주문하지 않았어요.")
        return "\n".join(lines)

    status = row["approval_status"]
    if status == "pending" and row["expires_at"] > clock.now():
        lines.append(f"- 승인을 기다리고 있어요 ({hhmm(row['expires_at'])}까지). 승인 대기에서 확인해 주세요.")
    elif status in ("pending", "expired"):
        lines.append("- 승인 시간이 지나 만료됐어요. 주문하지 않았어요.")
    elif status == "rejected":
        lines.append("- 처리안을 거절했어요. 주문하지 않았어요.")
    elif row["order_status"] is None:
        channel = CHANNELS.get(row["decided_channel"], row["decided_channel"])
        lines.append(f"- {channel}에서 승인했지만 아직 폰에서 실행하지 않았어요. 폰 앱의 승인 대기 → 실행 필요에서 실행해 주세요.")
    else:
        lines.append(f"- 주문: {ORDER_LABELS.get(row['order_status'], row['order_status'])}")
        if row["filled_qty"]:
            lines.append(f"- 체결 {row['filled_qty']:,}주 × {won(row['filled_price'])}")
        if row["broker_order_no"]:
            lines.append(f"- 주문번호 {row['broker_order_no']}")
        if row["message"]:
            lines.append(f"- 증권사 메시지: {row['message']}")
        lines.append(f"(폰이 증권사에서 확인한 기록, {hhmm(row['checked_at'])} 기준)")
    return "\n".join(lines)
