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
