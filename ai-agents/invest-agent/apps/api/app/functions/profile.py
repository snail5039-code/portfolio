"""투자성향 퀴즈 점수 계산과 성향별 기본 투자 정책.

퀴즈 8문항, 계산 규칙, 조사 근거는 docs/plan/09-investor-profile.md에 있다. 규칙을 바꾸면 그 문서도 같이 고친다.
- A. 투자 체력(출생연도, 돈의 용도, 비상금·빚): 단계에 상한을 건다
- B. 상황 고르기(손실 반응, 상품 고르기): 단계를 정한다. 급등주 추천 문항은 점수에 넣지 않고 표시만 한다
- C. 지식 퀴즈 2개: 하나라도 틀리면 한 단계 내린다

이 앱 안에서 쓰는 참고용 진단이다. 공식 적합성 진단이 아니다.
성향은 맞지 않는 투자를 막는 데만 쓴다 (INVEST_AGENT_PLAN.md 6장).
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

LABELS = {
    1: "안정형",
    2: "안정추구형",
    3: "위험중립형",
    4: "적극투자형",
    5: "공격투자형",
}

# 성향 단계별 기본 한도 (사용자가 설정에서 바꿀 수 있는 시작값). 확정 2026-10-06.
# 계좌 크기에 비례한 한도(예: 계좌의 5~25%)는 5단계에서 검토한다 (docs/plan/09-investor-profile.md 6장)
# 퀴즈를 하지 않은 일반 모드도 1단계(안정형) 값을 쓴다.
DEFAULT_POLICIES = {
    1: {"max_order_krw": 300_000, "max_daily_krw": 500_000, "max_weight_pct": Decimal("20")},
    2: {"max_order_krw": 500_000, "max_daily_krw": 1_000_000, "max_weight_pct": Decimal("25")},
    3: {"max_order_krw": 1_000_000, "max_daily_krw": 2_000_000, "max_weight_pct": Decimal("30")},
    4: {"max_order_krw": 2_000_000, "max_daily_krw": 5_000_000, "max_weight_pct": Decimal("40")},
    5: {"max_order_krw": 3_000_000, "max_daily_krw": 10_000_000, "max_weight_pct": Decimal("50")},
}
GENERAL_MODE_LEVEL = 1

LIMIT_NAMES = {
    "max_order_krw": "1회 주문 한도",
    "max_daily_krw": "1일 주문 한도",
    "max_weight_pct": "한 종목 최대 비중",
}

ADULT_AGE = 19
SENIOR_AGE = 65


class QuizAnswers(BaseModel):
    """퀴즈 답. 보기는 영어 키로 받고, 화면 문구는 앱이 가진다."""

    # A. 투자 체력
    birth_year: int
    adult_confirmed: bool = False  # 올해 19세가 되는 사람만: "만 19세 이상입니다" 확인
    money_use: Literal["spare", "within_3y", "living", "borrowed"]
    emergency: Literal["fund", "no_fund_no_debt", "high_interest_debt"]
    # B. 상황 고르기
    drop_reaction: Literal["sell_all", "sell_some", "wait", "buy_more"]
    portfolio_choice: Literal["A", "B", "C", "D"]
    hot_tip: Literal["buy_big", "buy_small", "research", "skip"]
    # C. 지식 퀴즈
    quiz_diversify: Literal["one_stock", "ten_stocks"]
    quiz_trading_cost: Literal["frequent_earns_more", "same", "frequent_earns_less"]


# A. 상한 (5는 상한 없음)
MONEY_USE_CAP = {"spare": 5, "within_3y": 2, "living": 1, "borrowed": 1}
EMERGENCY_CAP = {"fund": 5, "no_fund_no_debt": 3, "high_interest_debt": 2}
SELL_ALL_CAP = 2  # 손실에 "전부 판다"면 최대 2단계

# B. 점수와 단계
DROP_REACTION_POINTS = {"sell_all": 1, "sell_some": 2, "wait": 3, "buy_more": 4}
# B2 보기는 기대 수익률 없이 "최악의 해" 손실만 실제 사례로 보여준다 (2008년 금융위기)
#   A 원금 보장(0%) / B 채권 위주(약 −7%, 채권혼합형 연금펀드 −6.60%)
#   C 주식 반·채권 반(약 −20%, 주식혼합형 −19.52%) / D 주식 100%(약 −40%, 코스피 1,897 → 1,124)
PORTFOLIO_POINTS = {"A": 1, "B": 2, "C": 3, "D": 4}
LEVEL_BY_POINTS = {2: 1, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5}

# C. 정답과 해설
QUIZ = {
    "quiz_diversify": (
        "ten_stocks",
        "여러 업종에 나눠 담으면 한 회사가 망해도 전체 손실은 그 비중만큼만 생겨요.",
    ),
    "quiz_trading_cost": (
        "frequent_earns_less",
        "사고팔 때마다 수수료와 세금이 나가서, 주가가 같아도 자주 거래할수록 덜 벌어요.",
    ),
}


@dataclass
class Assessment:
    risk_level: int
    flags: list[str]  # vulnerable / no_buy_proposals / high_interest_debt / chases_hot_stocks / quiz_missed
    notices: list[str]  # 서로 맞지 않는 답 안내
    quiz_feedback: list[dict]


def assess(answers: QuizAnswers, this_year: int) -> Assessment:
    """퀴즈 답 → 성향 단계와 표시 값. 19세 미만이면 ValueError."""
    age = this_year - answers.birth_year
    if not 0 <= age <= 120:
        raise ValueError("태어난 해를 다시 확인해 주세요")
    if age < ADULT_AGE or (age == ADULT_AGE and not answers.adult_confirmed):
        raise ValueError("만 19세 이상만 이용할 수 있어요")

    # B. 상황 고르기로 단계를 정한다
    points = DROP_REACTION_POINTS[answers.drop_reaction] + PORTFOLIO_POINTS[answers.portfolio_choice]
    level = LEVEL_BY_POINTS[points]

    # A. 투자 체력과 손실 반응으로 상한을 건다
    level = min(level, MONEY_USE_CAP[answers.money_use], EMERGENCY_CAP[answers.emergency])
    if answers.drop_reaction == "sell_all":
        level = min(level, SELL_ALL_CAP)

    # C. 지식 퀴즈: 하나라도 틀리면 한 단계 내린다 (최소 1단계)
    quiz_feedback = [
        {"question": name, "correct": getattr(answers, name) == correct, "explanation": explanation}
        for name, (correct, explanation) in QUIZ.items()
    ]
    missed_quiz = not all(item["correct"] for item in quiz_feedback)
    if missed_quiz:
        level = max(level - 1, 1)

    flags = [
        flag for flag, applies in [
            ("vulnerable", age >= SENIOR_AGE),
            ("no_buy_proposals", answers.money_use in ("living", "borrowed")),
            ("high_interest_debt", answers.emergency == "high_interest_debt"),
            ("chases_hot_stocks", answers.hot_tip in ("buy_big", "buy_small")),
            ("quiz_missed", missed_quiz),
        ] if applies
    ]
    return Assessment(level, flags, contradiction_notices(answers), quiz_feedback)


def contradiction_notices(answers: QuizAnswers) -> list[str]:
    """서로 맞지 않는 답. 계산은 이미 낮은 쪽을 쓰므로 막지 않고 다시 확인하라고만 알린다."""
    checks = [
        (answers.money_use in ("living", "borrowed") and answers.portfolio_choice == "D",
         "생활비나 빌린 돈이라고 했는데, 최악 약 −40%인 상품을 골랐어요."),
        (answers.drop_reaction == "buy_more" and answers.portfolio_choice == "A",
         "떨어지면 더 산다고 했는데, 손실이 없는 상품을 골랐어요."),
        (answers.drop_reaction == "sell_all" and answers.portfolio_choice == "D",
         "떨어지면 전부 판다고 했는데, 최악 약 −40%인 상품을 골랐어요."),
    ]
    return [message for applies, message in checks if applies]


def lowered_policy(current: dict, level: int) -> dict:
    """항목마다 지금 값과 그 단계 기본값 중 작은 쪽. 퀴즈를 다시 하거나 일반 모드로 돌아갈 때 쓴다."""
    return {key: min(current[key], default) for key, default in DEFAULT_POLICIES[level].items()}


def policy_warnings(policy: dict, level: int) -> list[str]:
    """성향 기본값보다 높게 잡은 한도마다 경고 문장 하나."""
    return [
        f"{LIMIT_NAMES[key]}: 성향({LABELS[level]}) 기본값보다 높아요"
        for key, default in DEFAULT_POLICIES[level].items()
        if policy[key] > default
    ]
