"""전체 그래프 (1단 supervisor, docs/plan/04-graph-design.md 1장).

    START → understand ─┬─ query          → 조회 그래프 (agents/query.py)
                        ├─ analysis       → 분석 그래프 (agents/analysis.py) ─ "이대로 주문" → 주문 그래프
                        ├─ order          → 주문 그래프 (agents/order.py)
                        ├─ result         → 결과 확인 (agents/result.py, DB 기록으로 답)
                        ├─ history        → 내 기록 질문 (agents/history.py, DB 기록으로 답)
                        └─ other          → guide

understand는 Gemini 한 번으로 "그거" 풀기(rewrite) + 분류(classify) + 조회 대상 뽑기를 한다 (속도 때문에 합침).
새 요청일 때만 지난다. 멈춤(question·fetch)의 답은 멈춘 노드에서 이어가므로 여기를 지나지 않는다.
"""

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import END, START, StateGraph

from app.agents import llm
from app.agents.analysis import build_analysis_graph
from app.agents.history import history_node
from app.agents.order import build_order_graph
from app.agents.query import build_query_graph
from app.agents.result import result_node
from app.agents.state import Context, InvestState
from app.glossary import explain_node

GUIDE_MESSAGE = (
    "이렇게 말해 보세요.\n"
    "- 잔고 보여줘\n"
    "- 삼성전자 얼마야?\n"
    "- 오늘 주문 내역 보여줘\n"
    "- 삼성전자 사도 돼?\n"
    "- SK하이닉스 4주 사줘\n"
    "- 아까 주문 체결됐어?\n"
    "- 이번 달에 뭐 샀지?\n"
    "- PER이 뭐야?"
)


def understand_node(state: InvestState) -> dict:
    result = llm.understand(state["query"], state.get("history") or [])
    intent = result.intent
    if intent == "query" and result.query_kind is None:
        intent = "other"  # 무엇을 조회할지 모르면 할 수 있는 일을 안내한다
    stock_name = result.stock_name
    # 종목 대화방에서 "지금 사도 돼?"처럼 종목을 말하지 않으면 그 방의 종목으로 본다 (잔고·주문 내역 조회는 종목이 없다)
    if stock_name is None and state.get("room_stock") and (intent in ("analysis", "order", "result", "history")
                                                           or (intent == "query" and result.query_kind == "price")):
        stock_name = state["room_stock"]
    return {"query": result.query, "intent": intent, "query_kind": result.query_kind, "stock_name": stock_name,
            "side": result.side, "qty": result.qty, "limit_price": result.limit_price, "user_directed": intent == "order",
            "order_change": result.order_change if intent == "order" else None, "target_order": None,
            "trigger_price": result.trigger_price if intent == "order" else None,
            "trigger_direction": result.trigger_direction, "split_count": result.split_count if intent == "order" else None,
            "term": result.term, "period": result.period, "history_kind": result.history_kind}


def route_by_intent(state: InvestState) -> str:
    return {"query": "query", "analysis": "analysis", "order": "order", "result": "result",
            "explain": "explain", "history": "history"}.get(state["intent"], "guide")


def route_after_analysis(state: InvestState) -> str:
    return "order" if state["intent"] == "order" else END


def guide_node(state: InvestState) -> dict:
    return {"answer": GUIDE_MESSAGE}


def build_graph(checkpointer: BaseCheckpointSaver):
    builder = StateGraph(InvestState, context_schema=Context)
    builder.add_node("understand", understand_node)
    builder.add_node("query", build_query_graph())  # 조회 그래프를 노드로 넣는다
    builder.add_node("analysis", build_analysis_graph())
    builder.add_node("order", build_order_graph())
    builder.add_node("result", result_node)
    builder.add_node("explain", explain_node)
    builder.add_node("history", history_node)
    builder.add_node("guide", guide_node)

    builder.add_edge(START, "understand")
    builder.add_conditional_edges("understand", route_by_intent, ["query", "analysis", "order", "result", "explain", "history", "guide"])
    builder.add_conditional_edges("analysis", route_after_analysis, ["order", END])
    for node in ("query", "order", "result", "explain", "history", "guide"):
        builder.add_edge(node, END)
    return builder.compile(checkpointer=checkpointer)
