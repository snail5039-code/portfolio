from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/audit-logs")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_three_decisions_with_five_columns_each() -> None:
    data = get_payload()["data"]
    assert len(data["labels"]) == 5
    for row in data["decisions"]:
        assert len(row["initial"]) == 5
        assert len(row["verified"]) == 5
        assert len(row["changed"]) == 5


def test_agrees_with_approvals_on_verified_amounts() -> None:
    client = TestClient(create_app())
    rows = {row["id"]: row for row in client.get("/api/audit-logs").json()["data"]["decisions"]}
    orders = {o["id"]: o for o in client.get("/api/approvals").json()["data"]["orders"]}

    for decision_id in ("DEC-1042", "DEC-1043", "DEC-1044"):
        verified_amount = rows[decision_id]["verified"][2]
        assert verified_amount == f"{orders[decision_id]['amount']:,}원"
