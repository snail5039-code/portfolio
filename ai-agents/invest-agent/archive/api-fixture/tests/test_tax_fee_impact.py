from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/tax-fee-impact")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_four_orders_with_numeric_cost_fields() -> None:
    orders = get_payload()["data"]["orders"]
    assert len(orders) == 4
    for order in orders:
        for field in ("gross", "fee", "tax", "slippage", "fx"):
            assert isinstance(order[field], int), field
