from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/agent-role-status")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_returns_four_roles() -> None:
    roles = get_payload()["data"]["roles"]
    assert len(roles) == 4
    assert {r["id"] for r in roles} == {"proposer", "verifier", "policy", "approver"}


def test_no_role_claims_a_pending_decision_was_rejected() -> None:
    # Regression test for the DEC-1043 collision: this screen once said
    # "DEC-1043 반려 후 근거 보강" (after DEC-1043's rejection) while
    # approvals.py still had that exact id sitting pending. A role's
    # `history`/`decision` fields may only narrate a decision as rejected if
    # that id is not currently sitting pending in the live approvals queue.
    client = TestClient(create_app())
    roles = client.get("/api/agent-role-status").json()["data"]["roles"]
    orders = {o["id"]: o for o in client.get("/api/approvals").json()["data"]["orders"]}

    for role in roles:
        for decision_id, order in orders.items():
            if order["decisionStatus"] != "pending":
                continue
            mentions_rejection = "반려" in role["history"] and decision_id in role["history"]
            assert not mentions_rejection, (
                f"role '{role['id']}' narrates {decision_id} as rejected in "
                f"history ({role['history']!r}), but it is still pending in "
                "the live approvals queue"
            )
