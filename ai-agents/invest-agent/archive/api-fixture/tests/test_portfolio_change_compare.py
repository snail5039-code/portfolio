from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/portfolio-change-compare")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_six_assets_with_valid_policy_types() -> None:
    assets = get_payload()["data"]["assets"]
    assert len(assets) == 6
    for asset in assets:
        assert asset["policyType"] in ("pass", "check", "block")
        assert asset["direction"] in ("up", "down")
