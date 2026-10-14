"""모든 그래프가 같이 쓰는 State (docs/plan/04-graph-design.md 7장).

체크포인트(PostgresSaver)가 thread_id마다 State를 저장하므로 턴이 바뀌어도 값이 남는다.
그래서 새 요청을 시작할 때 new_request()로 이번 업무 칸을 비운다.
조회(3단계)·분석(4단계)·주문(5단계)에 필요한 칸이 있다.
"""

from dataclasses import dataclass
from typing import TypedDict


@dataclass
class Context:
    """그래프 실행마다 넘기는 값. State와 달리 체크포인트에 저장되지 않는다 (DB 주소에 비밀번호가 있어서)."""

    database_url: str


class InvestState(TypedDict, total=False):
    # 공통
    user_id: str
    thread_id: str
    client: str              # app / web. 웹은 증권사 조회(fetch)를 못 한다
    query: str               # 이번 입력 ("그거"를 풀었으면 푼 문장)
    history: list            # 최근 대화 [{request, answer}, ...] (최대 5턴)
    intent: str              # query / analysis / order / result / other
    answer: str              # 사용자에게 보여줄 답

    # 성향 (docs/plan/09-investor-profile.md). 3단계에서는 담아 두기만 하고 4·5단계에서 쓴다
    mode: str                # general / custom
    risk_level: int | None
    flags: list

    # 조회
    query_kind: str          # balance / price / orders
    stock_name: str | None   # 사용자가 말한 종목 이름
    stock_code: str | None   # 찾아낸 종목 코드
    snapshot: dict | None    # 계좌: cash_krw, holdings, fetched_at, source(app / server)
    prices: list | None      # [{stock_code, price, as_of}]
    market: list | None      # 폰이 보낸 시장 지수 [{index, value, change_pct, open, high, low, up, down, flat, daily, as_of}]

    # 분석 (4단계, docs/plan/05-schemas.md)
    sources: dict            # 출처 ID → {kind, title, url, as_of, content}
    metrics: list            # 코드가 계산한 지표 [{metric_id, value, unit, formula, inputs}]
    risk_grade: int          # 종목 위험등급 (1 매우 높음 ~ 6)
    risk_reason: str | None  # 1등급이면 근거 공시 (제목·날짜·출처 ID)
    allowed_actions: list    # 성향 규칙상 투자 AI가 낼 수 있는 행동
    buy_block_reason: str | None  # 매수를 뺀 이유 (투자 AI와 사용자에게 알림)
    proposal: dict | None    # 투자 AI 제안서 (최신)
    verifications: list      # 검증 AI 판정, 반박-수정마다 하나
    revision_round: int      # 검증을 몇 번 했는지 (반박-수정 최대 2번)

    # 주문 (5단계, docs/plan/05-schemas.md 6~8장)
    side: str | None         # buy / sell
    qty: int | None          # 주식 수
    limit_price: int | None  # 1주 지정가 (말하지 않으면 현재가)
    order_change: str | None # 3-1: None 새 주문 / cancel 미체결 주문 취소 / modify 가격 정정
    trigger_price: int | None  # 3-2: 이 가격에 닿으면 주문 (예약)
    trigger_direction: str | None  # below / above
    split_count: int | None  # 3-3: 몇 번에 나눠 주문할지 (예약)
    target_order: dict | None  # 취소·정정할 원래 주문 {id, broker_order_no, side, qty(남은 수량), price}
    term: str | None         # explain일 때 뜻을 묻는 용어
    period: str | None       # history: today / week / month (없으면 최근 30일)
    history_kind: str | None # history: orders / rejected (없으면 제안·주문 전부)
    room_stock: str | None   # 종목 대화방이면 그 종목 이름. 요청에 종목이 없으면 이 종목으로 본다
    user_directed: bool      # 사용자가 직접 지시한 주문인지 (분석에서 이어진 주문이면 false)
    real_mode: bool          # 4-1: 실전 모드 주문 (실제 돈). 처리안에 확인이 더 붙고 자동 주문은 소액만
    conversation_signal: str | None  # 5-4: 학습한 모델이 사용자 말에서 본 위험 신호 (app/signals.py). 투자 AI 참고·처리안 경고에 쓴다
    auto_origin: bool        # 3-4: 앱의 자동매매·예약이 낸 주문. 매수는 투자 AI가 '관찰'로 거절할 수 있고, 그러면 자동 승인하지 않는다
    from_analysis: bool      # 분석 결과에서 "이대로 주문할까요?"로 이어졌는지
    policy_result: dict | None   # 정책 검사 결과 (PolicyResult)
    coach_warnings: list     # 행동 코치 경고
    confirm_required: list   # 승인할 때 확인받아야 하는 위험 (검증 반려, 성향 초과 등)
    approval_id: str | None  # 처리안 ID (approvals.id)
    card: dict | None        # 처리안 카드 (ApprovalCard)
    expires_at: str | None   # 승인 만료 시각
    decision: str | None     # 처리안에 대한 답 (approve / edit)


def new_request(query: str, history: list, profile: dict) -> dict:
    """새 요청의 시작값. 지난 업무의 값이 섞이지 않게 비운다. 대화 ID·사용자 정보는 호출하는 쪽이 넣는다."""
    return {
        "query": query, "history": history, "intent": None, "answer": None,
        "mode": profile["mode"], "risk_level": profile.get("risk_level"), "flags": profile.get("flags", []),
        "query_kind": None, "term": None, "period": None, "history_kind": None, "room_stock": None, "stock_name": None, "stock_code": None, "snapshot": None, "prices": None, "market": None,
        "sources": {}, "metrics": [], "risk_grade": None, "risk_reason": None, "allowed_actions": [], "buy_block_reason": None, "proposal": None,
        "verifications": [], "revision_round": 0,
        "side": None, "qty": None, "limit_price": None, "order_change": None, "target_order": None,
        "trigger_price": None, "trigger_direction": None, "split_count": None,
        "user_directed": False, "auto_origin": False, "real_mode": False, "from_analysis": False, "conversation_signal": None,
        "policy_result": None, "coach_warnings": [], "confirm_required": [], "approval_id": None, "card": None,
        "expires_at": None, "decision": None,
    }
