"""멈춤(interrupt) 형식과 답 검사 (docs/plan/06-api-spec.md 3장).

서버 그래프가 멈추는 곳은 question / fetch / approval / execute 네 가지뿐이다.
멈춤에 대한 답은 그래프에 넣기 전에 chat 라우터가 여기 모델로 검사한다. 틀리면 그래프는 멈춘 채로 남는다.
모든 모델은 정해진 칸 외에는 받지 않는다 (extra="forbid"). 계좌번호 같은 칸이 섞여 오면 거부한다 (NFR-01).
"""

from datetime import datetime, timedelta
from typing import Annotated, Literal

from langgraph.types import interrupt
from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.clock import KST

MAX_KRW = 10**15
STOCK_CODE_PATTERN = r"^[0-9A-Z]{6}$"


def not_in_future(value: datetime) -> datetime:
    # 폰 시계가 조금 빠를 수 있어서 5분까지는 받는다
    if value > datetime.now(KST) + timedelta(minutes=5):
        raise ValueError("조회 시각이 미래예요")
    return value


FetchedAt = Annotated[AwareDatetime, AfterValidator(not_in_future)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Holding(Strict):
    stock_code: str = Field(pattern=STOCK_CODE_PATTERN)
    stock_name: str = Field(min_length=1, max_length=100)
    qty: int = Field(gt=0)
    avg_price: int = Field(ge=0, le=MAX_KRW)


class Balance(Strict):
    """폰이 증권사에서 조회한 계좌 요약. 계좌번호는 없다. POST /api/snapshot도 이 형식을 쓴다."""

    cash_krw: int = Field(ge=0, le=MAX_KRW)
    holdings: list[Holding] = Field(max_length=200)
    fetched_at: FetchedAt


class Intraday(Strict):
    """폰이 받은 오늘 장중 흐름: 전일 대비 %, VWAP, 1분봉 [체결시각 "HHmmss", 가격] (오래된 것부터)."""

    change_pct: float | None = Field(default=None, ge=-100, le=1000)
    vwap: int | None = Field(default=None, gt=0, le=MAX_KRW)  # 오늘 누적 거래대금 ÷ 누적 거래량
    bars: list[tuple[Annotated[str, Field(pattern=r"^\d{6}$")], Annotated[int, Field(gt=0, le=MAX_KRW)]]] = Field(max_length=120)


class Price(Strict):
    stock_code: str = Field(pattern=STOCK_CODE_PATTERN)
    price: int = Field(gt=0, le=MAX_KRW)
    as_of: FetchedAt
    intraday: Intraday | None = None


class MarketIndex(Strict):
    """폰이 증권사에서 받은 시장 지수. daily는 최근 거래일 [날짜 "YYYYMMDD", 종가] (최신부터)."""

    index: Literal["KOSPI", "KOSDAQ"]
    value: float = Field(gt=0, le=10**6)
    change_pct: float | None = Field(default=None, ge=-100, le=100)
    open: float | None = Field(default=None, ge=0, le=10**6)
    high: float | None = Field(default=None, ge=0, le=10**6)
    low: float | None = Field(default=None, ge=0, le=10**6)
    up: int | None = Field(default=None, ge=0, le=10**5)
    down: int | None = Field(default=None, ge=0, le=10**5)
    flat: int | None = Field(default=None, ge=0, le=10**5)
    daily: list[tuple[Annotated[str, Field(pattern=r"^\d{8}$")], Annotated[float, Field(gt=0, le=10**6)]]] = Field(default=[], max_length=40)
    as_of: FetchedAt


class FetchAnswer(Strict):
    """fetch 멈춤에 대한 폰의 답: 조회 결과 또는 실패 사유 중 하나."""

    balance: Balance | None = None
    prices: list[Price] | None = Field(default=None, max_length=20)
    market: list[MarketIndex] | None = Field(default=None, max_length=2)  # 시장 자료는 덤이라 결과 판정에 넣지 않는다
    error: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def check_result_or_error(self) -> "FetchAnswer":
        has_result = self.balance is not None or self.prices is not None
        if has_result == (self.error is not None):
            raise ValueError("조회 결과(balance, prices)나 실패 사유(error) 중 하나만 보내 주세요")
        return self


class QuestionAnswer(Strict):
    """question 멈춤에 대한 사용자의 답: 글로 답하거나 후보 중 하나를 고른다."""

    text: str | None = Field(default=None, min_length=1, max_length=200)
    choice_id: str | None = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def check_one_answer(self) -> "QuestionAnswer":
        if (self.text is None) == (self.choice_id is None):
            raise ValueError("text나 choice_id 중 하나만 보내 주세요")
        return self


class ApprovalAnswer(Strict):
    """approval 멈춤(처리안)에 대한 답: 승인 / 거절 / 수정("5주만")."""

    decision: Literal["approve", "reject", "edit"]
    text: str | None = Field(default=None, min_length=1, max_length=200)  # 수정 내용
    confirm_risk: bool = False  # 처리안에 "확인 필요"가 있으면 승인할 때 true여야 한다

    @model_validator(mode="after")
    def check_edit_text(self) -> "ApprovalAnswer":
        if self.decision == "edit" and not self.text:
            raise ValueError("수정하려면 text에 바꿀 내용을 적어 주세요")
        return self


class ExecutionResult(Strict):
    """폰이 증권사에 주문한 결과 (05-schemas.md 8장). 계좌번호·키는 없다."""

    idempotency_key: str = Field(max_length=100)
    status: Literal["accepted", "filled", "partially_filled", "failed", "price_changed", "unknown_checked"]
    broker_order_no: str | None = Field(default=None, max_length=50)
    filled_qty: int = Field(default=0, ge=0)
    filled_price: int | None = Field(default=None, gt=0, le=MAX_KRW)
    current_price: int | None = Field(default=None, gt=0, le=MAX_KRW)  # price_changed일 때 지금 가격
    message: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def check_status_fields(self) -> "ExecutionResult":
        if self.status == "price_changed" and self.current_price is None:
            raise ValueError("price_changed면 current_price가 필요해요")
        if self.status in ("filled", "partially_filled") and (self.filled_qty <= 0 or self.filled_price is None):
            raise ValueError("체결이면 filled_qty와 filled_price가 필요해요")
        return self


class ExecuteAnswer(Strict):
    result: ExecutionResult


ANSWER_MODELS: dict[str, type[Strict]] = {
    "question": QuestionAnswer, "fetch": FetchAnswer, "approval": ApprovalAnswer, "execute": ExecuteAnswer,
}
# 증권사 일(fetch·execute)은 키가 있는 앱만 답할 수 있다
APP_ONLY_KINDS = {"fetch", "execute"}


def pause(kind: str, **data) -> dict:
    """그래프를 멈추고 앱·웹의 답을 기다린다. 답은 chat 라우터가 이미 검사한 dict로 돌아온다.

    LangGraph는 이어서 진행할 때 이 노드를 처음부터 다시 실행하므로, 멈추기 전에는 LLM 호출 같은 일을 하지 않는다.
    """
    return interrupt({"kind": kind, **data})
