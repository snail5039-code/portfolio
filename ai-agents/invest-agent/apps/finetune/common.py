"""학습·평가·서빙이 같이 쓰는 것: 라벨, 프롬프트, 라벨 점수 매기기.

라벨과 설명은 apps/api/app/signals.py의 SIGNALS·PRIORITY와 같아야 한다.
모델은 라벨 이름을 글로 답한다. 답을 자유롭게 생성하지 않고, 라벨 6개 각각이 나올 확률을 비교해 가장 높은 것을 고른다
(엉뚱한 답이 나올 수 없다).
"""

import json
import os
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
# 원본 모델은 BASE_MODEL 환경변수로 바꾼다 (예: Qwen/Qwen2.5-1.5B-Instruct). 어댑터는 모델마다 따로 저장
BASE_MODEL = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")  # 0.5B보다 test +5%p, hard +23%p
ADAPTER = ROOT / "out" / BASE_MODEL.split("/")[-1]

LABELS = {
    "none": "위험 신호 없음. 평범한 질문·분석 요청·주문, 투자와 상관없는 말",
    "living_money": "생활비나 곧 써야 할 돈(월세, 등록금, 보증금, 결혼·출산 자금 등)으로 투자하려 함",
    "borrowed_money": "대출·신용·마이너스통장·카드론·남에게 빌린 돈으로 투자하려 함",
    "chasing": "급등주나 남이 추천한 종목을 놓칠까 봐 급하게 따라 사려 함",
    "panic_sell": "떨어져서 무섭거나 견디기 힘들어 한꺼번에 팔아 버리려 함",
    "all_in": "전 재산이나 대부분을 한 종목에 몰거나, 손실 가능성을 무시하고 확신함",
}
PRIORITY = ["borrowed_money", "living_money", "panic_sell", "all_in", "chasing"]
SYSTEM = ("주식 앱 사용자 문장 하나에서 투자 위험 신호를 골라 라벨 이름만 답한다. "
          f"여럿이면 이 순서로 앞의 것: {' > '.join(PRIORITY)}.\n"
          + "\n".join(f"- {k}: {v}" for k, v in LABELS.items()))


def read(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def prompt_ids(tok, text: str) -> list[int]:
    messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}]
    return tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=True)["input_ids"]


def answer_ids(tok, label: str) -> list[int]:
    return tok(label + "<|im_end|>", add_special_tokens=False)["input_ids"]


@torch.no_grad()
def classify(model, tok, texts: list[str], batch: int = 16) -> list[str]:
    """문장마다 라벨 6개의 로그 확률 합을 구해 가장 큰 라벨을 고른다."""
    labels = list(LABELS)
    answers = [answer_ids(tok, label) for label in labels]
    preds = []
    for start in range(0, len(texts), batch):
        seqs, spans = [], []
        for text in texts[start:start + batch]:
            p = prompt_ids(tok, text)
            for a in answers:
                seqs.append(p + a)
                spans.append((len(p), len(a)))
        # 왼쪽을 채워서 모든 답이 오른쪽 끝에 오게 한다. 그래야 끝의 몇 칸만 어휘 확률을 계산한다 (전체는 GPU 메모리 부족)
        width = max(map(len, seqs))
        keep = max(a for _, a in spans) + 1
        ids = torch.full((len(seqs), width), tok.pad_token_id)
        mask = torch.zeros_like(ids)
        for i, s in enumerate(seqs):
            ids[i, width - len(s):] = torch.tensor(s)
            mask[i, width - len(s):] = 1
        positions = (mask.cumsum(-1) - 1).clamp(min=0)
        logits = model(input_ids=ids.to(model.device), attention_mask=mask.to(model.device),
                       position_ids=positions.to(model.device), logits_to_keep=keep).logits.float()
        logp = torch.log_softmax(logits, -1)  # 칸 j는 width-keep+j 위치의 출력, 그다음 토큰을 맞힌다
        scores = []
        for i, (_, a_len) in enumerate(spans):
            targets = ids[i, width - a_len:].to(model.device)
            scores.append(logp[i, keep - 1 - a_len:keep - 1].gather(1, targets[:, None]).sum().item())
        for j in range(0, len(scores), len(labels)):
            chunk = scores[j:j + len(labels)]
            preds.append(labels[chunk.index(max(chunk))])
    return preds


def load(adapter: bool):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, dtype=torch.bfloat16).to("cuda")
    if adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, ADAPTER)
    return model.eval(), tok
