import pytest

from app.functions.suitability import allowed_actions, buy_block_reason, stock_risk_grade


def test_general_mode_only_watches() -> None:
    assert allowed_actions("general", None, [], 2, holds_stock=True) == ["watch"]


@pytest.mark.parametrize("level, can_buy", [(1, False), (2, False), (3, True), (4, True), (5, True)])
def test_grade_2_stock_buy_from_level_3(level: int, can_buy: bool) -> None:
    assert ("buy" in allowed_actions("custom", level, [], 2, holds_stock=False)) is can_buy


@pytest.mark.parametrize("level, can_buy", [(4, False), (5, True)])
def test_grade_1_stock_buy_only_level_5(level: int, can_buy: bool) -> None:
    assert ("buy" in allowed_actions("custom", level, [], 1, holds_stock=False)) is can_buy


def test_no_buy_flag_blocks_buy_even_for_aggressive() -> None:
    assert "buy" not in allowed_actions("custom", 5, ["no_buy_proposals"], 2, holds_stock=False)


def test_sell_and_hold_only_when_holding() -> None:
    assert set(allowed_actions("custom", 1, [], 2, holds_stock=True)) == {"hold", "sell"}  # 보유 종목에 모호한 관찰은 없다
    assert allowed_actions("custom", 1, [], 2, holds_stock=False) == ["watch"]


def test_domestic_stock_is_grade_2(migrated) -> None:
    from psycopg.rows import dict_row
    from app.db import connect
    with connect(migrated, row_factory=dict_row) as conn:  # 위험 공시가 없거나 모르는 종목은 원칙대로 2등급 (1등급은 test_collect)
        assert stock_risk_grade(conn, "000000") == 2


@pytest.mark.parametrize(
    "level, rank, can_buy",
    [(3, 10 / 30, True), (3, 11 / 30, False), (4, 0.8, True), (4, 25 / 30, False), (5, 1.0, True), (3, None, True)],
)
def test_volatility_rank_limit_for_buy(level: int, rank: float | None, can_buy: bool) -> None:
    assert ("buy" in allowed_actions("custom", level, [], 2, holds_stock=False, volatility_rank=rank)) is can_buy


def test_block_reason_explains_volatility_rank() -> None:
    reason = buy_block_reason("custom", 3, [], 2, 0.9)
    assert reason == "60일 변동성이 분석 대상 중 높은 편이라 (낮은 쪽부터 90% 위치) 위험중립형 기준(낮은 쪽 33% 이내)을 넘음"
    assert buy_block_reason("custom", 5, [], 2, 1.0) is None
