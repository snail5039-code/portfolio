"""평가 스크립트의 채점·오류 주입 도우미 (실제 Gemini 없이)."""

from app.evaluate import flip, inflate, same


def test_inflate_changes_only_amounts_and_rates() -> None:
    assert inflate("3단계 사용자, 2026년 변동성 84.57%") == "3단계 사용자, 2026년 변동성 254%"
    assert inflate("종가 1,000원") == "종가 3,000원" and inflate("3단계 2026년") is None


def test_same_ignores_spacing_case_only_for_names() -> None:
    assert same("stock_name", "SK 하이닉스", "sk하이닉스") and not same("qty", 4, 5)
    assert same("qty", None, None) and not same("limit_price", None, 0)


def test_flip_swaps_direction() -> None:
    assert flip("매출이 증가했다") == "매출이 감소했다" and flip("변동 없음") is None
