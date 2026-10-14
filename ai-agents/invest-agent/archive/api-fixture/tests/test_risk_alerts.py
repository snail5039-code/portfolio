from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/risk-alerts")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_all_events() -> None:
    events = get_payload()["data"]["events"]
    assert len(events) == 6
    assert {e["id"] for e in events} == {f"RISK-204{n}" for n in range(1, 7)}


def test_link_pages_are_local_or_null() -> None:
    for event in get_payload()["data"]["events"]:
        assert event["linkPage"] is None or not event["linkPage"].startswith("http")
