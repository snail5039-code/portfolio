from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/evidence-packets")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_packet_starts_pending() -> None:
    packet = get_payload()["data"]["packets"][0]
    assert packet["id"] == "DEC-1042"
    assert packet["decisionStatus"] == "pending"
    assert packet["decidedAt"] is None


def test_calculation_matches_amount() -> None:
    packet = get_payload()["data"]["packets"][0]
    assert packet["quantity"] * packet["price"] == packet["amount"]


def test_agrees_with_dashboard_and_approvals_on_dec_1042() -> None:
    client = TestClient(create_app())
    packet = client.get("/api/evidence-packets").json()["data"]["packets"][0]
    dashboard = client.get("/api/dashboard").json()["data"]["decision"]
    order = next(
        o for o in client.get("/api/approvals").json()["data"]["orders"] if o["id"] == "DEC-1042"
    )

    assert packet["price"] == dashboard["limitPrice"] == order["price"]
    assert packet["amount"] == dashboard["limitAmount"] == order["amount"]
    assert packet["expiresAt"] == dashboard["expiresAt"] == order["expiresAt"]


def test_approving_dec_1042_is_reflected_on_the_evidence_packet() -> None:
    client = TestClient(create_app())
    client.post("/api/approvals/DEC-1042/approve")

    packet = client.get("/api/evidence-packets").json()["data"]["packets"][0]
    assert packet["decisionStatus"] == "approved"
    assert packet["decidedAt"]
