"""분석 그래프(투자 AI ↔ 검증 AI) 테스트. Gemini는 가짜로 바꿔 끼운다 (비용 0)."""

import json
from datetime import date, timedelta
from decimal import Decimal

import psycopg
import pytest

from pydantic import ValidationError

from app.agents import analysis, llm
from app.agents.interrupts import Intraday
from app.agents.schemas import ProposalDraft, VerificationDraft
from tests.conftest import LEVEL_4_QUIZ
from tests.test_chat import BALANCE, events_of, first, now_iso, resume

CODE, NAME = "777777", "테스트전자"
LAST_DAY = date(2026, 10, 2)
PRICE_ID = f"price:{CODE}:{LAST_DAY}"


@pytest.fixture(scope="module", autouse=True)
def market_data(migrated):
    """분석 대상 1종목: 종가 25일, 2025 사업보고서 재무, 공시 2건, 본문 조각 2개."""
    vector = str([0.1] * 768)
    with psycopg.connect(migrated) as conn:
        conn.execute("INSERT INTO stocks VALUES (%s, %s, 'KOSPI', true), ('888888', '대상아님', 'KOSPI', false)"
                     " ON CONFLICT DO NOTHING", (CODE, NAME))
        for days_ago in range(25):
            close = 10_000 + days_ago * 10
            conn.execute("INSERT INTO stock_prices VALUES (%s, %s, %s, %s, 1000) ON CONFLICT DO NOTHING",
                         (CODE, LAST_DAY - timedelta(days=days_ago), close, close * 1000))
        for account, amount, prev in [("매출액", 1200, 1000), ("영업이익", 300, 200), ("당기순이익(손실)", 100, 80),
                                      ("부채총계", 400, 380), ("자본총계", 1000, 900)]:
            conn.execute("INSERT INTO financials VALUES (%s, 2025, '11011', 'CFS', %s, %s, %s, 'T1')"
                         " ON CONFLICT DO NOTHING", (CODE, account, amount * 1_000_000, prev * 1_000_000))
        conn.execute("INSERT INTO disclosures VALUES ('T1', %s, '사업보고서 (2025.12)', 'https://dart/T1', '2026-03-10'),"
                     " ('T2', %s, '주요사항보고서', 'https://dart/T2', '2026-09-01') ON CONFLICT DO NOTHING", (CODE, CODE))
        for seq, text in enumerate(["메모리 수요가 늘어 매출이 증가했다.", "환율 변동은 위험 요인이다."]):
            conn.execute("INSERT INTO disclosure_chunks (rcept_no, seq, section, content, embedding)"
                         " VALUES ('T1', %s, 'II. 사업의 내용', %s, %s::vector) ON CONFLICT DO NOTHING", (seq, text, vector))


GOOD_CLAIMS = [
    {"text": "부채비율이 40%다", "type": "calc", "source_ids": ["fin:T1"], "metric_ids": ["debt_ratio"]},
    {"text": "메모리 수요가 늘었다", "type": "fact", "source_ids": ["dart:T1#0"]},
    {"text": "수요가 이어질 수 있다", "type": "inference", "source_ids": []},
]
BAD_CLAIMS = [{"text": "영업이익이 두 배다", "type": "fact", "source_ids": ["dart:FAKE"]}]


def proposal(action="buy", claims=GOOD_CLAIMS) -> ProposalDraft:
    return ProposalDraft(action=action, claims=claims, counter_arguments=["경기 둔화"], risks=["손실 가능"],
                         invalid_if=["영업이익 감소"])


def verdict(value="approve") -> VerificationDraft:
    return VerificationDraft(verdict=value, checks=[], risk_fit="ok", summary="출처와 수치가 맞아요",
                             disagreements=["수요 전망은 불확실"] if value != "approve" else [])


@pytest.fixture
def ai(monkeypatch):
    """invest/verify가 받은 글을 기록하고, 테스트가 정한 답을 차례로 돌려준다."""
    record = {"invest": [], "verify": [], "proposals": [proposal()], "verdicts": [verdict()]}

    def write(context):
        record["invest"].append(context)
        return record["proposals"][min(len(record["invest"]), len(record["proposals"])) - 1]

    def verify(context):
        record["verify"].append(context)
        return record["verdicts"][min(len(record["verify"]), len(record["verdicts"])) - 1]

    monkeypatch.setattr(llm, "understand", lambda q, h: llm.Understood(query=q, intent="analysis",
                                                                        stock_name=q.split(" 사도")[0]))
    monkeypatch.setattr(llm, "embed_query", lambda text: [0.1] * 768)
    monkeypatch.setattr(llm, "write_proposal", write)
    monkeypatch.setattr(llm, "verify_proposal", verify)
    return record


def analyze(client, user, client_kind="app", holdings=None, name=NAME, market=None):
    events = events_of(client.post("/api/chat", headers=user["headers"],
                                   json={"text": f"{name} 사도 돼?", "client": client_kind}))
    if first(events, "interrupt") is None:
        return events, None
    fetch = first(events, "interrupt")
    payload = {"balance": {**BALANCE, "holdings": holdings or [], "fetched_at": now_iso()},
               "prices": [{"stock_code": CODE, "price": 10_100, "as_of": now_iso()}], **({"market": market} if market else {})}
    return events, events_of(resume(client, user, events, payload)), fetch


def text_of(events) -> str:
    """답 문장. 매수·매도 제안이면 마지막에 "이대로 주문할까요?" 질문 안에 분석 내용이 들어 있다."""
    message = first(events, "message")
    return message["text"] if message else first(events, "interrupt")["text"]


def take_quiz(client, user, **changes):
    assert client.put("/api/profile", headers=user["headers"], json={**LEVEL_4_QUIZ, **changes}).status_code == 200


def saved(migrated, user):
    with psycopg.connect(migrated) as conn:
        rows = conn.execute("SELECT p.action, v.round, v.verdict FROM proposals p JOIN verifications v ON v.proposal_id = p.id"
                            " WHERE p.user_id = %s ORDER BY v.round", (user["id"],)).fetchall()
    return rows


# ---------- 전체 흐름 ----------

def test_analysis_flow_with_sources_and_independent_verification(client, user, ai, migrated) -> None:
    take_quiz(client, user)  # 4단계 적극투자형

    _, answer, fetch = analyze(client, user)

    assert fetch["needs"] == [{"type": "balance"}, {"type": "price", "stock_code": CODE}, {"type": "market"}]
    text = text_of(answer)
    assert "검증: 승인" in text and "제안: 매수 검토" in text
    assert "OpenDART 주요 재무 (2025년 사업보고서, 연결)" in text
    assert "부채비율: 40.00%" in text and "PER:" in text
    assert text.endswith("이대로 주문할까요?") and "투자 판단과 책임은 본인에게" in text
    sources_part = text.split("출처 (근거와 지표에 쓴 것)")[1]
    assert sources_part.count("사업보고서 (2025.12) · II. 사업의 내용") == 1  # 인용한 조각
    assert "주요사항보고서" not in sources_part  # 인용하지 않은 공시는 빼고 보여준다
    assert saved(migrated, user) == [("buy", 0, "approve")]

    invest, verify = ai["invest"][0], ai["verify"][0]
    assert "[허용 행동] watch, buy" in invest
    assert PRICE_ID in invest and "dart:T1#0" in invest and "quote:777777" in invest
    # 검증 AI는 투자 AI의 입력(허용 행동, 자료 목록)을 받지 않고, 인용된 출처의 원문만 다시 읽는다
    assert "[허용 행동]" not in verify and "[자료]" not in verify
    assert "자본총계: 이번 기간 1,000,000,000원" in verify
    assert "dart:T1#1" not in verify  # 인용하지 않은 조각은 주지 않는다
    assert "[다시 계산한 지표]" in verify and "[코드 검사]" in verify


def test_progress_shows_both_agents(client, user, ai) -> None:
    _, answer, _ = analyze(client, user)
    steps = [data["step"] for event, data in answer if event == "progress"]
    assert steps.index("invest_agent") < steps.index("verify_agent") < steps.index("record")


# ---------- 성향 규칙 ----------

def test_general_mode_gives_information_only(client, user, ai, migrated) -> None:
    _, answer, _ = analyze(client, user)  # 퀴즈 안 함

    assert "[허용 행동] watch" in ai["invest"][0]
    text = text_of(answer)
    assert "일반 모드라 사라·말라 판단은 하지 않고" in text
    assert "이대로 주문할까요?" not in text
    assert saved(migrated, user)[0][0] == "watch"  # AI가 buy를 냈어도 코드가 관찰로 바꿨다


def test_level_2_cannot_get_buy_proposal(client, user, ai, migrated) -> None:
    take_quiz(client, user, drop_reaction="sell_some", portfolio_choice="B")  # 4점 → 2단계

    _, answer, _ = analyze(client, user)

    assert "buy" not in ai["invest"][0].split("[허용 행동]")[1].split("\n")[0]
    assert saved(migrated, user)[0][0] == "watch"
    assert "성향 규칙에 따라 '매수 검토' 대신 '관찰'로 바꿨어요 (2등급 종목은 위험중립형 이상만 매수 제안)" in text_of(answer)
    assert "(매수 제외: 2등급 종목은 위험중립형 이상만 매수 제안)" in ai["invest"][0]


def test_borrowed_money_flag_reaches_invest_ai(client, user, ai, migrated) -> None:
    take_quiz(client, user, money_use="borrowed")
    analyze(client, user)
    assert "매수를 제안하지 않는다" in ai["invest"][0]
    assert saved(migrated, user)[0][0] == "watch"


def test_holding_allows_sell(client, user, ai, migrated) -> None:
    take_quiz(client, user)
    ai["proposals"] = [proposal(action="sell")]
    analyze(client, user, holdings=[{"stock_code": CODE, "stock_name": NAME, "qty": 3, "avg_price": 9000}])
    assert "sell" in ai["invest"][0].split("[허용 행동]")[1].split("\n")[0]
    assert saved(migrated, user)[0][0] == "sell"


# ---------- 검증과 반박-수정 ----------

def test_fake_source_is_rejected_even_if_ai_approves_then_user_judgement(client, user, ai, migrated) -> None:
    take_quiz(client, user)
    ai["proposals"] = [proposal(claims=BAD_CLAIMS)]  # 계속 없는 출처를 낸다
    ai["verdicts"] = [verdict("approve")]           # 검증 AI는 속아서 승인한다

    _, answer, _ = analyze(client, user)

    assert len(ai["invest"]) == 3  # 처음 + 수정 2번
    assert "없는 출처 ID: dart:FAKE" in ai["invest"][1]  # 코드 검사의 반박이 투자 AI에게 간다
    assert [row[1:] for row in saved(migrated, user)] == [(0, "reject"), (1, "reject"), (2, "user_judgement")]
    assert "검증: 사용자 판단 필요" in text_of(answer)


def test_revision_fixes_and_passes(client, user, ai, migrated) -> None:
    take_quiz(client, user)
    ai["proposals"] = [proposal(claims=BAD_CLAIMS), proposal()]
    ai["verdicts"] = [verdict("approve")]

    analyze(client, user)

    assert [row[1:] for row in saved(migrated, user)] == [(0, "reject"), (1, "approve")]


def test_conditional_verdict_shows_conditions_and_disagreements(client, user, ai) -> None:
    take_quiz(client, user)
    ai["verdicts"] = [VerificationDraft(verdict="conditional", checks=[], risk_fit="warn", summary="조건부",
                                        conditions=["비중 10% 이하로"], disagreements=["수요 전망은 불확실"])]
    text = text_of(analyze(client, user)[1])
    assert "검증: 조건부 승인" in text and "조건: 비중 10% 이하로" in text and "의견 차이: 수요 전망은 불확실" in text


# ---------- 그 밖의 경우 ----------

def test_not_target_stock(client, user, ai) -> None:
    events, _ = analyze(client, user, name="대상아님")
    assert "아직 분석·주문 대상이 아니에요" in text_of(events)
    assert ai["invest"] == []


def test_daily_limit(client, user, ai, migrated) -> None:
    with psycopg.connect(migrated) as conn:
        thread = conn.execute("INSERT INTO threads (user_id) VALUES (%s) RETURNING id", (user["id"],)).fetchone()[0]
        for _ in range(analysis.MAX_ANALYSES_PER_DAY):
            conn.execute("INSERT INTO proposals (user_id, thread_id, stock_code, action) VALUES (%s, %s, %s, 'watch')",
                         (user["id"], thread, CODE))
    events, _ = analyze(client, user)
    assert analysis.LIMIT_MESSAGE in text_of(events)
    assert ai["invest"] == []


def test_holding_reserve_keeps_room_for_sell_checks(client, user, ai, migrated) -> None:
    # 2026-10-16: 한도가 14:32에 다 차서 오후 보유 종목 매도 판단이 17번 거절됐다
    with psycopg.connect(migrated) as conn:
        thread = conn.execute("INSERT INTO threads (user_id) VALUES (%s) RETURNING id", (user["id"],)).fetchone()[0]
        for _ in range(analysis.MAX_ANALYSES_PER_DAY - analysis.HOLDING_RESERVE):
            conn.execute("INSERT INTO proposals (user_id, thread_id, stock_code, action) VALUES (%s, %s, %s, 'watch')",
                         (user["id"], thread, CODE))
    events, _ = analyze(client, user)
    assert analysis.BUY_LIMIT_MESSAGE in text_of(events) and ai["invest"] == []  # 안 가진 종목은 막는다
    with psycopg.connect(migrated) as conn:
        conn.execute("INSERT INTO account_snapshots (user_id, cash_krw, holdings, fetched_at) VALUES (%s, 0, %s, now())",
                     (user["id"], json.dumps([{"stock_code": CODE, "stock_name": NAME, "qty": 1, "avg_price": 1000}])))
    events, after, _ = analyze(client, user)  # 보유 종목은 남겨 둔 몫으로 판단한다 (폰에 잔고를 묻는 데까지 간다)
    assert analysis.BUY_LIMIT_MESSAGE not in text_of(after) and ai["invest"]


def test_web_analysis_uses_server_data_without_phone(client, user, ai) -> None:
    events, _ = analyze(client, user, client_kind="web")
    assert first(events, "interrupt") is None
    assert "검증: 승인" in text_of(events)
    assert "quote:" not in ai["invest"][0] and PRICE_ID in ai["invest"][0]  # 실시간 현재가 없이 전일 종가


def test_phone_error_stops_without_saving(client, user, ai, migrated) -> None:
    events = events_of(client.post("/api/chat", headers=user["headers"], json={"text": f"{NAME} 사도 돼?", "client": "app"}))
    answer = events_of(resume(client, user, events, {"error": "KB 연결 실패"}))
    assert "조회에 실패했어요" in text_of(answer)
    assert saved(migrated, user) == [] and ai["invest"] == []


# ---------- 코드 검사 ----------

def test_code_checks_catch_missing_sources_metrics_and_risks() -> None:
    draft = proposal(claims=[
        {"text": "a", "type": "fact"},                                           # 사실인데 출처 없음
        {"text": "b", "type": "calc", "source_ids": ["fin:T1"]},                  # 계산인데 지표 없음
        {"text": "c", "type": "calc", "source_ids": ["fin:T1"], "metric_ids": ["per"]},  # 계산 불가 지표
    ]).model_dump()
    draft["risks"] = []
    metrics_now = [{"metric_id": "per", "value": None}, {"metric_id": "debt_ratio", "value": "40.00"}]
    checks = {c["target"]: c for c in analysis.code_checks(draft, {"fin:T1": {}}, metrics_now, metrics_now)}

    assert checks["claim:0"]["result"] == checks["claim:1"]["result"] == checks["claim:2"]["result"] == "fail"
    assert checks["risks"]["result"] == "fail" and checks["counter_arguments"]["result"] == "pass"
    assert checks["metrics"]["result"] == "pass"


def test_code_checks_catch_changed_metric_values() -> None:
    draft = proposal().model_dump()
    gathered = [{"metric_id": "debt_ratio", "value": "40.00"}]
    recomputed = [{"metric_id": "debt_ratio", "value": "41.00"}]
    checks = {c["target"]: c for c in analysis.code_checks(draft, {"fin:T1": {}, "dart:T1#0": {}}, gathered, recomputed)}
    assert checks["metrics"]["result"] == "fail"


def test_amounts_read_korean_units_only() -> None:
    assert analysis.amounts("시가총액 10조 2,092억 1,490만 500원, 29.06% 증가, 3단계, 2026년") == [10_209_214_900_500]
    assert analysis.amounts("1,500억 원과 103,300원") == [150_000_000_000, 103_300]


def test_code_checks_catch_other_stock_unit_errors_and_denied_risks() -> None:
    """평가(2026-10-10)에서 검증 AI가 놓친 것: 다른 종목 출처, 억→조, '위험·비용 없다'."""
    known = {"fin:A": {"stock_code": "000001", "content": "매출액: 이번 기간 34,928,000,000,000원"},
             "dart:B": {"stock_code": "999999", "content": "공시 제목: 남의 회사 공시"}}

    def run(claim_text, sources=("fin:A",), risks=("주가 하락으로 손실이 날 수 있다",), counter=("경쟁 심화",)):
        draft = proposal(claims=[{"text": claim_text, "type": "fact", "source_ids": list(sources)}]).model_dump()
        draft |= {"risks": list(risks), "counter_arguments": list(counter)}
        return {c["target"]: c for c in analysis.code_checks(draft, known, [], [], stock_code="000001")}

    ok = run("매출액은 약 34조 9,280억 원이다")
    assert all(c["result"] == "pass" for c in ok.values())  # 반올림한 금액은 통과
    assert run("매출액은 34조 9,280조 원이다")["claim:0:amount"]["result"] == "fail"   # 같은 단위 두 번
    assert run("매출액은 34조 9,280억 원이다".replace("조 9,280억", "만"))["claim:0:amount"]["result"] == "fail"  # 34만 원: 1억 배 차이
    assert run("매출액은 100조 원이다")["claim:0:amount"]["result"] == "warn"           # 3배: 주의만
    assert run("남의 회사가 공시했다", sources=("dart:B",))["source_stock"]["result"] == "fail"
    assert run("매출이 늘었다", risks=("특별한 위험은 없다",))["denies_risk"]["result"] == "fail"
    assert run("매출이 늘었다", risks=("거래 비용(수수료·세금)은 없다",))["denies_risk"]["result"] == "fail"
    assert run("매출이 늘었다", counter=("특별한 반대 근거는 없다",))["denies_risk"]["result"] == "fail"
    assert "denies_risk" not in run("매출이 늘었다", risks=("손실 가능성을 배제할 수 없다",))


# ---------- 재무 기준: 최근 정기보고서 ----------

def test_financial_basis_uses_latest_report_and_trailing_four_quarters(migrated) -> None:
    from psycopg.rows import dict_row
    with psycopg.connect(migrated, row_factory=dict_row) as conn:
        conn.execute("INSERT INTO stocks VALUES ('666666', '분기회사', 'KOSPI', true) ON CONFLICT DO NOTHING")
        rows = [
            # (연도, 보고서, 계정, 이번 기간, 비교 기간, 누적, 전년 누적, 접수번호)
            (2025, "11011", "당기순이익(손실)", 100, 80, None, None, "A25"),
            (2025, "11011", "자본총계", 1000, 900, None, None, "A25"),
            (2026, "11012", "당기순이익(손실)", 40, 30, 70, 50, "H26"),  # 반기: 3개월 40, 누적 70
            (2026, "11012", "매출액", 400, 300, 800, 500, "H26"),
            (2026, "11012", "자본총계", 1200, 1000, None, None, "H26"),
            (2026, "11012", "부채총계", 600, 500, None, None, "H26"),
        ]
        for row in rows:
            conn.execute("INSERT INTO financials (stock_code, bsns_year, reprt_code, fs_div, account, amount, prev_amount,"
                         " add_amount, prev_add_amount, rcept_no) VALUES ('666666', %s, %s, 'CFS', %s, %s, %s, %s, %s, %s)",
                         row)
        conn.execute("INSERT INTO stock_prices VALUES ('666666', '2026-10-01', 100, 2400, 24)")

        basis = analysis.financial_basis(conn, "666666")
        found = {m["metric_id"]: m for m in analysis.compute_metrics(conn, "666666")}
        conn.rollback()

    assert basis["period"] == "2026년 반기보고서 누적"
    assert basis["net_ttm"] == 100 + 70 - 50  # 작년 연간 + 올해 누적 − 작년 같은 기간 누적
    assert basis["fin_ids"] == ["fin:H26", "fin:A25"]
    assert found["per"]["value"] == 20      # 2400 ÷ 120
    assert found["pbr"]["value"] == 2       # 2400 ÷ 1200 (반기 말 자본)
    assert found["debt_ratio"]["value"] == 50
    assert found["revenue_yoy"]["value"] == 60  # 누적 800 vs 500
    assert "2026년 반기보고서 누적" in found["revenue_yoy"]["formula"]


def test_volatility_rank_among_targets(migrated) -> None:
    from psycopg.rows import dict_row
    with psycopg.connect(migrated, row_factory=dict_row) as conn:
        conn.execute("UPDATE stocks SET is_target = false")
        for code, swing in (("R00001", 0), ("R00002", 1), ("R00003", 5)):  # 변동성: 0 < 작음 < 큼
            conn.execute("INSERT INTO stocks VALUES (%s, %s, 'KOSPI', true)", (code, code))
            for day in range(61):
                close = 1000 + (swing if day % 2 else 0)
                conn.execute("INSERT INTO stock_prices VALUES (%s, %s, %s, %s, 1)",
                             (code, date(2026, 1, 1) + timedelta(days=day), close, close))
        ranks = {code: analysis.volatility_rank(conn, code) for code in ("R00001", "R00002", "R00003")}
        missing = analysis.volatility_rank(conn, CODE)  # 종가가 61일치보다 적음
        conn.rollback()
    assert ranks == {"R00001": 1 / 3, "R00002": 2 / 3, "R00003": 1.0}
    assert missing is None


def test_search_chunks_filters_far_noise_and_other_stocks(migrated, monkeypatch) -> None:
    import math
    from psycopg.rows import dict_row
    from app.db import connect

    def vec(angle):  # 첫 두 칸만 쓰는 768차원 벡터. 각도 차이가 곧 코사인 거리
        return str([math.cos(angle), math.sin(angle)] + [0.0] * 766)

    monkeypatch.setattr(llm, "embed_query", lambda text: [1.0] + [0.0] * 767)
    with connect(migrated, row_factory=dict_row) as conn:
        for code in ("777001", "777002"):
            conn.execute("INSERT INTO stocks VALUES (%s, %s, 'KOSDAQ', true) ON CONFLICT DO NOTHING", (code, f"검색{code}"))
            conn.execute("INSERT INTO disclosures VALUES (%s, %s, '반기보고서', 'u', '2026-08-14') ON CONFLICT DO NOTHING",
                         (f"S{code}", code))
        chunks = [("777001", 0, "매출이 늘고 영업이익이 개선되었습니다", 0.1),     # 가깝다
                  ("777001", 1, "주요 위험 요인은 환율과 원자재 가격입니다", 0.3),  # 1등보다 조금 멀다 (거리 0.04)
                  ("777001", 2, "1,234 | 5,678 (9.1) 2,345 - 3,456", 0.05),      # 깨진 표 조각
                  ("777001", 3, "회사의 연혁과 본점 소재지입니다", 1.4),           # 너무 멀다
                  ("777002", 0, "다른 회사의 아주 가까운 문단입니다", 0.0)]        # 다른 종목
        for code, seq, text, angle in chunks:
            conn.execute("INSERT INTO disclosure_chunks (rcept_no, seq, section, content, embedding) VALUES (%s, %s, '본문', %s, %s::vector)",
                         (f"S{code}", seq, text, vec(angle)))
        assert analysis.search_chunks(conn, "777001", "검색777001", "사도 돼?") == ["dart:S777001#0", "dart:S777001#1"]
        assert analysis.search_chunks(conn, "777003", "없음", "사도 돼?") == []
        conn.rollback()
    assert analysis.is_table_noise("1,234 | 5,678 (9.1)") and not analysis.is_table_noise("매출 1,234억 원으로 늘었다")


def test_counter_argument_source_tags() -> None:
    known = {"dart:R1#3": {"title": "반기보고서 · 사업의 내용"}}
    proposal = {"claims": [{"text": "공시", "type": "opinion", "source_ids": [], "metric_ids": []}],
                "counter_arguments": ["환율 위험이 있다 (출처: dart:R1#3)", "경쟁 심화 (출처: dart:없음#1)"],
                "risks": ["손실 가능"]}
    assert analysis.cited_ids(proposal) == ["dart:R1#3", "dart:없음#1"]
    checks = {c["target"]: c for c in analysis.code_checks(proposal, known, [], [], offered_chunks=True)}
    assert checks["risk_sources"]["result"] == "fail" and "dart:없음#1" in checks["risk_sources"]["detail"]
    assert "body_citations" not in checks  # 본문 조각을 하나 인용했다
    assert analysis.with_titles("환율 위험이 있다 (출처: dart:R1#3)", known) == "환율 위험이 있다 [반기보고서 · 사업의 내용]"

    plain = {**proposal, "counter_arguments": ["경쟁 심화"]}
    checks = {c["target"]: c for c in analysis.code_checks(plain, known, [], [], offered_chunks=True)}
    assert checks["body_citations"]["result"] == "warn"  # 본문을 받고도 인용하지 않으면 주의 (막지는 않음)
    assert all(c["result"] != "fail" for c in checks.values())


# 2026-10-12 실제 KIS 지수 (코스피 3거래일 연속 하락)
KOSPI_1012 = {"index": "KOSPI", "value": 6384.24, "change_pct": -3.65, "open": 6578.17, "high": 6589.69, "low": 6368.49,
              "up": 166, "down": 720, "flat": 32, "as_of": "2026-10-12T15:40:00+09:00",
              "daily": [["20261012", 6384.24], ["20261008", 6625.93], ["20261007", 6803.90], ["20261006", 6941.39],
                        ["20261002", 7003.74], ["20261001", 6971.35]]}


def test_market_source_summarizes_index_and_trend() -> None:
    source = analysis.load_source(None, "market:KOSPI", {"market": [KOSPI_1012]})
    assert source["title"] == "코스피 지수 (앱 실시간 조회)" and source["stock_code"] is None
    assert source["content"] == ("코스피 6,384.24 (전일 대비 -3.65%), 오늘 시가 6,578.17 고가 6,589.69 저가 6,368.49, "
                                 "오른 종목 166 · 내린 종목 720 · 보합 32. 최근 흐름(지난 종가 10/08까지): 1거래일 -3.65%, 5거래일 -8.42%, "
                                 "20거래일 미확인, 4거래일 연속 하락")
    assert analysis.load_source(None, "market:KOSDAQ", {"market": [KOSPI_1012]}) is None
    assert analysis.load_source(None, "market:KOSPI", {"market": None}) is None


def test_analysis_gives_market_index_to_both_ais(client, user, ai) -> None:
    events, resumed, fetch = analyze(client, user, market=[KOSPI_1012])
    assert {"type": "market"} in fetch["needs"]
    assert "market:KOSPI" in ai["invest"][0] and "4거래일 연속 하락" in ai["invest"][0]
    _, _, fetch = analyze(client, user)  # 예전 앱처럼 시장 지수를 안 보내도 분석한다
    assert "market:" not in ai["invest"][-1]


def test_intraday_source_summarizes_minute_bars() -> None:
    price = {"stock_code": "000270", "price": 111000, "as_of": "2026-10-08T09:40:00+09:00",
             "intraday": {"change_pct": -1.25, "bars": [["091100", 112000], ["092500", 113000], ["094000", 111000]]}}
    source = analysis.load_source(None, "intraday:000270", {"prices": [price]})
    assert source["title"] == "오늘 장중 흐름 (앱 실시간 조회, 1분봉)" and source["as_of"] == price["as_of"]
    assert source["content"] == ("전일 대비 -1.25%. 09:11~09:40 1분봉 3개: 112,000원 → 111,000원 (-0.89%), "
                                 "이 사이 고가 113,000원, 저가 111,000원")
    assert analysis.load_source(None, "intraday:000270", {"prices": [{**price, "intraday": None}]}) is None


def test_giveback_text_from_day_high() -> None:
    # 2026-10-16 HLB: 매입 41,150 → 오늘 고가 42,500 (+3.28%) → 41,700 (+1.34%). 30분 1분봉만으로는 고가가 안 보였다
    assert analysis.giveback_text(42500, 41700, 41150) == (
        ". 오늘 고가 42,500원, 현재가는 고가보다 -1.88%. 매입가 대비 오늘 고가 때 +3.28%, 지금 +1.34% (고가 때 이익에서 1.94%p 돌려줌)")
    assert "돌려줌" not in analysis.giveback_text(42500, 42200, 41150)  # 0.73%p는 적지 않는다
    assert analysis.giveback_text(42500, 41700, None) == ". 오늘 고가 42,500원, 현재가는 고가보다 -1.88%"  # 안 가진 종목
    assert analysis.giveback_text(None, 41700, 41150) == ""  # 폰이 고가를 안 보냈으면
    price = {"stock_code": "028300", "price": 41700, "as_of": "2026-10-16T15:00:00+09:00",
             "intraday": {"change_pct": 1.0, "high": 42500, "bars": [["143000", 42000], ["150000", 41700]]}}
    state = {"stock_code": "028300", "prices": [price],
             "snapshot": {"holdings": [{"stock_code": "028300", "qty": 41, "avg_price": 41150}]}}
    assert "1.94%p 돌려줌" in analysis.load_source(None, "intraday:028300", state)["content"]


def test_day_flow_text_and_phone_fields_accepted() -> None:
    # 2026-10-16: 1분봉 30분만으로는 "오전에 오르고 오후 내내 밀림"이 안 보였다
    flow = [["0905", 41300], ["1000", 41900], ["1055", 42100], ["1405", 42400], ["1430", 42000], ["1505", 41700]]
    text = analysis.day_flow_text(flow, 41000, 41700)
    assert text == (". 오늘 시가 41,000원, 현재가는 시가보다 +1.71%. 오늘 흐름 (앱이 약 5분마다 본 현재가, 시간마다 마지막 값): "
                    "09:05 41,300원 → 10:55 42,100원 → 14:30 42,000원 → 15:05 41,700원. "
                    "이 중 최고 42,400원(14:05), 현재가는 그보다 -1.65%")
    assert analysis.day_flow_text([["0905", 41300]], None, 41700) == ""  # 한 번만 봤으면 흐름이 아니다
    # 폰이 보내는 새 칸(시가·고가·하루 흐름)을 서버가 받는다 (모르는 칸은 거부하는 모델)
    Intraday(bars=[["150000", 41700]], open=41000, high=42500, day_flow=flow)
    with pytest.raises(ValidationError):
        Intraday(bars=[], day_flow=[["15:05", 41700]])


# 2026-10-12 기록에서 검증이 놓친 것들 (뉴스를 사실로, 묵은 종가, 보유 판단에 오늘 자료 안 씀)
def proposal_with(action: str, claims: list[dict]) -> dict:
    return {"action": action, "claims": claims, "counter_arguments": ["반대"], "risks": ["위험"]}


def test_news_only_fact_claim_fails() -> None:
    sources = {"news:1": {"stock_code": None}, "dart:1": {"stock_code": None}}
    news_fact = {"type": "fact", "text": "3분기 영업이익 5,100억 원", "source_ids": ["news:1"], "metric_ids": []}
    assert analysis.claim_check("claim:0", news_fact, sources, set())["result"] == "fail"
    assert analysis.claim_check("claim:0", {**news_fact, "source_ids": ["news:1", "dart:1"]}, sources, set())["result"] == "pass"
    assert analysis.claim_check("claim:0", {**news_fact, "type": "inference"}, sources, set())["result"] == "pass"


def test_freshness_and_today_data_checks() -> None:
    hold = proposal_with("hold", [{"type": "fact", "text": "실적 호조", "source_ids": ["fin:1"], "metric_ids": []}])
    stale = {"price:000720:2026-10-07": {}, "fin:1": {}}
    checks = analysis.freshness_checks(hold, stale, holds=False, today=date(2026, 10, 12))
    assert [c["target"] for c in checks] == ["freshness"]  # 10/12 아침에 10/7 종가만
    assert analysis.freshness_checks(hold, {"price:000720:2026-10-08": {}}, False, date(2026, 10, 12)) == []
    live = {**stale, "quote:000720": {}, "market:KOSPI": {}}
    assert analysis.freshness_checks(hold, live, holds=False, today=date(2026, 10, 12)) == []  # 오늘 시세가 있으면 괜찮다
    checks = analysis.freshness_checks(hold, live, holds=True, today=date(2026, 10, 12))
    assert [(c["target"], c["result"]) for c in checks] == [("today_data", "fail")]  # 보유 판단인데 오늘 자료를 안 씀
    cited = proposal_with("hold", [{"type": "fact", "text": "코스피 -3.65%", "source_ids": ["market:KOSPI"], "metric_ids": []}])
    assert analysis.freshness_checks(cited, live, holds=True, today=date(2026, 10, 12)) == []


def test_news_only_fact_becomes_reported_inference() -> None:
    claims = [{"type": "fact", "text": "3분기 영업이익 5,100억 원", "source_ids": ["news:1"], "metric_ids": []},
              {"type": "fact", "text": "부채비율 31%", "source_ids": ["fin:1"], "metric_ids": []}]
    out = analysis.news_as_inference(claims)
    assert out[0] == {"type": "inference", "text": "보도에 따르면 3분기 영업이익 5,100억 원", "source_ids": ["news:1"], "metric_ids": []}
    assert out[1] == claims[1]
    assert analysis.claim_check("claim:0", out[0], {"news:1": {}}, set())["result"] == "pass"  # 이제 반려되지 않는다


# 2026-10-14 점검 (웹 조사 기준): 추세·VWAP·떨어지는 칼날·세후 손익을 코드가 계산해 AI에게 준다
FALLING_BARS = [["091000", 101000], ["091200", 100500], ["091500", 100200], ["091700", 99800], ["092000", 99500], ["092200", 99100]]


def test_intraday_vwap_and_falling_knife() -> None:
    price = {"stock_code": "000270", "price": 99100, "as_of": "2026-10-14T09:23:00+09:00",
             "intraday": {"change_pct": -2.0, "vwap": 100000, "bars": FALLING_BARS}}
    content = analysis.load_source(None, "intraday:000270", {"prices": [price]})["content"]
    assert "VWAP) 100,000원, 현재가는 그보다 -0.90% (아래)" in content and "5분 저가가 3번 연속 낮아짐" in content
    assert analysis.falling_now(price)
    assert not analysis.falling_now({**price, "price": 100500})  # VWAP 위면 하락 중으로 막지 않는다
    rebound = {**price, "intraday": {**price["intraday"], "bars": FALLING_BARS[:4] + [["092000", 99900], ["092200", 100100]]}}
    assert not analysis.falling_now(rebound)  # 마지막 5분 저가가 더 낮지 않으면 반등
    assert not analysis.lows_falling([("091000", 100), ("091500", 99)])  # 5분 묶음이 3개 안 되면 판단 안 함


def test_trend_text_moving_averages_and_relative_strength() -> None:
    closes = [100] * 40 + list(range(101, 122))  # 61일: 마지막 21일 동안 오름
    text = analysis.trend_text(closes, 120, index_return=5.0)
    assert "20일 평균 112원보다 +7.62% (위)" in text and "60일 평균 104원보다 +15.55% (위)" in text
    assert "20일 평균은 5거래일 전보다 오르는 중" in text
    assert "약 20거래일 등락률 +18.81% (같은 기간 시장 +5.00%, 시장보다 +13.81%p)" in text
    assert "20일 최고가 121원보다 -0.83%" in text
    short = analysis.trend_text([100] * 20, 90, None)
    assert "20일 평균 100원보다 -10.00% (아래)" in short and "60일 평균 미확인" in short and "등락률" not in short


def test_market_source_twenty_day_average() -> None:
    daily = [["20261014", 6000.0]] + [[f"2026090{i % 10}", 6500.0] for i in range(24)]
    content = analysis.market_source({**KOSPI_1012, "value": 6000.0, "daily": daily})["content"]
    assert content.endswith("20거래일 평균 6,500.00보다 -7.69% (아래)")


def test_net_sell_text_subtracts_tax_and_fees() -> None:
    # 100주, 매입 10,000 → 10,300: 차익 30,000 - 세금 2,060 - 수수료 150·154
    assert analysis.net_sell_text(100, 10_000, 10_300, "KOSPI", Decimal("0.015")) == "지금 다 팔면 손익 27,636원 (+2.76%, 매도 세금·수수료 뺀 추정)"
    assert analysis.net_sell_text(100, 10_000, 10_000, "KOSDAQ", None) == "지금 다 팔면 손익 -2,000원 (-0.20%, 매도 세금만 뺀 추정, 수수료 미확인)"


def test_calc_from_code_computed_sources_needs_no_metric_id() -> None:
    # 2026-10-14: 추세 자료로 쓴 계산 근거, 반대 근거에 단 지표 ID가 반려되어 판단이 결론 없이 끝났다
    sources = {"trend:000270": {"stock_code": "000270"}, "news:1": {"stock_code": "000270"}}
    trend = {"text": "20일 평균보다 3% 위", "type": "calc", "source_ids": ["trend:000270"], "metric_ids": []}
    assert analysis.claim_check("claim:0", trend, sources, set())["result"] == "pass"
    news = {**trend, "source_ids": ["news:1"]}
    assert analysis.claim_check("claim:0", news, sources, set())["result"] == "fail"
    proposal = {"action": "watch", "claims": [trend], "counter_arguments": ["변동성이 크다 (출처: volatility_60d)"],
                "risks": ["모르는 값 (출처: nope)"]}
    metric = [{"metric_id": "volatility_60d", "value": 30}]
    checks = analysis.code_checks(proposal, sources, metric, metric)
    assert [c["detail"] for c in checks if c["target"] == "risk_sources"] == ["반대 근거·위험의 없는 출처 ID: nope"]


# 2026-10-14 장 마감 뒤: 검사 코드 버그와 모의 지수 날짜
def test_amount_check_reads_table_numbers_without_won() -> None:
    known = {"dart:1#1": {"content": "취득예정주식 560,853 | 취득예정금액 100,000,089,900 | 주가 178,300원)"}}
    claim = {"text": "약 1,000억원(100,000,089,900원) 규모의 자기주식 취득", "type": "fact", "source_ids": ["dart:1#1"]}
    assert analysis.amount_check("claim:0", claim, known) is None
    wrong = {**claim, "text": "약 1,000조원 규모의 자기주식 취득"}
    assert analysis.amount_check("claim:0", wrong, known)["result"] == "fail"  # 단위 오류는 계속 잡는다


def test_market_source_uses_dates_when_daily_index_lags() -> None:
    # KIS 모의는 10/14에 일별 지수를 10/12까지만 준다. 첫 값을 어제 종가로 보면 안 된다
    lagging = {**KOSPI_1012, "value": 6008.81, "change_pct": -0.44, "as_of": "2026-10-14T15:40:00+09:00"}
    content = analysis.market_source(lagging)["content"]
    assert "최근 흐름(지난 종가 10/12까지): 1거래일 -5.88%" in content
    same_day = analysis.market_source(KOSPI_1012)["content"]  # 오늘 값이 일별 첫 줄에 있으면 뺀다
    assert "최근 흐름(지난 종가 10/08까지): 1거래일 -3.65%, 5거래일 -8.42%" in same_day


def test_news_inference_prefix_not_doubled() -> None:
    claim = {"type": "fact", "text": "전자신문 보도에 따르면 실적 개선", "source_ids": ["news:1"], "metric_ids": []}
    assert analysis.news_as_inference([claim])[0]["text"] == "전자신문 보도에 따르면 실적 개선"


def test_rebounding_needs_higher_recent_low_and_vwap() -> None:
    """2026-10-15: 급락일에 저점을 더 낮추지 않고 VWAP 위로 올라오면 '반등 중'"""
    bars = [("100000", 100), ("100500", 90), ("101000", 95), ("101500", 97)]
    assert analysis.rebounding(bars, 97, 95)
    assert not analysis.rebounding(bars, 97, 99)  # VWAP 아래
    assert not analysis.rebounding(bars[:3] + [("101500", 89)], 89, 80)  # 저점을 더 낮춤


def test_fix_source_ids_corrects_common_typos() -> None:
    """2026-10-15 반려 3번: snapshot:, market:KDAQ, market:KOSDAQD"""
    draft = {"claims": [{"text": "a", "type": "fact", "source_ids": ["snapshot:holdings", "market:KDAQ", "dart:1"]}],
             "counter_arguments": ["지수 급락 (출처: market:KOSDAQD, trend:005930)"], "risks": ["코스피 (출처: market:KOSPI)"]}
    fixed = analysis.fix_source_ids(draft)
    assert fixed["claims"][0]["source_ids"] == ["snapshot", "market:KOSDAQ", "dart:1"]
    assert fixed["counter_arguments"] == ["지수 급락 (출처: market:KOSDAQ, trend:005930)"]
    assert fixed["risks"] == ["코스피 (출처: market:KOSPI)"]


def test_held_stock_watch_becomes_hold(monkeypatch) -> None:
    """2026-10-15: 보유 종목 판단이 '관찰'로 나오면 "'관찰' 대신 '관찰'로" 문장이 남았다. 보유 종목은 '보유'로"""
    draft = ProposalDraft(action="watch", claims=[{"text": "a", "type": "opinion", "source_ids": []}],
                          counter_arguments=["b"], risks=["c"], invalid_if=["d"])
    monkeypatch.setattr(llm, "write_proposal", lambda context: draft)
    monkeypatch.setattr(analysis, "invest_context", lambda state: "")
    result = analysis.invest_agent_node({"allowed_actions": ["hold", "sell"], "stock_code": "005930", "stock_name": "삼성전자"})
    assert result["proposal"]["action"] == "hold"
    assert "'관찰' 대신 '보유'로" in result["proposal"]["risks"][-1]


def test_uncomputable_metric_ids_dropped_and_prefix_fixed() -> None:
    """2026-10-16: 계산 안 하는 op_income_yoy를 달아 6번 반려, "(출처: 지표: volatility_60d)"로 2번 반려"""
    claims = [{"text": "흑자 전환", "type": "calc", "source_ids": ["fin:1"], "metric_ids": ["op_income_yoy"]},
              {"text": "PER", "type": "calc", "source_ids": [], "metric_ids": ["per", "op_income_yoy"]}]
    metrics = [{"metric_id": "op_income_yoy", "value": None}, {"metric_id": "per", "value": 10}]
    fixed = analysis.drop_uncomputable_metrics(claims, metrics)
    assert (fixed[0]["type"], fixed[0]["metric_ids"]) == ("fact", [])
    assert (fixed[1]["type"], fixed[1]["metric_ids"]) == ("calc", ["per"])
    assert analysis.fix_source_id("지표: volatility_60d") == "volatility_60d"
    assert analysis.fix_source_id("지표 volatility_60d") == "volatility_60d"  # 2026-10-20 콜론 없이
    assert analysis.fix_source_id("지표volatility_60d") == "volatility_60d"
    # 2026-10-20 값을 붙인 지표 ID, 코스닥 오타 (반려 4건)
    assert analysis.fix_source_id("pbr:0.77배") == "pbr"
    assert analysis.fix_source_id("volatility_60d:38.13%") == "volatility_60d"
    assert analysis.fix_source_id("market:KOSDAI") == "market:KOSDAQ"
    assert analysis.fix_source_id("per:계산 불가") == "per"  # 2026-10-21
    assert analysis.fix_source_id("metric: op_income_yoy") == "op_income_yoy"
    assert analysis.fix_source_id("market:KOSPI") == "market:KOSPI"
    assert analysis.fix_source_id("fin:20260814002500#91") == "fin:20260814002500"
    assert analysis.fix_source_id("dart:20260814002500#91") == "dart:20260814002500#91"  # 공시 본문 조각은 그대로
    assert analysis.fix_source_id("quote:005930") == "quote:005930"  # 진짜 출처 ID는 그대로
    assert analysis.fix_source_id("price:005930:2026-10-16") == "price:005930:2026-10-16"


def test_financial_amounts_carry_korean_units() -> None:
    """2026-10-20: AI가 "399,144,000,000원"을 조·억으로 바꾸다 10배 틀려 반려 6건. 단위를 같이 준다"""
    assert analysis.fmt_amount(399_144_000_000) == "399,144,000,000원 (3,991억 4,400만 원)"
    assert analysis.fmt_amount(5_649_461_675_000) == "5,649,461,675,000원 (5조 6,494억 원)"
    assert analysis.fmt_amount(-45_713_101_404) == "-45,713,101,404원 (-457억 1,310만 원)"
    assert analysis.fmt_amount(80_000_000) == "80,000,000원" and analysis.fmt_amount(None) == "없음"
    # 금액 검사가 단위 붙은 원문 금액도 그대로 읽는다 (AI가 "3,991억 원"이라 써도 통과)
    known = {"fin:A": {"content": "영업이익: 이번 기간 " + analysis.fmt_amount(399_144_000_000)}}
    claim = {"text": "영업이익은 3,991억 원이다", "type": "fact", "source_ids": ["fin:A"]}
    assert analysis.amount_check("claim:0", claim, known) is None


def test_invest_context_shows_todays_sell_rejects() -> None:
    """2026-10-20 삼성SDI: 시장 하락만으로 매도를 4번 내고 4번 반려. 오늘 반려 이유를 투자 AI에게 보여 같은 근거로 다시 내지 않게"""
    state = {"query": "삼성SDI 보유 중이야", "stock_name": "삼성SDI", "stock_code": "006400", "risk_grade": 2, "mode": "custom",
             "risk_level": 4, "flags": [], "allowed_actions": ["hold", "sell"], "sources": {}, "metrics": [],
             "today_rejects": ["시장 전체 급락 외에 종목 자체의 매도 근거가 부족하여 반려"]}
    text = analysis.invest_context(state)
    assert "[오늘 이 종목 매도 반려]" in text and "시장 전체 급락 외에" in text
    assert "[오늘 이 종목 매도 반려]" not in analysis.invest_context({**state, "today_rejects": []})


def test_invest_context_shows_todays_sells_and_short_signal_rule() -> None:
    """2026-10-21 한화시스템: 70,800원에 팔고 73,000원에 다시 삼. 막지 않고 판 기록을 보여 다시 사는 근거를 쓰게.
    같은 날 "VWAP 아래·5분 저가 하락"만으로 산 지 얼마 안 된 종목을 팔아 손해. 지시문에 단기 신호만으로는 팔지 않는다"""
    from app.agents import llm
    state = {"query": "한화시스템 2주 사줘", "stock_name": "한화시스템", "stock_code": "272210", "risk_grade": 2, "mode": "custom",
             "risk_level": 4, "flags": [], "allowed_actions": ["buy", "watch"], "sources": {}, "metrics": [],
             "today_sells": ["09:57 8주 70,800원에 팜 (판 근거: 장중 VWAP 아래)"]}
    text = analysis.invest_context(state)
    assert "[오늘 이 종목 매도]" in text and "70,800원에 팜" in text
    assert "[오늘 이 종목 매도]" not in analysis.invest_context({**state, "today_sells": []})
    assert "단기 신호" in llm.INVEST_PROMPT and "장중 단기 신호" in llm.VERIFY_PROMPT and "[오늘 이 종목 매도]가 있는데" in llm.VERIFY_PROMPT
