import pytest
from fastapi.testclient import TestClient

from app.integrations.kis import KisApiError
from app.main import create_app


def new_client() -> TestClient:
    return TestClient(create_app())


def _configure_kis(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.routers.approvals.KIS_PAPER_APP_KEY", "fake-app-key")
    monkeypatch.setattr("app.routers.approvals.KIS_PAPER_APP_SECRET", "fake-app-secret")
    monkeypatch.setattr("app.routers.approvals.KIS_PAPER_CANO", "12345678")
    monkeypatch.setattr("app.routers.approvals.KIS_PAPER_ACNT_PRDT_CD", "01")


def test_list_returns_all_orders_pending_initially() -> None:
    response = new_client().get("/api/approvals")

    assert response.status_code == 200
    payload = response.json()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0

    orders = payload["data"]["orders"]
    assert len(orders) == 4
    assert all(order["decisionStatus"] == "pending" for order in orders)
    assert all(order["decidedAt"] is None for order in orders)


def test_order_amount_equals_quantity_times_price() -> None:
    orders = new_client().get("/api/approvals").json()["data"]["orders"]

    for order in orders:
        assert order["amount"] == order["quantity"] * order["price"], order["id"]


def test_approve_transitions_status_and_sets_decided_at() -> None:
    client = new_client()

    response = client.post("/api/approvals/DEC-1042/approve")

    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["decisionStatus"] == "approved"
    assert payload["data"]["decidedAt"]
    # Approving never means an order was actually placed.
    assert payload["executed"] is False
    assert payload["paperOnly"] is True

    listed = client.get("/api/approvals").json()["data"]["orders"]
    updated = next(o for o in listed if o["id"] == "DEC-1042")
    assert updated["decisionStatus"] == "approved"


def test_reject_transitions_status() -> None:
    client = new_client()

    response = client.post("/api/approvals/DEC-1043/reject")

    assert response.status_code == 200
    payload = response.json()
    assert payload["data"]["decisionStatus"] == "rejected"
    assert payload["data"]["decidedAt"]
    assert payload["executed"] is False


def test_approve_unknown_id_returns_404() -> None:
    response = new_client().post("/api/approvals/DEC-9999/approve")

    assert response.status_code == 404


def test_approve_twice_returns_409_conflict() -> None:
    client = new_client()
    client.post("/api/approvals/DEC-1042/approve")

    response = client.post("/api/approvals/DEC-1042/approve")

    assert response.status_code == 409
    assert "DEC-1042" in response.json()["detail"]


def test_reject_after_approve_returns_409_conflict() -> None:
    client = new_client()
    client.post("/api/approvals/DEC-1044/approve")

    response = client.post("/api/approvals/DEC-1044/reject")

    assert response.status_code == 409


def test_other_orders_are_unaffected_by_one_decision() -> None:
    client = new_client()

    client.post("/api/approvals/DEC-1042/approve")

    orders = client.get("/api/approvals").json()["data"]["orders"]
    others = [o for o in orders if o["id"] != "DEC-1042"]
    assert all(o["decisionStatus"] == "pending" for o in others)


def test_store_state_is_isolated_per_app_instance() -> None:
    # Each create_app() call must get its own store — otherwise a module-level
    # singleton would leak approvals between unrelated app instances (and
    # between tests in this same process).
    first_app_client = new_client()
    second_app_client = new_client()

    first_app_client.post("/api/approvals/DEC-1042/approve")

    second_orders = second_app_client.get("/api/approvals").json()["data"]["orders"]
    still_pending = next(o for o in second_orders if o["id"] == "DEC-1042")
    assert still_pending["decisionStatus"] == "pending"


def test_action_envelope_disclaimer_mentions_no_real_order() -> None:
    payload = new_client().post("/api/approvals/DEC-1045/approve").json()

    assert "실제 주문" in payload["disclaimer"]


def test_approve_places_a_live_kis_order_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_place_order(app_key, app_secret, cano, acnt_prdt_cd, *, stock_code, side, quantity, price):
        assert (app_key, app_secret, cano, acnt_prdt_cd) == ("fake-app-key", "fake-app-secret", "12345678", "01")
        assert (stock_code, side, quantity, price) == ("005930", "buy", 10, 71_200)  # DEC-1042
        return {"ODNO": "0000123456", "ORD_TMD": "091500"}

    client = new_client()
    _configure_kis(monkeypatch)
    monkeypatch.setattr("app.routers.approvals.kis.place_paper_order", fake_place_order)

    response = client.post("/api/approvals/DEC-1042/approve")

    assert response.status_code == 200
    payload = response.json()
    assert payload["externalConnections"] == 1
    assert "한국투자증권 모의투자" in payload["disclaimer"]
    assert payload["data"]["kisOrderNo"] == "0000123456"
    assert payload["data"]["decisionStatus"] == "approved"

    listed = client.get("/api/approvals").json()
    assert listed["externalConnections"] == 1
    order = next(o for o in listed["data"]["orders"] if o["id"] == "DEC-1042")
    assert order["kisOrderNo"] == "0000123456"


def test_approve_maps_sell_side_correctly(monkeypatch: pytest.MonkeyPatch) -> None:
    seen_sides = {}

    async def fake_place_order(app_key, app_secret, cano, acnt_prdt_cd, *, stock_code, side, quantity, price):
        seen_sides["side"] = side
        return {"ODNO": "0000999999"}

    client = new_client()
    _configure_kis(monkeypatch)
    monkeypatch.setattr("app.routers.approvals.kis.place_paper_order", fake_place_order)

    response = client.post("/api/approvals/DEC-1043/approve")  # DEC-1043 is 매도

    assert response.status_code == 200
    assert seen_sides["side"] == "sell"


def test_approve_returns_502_and_stays_pending_when_kis_order_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    async def failing_place_order(*args, **kwargs):
        raise KisApiError("simulated KIS rejection")

    client = new_client()
    _configure_kis(monkeypatch)
    monkeypatch.setattr("app.routers.approvals.kis.place_paper_order", failing_place_order)

    response = client.post("/api/approvals/DEC-1042/approve")

    assert response.status_code == 502

    # The failed live order must not have silently succeeded as a local approve.
    listed = client.get("/api/approvals").json()["data"]["orders"]
    order = next(o for o in listed if o["id"] == "DEC-1042")
    assert order["decisionStatus"] == "pending"
    assert order["kisOrderNo"] is None


def test_reject_never_calls_kis_even_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    def unexpected_call(*args, **kwargs):
        raise AssertionError("reject must never call KIS")

    client = new_client()
    _configure_kis(monkeypatch)
    monkeypatch.setattr("app.routers.approvals.kis.place_paper_order", unexpected_call)

    response = client.post("/api/approvals/DEC-1042/reject")

    assert response.status_code == 200
    assert response.json()["data"]["kisOrderNo"] is None
