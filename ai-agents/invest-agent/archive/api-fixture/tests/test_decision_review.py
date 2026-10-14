from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/decision-review")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_four_decisions_with_valid_outcomes() -> None:
    decisions = get_payload()["data"]["decisions"]
    assert len(decisions) == 4
    for row in decisions:
        assert row["decision"] in ("승인", "반려", "보류")
        assert not row["linkPage"].startswith("http")


def test_no_row_contradicts_a_currently_pending_approval() -> None:
    # Regression test for the DEC-1043 collision: this screen once claimed
    # NAVER's DEC-1043 was "반려" while approvals.py still had that exact id
    # sitting pending. A row here may only reuse an id from the live queue if
    # that order is no longer pending (so there is nothing left to contradict).
    client = TestClient(create_app())
    decisions = client.get("/api/decision-review").json()["data"]["decisions"]
    orders = {o["id"]: o for o in client.get("/api/approvals").json()["data"]["orders"]}

    for row in decisions:
        order = orders.get(row["id"])
        if order is not None:
            assert order["decisionStatus"] != "pending", (
                f"{row['id']} is claimed '{row['decision']}' here but is still "
                "pending in the live approvals queue"
            )
