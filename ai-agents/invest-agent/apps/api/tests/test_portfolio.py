"""포트폴리오 점검·리밸런싱 제안 (5단계)."""

from decimal import Decimal

from app.functions.portfolio import analyze

SNAPSHOT = {"cash_krw": 100_000, "holdings": [
    {"stock_code": "A", "stock_name": "큰회사", "qty": 10, "avg_price": 100_000},   # 종가 100,000 → 100만
    {"stock_code": "B", "stock_name": "작은회사", "qty": 10, "avg_price": 10_000},  # 종가 8,000 → 8만, -20%
]}


def test_suggestions_overweight_loss_concentration_cash() -> None:
    result = analyze(SNAPSHOT, {"A": 100_000, "B": 8_000}, Decimal("40"), 4, {"B": "투자주의환기종목 지정"})
    assert result["total_krw"] == 1_180_000 and result["cash_pct"] == Decimal("8.5")
    kinds = [s["kind"] for s in result["suggestions"]]
    assert kinds == ["overweight", "risk_grade", "big_loss", "concentration", "few_holdings"]  # 4단계 현금 기준 5%는 넘는다
    over = result["suggestions"][0]["text"]
    assert "84.7%" in over and "6주 줄이면" in over  # 100만 - 118만×40% = 52.8만 → 10만 원짜리 6주
    assert result["holdings"][1]["gain_pct"] == Decimal("-20.0")


def test_low_cash_by_level_and_general_mode() -> None:
    result = analyze(SNAPSHOT, {"A": 100_000, "B": 8_000}, Decimal("100"), 2)
    assert "low_cash" in [s["kind"] for s in result["suggestions"]]  # 2단계 기준 20%보다 낮다
    no_price = analyze({"cash_krw": 0, "holdings": [SNAPSHOT["holdings"][0]]}, {}, Decimal("100"), 5, mode="general")
    assert no_price["holdings"][0]["priced"] is False and no_price["total_krw"] == 1_000_000  # 종가가 없으면 평균 매입가


def test_portfolio_endpoint_uses_latest_snapshot(client, user) -> None:
    from tests.test_chat import now_iso

    assert client.get("/api/portfolio/analysis", headers=user["headers"]).status_code == 404
    holdings = [{"stock_code": "005930", "stock_name": "삼성전자", "qty": 1, "avg_price": 70_000}]
    assert client.post("/api/snapshot", headers=user["headers"],
                       json={"cash_krw": 30_000, "holdings": holdings, "fetched_at": now_iso()}).status_code == 204
    result = client.get("/api/portfolio/analysis", headers=user["headers"]).json()
    assert result["total_krw"] >= 100_000 and result["holdings"][0]["stock_code"] == "005930"
