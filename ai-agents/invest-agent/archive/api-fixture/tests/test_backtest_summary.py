from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/backtest-summary")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_all_nine_strategy_period_combinations_present() -> None:
    data = get_payload()["data"]
    for strategy in ("conservative", "balanced", "aggressive"):
        for period in ("3m", "6m", "1y"):
            assert period in data["metrics"][strategy]
            assert period in data["rows"][strategy]
            assert len(data["rows"][strategy][period]) >= 3


def test_excess_equals_portfolio_minus_benchmark() -> None:
    data = get_payload()["data"]
    for strategy_rows in data["rows"].values():
        for rows in strategy_rows.values():
            for row in rows:
                assert abs(row["excess"] - (row["portfolio"] - row["benchmark"])) < 0.01
                expected_state = "초과" if row["portfolio"] >= row["benchmark"] else "미달"
                assert row["state"] == expected_state


def test_win_rate_never_drops_below_floor() -> None:
    data = get_payload()["data"]
    for strategy_metrics in data["metrics"].values():
        for metrics in strategy_metrics.values():
            assert metrics["win"] >= 40
