"""주문 그래프 테스트: 처리안 → 승인 → 폰 실행 → 기록. Gemini·시계·폰은 가짜로 바꿔 끼운다."""

from datetime import date, datetime, timedelta
from uuid import uuid4

import psycopg
import pytest

from app import clock
from app.agents import llm
from app.agents.schemas import ProposalDraft, VerificationDraft
from app.clock import KST
from tests.conftest import LEVEL_4_QUIZ, PASSWORD
from tests.test_chat import events_of, first, now_iso

CODE, NAME, PRICE = "555555", "주문전자", 100_000
OPEN = datetime(2026, 10, 6, 10, 0, tzinfo=KST)  # 화요일 10시 (장중)


@pytest.fixture(scope="module", autouse=True)
def order_stock(migrated):
    with psycopg.connect(migrated) as conn:
        conn.execute("INSERT INTO stocks VALUES (%s, %s, 'KOSPI', true) ON CONFLICT DO NOTHING", (CODE, NAME))
        for days_ago in range(10):
            conn.execute("INSERT INTO stock_prices VALUES (%s, %s, %s, %s, 1000) ON CONFLICT DO NOTHING",
                         (CODE, date(2026, 10, 1) - timedelta(days=days_ago), PRICE, PRICE * 1000))


@pytest.fixture
def now(monkeypatch):
    """가짜 시계. 테스트에서 now["value"]를 바꾸면 시간이 흐른 것처럼 된다."""
    holder = {"value": OPEN}
    monkeypatch.setattr(clock, "now", lambda: holder["value"])
    return holder


def understand(query: str, history: list) -> llm.Understood:
    if "체결" in query:
        return llm.Understood(query=query, intent="result", stock_name=NAME if NAME in query else None)
    if "사도 돼" in query:
        return llm.Understood(query=query, intent="analysis", stock_name=NAME)
    side = "sell" if "팔" in query else "buy"
    qty = int(query.split("주 ")[0].split()[-1]) if "주 " in query else None
    return llm.Understood(query=query, intent="order", stock_name=NAME, side=side, qty=qty)


@pytest.fixture
def ai(monkeypatch, now):
    record = {"invest": [], "verify": [], "verdict": "approve", "action": None, "edit": llm.OrderEdit()}

    def write(context):
        record["invest"].append(context)
        action = record["action"] or ("sell" if "매도" in context.split("[사용자 지시 주문]")[-1] else "buy")
        return ProposalDraft(action=action, claims=[{"text": "실적이 좋아 보인다", "type": "opinion"}],
                             counter_arguments=["경기 둔화"], risks=["손실 가능"], invalid_if=["실적 감소"])

    def verify(context):
        record["verify"].append(context)
        return VerificationDraft(verdict=record["verdict"], checks=[], risk_fit="ok", summary="검증 요약")

    monkeypatch.setattr(llm, "understand", understand)
    monkeypatch.setattr(llm, "embed_query", lambda text: [0.1] * 768)
    monkeypatch.setattr(llm, "write_proposal", write)
    monkeypatch.setattr(llm, "verify_proposal", verify)
    monkeypatch.setattr(llm, "parse_order_edit", lambda text, order: record["edit"])
    return record


# ---------- 도우미 ----------

def balance(cash=10_000_000, holdings=None):
    return {"balance": {"cash_krw": cash, "holdings": holdings or [], "fetched_at": now_iso()},
            "prices": [{"stock_code": CODE, "price": PRICE, "as_of": now_iso()}]}


def chat(client, user, text, client_kind="app", thread_id=None):
    body = {"text": text, "client": client_kind, **({"thread_id": thread_id} if thread_id else {})}
    return events_of(client.post("/api/chat", headers=user["headers"], json=body))


def answer(client, user, events, payload, client_kind=None):
    body = {"thread_id": first(events, "done")["thread_id"], "interrupt_id": first(events, "interrupt")["interrupt_id"],
            "payload": payload, **({"client": client_kind} if client_kind else {})}
    return client.post("/api/chat/resume", headers=user["headers"], json=body)


def to_approval(client, user, text="주문전자 4주 사줘", cash=10_000_000, holdings=None):
    events = chat(client, user, text)
    assert first(events, "interrupt")["kind"] == "fetch"
    return events_of(answer(client, user, events, balance(cash, holdings)))


def filled(execute, qty=4, price=PRICE):
    return {"result": {"idempotency_key": execute["request"]["idempotency_key"], "status": "filled",
                       "broker_order_no": "0000123", "filled_qty": qty, "filled_price": price}}


def db(migrated, sql, *params):
    with psycopg.connect(migrated) as conn:
        return conn.execute(sql, params).fetchall()


@pytest.fixture
def custom_user(client, user):
    assert client.put("/api/profile", headers=user["headers"], json=LEVEL_4_QUIZ).status_code == 200
    return user


# ---------- 전체 흐름 (5단계 완료 조건) ----------

def test_order_flow_to_execution_and_record(client, custom_user, ai, migrated) -> None:
    user = custom_user
    approval_events = to_approval(client, user)

    approval = first(approval_events, "interrupt")
    assert approval["kind"] == "approval"
    card = approval["card"]
    assert (card["qty"], card["limit_price"], card["amount"], card["fee"]) == (4, PRICE, 400_000, None)
    assert card["weight_after"] == "4.00" and card["worst_case_loss"] == 40_000
    assert card["confirm_required"] == [] and all(rule["ok"] for rule in card["policy"])
    assert "수수료율 미입력" in approval["text"] and "모의투자" in approval["text"]
    assert "[사용자 지시 주문] 주문전자 4주 100,000원 매수" in ai["invest"][0]

    execute_events = events_of(answer(client, user, approval_events, {"decision": "approve"}))
    execute = first(execute_events, "interrupt")
    assert execute["kind"] == "execute"
    assert execute["request"] == {"approval_id": approval["approval_id"], "stock_code": CODE, "side": "buy", "qty": 4,
                                  "limit_price": PRICE, "approved_price": PRICE, "max_price_drift_pct": 1,
                                  "idempotency_key": approval["approval_id"], "mode": "mock"}

    done = events_of(answer(client, user, execute_events, filled(execute)))
    assert "주문이 체결됐어요 (모의투자)" in first(done, "message")["text"]
    assert "주문번호 0000123" in first(done, "message")["text"]

    [(status, channel)] = db(migrated, "SELECT status, decided_channel FROM approvals WHERE id = %s", approval["approval_id"])
    assert (status, channel) == ("approved", "app")
    [(order_status, broker, mode, qty)] = db(migrated, "SELECT status, broker, mode, qty FROM orders WHERE approval_id = %s",
                                             approval["approval_id"])
    assert (order_status, broker, mode, qty) == ("filled", "kis_mock", "mock", 4)
    [(directed, saved_qty)] = db(migrated, "SELECT p.user_directed, p.qty FROM proposals p JOIN approvals a"
                                           " ON a.proposal_id = p.id WHERE a.id = %s", approval["approval_id"])
    assert (directed, saved_qty) == (True, 4)
    events = [r[0] for r in db(migrated, "SELECT event FROM audit_logs WHERE user_id = %s ORDER BY id", user["id"])]
    assert events[-3:] == ["approval_requested", "approval_approved", "order_result"]


def test_asks_quantity_when_missing(client, custom_user, ai) -> None:
    events = chat(client, custom_user, "주문전자 사줘")
    question = first(events, "interrupt")
    assert (question["kind"], question["text"]) == ("question", "몇 주 살까요?")
    after = events_of(answer(client, custom_user, events, {"text": "3주"}))
    assert first(after, "interrupt")["kind"] == "fetch"


# ---------- 정책 검사 (처리안 전에 막음) ----------

@pytest.mark.parametrize(
    "text, kwargs, rule_label",
    [
        ("주문전자 30주 사줘", {}, "1회 주문 한도"),                  # 300만 > 적극투자형 1회 200만
        ("주문전자 4주 사줘", {"cash": 100_000}, "현금"),
        ("주문전자 4주 팔아줘", {}, "보유 수량"),                     # 보유 없음
    ],
)
def test_policy_violation_blocks_without_approval(client, custom_user, ai, migrated, text, kwargs, rule_label) -> None:
    events = to_approval(client, custom_user, text, **kwargs)
    message = first(events, "message")["text"]
    assert message.startswith("주문할 수 없어요") and rule_label in message
    assert first(events, "interrupt") is None
    assert db(migrated, "SELECT count(*) FROM approvals a JOIN proposals p ON p.id = a.proposal_id WHERE p.user_id = %s",
              custom_user["id"])[0][0] == 0
    assert db(migrated, "SELECT bool_and(NOT ok) FROM policy_checks c JOIN proposals p ON p.id = c.proposal_id"
                        " WHERE p.user_id = %s", custom_user["id"])[0][0] is True


def test_market_closed_blocks(client, custom_user, ai, now) -> None:
    now["value"] = datetime(2026, 10, 10, 10, 0, tzinfo=KST)  # 토요일
    assert "장 운영 시간" in first(to_approval(client, custom_user), "message")["text"]


# ---------- 승인 · 거절 · 만료 · 수정 ----------

def test_reject_records_and_does_not_order(client, custom_user, ai, migrated) -> None:
    events = to_approval(client, custom_user)
    approval_id = first(events, "interrupt")["approval_id"]
    done = events_of(answer(client, custom_user, events, {"decision": "reject"}))
    assert "주문하지 않았어요" in first(done, "message")["text"]
    assert db(migrated, "SELECT status FROM approvals WHERE id = %s", approval_id)[0][0] == "rejected"
    assert db(migrated, "SELECT count(*) FROM orders WHERE approval_id = %s", approval_id)[0][0] == 0


def test_late_approval_expires(client, custom_user, ai, now, migrated) -> None:
    events = to_approval(client, custom_user)
    approval_id = first(events, "interrupt")["approval_id"]
    now["value"] = OPEN + timedelta(minutes=10, seconds=1)
    done = events_of(answer(client, custom_user, events, {"decision": "approve"}))
    assert "만료" in first(done, "message")["text"]
    assert db(migrated, "SELECT status FROM approvals WHERE id = %s", approval_id)[0][0] == "expired"


def test_edit_quantity_makes_new_card_on_same_approval(client, custom_user, ai, migrated) -> None:
    events = to_approval(client, custom_user)
    approval_id = first(events, "interrupt")["approval_id"]

    edited = events_of(answer(client, custom_user, events, {"decision": "edit", "text": "2주만"}))

    card = first(edited, "interrupt")["card"]
    assert (card["qty"], card["amount"], card["approval_id"]) == (2, 200_000, approval_id)
    assert db(migrated, "SELECT p.qty FROM proposals p JOIN approvals a ON a.proposal_id = p.id WHERE a.id = %s",
              approval_id)[0][0] == 2
    assert len(ai["invest"]) == 1  # 수량만 바꾸면 AI를 다시 부르지 않고 정책만 다시 검사한다


def test_unclear_edit_asks_again_without_executing(client, custom_user, ai) -> None:
    events = to_approval(client, custom_user)
    again = events_of(answer(client, custom_user, events, {"decision": "edit", "text": "음 좀 바꿔줘"}))
    assert first(again, "interrupt")["kind"] == "approval"


def test_price_change_requires_new_approval(client, custom_user, ai, migrated) -> None:
    events = to_approval(client, custom_user)
    execute_events = events_of(answer(client, custom_user, events, {"decision": "approve"}))
    execute = first(execute_events, "interrupt")
    changed = {"result": {"idempotency_key": execute["request"]["idempotency_key"], "status": "price_changed",
                          "current_price": 102_000}}

    reapproval = events_of(answer(client, custom_user, execute_events, changed))

    approval = first(reapproval, "interrupt")
    assert approval["kind"] == "approval" and approval["card"]["limit_price"] == 102_000
    assert db(migrated, "SELECT status FROM approvals WHERE id = %s", approval["approval_id"])[0][0] == "pending"
    execute2 = events_of(answer(client, custom_user, reapproval, {"decision": "approve"}))
    done = events_of(answer(client, custom_user, execute2, filled(first(execute2, "interrupt"), price=102_000)))
    assert "체결" in first(done, "message")["text"]


# ---------- 확인 필요한 위험 ----------

def test_general_mode_order_needs_risk_confirmation(client, user, ai) -> None:
    events = to_approval(client, user, "주문전자 2주 사줘")  # 퀴즈 안 함 → 안정형 한도 (1회 30만)
    assert any("일반 모드" in c for c in first(events, "interrupt")["confirm_required"])

    assert answer(client, user, events, {"decision": "approve"}).status_code == 422
    confirmed = events_of(answer(client, user, events, {"decision": "approve", "confirm_risk": True}))
    assert first(confirmed, "interrupt")["kind"] == "execute"


def test_verifier_rejection_does_not_block_directed_order_but_needs_confirm(client, custom_user, ai) -> None:
    ai["verdict"] = "reject"  # 계속 반려 → 2번 수정 후 사용자 판단 필요
    events = to_approval(client, custom_user)
    approval = first(events, "interrupt")
    assert approval["kind"] == "approval"
    assert len(ai["invest"]) == 3
    assert any("검증 AI 판정이 '사용자 판단 필요'" in c for c in approval["confirm_required"])


# ---------- 웹 승인 → 폰 실행, 중복 방지 ----------

def test_web_approval_waits_for_phone(client, custom_user, ai) -> None:
    user = custom_user
    client.post("/api/snapshot", headers=user["headers"], json=balance()["balance"])
    events = chat(client, user, "주문전자 4주 사줘", "web")
    assert first(events, "interrupt")["kind"] == "approval"  # 웹은 fetch 없이 스냅샷·최근 종가로

    execute_events = events_of(answer(client, user, events, {"decision": "approve"}, "web"))
    execute = first(execute_events, "interrupt")
    assert execute["kind"] == "execute"
    assert answer(client, user, execute_events, filled(execute), "web").status_code == 403  # 웹은 주문 못 함

    pending = client.get("/api/chat/pending", headers=user["headers"]).json()
    assert [p["kind"] for p in pending] == ["execute"]
    done = events_of(answer(client, user, execute_events, filled(execute), "app"))
    assert "체결" in first(done, "message")["text"]


def test_execute_result_for_other_order_is_rejected(client, custom_user, ai) -> None:
    events = to_approval(client, custom_user)
    execute_events = events_of(answer(client, custom_user, events, {"decision": "approve"}))
    wrong = {"result": {"idempotency_key": "other", "status": "failed", "message": "x"}}
    assert answer(client, custom_user, execute_events, wrong).status_code == 422


def test_duplicate_result_is_recorded_once(client, custom_user, ai, migrated) -> None:
    events = to_approval(client, custom_user)
    execute_events = events_of(answer(client, custom_user, events, {"decision": "approve"}))
    execute = first(execute_events, "interrupt")
    key = execute["request"]["idempotency_key"]
    with psycopg.connect(migrated) as conn:  # 같은 주문 결과가 이미 기록돼 있다고 가정
        conn.execute("INSERT INTO orders (approval_id, idempotency_key, broker, mode, side, qty, price, status)"
                     " VALUES (%s, %s, 'kis_mock', 'mock', 'buy', 4, %s, 'accepted')", (key, key, PRICE))

    events_of(answer(client, custom_user, execute_events, filled(execute)))

    assert db(migrated, "SELECT count(*), min(status) FROM orders WHERE idempotency_key = %s", key) == [(1, "accepted")]


# ---------- 분석에서 이어서 주문 ----------

def test_analysis_offers_order_and_continues(client, custom_user, ai) -> None:
    user = custom_user
    events = chat(client, user, "주문전자 사도 돼?")
    analysis_answer = events_of(answer(client, user, events, balance()))
    offer = first(analysis_answer, "interrupt")
    assert offer["kind"] == "question" and offer["text"].endswith("이대로 주문할까요?")

    qty_question = events_of(answer(client, user, analysis_answer, {"choice_id": "yes"}))
    assert first(qty_question, "interrupt")["text"] == "몇 주 살까요?"
    approval = events_of(answer(client, user, qty_question, {"text": "3주"}))

    card = first(approval, "interrupt")["card"]
    assert (card["qty"], card["user_directed"]) == (3, False)
    assert len(ai["invest"]) == 1  # 분석 때 한 번만. 주문으로 이어갈 때 AI를 다시 부르지 않는다
    # 기록에도 주문 수량·가격이 남는다 (분석 때 제안서에는 수량이 없었다)
    latest = client.get("/api/history", headers=user["headers"]).json()[0]
    assert (latest["qty"], latest["limit_price"]) == (3, PRICE)
    assert "3주 매수" in result_text(client, user)


def test_analysis_offer_declined(client, custom_user, ai) -> None:
    events = chat(client, custom_user, "주문전자 사도 돼?")
    offer = events_of(answer(client, custom_user, events, balance()))
    done = events_of(answer(client, custom_user, offer, {"choice_id": "no"}))
    assert first(done, "interrupt") is None and "분석" in first(done, "message")["text"]


# ---------- 행동 코치 · 하루 한도 (실제 주문 기록으로) ----------

def place_filled_order(client, user, text="주문전자 4주 사줘", qty=4):
    events = to_approval(client, user, text)
    execute_events = events_of(answer(client, user, events, {"decision": "approve"}))
    events_of(answer(client, user, execute_events, filled(first(execute_events, "interrupt"), qty)))


def test_frequent_trading_warning_and_daily_total(client, custom_user, ai) -> None:
    place_filled_order(client, custom_user)
    place_filled_order(client, custom_user)

    card = first(to_approval(client, custom_user), "interrupt")["card"]
    assert any("최근 7일 동안 이 종목을 2번 거래" in w for w in card["warnings"])
    daily = next(rule for rule in card["policy"] if rule["rule"] == "max_daily")
    assert daily["actual"] == 3 * 400_000  # 오늘 체결 2건 + 이번 주문


def test_conversation_signal_adds_warning_and_confirm(client, custom_user, ai, monkeypatch) -> None:
    from app import signals
    seen = []
    monkeypatch.setattr(signals, "model_signal", lambda text: seen.append(text) or "borrowed_money")
    card = first(to_approval(client, custom_user), "interrupt")["card"]
    assert len(seen) == 1 and signals.WARNINGS["borrowed_money"] in card["warnings"]  # 한 번만 본다
    assert any("위험 신호" in c for c in card["confirm_required"])
    assert "[대화 신호]" in ai["invest"][-1] and all("[대화 신호]" not in v for v in ai["verify"])  # 투자 AI만 받는다


def test_signal_warning_only_matches_side() -> None:
    from app.signals import keyword_signal, signal_warning
    assert signal_warning("borrowed_money", "sell") is None and signal_warning("panic_sell", "buy") is None
    assert signal_warning("panic_sell", "sell") and signal_warning(None, "buy") is None and signal_warning("none", "buy") is None
    assert keyword_signal("마통 당겨서 살래") == "borrowed_money" and keyword_signal("삼성전자 어때?") == "none"


def test_daily_limit_blocks_after_orders(client, custom_user, ai, migrated) -> None:
    with psycopg.connect(migrated) as conn:  # 1회 40만, 1일 60만으로 낮춘다 (1일 ≥ 1회)
        conn.execute("UPDATE policies SET max_order_krw = 400000, max_daily_krw = 600000 WHERE user_id = %s",
                     (custom_user["id"],))
    place_filled_order(client, custom_user)                      # 40만
    message = first(to_approval(client, custom_user), "message")["text"]  # 40만 + 40만 > 60만
    assert "1일 주문 한도" in message


# ---------- 승인 대기 · 기록 API ----------

def test_approval_lists_and_history_timeline(client, custom_user, ai) -> None:
    user, headers = custom_user, custom_user["headers"]
    events = to_approval(client, user)
    approval_id = first(events, "interrupt")["approval_id"]
    with psycopg.connect(client.app.state.database_url) as conn:  # 목록은 DB 시계로 만료를 본다 (테스트 시계는 10시 고정)
        conn.execute("UPDATE approvals SET expires_at = now() + interval '10 minutes' WHERE id = %s", (approval_id,))

    waiting = client.get("/api/approvals?status=needs_approval", headers=headers).json()
    assert [a["approval_id"] for a in waiting] == [approval_id]
    assert waiting[0]["card"]["qty"] == 4 and waiting[0]["thread_id"] == first(events, "done")["thread_id"]

    execute_events = events_of(answer(client, user, events, {"decision": "approve"}))
    assert [a["approval_id"] for a in client.get("/api/approvals?status=needs_execution", headers=headers).json()] == [approval_id]

    events_of(answer(client, user, execute_events, filled(first(execute_events, "interrupt"))))
    closed = client.get(f"/api/approvals/{approval_id}", headers=headers).json()
    assert (closed["state"], closed["order_result"]["status"]) == ("closed", "filled")

    [item] = client.get("/api/history", headers=headers).json()
    assert (item["stock_name"], item["verdict"], item["approval_status"], item["order_status"]) == (NAME, "approve", "approved", "filled")
    assert item["policy_ok"] is True
    [proposal] = client.get("/api/agents/proposals", headers=headers).json()
    assert (proposal["proposal_id"], proposal["action"], proposal["verdict"]) == (item["proposal_id"], "buy", "approve")
    assert proposal["claims"][0]["text"] == "실적이 좋아 보인다"
    [verification] = client.get("/api/agents/verifications", headers=headers).json()
    assert (verification["stock_name"], verification["round"], verification["failed_checks"]) == (NAME, 0, 0)
    steps = [step["step"] for step in client.get(f"/api/history/{item['proposal_id']}", headers=headers).json()["timeline"]]
    assert steps[0] == "proposal" and steps[-1] == "order_result"
    assert {"verification", "policy_check", "approval_requested", "approval_approved"} <= set(steps)


def test_expired_approval_shows_as_closed(client, custom_user, ai, now) -> None:
    events = to_approval(client, custom_user)
    approval_id = first(events, "interrupt")["approval_id"]
    with psycopg.connect(client.app.state.database_url) as conn:  # 만료 시각이 지난 것처럼
        conn.execute("UPDATE approvals SET expires_at = now() - interval '1 second' WHERE id = %s", (approval_id,))
    detail = client.get(f"/api/approvals/{approval_id}", headers=custom_user["headers"]).json()
    assert (detail["state"], detail["status"]) == ("closed", "expired")


def test_other_users_cannot_see_approvals_or_history(client, custom_user, ai) -> None:
    events = to_approval(client, custom_user)
    approval_id = first(events, "interrupt")["approval_id"]
    proposal_id = client.get("/api/history", headers=custom_user["headers"]).json()[0]["proposal_id"]
    email = "other-" + custom_user["email"]
    client.post("/api/auth/signup", json={"email": email, "password": "pw-other-1", "agreed_terms": True})
    other = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": email, "password": "pw-other-1"}).json()["token"]}
    assert client.get(f"/api/approvals/{approval_id}", headers=other).status_code == 404
    assert client.get(f"/api/history/{proposal_id}", headers=other).status_code == 404
    assert client.get("/api/approvals", headers=other).json() == []
    assert client.get("/api/history", headers=other).json() == []
    assert client.get("/api/agents/proposals", headers=other).json() == []
    assert client.get("/api/agents/verifications", headers=other).json() == []


# ---------- 결과 확인 ("아까 주문 체결됐어?") ----------

def result_text(client, user, text="아까 주문 체결됐어?"):
    return first(chat(client, user, text), "message")["text"]


def test_result_after_fill(client, custom_user, ai) -> None:
    place_filled_order(client, custom_user)
    text = result_text(client, custom_user, "주문전자 체결됐어?")
    assert "주문전자(555555) 4주 매수" in text and "체결됐어요" in text
    assert "체결 4주 × 100,000원" in text and "주문번호 0000123" in text and "기준" in text


def test_result_while_waiting_and_after_web_approval(client, custom_user, ai) -> None:
    events = to_approval(client, custom_user)
    assert "승인을 기다리고 있어요" in result_text(client, custom_user)
    # 새 메시지를 보내면 멈춘 업무는 버려지므로 다른 대화에서 웹 승인 흐름을 만든다
    events = to_approval(client, custom_user)
    events_of(answer(client, custom_user, events, {"decision": "approve"}, client_kind="web"))
    assert "웹에서 승인했지만 아직 폰에서 실행하지 않았어요" in result_text(client, custom_user)


def test_result_for_blocked_and_rejected(client, custom_user, ai) -> None:
    to_approval(client, custom_user, "주문전자 4주 사줘", cash=100)  # 현금 부족
    assert "정책 검사에 걸려 주문하지 않았어요" in result_text(client, custom_user)
    events = to_approval(client, custom_user)
    events_of(answer(client, custom_user, events, {"decision": "reject"}))
    assert "거절했어요" in result_text(client, custom_user)


def test_result_is_only_mine(client, custom_user, ai) -> None:
    place_filled_order(client, custom_user)
    email = "other-" + custom_user["email"]
    client.post("/api/auth/signup", json={"email": email, "password": "pw-other-1", "agreed_terms": True})
    token = client.post("/api/auth/login", json={"email": email, "password": "pw-other-1"}).json()["token"]
    assert result_text(client, {"headers": {"Authorization": f"Bearer {token}"}}) == "주문 기록이 없어요."


# ---------- 체결 갱신 (접수 → 체결) ----------

def place_accepted_order(client, user):
    events = to_approval(client, user)
    execute_events = events_of(answer(client, user, events, {"decision": "approve"}))
    key = first(execute_events, "interrupt")["request"]["idempotency_key"]
    accepted = {"result": {"idempotency_key": key, "status": "accepted", "broker_order_no": "0000777", "filled_qty": 0}}
    events_of(answer(client, user, execute_events, accepted))
    return key


def test_fill_sync_updates_accepted_order(client, custom_user, ai) -> None:
    headers = custom_user["headers"]
    key = place_accepted_order(client, custom_user)
    assert "접수됐어요. 아직 체결되지 않았어요" in result_text(client, custom_user)

    [open_order] = client.get("/api/orders/open", headers=headers).json()
    assert open_order == {"idempotency_key": key, "stock_code": CODE, "broker_order_no": "0000777", "side": "buy",
                          "qty": 4, "filled_qty": 0}

    def post(qty, price=99_500):
        fill = {"idempotency_key": key, "filled_qty": qty, **({"filled_price": price} if price else {})}
        return client.post("/api/orders/fills", headers=headers, json={"fills": [fill]})

    assert post(1, None).status_code == 422                       # 체결 수량이 있으면 가격도
    assert post(1).json()["updated"][0]["status"] == "partially_filled"
    assert post(0, None).json()["updated"] == []                   # 체결 수량은 줄어들 수 없다
    assert post(5).json()["updated"] == []                         # 주문 수량을 넘을 수 없다
    assert post(4).json()["updated"][0]["status"] == "filled"
    assert client.get("/api/orders/open", headers=headers).json() == []
    assert post(4).json()["updated"] == []                         # 끝난 주문은 다시 바꾸지 않는다

    text = result_text(client, custom_user)
    assert "체결됐어요" in text and "체결 4주 × 99,500원" in text and "증권사에서 확인한 기록" in text


def test_fill_sync_ignores_other_users_orders(client, custom_user, ai) -> None:
    key = place_accepted_order(client, custom_user)
    email = "fill-" + custom_user["email"]
    client.post("/api/auth/signup", json={"email": email, "password": "pw-other-1", "agreed_terms": True})
    other = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": email, "password": "pw-other-1"}).json()["token"]}
    assert client.get("/api/orders/open", headers=other).json() == []
    fill = {"idempotency_key": key, "filled_qty": 4, "filled_price": PRICE}
    assert client.post("/api/orders/fills", headers=other, json={"fills": [fill]}).json()["updated"] == []


def test_today_rings(client, custom_user, ai, migrated) -> None:
    headers = custom_user["headers"]
    place_filled_order(client, custom_user)
    today = client.get("/api/orders/today", headers=headers).json()
    [(limit,)] = db(migrated, "SELECT max_daily_krw FROM policies WHERE user_id = %s", custom_user["id"])
    assert today == {"daily_used_krw": 400_000, "daily_limit_krw": limit, "clean_days": 0}  # 오늘 가입
    with psycopg.connect(migrated) as conn:  # 사흘 전에 가입했고 그 뒤로 규칙에 걸린 적 없음
        conn.execute("UPDATE users SET created_at = now() - interval '3 days' WHERE id = %s", (custom_user["id"],))
    assert client.get("/api/orders/today", headers=headers).json()["clean_days"] == 3
    with psycopg.connect(migrated) as conn:  # 1회 한도를 낮춰서 오늘 규칙에 걸리게
        conn.execute("UPDATE policies SET max_order_krw = 100000 WHERE user_id = %s", (custom_user["id"],))
    to_approval(client, custom_user)
    assert client.get("/api/orders/today", headers=headers).json()["clean_days"] == 0


# ---------- 종목 대화방 ----------

def test_stock_room_remembers_stock(client, custom_user, ai) -> None:
    headers = custom_user["headers"]
    assert client.get(f"/api/chat/rooms/{CODE}", headers=headers).json() == {
        "stock_code": CODE, "stock_name": NAME, "thread_id": None, "messages": []}
    place_filled_order(client, custom_user)
    # 종목 방에서는 종목을 말하지 않아도 그 종목으로 본다 (가짜 understand는 종목 이름이 없으면 stock_name=None)
    events = events_of(client.post("/api/chat", headers=headers,
                                   json={"text": "체결됐어?", "client": "app", "stock_code": CODE}))
    assert "주문전자(555555) 4주 매수" in first(events, "message")["text"]
    room = client.get(f"/api/chat/rooms/{CODE}", headers=headers).json()
    assert room["thread_id"] == first(events, "done")["thread_id"]
    assert [m["role"] for m in room["messages"]] == ["user", "assistant"]
    # 같은 방에 이어서 보내면 같은 대화에 쌓인다
    events_of(client.post("/api/chat", headers=headers, json={"text": "체결됐어?", "client": "app", "thread_id": room["thread_id"]}))
    assert len(client.get(f"/api/chat/rooms/{CODE}", headers=headers).json()["messages"]) == 4
    assert client.get("/api/chat/rooms/999999", headers=headers).status_code == 404
    assert client.post("/api/chat", headers=headers, json={"text": "x", "client": "app", "stock_code": "999999"}).status_code == 404


# ---------- 장 마감 요약 ----------

def test_close_summary(client, custom_user, ai, migrated) -> None:
    from app import briefing

    headers = custom_user["headers"]
    place_filled_order(client, custom_user)                    # 체결 4주 × 100,000
    place_accepted_order(client, custom_user)                  # 접수만
    with psycopg.connect(migrated) as conn:                    # 1회 한도를 낮춰 규칙에 걸리게
        conn.execute("UPDATE policies SET max_order_krw = 100000 WHERE user_id = %s", (custom_user["id"],))
    to_approval(client, custom_user)
    assert client.get("/api/briefings/latest?kind=close", headers=headers).status_code == 404

    content = briefing.build_close(migrated, custom_user["id"])

    assert [o["status"] for o in content["orders"]] == ["filled", "accepted"]
    assert (content["bought_krw"], content["sold_krw"], content["analyses"]) == (400_000, 0, 3)
    [blocked] = content["blocked"]
    assert blocked["stock_name"] == NAME and blocked["rules"]  # 걸린 규칙 이름
    saved = client.get("/api/briefings/latest?kind=close", headers=headers).json()
    assert saved["kind"] == "close" and saved["content"]["bought_krw"] == 400_000
    assert client.get("/api/briefings/latest", headers=headers).status_code == 404  # 아침 브리핑과 따로


# ---------- 장 마감 AI 회고 · 내일 계획 ----------

@pytest.fixture
def review_ai(monkeypatch):
    record = {"invest": [], "verify": [], "drafts": []}

    def write(context):
        record["invest"].append(context)
        return record["drafts"].pop(0) if len(record["drafts"]) > 1 else record["drafts"][0]

    def verify(context):
        record["verify"].append(context)
        return VerificationDraft(verdict="approve", checks=[], risk_fit="ok", summary="원문과 맞아요")

    monkeypatch.setattr(llm, "write_review", write)
    monkeypatch.setattr(llm, "verify_review", verify)
    return record


def review_draft(source_id="today", action="sell"):
    from app.agents.schemas import ReviewDraft
    return ReviewDraft(
        retrospective=[{"text": "오늘 4주를 체결했다", "type": "fact", "source_ids": [source_id]}],
        tomorrow=[{"stock_code": CODE, "action": action, "invalid_if": ["실적 개선 공시"],
                   "reasons": [{"text": "비중이 크다", "type": "calc", "source_ids": ["portfolio"]}]}],
        risks=["손실 가능, 매도 시 세금 0.20%"])


def post_snapshot(client, user, qty=4):
    snapshot = {"cash_krw": 600_000, "fetched_at": now_iso(),
                "holdings": [{"stock_code": CODE, "stock_name": NAME, "qty": qty, "avg_price": PRICE}]}
    assert client.post("/api/snapshot", headers=user["headers"], json=snapshot).status_code == 204


def test_close_review_rewrites_until_sources_check(client, custom_user, ai, review_ai, migrated) -> None:
    from app import review

    place_filled_order(client, custom_user)
    post_snapshot(client, custom_user)
    review_ai["drafts"] = [review_draft("dart:NOPE"), review_draft()]  # 첫 회고는 없는 출처를 단다

    review.build_review(migrated, custom_user["id"])
    place_filled_order(client, custom_user)  # 회고 뒤에 또 산다 → 다시 만들면 요약도 지금 기록으로 새로 만든다
    review_ai["invest"], review_ai["verify"] = [], []
    review_ai["drafts"] = [review_draft("dart:NOPE"), review_draft()]
    result = review.build_review(migrated, custom_user["id"])

    # 코드 검사가 없는 출처를 잡아 검증 AI가 승인해도 반려 → 다시 쓴다
    assert len(review_ai["invest"]) == 2 and "r0: 없는 출처 ID: dart:NOPE" in review_ai["invest"][1]
    assert (result["verdict"], result["rounds"]) == ("approve", 2)
    # 투자 AI 자료: 오늘 기록·제안서·비중(코드 계산)·종가
    context = review_ai["invest"][0]
    assert "산 금액(체결) 800,000원" in context and "주문전자 제안서" in context and "비중 40.0%" in context  # 스냅샷은 그대로
    assert "수수료율 미입력이라 미확인" in context and f"price:{CODE}:2026-10-01" in context
    # 검증 AI는 투자 AI의 자료 목록이 아니라 인용한 출처만 다시 읽는다
    checked = review_ai["verify"][1]
    assert "[자료]" not in checked and "[원문]" in checked and "주문전자 제안서" not in checked
    [plan] = result["tomorrow"]
    assert (plan["stock_name"], plan["action"]) == (NAME, "매도 검토")
    assert plan["reasons"][0]["sources"] == ["내 계좌 비중 (최근 스냅샷 × 최근 종가, 코드 계산)"]
    saved = client.get("/api/briefings/latest?kind=close", headers=custom_user["headers"]).json()["content"]
    assert saved["bought_krw"] == 800_000 and saved["review"]["summary"] == "원문과 맞아요"  # 요약에 붙는다


def test_close_review_general_mode_and_nothing_to_review(client, user, review_ai, migrated) -> None:
    from app import review

    assert review.build_review(migrated, user["id"]) is None and review_ai["invest"] == []  # 매매·보유·관심 없음 → 비용 없음
    post_snapshot(client, user)
    review_ai["drafts"] = [review_draft(action="sell")]
    result = review.build_review(migrated, user["id"])
    # 일반 모드는 판단하지 않는다: 코드가 '관찰'로 바꾼다
    assert result["general"] and result["tomorrow"][0]["action"] == "관찰"
    assert any("성향 규칙에 따라 주문전자은(는) '매도 검토' 대신 '관찰'" in r for r in result["risks"])
    assert "일반 모드다" in review_ai["invest"][0]


# ---------- 내 투자 습관 (행동 기반 성향) ----------

def test_behavior_habits_add_caution_only(client, custom_user, ai, migrated, monkeypatch) -> None:
    from app.functions import behavior as habits

    headers, url = custom_user["headers"], "/api/profile/behavior"
    for _ in range(4):
        place_filled_order(client, custom_user, "주문전자 1주 사줘", 1)
    found = client.get(url, headers=headers).json()
    assert (found["records"], found["fills"], found["enough"], found["flags"]) == (4, 4, False, [])  # 5건 미만이면 판단 안 함
    place_filled_order(client, custom_user, "주문전자 1주 사줘", 1)
    # 두 건은 급등 경고를 받고도 승인한 것으로 기록을 바꾼다 (실제 급등 시세 대신)
    db(migrated, "UPDATE approvals SET card = jsonb_set(card, '{warnings}', '[\"급등 직후 매수는 고점에 살 위험이 있어요.\"]')"
                 " WHERE id IN (SELECT a.id FROM approvals a JOIN proposals p ON p.id = a.proposal_id"
                 " WHERE p.user_id = %s ORDER BY a.created_at LIMIT 2) RETURNING id", custom_user["id"])
    monkeypatch.setattr(habits, "FREQUENT_FILLS", 5)

    found = client.get(url, headers=headers).json()
    assert found["enough"] and (found["fills"], found["hot_buys"], found["winner_sells"]) == (5, 2, 0)
    assert found["flags"] == ["frequent_trading", "hot_buys"] and len(found["notes"]) == 2
    assert client.get("/api/profile", headers=headers).json()["risk_level"] == 4  # 성향 단계는 그대로
    # 다음 주문: 처리안에 30일 체결 수, 투자 AI에게 비용 강조 안내
    card = first(to_approval(client, custom_user, "주문전자 1주 사줘"), "interrupt")["card"]
    assert any("최근 30일 동안 5건 체결" in w for w in card["warnings"])
    assert "최근 30일 동안 자주 거래했다" in ai["invest"][-1] and "급등 경고를 받고도 산 적이" in ai["invest"][-1]


# ---------- 내 기록 질문 ----------

def test_history_questions(client, custom_user, ai, monkeypatch) -> None:
    headers = custom_user["headers"]
    place_filled_order(client, custom_user)                    # 체결된 매수
    ai["verdict"] = "reject"                                    # 2번 고쳐도 반려 → 사용자 판단 필요, 주문 안 함
    to_approval(client, custom_user, "주문전자 2주 사줘")
    ask = {}
    monkeypatch.setattr(llm, "understand", lambda q, h: llm.Understood(query=q, intent="history", **ask))

    def answer_of(**kwargs):
        ask.clear(); ask.update(kwargs)
        return first(events_of(client.post("/api/chat", headers=headers, json={"text": "기록", "client": "web"})), "message")["text"]

    text = answer_of()
    assert text.startswith("최근 30일 제안·주문 2건") and "검증 사용자 판단 필요" in text and "체결됐어요 (4주 × 100,000원)" in text
    text = answer_of(history_kind="orders", side="buy", period="today")
    assert text.startswith("오늘 매수 주문 1건") and "2주" not in text
    text = answer_of(history_kind="rejected", stock_name=NAME)
    assert text.startswith(f"최근 30일 {NAME} 검증을 통과하지 못한 제안 1건") and "- 검증 AI: 2번 수정했지만" in text
    assert answer_of(stock_name="없는회사").startswith("'없는회사' 종목을 찾지 못했어요")
    assert answer_of(side="sell").startswith("최근 30일 매도 제안·주문 기록이 없어요")

    # 다른 사용자의 기록은 보이지 않는다
    email = f"{uuid4().hex}@test.kr"
    client.post("/api/auth/signup", json={"email": email, "password": PASSWORD, "agreed_terms": True})
    headers = {"Authorization": "Bearer " + client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).json()["token"]}
    assert answer_of().startswith("최근 30일 제안·주문 기록이 없어요")


# ---------- 정정·취소 (3-1) ----------

def change_understand(query: str, history: list) -> llm.Understood:
    if "취소" in query:
        return llm.Understood(query=query, intent="order", stock_name=NAME, order_change="cancel")
    if "정정" in query:
        return llm.Understood(query=query, intent="order", stock_name=NAME, order_change="modify", limit_price=98_000)
    return understand(query, history)


def test_cancel_open_order_goes_through_ai_and_closes_original(client, custom_user, ai, migrated, monkeypatch) -> None:
    monkeypatch.setattr(llm, "understand", change_understand)
    place_accepted_order(client, custom_user)
    card, request, message = run_change(client, custom_user, "주문전자 주문 취소해줘")

    assert card["order_change"] == "cancel" and card["original_order_no"] == "0000777" and card["amount"] == 0
    assert [r["rule"] for r in card["policy"]] == ["market_hours"]  # 취소는 한도를 보지 않는다
    assert "취소" in ai["invest"][-1].split("[사용자 지시 주문]")[-1] and ai["verify"]  # 투자 AI → 검증 AI를 거쳤다
    assert request["order_change"] == "cancel" and request["original_order_no"] == "0000777" and request["qty"] == 4
    assert message.startswith("취소 요청이 접수됐어요")
    rows = db(migrated, "SELECT o.kind, o.status FROM orders o JOIN approvals a ON a.id = o.approval_id"
                        " JOIN proposals p ON p.id = a.proposal_id WHERE p.user_id = %s ORDER BY o.created_at", custom_user["id"])
    assert rows == [("new", "cancelled"), ("cancel", "accepted")]
    used = client.get("/api/orders/today", headers=custom_user["headers"]).json()["daily_used_krw"]
    assert used == 0  # 체결 없이 취소된 주문은 1일 한도에 세지 않는다
    assert client.get("/api/orders/open", headers=custom_user["headers"]).json() == []


def test_modify_open_order_price_rechecks_limits(client, custom_user, ai, migrated, monkeypatch) -> None:
    monkeypatch.setattr(llm, "understand", change_understand)
    place_accepted_order(client, custom_user)
    card, request, message = run_change(client, custom_user, "주문전자 주문 98000원으로 정정해줘")

    assert card["order_change"] == "modify" and card["original_price"] == PRICE and card["limit_price"] == 98_000
    daily = next(r for r in card["policy"] if r["rule"] == "max_daily")
    assert daily["actual"] == 4 * 98_000  # 원래 주문 금액을 빼고 정정 후 금액으로 본다
    assert request["order_change"] == "modify" and request["limit_price"] == 98_000
    rows = db(migrated, "SELECT o.kind, o.status, o.price FROM orders o JOIN approvals a ON a.id = o.approval_id"
                        " JOIN proposals p ON p.id = a.proposal_id WHERE p.user_id = %s ORDER BY o.created_at", custom_user["id"])
    assert rows == [("new", "replaced", PRICE), ("modify", "accepted", 98_000)]
    assert client.get("/api/orders/today", headers=custom_user["headers"]).json()["daily_used_krw"] == 4 * 98_000


def test_cancel_failed_at_broker_keeps_original_open(client, custom_user, ai, migrated, monkeypatch) -> None:
    monkeypatch.setattr(llm, "understand", change_understand)
    place_accepted_order(client, custom_user)
    run_change(client, custom_user, "주문전자 주문 취소해줘", broker_status="failed")
    rows = db(migrated, "SELECT o.kind, o.status FROM orders o JOIN approvals a ON a.id = o.approval_id"
                        " JOIN proposals p ON p.id = a.proposal_id WHERE p.user_id = %s ORDER BY o.created_at", custom_user["id"])
    assert rows == [("new", "accepted"), ("cancel", "failed")]


def test_cancel_without_open_order(client, custom_user, ai, monkeypatch) -> None:
    monkeypatch.setattr(llm, "understand", change_understand)
    events = chat(client, custom_user, "주문전자 주문 취소해줘")
    assert "취소할 주문전자 주문이 없어요" in first(events, "message")["text"]


def run_change(client, user, text, broker_status="accepted"):
    events = to_approval(client, user, text)
    card = first(events, "interrupt")["card"]
    execute_events = events_of(answer(client, user, events, {"decision": "approve"}))
    execute = first(execute_events, "interrupt")
    result = {"result": {"idempotency_key": execute["request"]["idempotency_key"], "status": broker_status,
                         "broker_order_no": "0000888"}}
    message = first(events_of(answer(client, user, execute_events, result)), "message")["text"]
    return card, execute["request"], message


# ---------- 예약·조건부 (3-2), 분할 (3-3) ----------

def reserve_understand(query: str, history: list) -> llm.Understood:
    if "되면" in query:
        return llm.Understood(query=query, intent="order", stock_name=NAME, side="buy", qty=4, trigger_price=90_000)
    if "나눠" in query:
        return llm.Understood(query=query, intent="order", stock_name=NAME, side="buy", qty=10, split_count=3)
    return understand(query, history)


def test_price_reservation_saved_listed_triggered_once_and_cancelled(client, custom_user, ai, migrated, monkeypatch) -> None:
    monkeypatch.setattr(llm, "understand", reserve_understand)
    headers = custom_user["headers"]
    message = first(chat(client, custom_user, "주문전자 4주 9만원 되면 사줘"), "message")["text"]
    assert message.startswith("예약했어요: 주문전자 매수 4주, 현재가가 90,000원 이하로 내려오면 주문해요")
    assert ai["invest"] == []  # 예약할 때는 AI를 부르지 않는다. 조건이 되면 그때 일반 주문 흐름을 돈다
    [item] = client.get("/api/reservations", headers=headers).json()
    assert (item["kind"], item["side"], item["qty"], item["trigger_price"], item["direction"]) == ("price", "buy", 4, 90_000, "below")

    assert client.post(f"/api/reservations/{item['id']}/trigger", headers=headers).json()["qty"] == 4
    assert client.post(f"/api/reservations/{item['id']}/trigger", headers=headers).status_code == 409  # 두 번 주문하지 않는다
    assert client.get("/api/reservations", headers=headers).json() == []
    assert client.get("/api/notifications", headers=headers).json()[0]["kind"] == "reservation"

    first(chat(client, custom_user, "주문전자 4주 9만원 되면 사줘"), "message")
    [again] = client.get("/api/reservations", headers=headers).json()
    assert client.delete(f"/api/reservations/{again['id']}", headers=headers).status_code == 204
    assert client.post(f"/api/reservations/{again['id']}/trigger", headers=headers).status_code == 409
    assert client.delete(f"/api/reservations/{again['id']}", headers=headers).status_code == 404


def test_split_reservation_spreads_qty_over_time(client, custom_user, ai, monkeypatch) -> None:
    monkeypatch.setattr(llm, "understand", reserve_understand)
    message = first(chat(client, custom_user, "주문전자 10주 3번에 나눠 사줘"), "message")["text"]
    assert "10주를 3번(4주, 3주, 3주)에 나눠" in message
    items = client.get("/api/reservations", headers=custom_user["headers"]).json()
    assert [i["qty"] for i in items] == [4, 3, 3] and {i["kind"] for i in items} == {"split"}
    due = [datetime.fromisoformat(i["due_at"]) for i in items]
    assert due[1] - due[0] == due[2] - due[1] == timedelta(minutes=30)


# ---------- 자동매매 주문 구분 (3-4) ----------

def test_auto_order_lets_ai_decline_buy_and_needs_confirm(client, custom_user, ai) -> None:
    ai["action"] = "watch"  # 투자 AI: 지금은 사지 말고 관찰
    body = {"text": "주문전자 4주 사줘", "client": "app", "origin": "auto"}
    events = events_of(client.post("/api/chat", headers=custom_user["headers"], json=body))
    card = first(events_of(answer(client, custom_user, events, balance())), "interrupt")["card"]
    assert "[자동매매 주문]" in ai["invest"][-1] and "자동매매가 낸 주문" in ai["verify"][-1]
    assert any("관찰하자고 했어요" in c for c in card["confirm_required"])  # 앱은 확인이 필요한 처리안을 자동 승인하지 않는다

    ai["action"] = None  # 사람이 직접 지시한 주문은 그대로 (행동은 지시대로)
    card = first(to_approval(client, custom_user), "interrupt")["card"]
    assert "[사용자 지시 주문]" in ai["invest"][-1] and card["confirm_required"] == []


def test_auto_buy_is_blocked_while_falling_intraday(client, custom_user, ai) -> None:
    # 2026-10-14: 5분 저가가 연속 낮아지고 VWAP 아래면 자동매매 매수는 코드가 막는다 (관찰만 허용)
    ai["action"] = "watch"
    bars = [["091000", 101000], ["091200", 100500], ["091500", 100200], ["091700", 99800], ["092000", 99500], ["092200", 99100]]
    reply = balance()
    reply["prices"][0]["intraday"] = {"change_pct": -2.0, "vwap": PRICE + 5000, "bars": bars}
    body = {"text": "주문전자 4주 사줘", "client": "app", "origin": "auto"}
    events = events_of(client.post("/api/chat", headers=custom_user["headers"], json=body))
    answer(client, custom_user, events, reply)
    assert "[허용 행동] watch (매수 제외: 장중 하락 중" in ai["invest"][-1] and "5분 저가가 3번 연속 낮아짐" in ai["invest"][-1]


def test_partial_cancel_and_choosing_among_open_orders(client, custom_user, ai, migrated, monkeypatch) -> None:
    def partial(query, history):
        if "취소" in query:
            return llm.Understood(query=query, intent="order", stock_name=NAME, order_change="cancel", qty=2)
        return understand(query, history)

    monkeypatch.setattr(llm, "understand", partial)
    first_key = place_accepted_order(client, custom_user)
    place_accepted_order(client, custom_user)

    events = chat(client, custom_user, "주문전자 2주만 취소해줘")
    question = first(events, "interrupt")
    assert question["kind"] == "question" and len(question["choices"]) == 2  # 미체결 주문이 2개면 고르게 한다
    [older] = db(migrated, "SELECT o.id::text FROM orders o WHERE o.idempotency_key = %s", first_key)
    events = events_of(answer(client, custom_user, events, {"choice_id": older[0]}))
    events = events_of(answer(client, custom_user, events, balance()))
    card = first(events, "interrupt")["card"]
    assert card["qty"] == 2 and card["order_change"] == "cancel"
    execute_events = events_of(answer(client, custom_user, events, {"decision": "approve"}))
    request = first(execute_events, "interrupt")["request"]
    assert request["all_qty"] is False and request["qty"] == 2
    events_of(answer(client, custom_user, execute_events, {"result": {
        "idempotency_key": request["idempotency_key"], "status": "accepted", "broker_order_no": "0000999"}}))
    rows = db(migrated, "SELECT o.kind, o.status, o.qty FROM orders o JOIN approvals a ON a.id = o.approval_id"
                        " JOIN proposals p ON p.id = a.proposal_id WHERE p.user_id = %s ORDER BY o.created_at", custom_user["id"])
    assert rows == [("new", "accepted", 2), ("new", "accepted", 4), ("cancel", "accepted", 2)]  # 원래 주문은 2주가 남는다


# ---------- 4단계: 실전 모드·안전장치 ----------

def test_real_mode_order_needs_confirmations_and_records_real(client, custom_user, ai, migrated) -> None:
    body = {"text": "주문전자 15주 사줘", "client": "app", "mode": "real"}
    events = events_of(client.post("/api/chat", headers=custom_user["headers"], json=body))
    approval_events = events_of(answer(client, custom_user, events, balance(cash=20_000_000)))
    card = first(approval_events, "interrupt")["card"]
    assert (card["mode"], card["broker"]) == ("real", "kb")
    assert any("실전 주문이에요" in c for c in card["confirm_required"])
    assert any("고액 실전 주문" in c for c in card["confirm_required"])  # 15주 × 10만 = 150만 원 ≥ 100만
    execute_events = events_of(answer(client, custom_user, approval_events, {"decision": "approve", "confirm_risk": True}))
    execute = first(execute_events, "interrupt")
    assert execute["request"]["mode"] == "real"  # 폰은 실전 모드·실전 증권사일 때만 실행한다
    events_of(answer(client, custom_user, execute_events, filled(execute, qty=15)))
    assert db(migrated, "SELECT o.broker, o.mode FROM orders o JOIN approvals a ON a.id = o.approval_id"
                        " JOIN proposals p ON p.id = a.proposal_id WHERE p.user_id = %s", custom_user["id"]) == [("kb", "real")]


def test_real_auto_order_over_small_limit_is_not_auto_approved(client, custom_user, ai) -> None:
    body = {"text": "주문전자 4주 사줘", "client": "app", "mode": "real", "origin": "auto"}
    events = events_of(client.post("/api/chat", headers=custom_user["headers"], json=body))
    card = first(events_of(answer(client, custom_user, events, balance())), "interrupt")["card"]
    assert any("300,000원까지만 자동으로 승인" in c for c in card["confirm_required"])  # 40만 원 > 30만 원


def test_emergency_stop_cancels_reservations_and_pending_approvals(client, custom_user, ai, monkeypatch) -> None:
    monkeypatch.setattr(llm, "understand", reserve_understand)
    headers = custom_user["headers"]
    chat(client, custom_user, "주문전자 4주 9만원 되면 사줘")
    monkeypatch.setattr(llm, "understand", understand)
    to_approval(client, custom_user)  # 승인 대기 처리안 1건
    assert client.post("/api/emergency-stop", headers=headers).json() == {"cancelled_reservations": 1, "rejected_approvals": 1}
    assert client.get("/api/reservations", headers=headers).json() == []
    assert client.get("/api/notifications", headers=headers).json()[0]["kind"] == "emergency_stop"


def test_real_readiness_needs_quiz_and_mock_history(client, custom_user, ai) -> None:
    ready = client.get("/api/real-readiness", headers=custom_user["headers"]).json()
    assert ready["ok"] is False and ready["checks"][0]["ok"] is True  # 퀴즈는 했고, 모의투자 기록이 아직 없다
    assert [c["ok"] for c in ready["checks"][1:]] == [False, False]
