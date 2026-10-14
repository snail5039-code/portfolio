from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/stress-test")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_all_four_scenarios_have_five_asset_rows() -> None:
    data = get_payload()["data"]
    assert set(data["scenarios"]) == {"rates", "chips", "fx", "liquidity"}
    for rows in data["rowsByScenario"].values():
        assert len(rows) == 5


def test_contribution_equals_weight_times_shock_over_100() -> None:
    data = get_payload()["data"]
    for rows in data["rowsByScenario"].values():
        for row in rows:
            expected = round((row["weight"] * row["shock"]) / 100, 2)
            assert abs(row["contribution"] - expected) < 0.01


def test_impact_state_thresholds_are_consistent() -> None:
    data = get_payload()["data"]
    for rows in data["rowsByScenario"].values():
        for row in rows:
            if row["shock"] <= -10:
                assert row["state"] == "높음"
            elif row["shock"] <= -6:
                assert row["state"] == "주의"
            else:
                assert row["state"] == "관리"
