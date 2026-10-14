from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/data-connections")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_every_row_has_a_matching_detail() -> None:
    data = get_payload()["data"]
    for row in data["rows"]:
        assert row["key"] in data["details"]
        assert len(data["details"][row["key"]]["facts"]) == 4
