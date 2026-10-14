"""투자 용어: LLM 없이 용어집에서 찾아 답한다."""

import pytest
from psycopg.rows import dict_row

from app import glossary
from app.agents import llm
from app.db import connect
from tests.test_chat import events_of, first


@pytest.fixture(scope="module", autouse=True)
def terms(migrated):
    assert glossary.load(migrated) > 200


def find(migrated, text):
    with connect(migrated, row_factory=dict_row) as conn:
        return glossary.lookup(conn, text)


def test_lookup_names_and_aliases(migrated) -> None:
    assert find(migrated, "per")[0]["term"] == "PER"            # 대소문자 무시
    assert find(migrated, "주가 수익 비율")[0]["term"] == "PER"  # 다른 이름, 공백 무시
    assert find(migrated, "ROE")[0]["source"] == glossary.FSC_SOURCE  # 괄호 밖 이름 "ROE(Return To Equity)"
    assert find(migrated, "Return To Equity")[0]["term"].startswith("ROE")  # 괄호 안 이름
    row, _ = find(migrated, "공매도")
    assert row["url"].startswith("https://www.fsc.go.kr/in090301/view?dicId=") and row["reviewed"] is True


def test_unknown_term_suggests_without_guessing(migrated) -> None:
    row, candidates = find(migrated, "자기자본비율")
    assert row is None and any("자기자본비율" in c for c in candidates)  # 억지로 붙이지 않고 후보만
    assert find(migrated, "양자컴퓨터")[0] is None


def test_names_of_splits_parentheses() -> None:
    assert glossary.names_of("ETF(Exchange Traded Fund, 상장지수집합투자기구)", []) == [
        "ETF(Exchange Traded Fund, 상장지수집합투자기구)", "ETF", "Exchange Traded Fund", "상장지수집합투자기구"]


def test_explain_in_chat(client, user, monkeypatch) -> None:
    term = {"value": "PER"}
    monkeypatch.setattr(llm, "understand", lambda q, h: llm.Understood(query=q, intent="explain", term=term["value"]))

    def ask(text, kind="app"):
        events = events_of(client.post("/api/chat", headers=user["headers"], json={"text": text, "client": kind}))
        return first(events, "message")["text"]

    answer = ask("PER이 뭐야?")
    assert answer.startswith("PER\n주가가 1년 순이익의 몇 배인지") and "검토 전 초안" in answer and "주의:" in answer
    term["value"] = "공매도"
    answer = ask("공매도가 뭐야", "web")
    assert "출처: 금융위원회 금융용어사전 https://www.fsc.go.kr/" in answer and "검토 전" not in answer
    term["value"] = "양자컴퓨터"
    assert ask("양자컴퓨터가 뭐야").startswith("'양자컴퓨터'은(는) 용어집에 없어요.")
