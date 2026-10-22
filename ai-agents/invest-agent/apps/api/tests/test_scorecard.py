from app import scorecard


def test_score_counts_missed_and_avoided() -> None:
    decisions = [{"stock_code": "006400", "stock_name": "삼성SDI", "action": "watch"},
                 {"stock_code": "000720", "stock_name": "현대건설", "action": "watch"},
                 {"stock_code": "111111", "stock_name": "하락주", "action": "watch"},
                 {"stock_code": "222222", "stock_name": "매수주", "action": "buy"},
                 {"stock_code": "333333", "stock_name": "종가없음", "action": "watch"}]
    result = scorecard.score(decisions, {"006400": 5.0, "000720": 0.31, "111111": -3.0, "222222": 1.0})
    assert result["missed"] == ["삼성SDI"] and result["avoided"] == ["하락주"]
    assert (result["watch_avg"], result["buy_avg"]) == (0.77, 1.0)
    assert result["rows"][-1]["change_pct"] is None


def test_sell_score_compares_sold_price_with_close() -> None:
    """10/19처럼 판 뒤 종가가 더 높으면 +, 들고 있었으면 더 받았을 금액을 더한다 (세금·수수료 전)"""
    sells = [{"stock_code": "272210", "stock_name": "한화시스템", "qty": 22, "price": 74_000},
             {"stock_code": "357780", "stock_name": "솔브레인", "qty": 4, "price": 323_500},
             {"stock_code": "999999", "stock_name": "종가없음", "qty": 1, "price": 1_000}]
    result = scorecard.sell_score(sells, {"272210": 81_500, "357780": 300_000})
    assert [r["after_pct"] for r in result["rows"]] == [10.14, -7.26, None]
    assert result["missed_krw"] == 22 * 7_500 - 4 * 23_500
    assert (result["higher"], result["known"]) == (1, 2)
    assert scorecard.sell_score([], {})["missed_krw"] is None
