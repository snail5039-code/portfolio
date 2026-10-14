"""Direct tests for app/integrations/kis.py's request-building and response
parsing — the router tests monkeypatch this module's functions entirely
(matching this project's existing convention for external integrations), so
this file is what actually exercises the HTTP request shape, tr_id
selection, and error handling below it.

No real network call ever happens here: `httpx.AsyncClient` itself is
replaced with a fake that records the request and returns a canned response.
Tests are plain sync functions driving `asyncio.run` themselves — this
project has no pytest-asyncio/anyio dependency, so a bare `async def test_*`
would silently not run at all.
"""

import asyncio

import pytest

from app.integrations import kis


class _FakeResponse:
    def __init__(self, json_body: dict) -> None:
        self._json_body = json_body
        self.status_code = 200

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._json_body


class _FakeAsyncClient:
    """Records every call made through it; `responses` is consumed in order."""

    calls: list[dict] = []
    responses: list[_FakeResponse] = []

    def __init__(self, *args, **kwargs) -> None:
        pass

    async def __aenter__(self) -> "_FakeAsyncClient":
        return self

    async def __aexit__(self, *exc_info) -> None:
        return None

    async def get(self, url, headers=None, params=None):
        _FakeAsyncClient.calls.append({"method": "GET", "url": url, "headers": headers, "params": params})
        return _FakeAsyncClient.responses.pop(0)

    async def post(self, url, headers=None, json=None):
        _FakeAsyncClient.calls.append({"method": "POST", "url": url, "headers": headers, "body": json})
        return _FakeAsyncClient.responses.pop(0)


@pytest.fixture(autouse=True)
def _reset_fake_client(monkeypatch: pytest.MonkeyPatch):
    _FakeAsyncClient.calls = []
    _FakeAsyncClient.responses = []
    monkeypatch.setattr(kis.httpx, "AsyncClient", _FakeAsyncClient)
    # Every test gets its own token cache so one test's cached token can't
    # leak into another's assertions about the auth call being made.
    monkeypatch.setattr(kis, "_token_cache", kis._TokenCache())


def _token_response() -> _FakeResponse:
    return _FakeResponse({"access_token": "test-token", "expires_in": 86400})


def test_get_balance_uses_paper_trading_tr_id_and_domain() -> None:
    _FakeAsyncClient.responses = [
        _token_response(),
        _FakeResponse(
            {
                "rt_cd": "0",
                "output1": [
                    {"pdno": "005930", "hldg_qty": "10", "evlu_amt": "712000"},
                    {"pdno": "000660", "hldg_qty": "0", "evlu_amt": "0"},  # sold out, should be filtered
                ],
                "output2": [{"tot_evlu_amt": "1000000"}],
            }
        ),
    ]

    holdings, summary = asyncio.run(kis.get_balance("app-key", "app-secret", "12345678", "01"))

    assert [h["pdno"] for h in holdings] == ["005930"]  # zero-qty row dropped
    assert summary["tot_evlu_amt"] == "1000000"

    balance_call = _FakeAsyncClient.calls[-1]
    assert balance_call["url"] == f"{kis.PAPER_BASE_URL}/uapi/domestic-stock/v1/trading/inquire-balance"
    assert balance_call["headers"]["tr_id"] == "VTTC8434R"
    assert balance_call["headers"]["authorization"] == "Bearer test-token"
    assert kis.PAPER_BASE_URL.startswith("https://openapivts.")  # never the real-trading host


def test_place_paper_order_buy_uses_buy_tr_id_and_body_fields() -> None:
    _FakeAsyncClient.responses = [
        _token_response(),
        _FakeResponse({"rt_cd": "0", "output": {"ODNO": "0000123456", "ORD_TMD": "091500"}}),
    ]

    result = asyncio.run(
        kis.place_paper_order(
            "app-key", "app-secret", "12345678", "01", stock_code="005930", side="buy", quantity=10, price=71_200
        )
    )

    assert result["ODNO"] == "0000123456"
    order_call = _FakeAsyncClient.calls[-1]
    assert order_call["method"] == "POST"
    assert order_call["url"] == f"{kis.PAPER_BASE_URL}/uapi/domestic-stock/v1/trading/order-cash"
    assert order_call["headers"]["tr_id"] == "VTTC0012U"
    assert order_call["body"] == {
        "CANO": "12345678",
        "ACNT_PRDT_CD": "01",
        "PDNO": "005930",
        "ORD_DVSN": "00",
        "ORD_QTY": "10",
        "ORD_UNPR": "71200",
        "EXCG_ID_DVSN_CD": "KRX",
        "SLL_TYPE": "",
        "CNDT_PRIC": "",
    }


def test_place_paper_order_sell_uses_sell_tr_id() -> None:
    _FakeAsyncClient.responses = [
        _token_response(),
        _FakeResponse({"rt_cd": "0", "output": {"ODNO": "0000999999"}}),
    ]

    asyncio.run(
        kis.place_paper_order(
            "app-key", "app-secret", "12345678", "01", stock_code="035420", side="sell", quantity=8, price=220_000
        )
    )

    order_call = _FakeAsyncClient.calls[-1]
    assert order_call["headers"]["tr_id"] == "VTTC0011U"
    assert order_call["body"]["SLL_TYPE"] == "01"


def test_place_paper_order_raises_kis_api_error_on_non_zero_rt_cd() -> None:
    _FakeAsyncClient.responses = [
        _token_response(),
        _FakeResponse({"rt_cd": "1", "msg_cd": "40910000", "msg1": "모의투자 주문가능금액을 초과했습니다."}),
    ]

    with pytest.raises(kis.KisApiError, match="모의투자 주문가능금액을 초과했습니다"):
        asyncio.run(
            kis.place_paper_order(
                "app-key",
                "app-secret",
                "12345678",
                "01",
                stock_code="005930",
                side="buy",
                quantity=10_000,
                price=71_200,
            )
        )


def test_token_is_cached_across_multiple_calls() -> None:
    _FakeAsyncClient.responses = [
        _token_response(),
        _FakeResponse({"rt_cd": "0", "output": {}}),
        _FakeResponse({"rt_cd": "0", "output": {}}),
    ]

    async def call_twice() -> None:
        await kis.get_current_price("app-key", "app-secret", "005930")
        await kis.get_current_price("app-key", "app-secret", "005930")

    asyncio.run(call_twice())

    auth_calls = [c for c in _FakeAsyncClient.calls if c["url"].endswith("/oauth2/tokenP")]
    assert len(auth_calls) == 1  # second call reused the cached token
