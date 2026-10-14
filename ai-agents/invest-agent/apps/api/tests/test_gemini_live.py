"""실제 Gemini로 요청 이해(분류·값 뽑기·"그거" 풀기)가 맞는지 확인한다. 비용이 들어서 기본 테스트에서는 빠진다.

실행: uv run pytest -m gemini
"""

import time

import pytest

from app import config
from app.agents import llm

pytestmark = [
    pytest.mark.gemini,
    pytest.mark.skipif(not config.GEMINI_API_KEY, reason="GEMINI_API_KEY 없음"),
]


@pytest.mark.parametrize(
    "text, intent, query_kind, stock_name",
    [
        ("잔고 보여줘", "query", "balance", None),
        ("내 계좌에 돈 얼마 있어?", "query", "balance", None),
        ("삼성전자 지금 얼마야?", "query", "price", "삼성전자"),
        ("오늘 주문한 거 보여줘", "query", "orders", None),
        ("SK하이닉스 사도 될까?", "analysis", None, "SK하이닉스"),
        ("카카오 요즘 어때?", "analysis", None, "카카오"),
        ("SK하이닉스 4주 사줘", "order", None, "SK하이닉스"),
        ("삼성전자 10주 팔아줘", "order", None, "삼성전자"),
        ("아까 주문 체결됐어?", "result", None, None),
        ("오늘 날씨 어때?", "other", None, None),
    ],
)
def test_understand(text: str, intent: str, query_kind: str | None, stock_name: str | None) -> None:
    start = time.time()
    result = llm.understand(text, [])
    assert time.time() - start < 3, "한 번 호출이 3초를 넘음 (NFR-12)"
    assert result.intent == intent
    if intent == "query":
        assert result.query_kind == query_kind
    assert result.stock_name == stock_name


def test_understand_resolves_reference() -> None:
    history = [{"request": "삼성전자 얼마야?", "answer": "삼성전자(005930) 현재가 71,200원"}]
    result = llm.understand("그거 다시 알려줘", history)
    assert "삼성전자" in result.query
    assert result.stock_name == "삼성전자"
    assert result.intent == "query" and result.query_kind == "price"
