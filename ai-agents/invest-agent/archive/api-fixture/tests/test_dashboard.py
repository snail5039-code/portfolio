import pytest
from fastapi.testclient import TestClient

from app.fixtures.dashboard import build_dashboard_data
from app.integrations.kis import KisApiError
from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    return response.json()


def test_dashboard_envelope_carries_safety_flags() -> None:
    payload = get_payload()

    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0
    assert payload["sourceLabel"] == "로컬 fixture"
    assert payload["generatedAt"]
    assert payload["dataAsOf"] == "2026-08-27T15:20:00+09:00"
    assert "연결되지 않습니다" in payload["disclaimer"]
    assert "data" in payload


def test_dashboard_money_and_percent_fields_are_numeric() -> None:
    data = get_payload()["data"]

    assert data["currency"] == "KRW"

    summary = data["summary"]
    for field in ("totalAsset", "todayProfit", "principal", "accumulatedProfit"):
        assert isinstance(summary[field], int), field
    for field in ("todayProfitRate", "cashWeight"):
        assert isinstance(summary[field], (int, float)), field
        assert not isinstance(summary[field], str), field

    for holding in data["holdings"]:
        assert isinstance(holding["value"], int)
        assert isinstance(holding["weight"], (int, float))
        assert not isinstance(holding["weight"], str)

    decision = data["decision"]
    assert isinstance(decision["limitPrice"], int)
    assert isinstance(decision["limitAmount"], int)
    assert isinstance(decision["targetWeightFrom"], (int, float))
    assert isinstance(decision["targetWeightTo"], (int, float))


def test_holding_values_sum_to_total_asset() -> None:
    data = get_payload()["data"]

    assert sum(holding["value"] for holding in data["holdings"]) == data["summary"]["totalAsset"]


def test_holding_weights_are_consistent_with_values() -> None:
    data = get_payload()["data"]
    total = data["summary"]["totalAsset"]

    for holding in data["holdings"]:
        implied = holding["value"] / total * 100
        assert abs(implied - holding["weight"]) < 0.01, holding["code"]


def test_cash_holding_uses_null_instead_of_placeholder_text() -> None:
    data = get_payload()["data"]
    cash = next(holding for holding in data["holdings"] if holding["code"] == "KRW")

    assert cash["quantity"] is None
    assert cash["averagePrice"] is None
    assert cash["currentPrice"] is None
    assert cash["profit"] is None
    assert cash["profitRate"] is None
    assert cash["value"] > 0


def test_decision_reports_no_execution() -> None:
    decision = get_payload()["data"]["decision"]

    assert decision["decisionId"] == "DEC-1042"
    assert any(
        check["label"] == "실제 주문" and check["value"] == "생성 안 됨"
        for check in decision["checks"]
    )
    assert decision["invalidConditions"]


def test_fixture_builder_matches_declared_schema() -> None:
    # Round-tripping proves the fixture cannot drift away from the schema
    # (extra="forbid" plus literal safety flags).
    data = build_dashboard_data()

    assert data.model_dump() == build_dashboard_data().model_dump()
    assert data.summary.totalAsset == sum(holding.value for holding in data.holdings)


def test_decision_starts_pending_with_no_decided_at() -> None:
    decision = get_payload()["data"]["decision"]

    assert decision["decisionStatus"] == "pending"
    assert decision["decidedAt"] is None


def test_approving_the_decision_via_approvals_is_reflected_on_dashboard() -> None:
    # This is the cross-screen consistency the decision consolidation exists
    # for: the dashboard's featured decision and the approvals queue read the
    # same store, so a decision made on one screen shows up on the other
    # without a page reload.
    client = TestClient(create_app())

    approve_response = client.post("/api/approvals/DEC-1042/approve")
    assert approve_response.status_code == 200

    dashboard = client.get("/api/dashboard").json()["data"]["decision"]
    assert dashboard["decisionId"] == "DEC-1042"
    assert dashboard["decisionStatus"] == "approved"
    assert dashboard["decidedAt"]
    assert dashboard["decidedAt"] == approve_response.json()["data"]["decidedAt"]


def test_rejecting_the_decision_via_approvals_is_reflected_on_dashboard() -> None:
    client = TestClient(create_app())

    client.post("/api/approvals/DEC-1042/reject")

    dashboard = client.get("/api/dashboard").json()["data"]["decision"]
    assert dashboard["decisionStatus"] == "rejected"


def test_dashboard_decision_state_is_isolated_per_app_instance() -> None:
    # Same isolation guarantee as the approvals store itself: one app's
    # decision does not leak into another app's dashboard.
    first_app_client = TestClient(create_app())
    second_app_client = TestClient(create_app())

    first_app_client.post("/api/approvals/DEC-1042/approve")

    second_dashboard = second_app_client.get("/api/dashboard").json()["data"]["decision"]
    assert second_dashboard["decisionStatus"] == "pending"


def test_dashboard_and_approvals_agree_on_dec_1042s_static_facts() -> None:
    # Both screens describe the same proposal; they must not silently drift
    # apart on what is actually being proposed (quantity, price, amount).
    client = TestClient(create_app())

    dashboard_decision = client.get("/api/dashboard").json()["data"]["decision"]
    approvals_order = next(
        order
        for order in client.get("/api/approvals").json()["data"]["orders"]
        if order["id"] == "DEC-1042"
    )

    assert dashboard_decision["limitPrice"] == approvals_order["price"]
    assert dashboard_decision["limitAmount"] == approvals_order["amount"]
    assert dashboard_decision["company"] == approvals_order["company"]
    assert dashboard_decision["code"] == approvals_order["code"]
    assert dashboard_decision["expiresAt"] == approvals_order["expiresAt"]


def _configure_kis(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routers.dashboard.KIS_PAPER_APP_KEY", "fake-app-key")
    monkeypatch.setattr("app.routers.dashboard.KIS_PAPER_APP_SECRET", "fake-app-secret")
    monkeypatch.setattr("app.routers.dashboard.KIS_PAPER_CANO", "12345678")
    monkeypatch.setattr("app.routers.dashboard.KIS_PAPER_ACNT_PRDT_CD", "01")


def test_live_kis_holdings_replace_the_fixture_and_are_disclosed_honestly(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get_balance(app_key: str, app_secret: str, cano: str, acnt_prdt_cd: str):
        assert (app_key, app_secret, cano, acnt_prdt_cd) == ("fake-app-key", "fake-app-secret", "12345678", "01")
        holdings = [
            {
                "pdno": "005930",
                "prdt_name": "삼성전자",
                "hldg_qty": "10",
                "pchs_avg_pric": "70000",
                "prpr": "71200",
                "evlu_amt": "712000",
                "evlu_pfls_amt": "12000",
                "evlu_pfls_rt": "1.72",
            }
        ]
        summary = {"tot_evlu_amt": "1000000"}
        return holdings, summary

    _configure_kis(monkeypatch)
    monkeypatch.setattr("app.routers.dashboard.kis.get_balance", fake_get_balance)

    payload = get_payload()

    assert payload["externalConnections"] == 1
    assert "한국투자증권 모의투자" in payload["disclaimer"]
    data = payload["data"]
    assert data["holdingsConnected"] is True
    assert len(data["holdings"]) == 1
    holding = data["holdings"][0]
    assert holding["code"] == "005930"
    assert holding["quantity"] == 10
    assert holding["value"] == 712_000
    assert holding["weight"] == 71.2


def test_kis_failure_falls_back_to_the_fixture_holdings(monkeypatch: pytest.MonkeyPatch) -> None:
    async def failing_get_balance(app_key: str, app_secret: str, cano: str, acnt_prdt_cd: str):
        raise KisApiError("simulated KIS outage")

    _configure_kis(monkeypatch)
    monkeypatch.setattr("app.routers.dashboard.kis.get_balance", failing_get_balance)

    payload = get_payload()

    assert payload["externalConnections"] == 0
    assert payload["data"]["holdingsConnected"] is False
    assert len(payload["data"]["holdings"]) == 6  # the original fixture list, untouched


def test_kis_empty_balance_falls_back_to_the_fixture_holdings(monkeypatch: pytest.MonkeyPatch) -> None:
    async def empty_get_balance(app_key: str, app_secret: str, cano: str, acnt_prdt_cd: str):
        return [], {"tot_evlu_amt": "0"}

    _configure_kis(monkeypatch)
    monkeypatch.setattr("app.routers.dashboard.kis.get_balance", empty_get_balance)

    payload = get_payload()

    assert payload["data"]["holdingsConnected"] is False


def test_dashboard_reports_live_when_dec_1042_carries_a_kis_order_no() -> None:
    # No KIS credentials configured here — this is about the decision panel
    # honestly reflecting a *previously* placed live order (e.g. approved in
    # an earlier request while KIS was configured), not about the live call
    # itself. See test_approvals.py for the approve-time KIS call.
    client = TestClient(create_app())
    client.app.state.approval_store.decide("DEC-1042", "approved", kis_order_no="0000123456")

    payload = client.get("/api/dashboard").json()

    assert payload["externalConnections"] == 1
    assert "한국투자증권 모의투자" in payload["disclaimer"]
    assert payload["data"]["decision"]["kisOrderNo"] == "0000123456"
