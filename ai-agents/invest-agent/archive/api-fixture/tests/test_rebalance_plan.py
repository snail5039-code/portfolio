from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/rebalance-plan")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_all_three_strategies_have_proposals() -> None:
    data = get_payload()["data"]
    assert set(data["proposalsByStrategy"]) == {"conservative", "balanced", "aggressive"}
    for proposals in data["proposalsByStrategy"].values():
        assert len(proposals) >= 1


def test_proposal_delta_matches_target_minus_current_weight() -> None:
    data = get_payload()["data"]
    allocations = {a["key"]: a["weight"] for a in data["currentAllocations"]}

    for strategy_key, proposals in data["proposalsByStrategy"].items():
        targets = data["strategies"][strategy_key]["targets"]
        for proposal in proposals:
            expected_delta = round(targets[proposal["key"]] - allocations[proposal["key"]], 1)
            assert abs(proposal["delta"] - expected_delta) < 0.01, (strategy_key, proposal["key"])
            assert proposal["direction"] == ("비중 확대" if expected_delta > 0 else "비중 축소")


def test_small_deltas_are_excluded_from_proposals() -> None:
    # Any proposal that appears must represent a real, visible change.
    data = get_payload()["data"]
    for proposals in data["proposalsByStrategy"].values():
        for proposal in proposals:
            assert abs(proposal["delta"]) >= 0.1
