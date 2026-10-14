from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/trade-history")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_seven_items_sorted_by_recency() -> None:
    items = get_payload()["data"]["items"]
    assert len(items) == 7
    days = [item["days"] for item in items]
    assert days == sorted(days)


def test_related_links_include_one_disabled_local_link() -> None:
    links = get_payload()["data"]["relatedLinks"]
    disabled = [link for link in links if link["disabled"]]
    assert len(disabled) == 1
    assert disabled[0]["page"] is None
