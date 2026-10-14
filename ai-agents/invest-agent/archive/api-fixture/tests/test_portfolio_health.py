from fastapi.testclient import TestClient

from app.fixtures.portfolio_health import build_portfolio_health_data
from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/portfolio-health")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_seven_groups_and_eight_checks() -> None:
    data = get_payload()["data"]
    assert len(data["groups"]) == 7
    assert len(data["checks"]) == 8


def test_overall_score_matches_the_documented_formula() -> None:
    data = get_payload()["data"]
    blocked = sum(1 for c in data["checks"] if c["status"] == "차단")
    needs = sum(1 for c in data["checks"] if c["status"] == "확인 필요")
    expected = max(42, round(88 - blocked * 10 - needs * 4))
    assert data["overallScore"] == expected


def test_score_is_deterministic() -> None:
    assert build_portfolio_health_data().overallScore == build_portfolio_health_data().overallScore
