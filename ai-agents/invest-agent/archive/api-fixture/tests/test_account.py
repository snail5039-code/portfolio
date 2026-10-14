from fastapi.testclient import TestClient

from app.main import create_app


def get_data() -> dict:
    client = TestClient(create_app())
    response = client.get("/api/account")
    assert response.status_code == 200
    return response.json()


def test_account_envelope_carries_safety_flags() -> None:
    payload = get_data()

    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0
    assert "실제 계좌" in payload["disclaimer"]


def test_account_is_labelled_as_a_simulation() -> None:
    data = get_data()["data"]

    assert data["accountLabel"] == "시뮬레이션 계좌"
    assert "실제 계좌 아님" in data["accountKind"]
    assert "실제 증권사 계좌" in data["safetyCopy"]


def test_account_money_fields_are_integers() -> None:
    data = get_data()["data"]

    assert data["currency"] == "KRW"
    for field, value in data["summary"].items():
        if field == "lastVerifiedAt":
            continue
        assert isinstance(value, int), field


def test_invested_plus_cash_equals_total_asset() -> None:
    summary = get_data()["data"]["summary"]

    assert summary["investedAmount"] + summary["cashAmount"] == summary["totalAsset"]


def test_realized_plus_unrealized_equals_accumulated_profit() -> None:
    summary = get_data()["data"]["summary"]

    accumulated = summary["totalAsset"] - summary["principal"]
    assert summary["realizedProfit"] + summary["unrealizedProfit"] == accumulated


def test_net_cash_flow_equals_principal() -> None:
    summary = get_data()["data"]["summary"]

    assert summary["depositTotal"] - summary["withdrawalTotal"] == summary["principal"]


def test_cash_flow_rows_add_up_to_the_declared_totals() -> None:
    data = get_data()["data"]
    summary = data["summary"]

    deposits = sum(row["amount"] for row in data["cashFlows"] if row["kind"] == "입금")
    withdrawals = sum(row["amount"] for row in data["cashFlows"] if row["kind"] == "출금")

    assert deposits == summary["depositTotal"]
    assert withdrawals == summary["withdrawalTotal"]


def test_asset_classes_and_currencies_both_sum_to_total_asset() -> None:
    data = get_data()["data"]
    total = data["summary"]["totalAsset"]

    assert sum(row["value"] for row in data["assetClasses"]) == total
    assert sum(row["value"] for row in data["currencies"]) == total

    for row in data["assetClasses"] + data["currencies"]:
        implied = row["value"] / total * 100
        assert abs(implied - row["weight"]) < 0.01, row["label"]


def test_account_totals_match_the_dashboard_fixture() -> None:
    # The two screens describe the same simulation account, so they must not
    # disagree on the headline numbers.
    client = TestClient(create_app())
    dashboard = client.get("/api/dashboard").json()["data"]
    account = get_data()["data"]

    assert account["summary"]["totalAsset"] == dashboard["summary"]["totalAsset"]
    assert account["summary"]["principal"] == dashboard["summary"]["principal"]

    cash = next(h for h in dashboard["holdings"] if h["code"] == "KRW")
    assert account["summary"]["cashAmount"] == cash["value"]

    holdings_profit = sum(h["profit"] or 0 for h in dashboard["holdings"])
    assert account["summary"]["unrealizedProfit"] == holdings_profit


def test_period_return_rates_are_derivable() -> None:
    data = get_data()["data"]
    total = data["summary"]["totalAsset"]
    rows = {row["period"]: row for row in data["returns"]}

    # No cash flow inside these periods, so the base is the period's opening value.
    for period in ("오늘", "이번 달"):
        row = rows[period]
        opening = total - row["profit"]
        assert abs(row["profit"] / opening * 100 - row["profitRate"]) < 0.01, period

    # 올해 includes the 2026-03-12 deposit, which is not performance.
    year = rows["올해"]
    deposit = next(r["amount"] for r in data["cashFlows"] if r["id"] == "CF-004")
    opening = total - year["profit"] - deposit
    assert abs(year["profit"] / opening * 100 - year["profitRate"]) < 0.01
    # Removing the deposit's effect can only lower the return here.
    assert year["netInvestmentRate"] < year["profitRate"]

    # 전체 is measured against principal, which already excludes transfers.
    overall = rows["전체"]
    assert overall["profit"] == total - data["summary"]["principal"]
    assert abs(overall["profit"] / data["summary"]["principal"] * 100 - overall["profitRate"]) < 0.01
    assert overall["netInvestmentRate"] == overall["profitRate"]
