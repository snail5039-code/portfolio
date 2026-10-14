"""LoRA 학습. 원본 모델은 그대로 두고 작은 덧붙임 가중치(어댑터)만 학습해 out/adapter에 저장한다.

  uv run python train.py

손실은 답(라벨) 부분에서만 계산한다. 에폭마다 검증 세트 정확도를 보고 가장 좋은 어댑터를 남긴다.
"""

import random

import torch
from peft import LoraConfig, get_peft_model

from common import ADAPTER, DATA, answer_ids, classify, load, prompt_ids, read

EPOCHS = 3
BATCH = 16
LR = 2e-4
SEED = 7


def batches(tok, rows):
    """왼쪽을 채워 답을 오른쪽 끝에 모은다. 손실은 끝의 답 칸에서만 계산한다 (질문 부분은 -100으로 뺀다)."""
    random.shuffle(rows)
    for start in range(0, len(rows), BATCH):
        seqs = [(prompt_ids(tok, r["text"]), answer_ids(tok, r["label"])) for r in rows[start:start + BATCH]]
        width = max(len(p) + len(a) for p, a in seqs)
        keep = max(len(a) for _, a in seqs) + 1
        ids = torch.full((len(seqs), width), tok.pad_token_id)
        mask = torch.zeros_like(ids)
        targets = torch.full((len(seqs), keep), -100)  # 칸 j의 출력이 맞혀야 할 다음 토큰
        for i, (p, a) in enumerate(seqs):
            ids[i, width - len(p) - len(a):] = torch.tensor(p + a)
            mask[i, width - len(p) - len(a):] = 1
            targets[i, keep - 1 - len(a):keep - 1] = torch.tensor(a)
        positions = (mask.cumsum(-1) - 1).clamp(min=0)
        yield ids.cuda(), mask.cuda(), positions.cuda(), keep, targets.cuda()


def main() -> None:
    random.seed(SEED)
    torch.manual_seed(SEED)
    model, tok = load(adapter=False)
    model.gradient_checkpointing_enable()  # 중간 값을 저장하지 않고 다시 계산한다 (16GB GPU에 맞추려고)
    model.enable_input_require_grads()
    model = get_peft_model(model, LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",
                                             target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                                                             "gate_proj", "up_proj", "down_proj"]))
    model.print_trainable_parameters()
    train, val = read(DATA / "train.jsonl"), read(DATA / "val.jsonl")
    steps = EPOCHS * -(-len(train) // BATCH)
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=LR)
    scheduler = torch.optim.lr_scheduler.OneCycleLR(optimizer, max_lr=LR, total_steps=steps, pct_start=0.1)
    best = -1.0
    for epoch in range(1, EPOCHS + 1):
        model.train()
        total = 0.0
        for n, (ids, mask, positions, keep, targets) in enumerate(batches(tok, train), 1):
            logits = model(input_ids=ids, attention_mask=mask, position_ids=positions, logits_to_keep=keep).logits
            loss = torch.nn.functional.cross_entropy(logits.float().flatten(0, 1), targets.flatten(), ignore_index=-100)
            loss.backward()
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
            total += loss.item()
            if n % 10 == 0:
                print(f"  step {n} loss {total / n:.4f}", flush=True)
        model.eval()
        preds = classify(model, tok, [r["text"] for r in val])
        acc = sum(p == r["label"] for p, r in zip(preds, val)) / len(val)
        print(f"epoch {epoch} loss {total / n:.4f} val_acc {acc:.3f}")
        if acc > best:
            best = acc
            model.save_pretrained(ADAPTER)
    print(f"best val_acc {best:.3f} → {ADAPTER}")


if __name__ == "__main__":
    main()
