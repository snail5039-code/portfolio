from decimal import Decimal

import pytest

from app.functions.profile import DEFAULT_POLICIES, QuizAnswers, assess, lowered_policy, policy_warnings
from tests.conftest import LEVEL_4_QUIZ

THIS_YEAR = 2026


def quiz(**changes) -> QuizAnswers:
    return QuizAnswers(**{**LEVEL_4_QUIZ, **changes})


def level(**changes) -> int:
    return assess(quiz(**changes), THIS_YEAR).risk_level


@pytest.mark.parametrize(
    "drop_reaction, portfolio_choice, expected",
    [
        ("sell_some", "A", 1),  # 3점
        ("sell_some", "B", 2),  # 4점
        ("sell_some", "C", 3),  # 5점
        ("wait", "C", 4),       # 6점
        ("wait", "D", 5),       # 7점
        ("buy_more", "D", 5),   # 8점
    ],
)
def test_level_by_situation_points(drop_reaction: str, portfolio_choice: str, expected: int) -> None:
    assert level(drop_reaction=drop_reaction, portfolio_choice=portfolio_choice) == expected


def test_sell_all_caps_at_level_2() -> None:
    assert level(drop_reaction="sell_all", portfolio_choice="D") == 2


@pytest.mark.parametrize(
    "changes, expected",
    [
        ({"money_use": "within_3y"}, 2),
        ({"money_use": "living"}, 1),
        ({"money_use": "borrowed"}, 1),
        ({"emergency": "no_fund_no_debt"}, 3),
        ({"emergency": "high_interest_debt"}, 2),
    ],
)
def test_money_situation_caps_level(changes: dict, expected: int) -> None:
    # 상황 점수는 8점(5단계)이어도 투자 체력 상한을 넘지 못한다
    assert level(drop_reaction="buy_more", portfolio_choice="D", **changes) == expected


@pytest.mark.parametrize("wrong", [{"quiz_diversify": "one_stock"}, {"quiz_trading_cost": "same"}])
def test_wrong_quiz_lowers_one_level(wrong: dict) -> None:
    result = assess(quiz(**wrong), THIS_YEAR)
    assert result.risk_level == 3
    assert "quiz_missed" in result.flags
    assert any(not item["correct"] for item in result.quiz_feedback)


def test_wrong_quiz_never_goes_below_level_1() -> None:
    both_wrong = {"quiz_diversify": "one_stock", "quiz_trading_cost": "frequent_earns_more"}
    assert level(money_use="borrowed", **both_wrong) == 1


def test_hot_tip_is_flag_not_score() -> None:
    result = assess(quiz(hot_tip="buy_big"), THIS_YEAR)
    assert result.risk_level == 4
    assert "chases_hot_stocks" in result.flags


def test_flags_for_money_situation_and_senior() -> None:
    result = assess(quiz(birth_year=1956, money_use="living", emergency="high_interest_debt"), THIS_YEAR)
    assert {"vulnerable", "no_buy_proposals", "high_interest_debt"} <= set(result.flags)
    assert "vulnerable" not in assess(quiz(birth_year=1962), THIS_YEAR).flags  # 64세


@pytest.mark.parametrize(
    "changes",
    [{"birth_year": 2008}, {"birth_year": 2007}, {"birth_year": 2030}, {"birth_year": 1800}],
)
def test_minors_and_impossible_years_rejected(changes: dict) -> None:
    # 2007년생은 올해 19세가 되지만 만 19세 확인이 없으면 거부
    with pytest.raises(ValueError):
        assess(quiz(**changes), THIS_YEAR)


def test_turning_19_this_year_needs_adult_confirmation() -> None:
    assert assess(quiz(birth_year=2007, adult_confirmed=True), THIS_YEAR).risk_level == 4


def test_contradicting_answers_are_noticed() -> None:
    assert assess(quiz(), THIS_YEAR).notices == []
    assert len(assess(quiz(money_use="borrowed", portfolio_choice="D"), THIS_YEAR).notices) == 1
    assert len(assess(quiz(drop_reaction="buy_more", portfolio_choice="A"), THIS_YEAR).notices) == 1
    assert len(assess(quiz(drop_reaction="sell_all", portfolio_choice="D"), THIS_YEAR).notices) == 1


def test_lowered_policy_only_goes_down() -> None:
    current = {"max_order_krw": 100_000, "max_daily_krw": 5_000_000, "max_weight_pct": Decimal("50")}
    # 3단계 기본값: 100만 / 200만 / 30%
    assert lowered_policy(current, 3) == {
        "max_order_krw": 100_000,  # 사용자가 낮춰 둔 값은 그대로
        "max_daily_krw": 2_000_000,
        "max_weight_pct": Decimal("30"),
    }


def test_policy_warnings_only_for_limits_above_default() -> None:
    assert policy_warnings(DEFAULT_POLICIES[1], 1) == []
    above = {**DEFAULT_POLICIES[1], "max_order_krw": 300_001, "max_weight_pct": Decimal("20.01")}
    assert len(policy_warnings(above, 1)) == 2
