"""조회 그래프: 잔고 · 현재가 · 오늘 주문 내역 (docs/plan/04-graph-design.md 3장).

    (understand가 뽑은 query_kind로 시작)
    ┬─ price   → find_stock → get_market → make_answer
    ├─ balance →              get_market → make_answer
    └─ orders  → read_orders

- 잔고·현재가는 서버가 직접 볼 수 없다 (증권사 키가 폰에만 있음). 앱이면 fetch로 멈춰 폰에 부탁하고,
  웹이면 폰이 올려 둔 계좌 스냅샷을 쓴다. 웹의 시세는 서버의 전일 종가(공개 데이터)로 답한다.
- 답 문장은 코드가 만든다. 금액은 원 단위 정수 그대로, 출처와 기준 시각을 붙인다 (AGENTS.md 5장).
"""

from datetime import datetime, timedelta

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from psycopg.rows import dict_row

from app.agents.interrupts import pause
from app.agents.state import Context, InvestState
from app.clock import KST
from app.db import connect

SNAPSHOT_MAX_AGE = timedelta(minutes=30)
SOURCE_LABELS = {"app": "앱 실시간 조회", "server": "폰 동기화"}
SIDE_LABELS = {"buy": "매수", "sell": "매도"}
STATUS_LABELS = {
    "accepted": "접수", "filled": "체결", "partially_filled": "일부 체결",
    "failed": "실패", "unknown_checked": "확인 필요", "cancelled": "취소됨", "replaced": "정정됨",
}
KIND_LABELS = {"new": "", "cancel": "취소 요청 ", "modify": "정정 "}
WEB_PRICE_MESSAGE = "웹에서는 실시간 현재가를 볼 수 없고, 이 종목은 서버에 종가 자료도 없어요. 폰 앱에서 확인해 주세요."
SYNC_MESSAGE = "최근 30분 안에 동기화된 계좌 정보가 없어요. 폰 앱을 열어 동기화해 주세요."


# ---------- 답 문장 만들기 (계산만 하는 함수) ----------

def latest_close(conn, code: str) -> dict | None:
    """가장 최근 종가 {close, trade_date} (금융위원회 시세, 하루 늦은 값). 없으면 None. dict_row 연결로 부른다."""
    return conn.execute("SELECT close, trade_date FROM stock_prices WHERE stock_code = %s ORDER BY trade_date DESC LIMIT 1",
                        (code,)).fetchone()


def won(amount: int) -> str:
    return f"{amount:,}원"


def hhmm(value: datetime) -> str:
    return f"{value.astimezone(KST):%m-%d %H:%M}"


def as_of(iso_time: str) -> str:
    return f"{hhmm(datetime.fromisoformat(iso_time))} 기준"


def format_balance(snapshot: dict) -> str:
    lines = [f"현금 {won(snapshot['cash_krw'])}"]
    lines += [
        f"- {h['stock_name']}({h['stock_code']}) {h['qty']:,}주, 평균 매입가 {won(h['avg_price'])}"
        for h in snapshot["holdings"]
    ] or ["보유 종목 없음"]
    lines.append(f"({SOURCE_LABELS[snapshot['source']]}, {as_of(snapshot['fetched_at'])})")
    return "\n".join(lines)


def format_price(stock_name: str, price: dict) -> str:
    return (f"{stock_name}({price['stock_code']}) 현재가 {won(price['price'])} "
            f"({SOURCE_LABELS['app']}, {as_of(price['as_of'])})")


def format_orders(rows: list[dict]) -> str:
    if not rows:
        return "오늘 주문 내역이 없어요."
    return "\n".join(
        f"- {row['created_at']:%H:%M} {row['stock_name'] or row['stock_code']} "
        f"{KIND_LABELS[row.get('kind') or 'new']}{SIDE_LABELS[row['side']]} {row['qty']:,}주 × {won(row['price'])}"
        f" · {STATUS_LABELS[row['status']]}"
        for row in rows
    )


# ---------- DB 읽기 ----------

def search_stocks(conn, name: str) -> list[dict]:
    """이름이나 코드가 정확히 맞으면 그 종목, 아니면 이름에 포함된 종목을 최대 5개."""
    exact = conn.execute("SELECT code, name FROM stocks WHERE code = %s OR name = %s", (name, name)).fetchall()
    if exact:
        return exact
    pattern = "%" + name.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    return conn.execute(
        "SELECT code, name FROM stocks WHERE name ILIKE %s ORDER BY length(name), name LIMIT 5", (pattern,)
    ).fetchall()


def stock_codes(conn, name: str | None) -> list[str] | None:
    """종목 이름(또는 코드) → 후보 코드. 이름이 없으면 None(종목으로 좁히지 않음), 못 찾으면 빈 목록."""
    return None if not name else [stock["code"] for stock in search_stocks(conn, name.strip())]


def latest_snapshot(conn, user_id: str) -> dict | None:
    return conn.execute(
        "SELECT cash_krw, holdings, fetched_at FROM account_snapshots WHERE user_id = %s"
        " ORDER BY fetched_at DESC LIMIT 1",
        (user_id,),
    ).fetchone()


def fresh_snapshot(conn, user_id: str) -> dict | None:
    """폰이 최근 SNAPSHOT_MAX_AGE 안에 올린 계좌 스냅샷 (웹 응답용, source=server). 없거나 오래됐으면 None."""
    snapshot = latest_snapshot(conn, user_id)
    if snapshot is None or datetime.now(KST) - snapshot["fetched_at"] > SNAPSHOT_MAX_AGE:
        return None
    return {**snapshot, "fetched_at": snapshot["fetched_at"].isoformat(), "source": "server"}


# ---------- 노드 ----------

def find_stock_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """종목 이름 → 코드. 이름이 없으면 묻고, 후보가 여럿이면 고르게 한다 (FR-11)."""
    name = state["stock_name"]
    if not name:
        reply = pause("question", text="어느 종목인가요?", choices=None)
        name = reply.get("text") or reply.get("choice_id")

    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        found = search_stocks(conn, name.strip())
    if not found:
        return {"answer": f"'{name}' 종목을 찾지 못했어요. 종목 이름이나 6자리 코드로 다시 말해 주세요."}
    if len(found) > 1:
        reply = pause("question", text="어느 종목인가요?",
                      choices=[{"id": stock["code"], "label": stock["name"]} for stock in found])
        picked = reply.get("choice_id") or reply.get("text")
        found = [stock for stock in found if picked in (stock["code"], stock["name"])]
        if not found:
            return {"answer": "고른 종목을 후보에서 찾지 못했어요. 다시 말해 주세요."}
    return {"stock_code": found[0]["code"], "stock_name": found[0]["name"]}


def get_market_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """잔고·현재가 가져오기. 앱이면 폰에 부탁(fetch), 웹이면 서버 스냅샷."""
    kind = state["query_kind"]

    if state["client"] == "web":
        if kind == "price":
            # 웹은 실시간 현재가가 없어서 서버의 전일 종가(공개 데이터)로 답한다
            with connect(runtime.context.database_url, row_factory=dict_row) as conn:
                last = latest_close(conn, state["stock_code"])
            if last is None:
                return {"answer": WEB_PRICE_MESSAGE}
            return {"answer": f"{state['stock_name']}({state['stock_code']}) 최근 종가 {won(last['close'])} "
                              f"(금융위원회_주식시세정보, {last['trade_date']} 기준). 실시간 현재가는 폰 앱에서 볼 수 있어요."}
        with connect(runtime.context.database_url, row_factory=dict_row) as conn:
            snapshot = fresh_snapshot(conn, state["user_id"])
        return {"snapshot": snapshot} if snapshot else {"answer": SYNC_MESSAGE}

    needs = [{"type": "balance"}] if kind == "balance" else [{"type": "price", "stock_code": state["stock_code"]}]
    reply = pause("fetch", needs=needs)
    if reply.get("error"):
        # 가짜 값으로 대신하지 않고 실패라고 알린다 (NFR-08)
        return {"answer": f"증권사 조회에 실패했어요 ({reply['error']}). 잠시 후 다시 시도해 주세요."}
    if kind == "balance":
        if not reply.get("balance"):
            return {"answer": "증권사 조회 결과에 잔고가 없어요. 다시 시도해 주세요."}
        return {"snapshot": {**reply["balance"], "source": "app"}}
    price = next((p for p in reply.get("prices") or [] if p["stock_code"] == state["stock_code"]), None)
    if price is None:
        return {"answer": "증권사 조회 결과에 요청한 종목의 시세가 없어요. 다시 시도해 주세요."}
    return {"prices": [price]}


def make_answer_node(state: InvestState) -> dict:
    if state["query_kind"] == "balance":
        return {"answer": format_balance(state["snapshot"])}
    return {"answer": format_price(state["stock_name"], state["prices"][0])}


def read_orders_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        rows = conn.execute(
            "SELECT o.created_at, p.stock_code, s.name AS stock_name, o.side, o.qty, o.price, o.status, o.kind"
            " FROM orders o"
            " JOIN approvals a ON a.id = o.approval_id"
            " JOIN proposals p ON p.id = a.proposal_id"
            " LEFT JOIN stocks s ON s.code = p.stock_code"
            " WHERE p.user_id = %s AND o.created_at >= date_trunc('day', now())"
            " ORDER BY o.created_at",
            (state["user_id"],),
        ).fetchall()
    return {"answer": format_orders(rows)}


# ---------- 그래프 ----------

def route_by_kind(state: InvestState) -> str:
    return {"price": "find_stock", "balance": "get_market", "orders": "read_orders"}[state["query_kind"]]


def end_if_answered(next_node: str):
    """앞 노드가 이미 답(실패 안내 등)을 만들었으면 끝내고, 아니면 다음 노드로."""
    return lambda state: END if state.get("answer") else next_node


def build_query_graph():
    builder = StateGraph(InvestState, context_schema=Context)
    builder.add_node("find_stock", find_stock_node)
    builder.add_node("get_market", get_market_node)
    builder.add_node("make_answer", make_answer_node)
    builder.add_node("read_orders", read_orders_node)

    builder.add_conditional_edges(START, route_by_kind, ["find_stock", "get_market", "read_orders"])
    builder.add_conditional_edges("find_stock", end_if_answered("get_market"), ["get_market", END])
    builder.add_conditional_edges("get_market", end_if_answered("make_answer"), ["make_answer", END])
    builder.add_edge("make_answer", END)
    builder.add_edge("read_orders", END)
    return builder.compile()
