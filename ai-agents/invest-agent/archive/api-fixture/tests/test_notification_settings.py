from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/notification-settings")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_four_channels_and_six_types() -> None:
    data = get_payload()["data"]
    assert len(data["channels"]) == 4
    assert len(data["types"]) == 6
    assert data["defaultSeverity"] in ("중대", "높음", "보통")


def test_only_in_app_channel_is_enabled_by_default() -> None:
    channels = {c["id"]: c["enabled"] for c in get_payload()["data"]["channels"]}
    assert channels["inapp"] is True
    assert channels["browser"] is False
    assert channels["email"] is False
    assert channels["messenger"] is False


ALL_TYPES_ENABLED = {"policy": True, "source": True, "approval": True, "data": True, "volatility": True, "cost": True}
ALL_CHANNELS_ENABLED = {"inapp": True, "browser": True, "email": True, "messenger": True}


def test_appliedAt_is_null_until_first_apply() -> None:
    assert get_payload()["data"]["appliedAt"] is None


def test_apply_persists_channels_types_and_severity_and_sets_appliedAt() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/notification-settings/apply",
        json={"channels": ALL_CHANNELS_ENABLED, "types": ALL_TYPES_ENABLED, "defaultSeverity": "보통"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["appliedAt"]
    assert data["defaultSeverity"] == "보통"
    assert all(t["enabled"] for t in data["types"])
    assert all(c["enabled"] for c in data["channels"])
    # Enabling a channel is purely a saved preference — it never changes the
    # honest real-connection copy the fixture supplies for it.
    browser = next(c for c in data["channels"] if c["id"] == "browser")
    assert browser["state"] == "권한 요청 없음"
    assert browser["summary"] == "브라우저 알림 권한은 요청하지 않습니다."

    refetched = client.get("/api/notification-settings").json()["data"]
    assert refetched["appliedAt"] == data["appliedAt"]
    assert refetched["defaultSeverity"] == "보통"
    assert all(c["enabled"] for c in refetched["channels"])


def test_apply_missing_type_returns_422() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/notification-settings/apply",
        json={"channels": ALL_CHANNELS_ENABLED, "types": {"policy": True}, "defaultSeverity": "보통"},
    )

    assert response.status_code == 422


def test_apply_missing_channel_returns_422() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/api/notification-settings/apply",
        json={"channels": {"inapp": True}, "types": ALL_TYPES_ENABLED, "defaultSeverity": "보통"},
    )

    assert response.status_code == 422
