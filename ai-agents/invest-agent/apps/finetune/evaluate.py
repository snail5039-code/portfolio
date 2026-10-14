"""시험 세트로 네 방법을 비교해 docs/reports/signal-finetune-YYYYMMDD.md를 쓴다.

  uv run python evaluate.py

  키워드 규칙·Gemini 프롬프트: apps/api에서 먼저 만든 data/preds_*.jsonl (python -m app.signal_data baseline)
  학습 전 모델·학습 후 모델: 여기서 바로 분류한다
시험 세트 두 가지
  test  학습에 안 쓴 말투 2개로 Gemini가 만든 문장 (라벨은 다시 확인함)
  hard  Claude가 직접 쓴 헷갈리는 문장 (위험 단어가 있지만 신호가 아닌 문장, 단어 없이 돌려 말한 문장)
"""

import time
from datetime import date

import torch

from common import BASE_MODEL, DATA, LABELS, ROOT, classify, load, read

SIZE = BASE_MODEL.split("-")[-2]  # 0.5B, 1.5B
REPORT = ROOT.parents[1] / "docs" / "reports" / f"signal-finetune-{SIZE}-{date.today():%Y%m%d}.md"
METHODS = ["키워드 규칙", "Gemini 프롬프트", "학습 전 모델", "학습 후 모델(LoRA)"]


def metrics(gold: list[str], pred: list[str]) -> dict:
    n = len(gold)
    risky = [i for i, g in enumerate(gold) if g != "none"]
    safe = [i for i, g in enumerate(gold) if g == "none"]
    f1s = []
    for label in LABELS:
        tp = sum(1 for g, p in zip(gold, pred) if g == p == label)
        fp = sum(1 for g, p in zip(gold, pred) if p == label != g)
        fn = sum(1 for g, p in zip(gold, pred) if g == label != p)
        f1s.append(2 * tp / (2 * tp + fp + fn) if tp else 0.0)
    return {
        "acc": sum(g == p for g, p in zip(gold, pred)) / n,
        "macro_f1": sum(f1s) / len(f1s),
        "missed": sum(pred[i] == "none" for i in risky) / len(risky),       # 위험 신호를 '없음'으로 놓침
        "false_alarm": sum(pred[i] != "none" for i in safe) / len(safe),    # 신호 없는 문장에 경고
    }


def timed_classify(model, tok, texts):
    torch.cuda.synchronize()
    start = time.perf_counter()
    preds = classify(model, tok, texts)
    torch.cuda.synchronize()
    return preds, (time.perf_counter() - start) * 1000 / len(texts)


def main() -> None:
    sets = {name: read(DATA / f"{name}.jsonl") for name in ("test", "hard")}
    preds, ms = {}, {}
    for name, rows in sets.items():
        preds[name, "키워드 규칙"] = [r["pred"] for r in read(DATA / f"preds_keyword_{name}.jsonl")]
        gemini = read(DATA / f"preds_gemini_{name}.jsonl")
        preds[name, "Gemini 프롬프트"] = [r["pred"] for r in gemini]
        ms[name, "Gemini 프롬프트"] = sum(r["ms"] for r in gemini) / len(gemini)
        ms[name, "키워드 규칙"] = 0
    for method, adapter in (("학습 전 모델", False), ("학습 후 모델(LoRA)", True)):
        model, tok = load(adapter)
        for name, rows in sets.items():
            preds[name, method], ms[name, method] = timed_classify(model, tok, [r["text"] for r in rows])
        del model
        torch.cuda.empty_cache()

    lines = [f"# 대화 속 성향 신호 감지: 파인튜닝 평가 ({date.today()})", "",
             "사용자 문장 하나에서 투자 위험 신호 6가지(없음 포함)를 고르는 일을 네 방법으로 비교했다. "
             "**데이터는 모두 가상 문장이다. 실제 사용자 문장에서의 정확도는 미확인이다.**", "",
             f"- 학습: Gemini가 만든 가상 문장 {len(read(DATA / 'train.jsonl'))}개 (말투 8가지), 검증 {len(read(DATA / 'val.jsonl'))}개",
             f"- 시험 test: 학습에 안 쓴 말투 2가지로 만든 {len(sets['test'])}개. 생성 의도와 다시 확인한 라벨이 다른 문장은 Claude가 직접 정했다",
             f"- 시험 hard: Claude가 직접 쓴 헷갈리는 문장 {len(sets['hard'])}개",
             f"- 학습 모델: {BASE_MODEL} + LoRA (r=16, 3에폭, RTX 5060 Ti). 라벨 6개의 확률을 비교해 하나를 고른다",
             "- 놓침: 실제 위험 신호를 '없음'으로 본 비율 (낮을수록 좋다, 이 앱에서 가장 중요). 오경보: 신호 없는 문장에 경고한 비율", ""]
    for name in sets:
        gold = [r["label"] for r in sets[name]]
        lines += [f"## {name} ({len(gold)}개)", "",
                  "| 방법 | 정확도 | 매크로 F1 | 놓침 | 오경보 | 문장당 시간 |", "|---|---|---|---|---|---|"]
        for method in METHODS:
            m = metrics(gold, preds[name, method])
            lines.append(f"| {method} | {m['acc']:.1%} | {m['macro_f1']:.3f} | {m['missed']:.1%} | {m['false_alarm']:.1%} | {ms[name, method]:.0f}ms |")
        lines.append("")
    gold = [r["label"] for r in sets["test"]]
    tuned = preds["test", "학습 후 모델(LoRA)"]
    lines += ["## 학습 후 모델 혼동표 (test, 행=정답, 열=예측)", "", "| | " + " | ".join(LABELS) + " |",
              "|---" * (len(LABELS) + 1) + "|"]
    for g in LABELS:
        lines.append(f"| {g} | " + " | ".join(str(sum(1 for a, b in zip(gold, tuned) if a == g and b == p)) for p in LABELS) + " |")
    lines += ["", "## 학습 후 모델이 틀린 hard 문장", ""]
    for r, p in zip(sets["hard"], preds["hard", "학습 후 모델(LoRA)"]):
        if p != r["label"]:
            lines.append(f"- \"{r['text']}\" → 정답 {r['label']}, 예측 {p}")
    lines += ["", "## 읽는 법과 한계", "",
              "- 학습 데이터와 test 라벨을 모두 Gemini가 만들거나 확인했다. 그래서 Gemini 프롬프트 결과는 유리하게, 학습 모델은 'Gemini를 얼마나 따라 했는지'로 나올 수 있다. "
              "hard 세트(Claude 작성)가 이 치우침을 조금 덜어 준다",
              "- 시간은 이 PC 기준이다. Gemini는 네트워크 왕복이 포함된 값이고, 학습 모델은 GPU에서 16문장씩 묶어 잰 평균이다",
              "- 앱에서는 조심하는 쪽으로만 쓴다: 매수 신호면 처리안에 경고를 더하고 한 번 더 확인받는다. 성향 단계·한도는 바꾸지 않는다",
              "- 실제 사용자 문장이 쌓이면 (동의를 받고, 익명화해서) 다시 학습·평가해야 한다"]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
