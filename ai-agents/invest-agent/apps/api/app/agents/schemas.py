"""투자 AI 제안서와 검증 AI 판정 형식 (docs/plan/05-schemas.md).

AI는 이 칸만 채운다. 종목·수량·기준 시각·출처 정보·지표 값은 코드가 채운다.
"""

from typing import Literal

from pydantic import BaseModel, Field

Action = Literal["buy", "sell", "hold", "watch"]
Verdict = Literal["approve", "conditional", "reject", "user_judgement"]


class Claim(BaseModel):
    text: str = Field(description="근거 한 문장")
    type: Literal["fact", "calc", "inference", "opinion"] = Field(
        description="fact 사실 / calc 계산 / inference 추론 / opinion 의견"
    )
    source_ids: list[str] = Field(default_factory=list, description="근거 출처 ID. 사실·계산은 반드시 1개 이상")
    metric_ids: list[str] = Field(default_factory=list, description="쓴 지표 ID. 계산은 반드시 1개 이상")


class ProposalDraft(BaseModel):
    """투자 AI가 쓰는 부분."""

    action: Action = Field(description="허용 행동 중 하나")
    claims: list[Claim] = Field(min_length=1, max_length=8)
    counter_arguments: list[str] = Field(description="반대 근거")
    risks: list[str] = Field(description="주요 위험. 손실 가능성, 수수료·세금도 본다")
    invalid_if: list[str] = Field(description="이 판단이 틀린 것이 되는 조건")
    sell_portion: Literal["all", "half"] | None = Field(
        default=None, description="매도 검토일 때만: all 전부 / half 절반 (일부만 덜어 위험을 줄일 때). 다른 행동이면 null")
    buy_portion: Literal["all", "half"] | None = Field(
        default=None, description="매수 검토일 때만: all 정한 몫 전부 / half 절반만 먼저 (추세는 좋지만 변동성·실적 위험도 클 때 나눠 사기). 다른 행동이면 null")


class Check(BaseModel):
    target: str = Field(description="확인한 것. 예: claim:0, freshness, risk_fit, counter_arguments")
    result: Literal["pass", "warn", "fail"]
    detail: str = Field(description="무엇을 어떻게 확인했는지")
    source_ids: list[str] = Field(default_factory=list)


class VerificationDraft(BaseModel):
    """검증 AI가 쓰는 부분."""

    verdict: Verdict = Field(description="approve 승인 / conditional 조건부 승인 / reject 반려 / user_judgement 사용자 판단 필요")
    checks: list[Check]
    challenges: list[str] = Field(default_factory=list, description="반려일 때 투자 AI에게 보낼 반박·질문")
    conditions: list[str] = Field(default_factory=list, description="조건부 승인의 조건")
    risk_fit: Literal["ok", "warn", "mismatch"] = Field(description="사용자 성향과 맞는지")
    disagreements: list[str] = Field(default_factory=list, description="투자 AI와 의견이 다른 점 (사용자에게 보여줌)")
    summary: str = Field(description="한 줄 요약")


# ---------- 장 마감 회고 · 내일 계획 (12-todo-by-stage.md 2-4b). 주문은 만들지 않는다 ----------

class TomorrowItem(BaseModel):
    stock_code: str = Field(description="[종목]에 있는 종목 코드")
    action: Literal["watch", "buy", "sell"] = Field(description="watch 관찰 / buy 매수 검토 / sell 매도 검토. 그 종목의 허용 행동 중 하나")
    reasons: list[Claim] = Field(min_length=1, max_length=3)
    invalid_if: list[str] = Field(description="이 판단이 틀린 것이 되는 조건")


class ReviewDraft(BaseModel):
    """투자 AI가 쓰는 장 마감 회고."""

    retrospective: list[Claim] = Field(min_length=1, max_length=6, description="오늘 회고: 산 이유가 맞았는지, 규칙, 분산, 비용")
    tomorrow: list[TomorrowItem] = Field(max_length=8, description="내일 볼 것. 보유·관심 종목마다 하나")
    risks: list[str] = Field(description="손실 가능성, 수수료·세금")
