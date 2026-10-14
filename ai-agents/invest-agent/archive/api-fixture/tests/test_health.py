from fastapi.testclient import TestClient

from app.main import create_app


def test_health_returns_local_fixture_safety_fields() -> None:
    client = TestClient(create_app())

    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "financial-ai-agent-api"
    assert payload["sourceLabel"] == "local FastAPI health"
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["externalConnections"] == 0
    assert payload["executed"] is False
    assert payload["generatedAt"]
    assert payload["dataAsOf"]
    assert "No real financial data" in payload["disclaimer"]


def test_unimplemented_api_path_is_not_found() -> None:
    # Every screen's fixture endpoint is implemented at this point (23
    # screens); this checks that an arbitrary path outside that set still
    # 404s rather than falling through to some catch-all.
    client = TestClient(create_app())

    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
