from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/policy-settings")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_six_number_rules_and_four_checks() -> None:
    data = get_payload()["data"]
    assert len(data["numberRules"]) == 6
    assert len(data["checks"]) == 4
    for rule in data["numberRules"]:
        # `value` is deliberately a string (bound to a text input); it must
        # still parse as a number within the rule's own min/max.
        assert rule["min"] <= float(rule["value"]) <= rule["max"]


def test_preview_agrees_with_dashboard_and_approvals_on_dec_1042() -> None:
    client = TestClient(create_app())
    preview = client.get("/api/policy-settings").json()["data"]["preview"]
    dashboard = client.get("/api/dashboard").json()["data"]["decision"]
    order = next(
        o for o in client.get("/api/approvals").json()["data"]["orders"] if o["id"] == "DEC-1042"
    )

    assert preview["decisionId"] == "DEC-1042"
    assert preview["amount"] == dashboard["limitAmount"] == order["amount"]
    assert preview["nextWeight"] == dashboard["targetWeightTo"]


VALID_APPLY_BODY = {
    "maxWeight": "12.0",
    "maxOrder": "2000000",
    "maxLoss": "4.0",
    "minCash": "10.0",
    "volatility": "30.0",
    "expiry": "15",
    "limitOrder": True,
    "marketOrder": True,
    "blockUnknown": False,
    "blockCorrection": True,
}


def test_appliedAt_is_null_until_first_apply() -> None:
    assert get_payload()["data"]["appliedAt"] is None


def test_apply_persists_values_and_sets_appliedAt() -> None:
    client = TestClient(create_app())

    response = client.post("/api/policy-settings/apply", json=VALID_APPLY_BODY)

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["appliedAt"]
    values = {rule["key"]: rule["value"] for rule in data["numberRules"]}
    assert values["maxWeight"] == "12.0"
    checks = {check["key"]: check["value"] for check in data["checks"]}
    assert checks["blockUnknown"] is False

    # A fresh GET on the same app instance reflects the saved apply, not the
    # fixture defaults.
    refetched = client.get("/api/policy-settings").json()["data"]
    assert refetched["appliedAt"] == data["appliedAt"]
    assert refetched["numberRules"][0]["value"] == "12.0"


def test_apply_out_of_range_number_returns_422_and_does_not_persist() -> None:
    client = TestClient(create_app())

    response = client.post("/api/policy-settings/apply", json={**VALID_APPLY_BODY, "maxWeight": "999"})

    assert response.status_code == 422
    assert client.get("/api/policy-settings").json()["data"]["appliedAt"] is None


def test_apply_state_is_isolated_per_app_instance() -> None:
    first = TestClient(create_app())
    second = TestClient(create_app())

    first.post("/api/policy-settings/apply", json=VALID_APPLY_BODY)

    assert second.get("/api/policy-settings").json()["data"]["appliedAt"] is None
