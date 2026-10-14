"""대화 속 성향 신호 (5-4). 사용자 문장 하나에서 퀴즈가 못 보는 위험 신호를 찾는다.

퀴즈 점수(functions/profile.py)와 매매 기록(functions/behavior.py)은 규칙이라 "월세 돈인데 넣어볼래" 같은 말은 못 본다.
신호는 조심하는 쪽으로만 쓴다: 처리안에 경고를 더하고 한 번 더 확인받을 뿐, 성향 단계·한도는 바꾸지 않는다.

찾는 방법 세 가지를 같은 시험 세트로 비교한다 (apps/finetune, docs/reports/signal-finetune-*.md)
  keyword_signal  키워드 규칙 (비교 기준)
  gemini_signal   Gemini 프롬프트
  model_signal    로컬에서 LoRA로 학습한 작은 모델 (apps/finetune/serve.py). SIGNAL_MODEL_URL이 비어 있으면 쓰지 않는다
라벨은 apps/finetune/common.py의 LABELS와 같아야 한다.
"""

import re
from typing import Literal

import httpx
from pydantic import BaseModel, Field

from app import config

SIGNALS = {
    "none": "위험 신호 없음. 평범한 질문·분석 요청·주문, 투자와 상관없는 말",
    "living_money": "생활비나 곧 써야 할 돈(월세, 등록금, 보증금, 결혼·출산 자금 등)으로 투자하려 함",
    "borrowed_money": "대출·신용·마이너스통장·카드론·남에게 빌린 돈으로 투자하려 함",
    "chasing": "급등주나 남이 추천한 종목을 놓칠까 봐 급하게 따라 사려 함",
    "panic_sell": "떨어져서 무섭거나 견디기 힘들어 한꺼번에 팔아 버리려 함",
    "all_in": "전 재산이나 대부분을 한 종목에 몰거나, 손실 가능성을 무시하고 확신함",
}
Signal = Literal["none", "living_money", "borrowed_money", "chasing", "panic_sell", "all_in"]

# 처리안에 붙일 경고. 매수 신호는 한 번 더 확인받고, 공포 매도는 경고만 한다
WARNINGS = {
    "living_money": "대화에서 생활비·곧 쓸 돈으로 투자하려는 말이 보였어요. 주식은 원금 손실이 날 수 있어 곧 써야 할 돈은 넣지 않는 게 좋아요.",
    "borrowed_money": "대화에서 빌린 돈으로 투자하려는 말이 보였어요. 손실이 나도 이자와 원금은 갚아야 해서 손실이 커져요.",
    "chasing": "대화에서 급등주를 놓칠까 봐 서두르는 말이 보였어요. 급등 직후 매수는 고점에 살 위험이 있어요.",
    "all_in": "대화에서 한 종목에 몰거나 손실을 생각하지 않는 말이 보였어요. 한 종목 손실이 계좌 전체 손실이 될 수 있어요.",
    "panic_sell": "대화에서 무서워서 한꺼번에 팔려는 말이 보였어요. 처음 산 이유가 아직 맞는지 먼저 보고 나눠 파는 방법도 있어요.",
}
BUY_SIGNALS = {"living_money", "borrowed_money", "chasing", "all_in"}

# 키워드 규칙: 처음 떠올릴 법한 단어만. 학습 모델이 이것보다 나은지 보는 기준이다
KEYWORDS = [
    ("borrowed_money", r"대출|빚|신용|마통|마이너스\s*통장|카드론|빌린|빌려"),
    ("living_money", r"생활비|월세|등록금|보증금|전세금|결혼\s*자금|적금\s*깨"),
    ("panic_sell", r"무서|겁나|다\s*팔|전부\s*팔|손절|못\s*버티"),
    ("all_in", r"몰빵|전\s*재산|올인|풀매수|무조건"),
    ("chasing", r"급등|상한가|떡상|놓치|탑승|추천\s*받"),
]


def keyword_signal(text: str) -> str:
    return next((label for label, pattern in KEYWORDS if re.search(pattern, text)), "none")


class SignalAnswer(BaseModel):
    signal: Signal = Field(description="가장 맞는 신호 하나")


# 한 문장에 신호가 여럿이면 앞의 것 하나로 정한다 (돈의 출처가 가장 위험하다)
PRIORITY = ["borrowed_money", "living_money", "panic_sell", "all_in", "chasing"]

INSTRUCTIONS = ("주식 앱 사용자가 쓴 문장 하나에서 투자 위험 신호를 고른다. 문장에 실제로 드러난 것만 보고, 추측하지 않는다. "
                "단어만 보고 고르지 않는다 (예: '대출 금리 오르면 은행주 어때?'는 빌린 돈 투자가 아니라 none). "
                f"신호가 여럿이면 이 순서로 앞의 것 하나: {' > '.join(PRIORITY)}. "
                "퇴직금·공제 해지금처럼 자기 돈이면 빌린 돈이 아니다.\n"
                + "\n".join(f"- {key}: {text}" for key, text in SIGNALS.items()))


def gemini_signal(text: str) -> str:
    from app.agents.llm import ask  # 서버가 Gemini 없이도 뜨게, 쓸 때만 불러온다
    return ask(SignalAnswer, INSTRUCTIONS, text).signal


def model_signal(text: str) -> str | None:
    """학습한 로컬 모델. 꺼져 있거나 답이 없으면 None (신호를 못 본 것으로 두고 주문 흐름은 그대로 간다)."""
    if not config.SIGNAL_MODEL_URL:
        return None
    try:
        label = httpx.post(config.SIGNAL_MODEL_URL, json={"text": text}, timeout=5).json()["signal"]
    except (httpx.HTTPError, ValueError, KeyError):
        return None
    return label if label in SIGNALS else None


def signal_warning(signal: str | None, side: str) -> str | None:
    """매수 신호는 매수에만, 공포 매도는 매도에만 경고한다."""
    if signal in BUY_SIGNALS and side == "buy" or signal == "panic_sell" and side == "sell":
        return WARNINGS[signal]
    return None
