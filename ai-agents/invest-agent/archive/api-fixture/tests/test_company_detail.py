import pytest
from fastapi.testclient import TestClient

from app.integrations.opendart import OpenDartError
from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/company-detail")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    # Force no OPENDART_API_KEY regardless of a real key in apps/api/.env, so
    # filings stay on the fixture placeholder and this reads like every other
    # screen's envelope.
    monkeypatch.setattr("app.routers.company_detail.OPENDART_API_KEY", None)
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0
    assert payload["data"]["filingsConnected"] is False


def test_live_opendart_filings_replace_the_fixture_and_are_disclosed_honestly(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch(stock_code: str, api_key: str, count: int = 5) -> list[dict]:
        assert stock_code == "005930"
        return [
            {"report_nm": "분기보고서", "rcept_no": "20260101000123", "rcept_dt": "20260101", "flr_nm": "삼성전자"},
        ]

    monkeypatch.setattr("app.routers.company_detail.OPENDART_API_KEY", "fake-key")
    monkeypatch.setattr("app.routers.company_detail.fetch_recent_disclosures", fake_fetch)

    payload = get_payload()

    assert payload["externalConnections"] == 1
    assert payload["data"]["filingsConnected"] is True
    assert payload["disclaimer"] == "모의투자 · 가상 예시 · 시세·계좌 미연결 · 공시는 OpenDART 실제 데이터 · 투자 권유 아님"
    filings = payload["data"]["filings"]
    assert len(filings) == 1
    assert filings[0]["id"] == "20260101000123"
    assert filings[0]["title"] == "분기보고서"
    assert filings[0]["subtitle"] == "2026.01.01 · 삼성전자"
    assert filings[0]["sourceLabel"] == "OpenDART 실제 공시"


def test_opendart_failure_falls_back_to_the_fixture_placeholder(monkeypatch: pytest.MonkeyPatch) -> None:
    async def failing_fetch(stock_code: str, api_key: str, count: int = 5) -> list[dict]:
        raise OpenDartError("simulated OpenDART outage")

    monkeypatch.setattr("app.routers.company_detail.OPENDART_API_KEY", "fake-key")
    monkeypatch.setattr("app.routers.company_detail.fetch_recent_disclosures", failing_fetch)

    payload = get_payload()

    assert payload["externalConnections"] == 0
    assert payload["data"]["filingsConnected"] is False
    assert len(payload["data"]["filings"]) == 3  # the original fixture placeholder, untouched


def test_opendart_empty_result_falls_back_to_the_fixture_placeholder(monkeypatch: pytest.MonkeyPatch) -> None:
    async def empty_fetch(stock_code: str, api_key: str, count: int = 5) -> list[dict]:
        return []

    monkeypatch.setattr("app.routers.company_detail.OPENDART_API_KEY", "fake-key")
    monkeypatch.setattr("app.routers.company_detail.fetch_recent_disclosures", empty_fetch)

    payload = get_payload()

    assert payload["externalConnections"] == 0
    assert payload["data"]["filingsConnected"] is False


def test_returns_twelve_chart_points_and_six_metrics() -> None:
    data = get_payload()["data"]
    assert len(data["chart"]) == 12
    assert len(data["metrics"]) == 6
    assert len(data["evidence"]) == 6
    assert len(data["filings"]) == 3


def test_price_panel_agrees_with_dashboard_holding() -> None:
    client = TestClient(create_app())
    price = client.get("/api/company-detail").json()["data"]["price"]
    holding = next(
        h for h in client.get("/api/dashboard").json()["data"]["holdings"] if h["code"] == "005930"
    )

    assert price["quantity"] == holding["quantity"]
    assert price["averagePrice"] == holding["averagePrice"]
    assert price["currentPrice"] == holding["currentPrice"]
    assert price["value"] == holding["value"]
    assert price["profit"] == holding["profit"]
    assert price["weight"] == holding["weight"]
