"""성향 신호 학습용 가상 문장 만들기와 Gemini·키워드 기준 평가 (5-4). 실제 사용자 기록이 아니다.

  uv run python -m app.signal_data generate   # Gemini로 문장 생성 → apps/finetune/data/{train,val,test}.jsonl (비용 발생)
  uv run python -m app.signal_data audit      # 라벨 다시 확인 (비용 발생)
  uv run python -m app.signal_data baseline   # 시험 세트를 키워드·Gemini로 분류 → apps/finetune/data/preds_*.jsonl (비용 발생)

학습과 시험이 같은 말투를 외우지 않게, 말투(STYLES)로 나눈다: 마지막 두 말투는 시험에만 쓴다.
"""

import json
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from pydantic import BaseModel

from app.agents.llm import LLMUnavailable, ask
from app.signals import INSTRUCTIONS, SIGNALS, SignalAnswer, gemini_signal, keyword_signal

DATA = Path(__file__).resolve().parents[2] / "finetune" / "data"
PER_CALL = 25
STYLES = [
    "20대 대학생, 반말, 짧게",
    "30대 직장인, 존댓말",
    "40대 자영업자, 말이 길고 사정 설명이 많음",
    "50대 회사원, 점잖은 말투",
    "주식 커뮤니티 말투, 은어(떡상·존버·물타기 등)",
    "오타·띄어쓰기 실수가 많은 급한 메시지",
    "종목명과 금액·주수를 구체적으로 말함",
    "AI에게 묻는 질문형",
    "60대 은퇴자, 조심스러운 말투",           # 여기부터 시험 전용
    "감정이 섞인 말투(불안·흥분·짜증)",
]
TEST_STYLES = STYLES[-2:]
VAL_SHARE = 0.1


class Batch(BaseModel):
    sentences: list[str]


def prompt(label: str, style: str) -> str:
    base = (f"한국 주식 앱의 AI 채팅창에 사용자가 보낼 법한 문장 {PER_CALL}개를 만든다. 말투: {style}. "
            "문장마다 상황·종목·표현을 다르게 하고, 한두 문장 길이로 쓴다. 실존 종목명을 써도 된다.\n")
    if label == "none":
        return base + ("투자 위험 신호가 없는 문장이다: 종목 분석 요청, 평범한 매수·매도 지시, 시장 질문, 앱 사용 질문, 잡담. "
                       "절반은 헷갈리게 위험 단어를 넣되 위험 행동은 아닌 문장으로 쓴다 "
                       "(예: '대출 금리 오르면 은행주 어때?', '왜 오늘 급등했어?', '손절 기준은 보통 어떻게 잡아?', '생활비 아끼는 법 말고 배당주 알려줘').")
    return base + (f"모든 문장에 이 신호가 드러나야 한다: {SIGNALS[label]}. "
                   "절반은 뻔한 단어(대출, 몰빵, 생활비 등) 없이 돌려서 말한다 "
                   "(예: '다음 달 방 빼야 하는데 그 돈 잠깐 굴려볼까', '친구한테 오백 꿔서 넣으려고').")


def generate() -> None:
    random.seed(7)
    jobs = [(label, style) for label in SIGNALS for style in STYLES]

    def run(job):
        label, style = job
        for attempt in range(3):
            try:
                return label, style, ask(Batch, "요청한 문장만 만든다.", prompt(label, style), thinking_level="low").sentences
            except LLMUnavailable as error:
                print(f"[재시도] {label}/{style}: {error}", file=sys.stderr)
                time.sleep(5 * (attempt + 1))
        return label, style, []

    with ThreadPoolExecutor(4) as pool:
        results = list(pool.map(run, jobs))
    seen, splits = set(), {"train": [], "val": [], "test": []}
    for label, style, sentences in results:
        for text in sentences:
            text = text.strip()
            if not text or text in seen:
                continue
            seen.add(text)
            split = "test" if style in TEST_STYLES else "val" if random.random() < VAL_SHARE else "train"
            splits[split].append({"text": text, "label": label, "style": style})
    DATA.mkdir(parents=True, exist_ok=True)
    for name, rows in splits.items():
        random.shuffle(rows)
        write(DATA / f"{name}.jsonl", rows)
        print(name, len(rows))


def audit() -> None:
    """생성할 때 노린 라벨을 Gemini(더 깊게 생각)가 다시 매긴다. 학습·검증 세트는 둘이 다르면 뺀다.
    시험 세트는 빼지 않고 다른 것만 audit_test.jsonl로 따로 모아 사람이(이번엔 Claude가) 직접 정한다"""
    for name in ("train", "val", "test"):
        rows = read(DATA / f"{name}.jsonl")

        def check(row):
            try:
                return ask(SignalAnswer, INSTRUCTIONS, row["text"], thinking_level="medium").signal
            except LLMUnavailable:
                return "error"

        with ThreadPoolExecutor(4) as pool:
            checked = list(pool.map(check, rows))
        same = [r for r, c in zip(rows, checked) if c == r["label"]]
        differ = [{**r, "audit": c} for r, c in zip(rows, checked) if c != r["label"]]
        if name == "test":
            write(DATA / "audit_test.jsonl", differ)
        else:
            write(DATA / f"{name}.jsonl", same)
        print(name, len(rows), "다름", len(differ))


def baseline() -> None:
    for name in ("test", "hard"):
        rows = read(DATA / f"{name}.jsonl")
        write(DATA / f"preds_keyword_{name}.jsonl", [{"text": r["text"], "pred": keyword_signal(r["text"])} for r in rows])

        def timed(row):
            start = time.perf_counter()
            try:
                pred = gemini_signal(row["text"])
            except LLMUnavailable:
                pred = "error"
            return {"text": row["text"], "pred": pred, "ms": round((time.perf_counter() - start) * 1000)}

        with ThreadPoolExecutor(4) as pool:
            write(DATA / f"preds_gemini_{name}.jsonl", list(pool.map(timed, rows)))
        print(name, len(rows))


def read(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write(path: Path, rows: list[dict]) -> None:
    path.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")


if __name__ == "__main__":
    {"generate": generate, "audit": audit, "baseline": baseline}[sys.argv[1]]()
