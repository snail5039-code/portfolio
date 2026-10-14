from fastapi.testclient import TestClient

from app.main import create_app


def get_payload() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/weekly-report")
    assert response.status_code == 200
    return response.json()


def test_envelope_carries_safety_flags() -> None:
    payload = get_payload()
    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0


def test_all_three_ranges_present() -> None:
    ranges = get_payload()["data"]["ranges"]
    assert set(ranges) == {"week", "month", "quarter"}


def test_every_detail_has_all_three_ranges_resolved() -> None:
    details = get_payload()["data"]["details"]
    assert len(details) == 15
    for detail in details.values():
        assert set(detail["summaryByRange"]) == {"week", "month", "quarter"}
        assert set(detail["factsByRange"]) == {"week", "month", "quarter"}
        for facts in detail["factsByRange"].values():
            assert len(facts) == 4


def test_return_detail_actually_varies_by_range() -> None:
    # A range-dependent detail must not collapse to one repeated string.
    summaries = get_payload()["data"]["details"]["return"]["summaryByRange"]
    assert len({summaries["week"], summaries["month"], summaries["quarter"]}) == 3


def test_static_detail_repeats_the_same_value_for_every_range() -> None:
    summaries = get_payload()["data"]["details"]["cash"]["summaryByRange"]
    assert len({summaries["week"], summaries["month"], summaries["quarter"]}) == 1
