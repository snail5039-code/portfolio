"""RAGAS로 에이전트 실패 원인을 단계별로 나눈다 (검색 / 판단 / 답변)

에이전트를 다시 돌리지 않는다. evaluate_agent가 저장한 details.jsonl의 질문·답변·검색 기록에
청크 본문(chunks.jsonl)을 다시 붙여 RAGAS 입력을 만든다.

지표 (aim-ai-agent-my 10번 스크립트 ragas_eval.py와 같은 방식: InstructorLLM + 동시 실행 수 제한)
- context_recall   : 검색한 청크에 정답(target_answer) 내용이 들어 있었나   -> 낮으면 검색·청킹 문제
- context_precision: 쓸모 있는 청크가 앞 순위에 있었나                       -> 낮으면 잡음이 많음
- faithfulness     : 답변이 검색한 청크 내용에만 근거했나 (답한 문제만)        -> 낮으면 지어낸 답

대상: 답할 수 있는 문제 중 실패 전부 + 같은 수의 성공 문제 (비교용, seed 고정)
진단 (diagnose):
- 검색 실패      : context_recall < 0.5 -> 근거가 검색 결과에 없음
- 판단 실패(보류): 근거가 있는데 보류
- 지어냄         : 답했는데 faithfulness < 0.5
- 근거 읽기 실패 : 근거도 있고 근거대로 답했는데 틀림 (다른 숫자·일부만 답함 등)

실행
    python -m pipeline.evaluate_ragas                       # 기본: 500/60 1차 결과
    python -m pipeline.evaluate_ragas --run goldenset_200__base_300_50__gemini-3.5-flash-lite
    python -m pipeline.evaluate_ragas --limit 4             # 앞 4문제만 먼저 확인

결과: output/eval/ragas/<에이전트 결과 폴더>/details.jsonl, report.md
"""

import sys
from pathlib import Path

# pipeline 폴더 안에서 python 파일명.py 로 바로 실행해도 pipeline 패키지를 찾게 한다
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import asyncio
import json
import random
from collections import Counter

from dotenv import load_dotenv

from pipeline.evaluate_agent import EVAL_DIR as AGENT_DIR, JUDGE_MODEL, load_done
from pipeline.extract import BASE_DIR
from pipeline.retriever import load_chunk_rows

RAGAS_DIR = BASE_DIR / "output" / "eval" / "ragas"
DEFAULT_RUN = "goldenset_200__base_500_60__gemini-3.5-flash-lite"
METRICS = ["context_recall", "context_precision", "faithfulness"]


def build_metrics():
    """RAGAS 채점 LLM(에이전트 평가와 같은 JUDGE_MODEL)과 지표 3개"""
    import instructor
    from google import genai
    from ragas.llms import InstructorLLM
    from ragas.metrics.collections import ContextPrecisionWithReference, ContextRecall, Faithfulness

    client = instructor.from_genai(genai.Client(), use_async=True)
    llm = InstructorLLM(client=client, model=JUDGE_MODEL, provider="google")
    return {"context_recall": ContextRecall(llm=llm), "context_precision": ContextPrecisionWithReference(llm=llm),
            "faithfulness": Faithfulness(llm=llm)}


def searched_chunks(row):
    """에이전트가 본 청크 ID를 검색 순서대로 (중복 제거)"""
    seen = []
    for s in row["searches"]:
        seen += [cid for cid in s["chunk_ids"] if cid not in seen]
    return seen


def metric_inputs(name, row, contexts):
    if name == "faithfulness":
        return {"user_input": row["question"], "response": row["answer"], "retrieved_contexts": contexts}
    return {"user_input": row["question"], "reference": row["target_answer"], "retrieved_contexts": contexts}


async def score_all(metrics, rows, by_id, max_concurrency):
    """문제 × 지표를 동시에 채점 (Gemini 429를 피하려고 동시 실행 수를 묶는다)"""
    semaphore = asyncio.Semaphore(max_concurrency)

    async def score_one(row, name):
        # 보류한 문제는 답변이 없어서 faithfulness를 매기지 않는다
        if name == "faithfulness" and row["status"] != "answered":
            return row["qid"], name, None
        contexts = [by_id[cid]["text"] for cid in searched_chunks(row) if cid in by_id]
        async with semaphore:
            try:
                result = await metrics[name].ascore(**metric_inputs(name, row, contexts))
                return row["qid"], name, result.value
            except Exception as e:
                print(f"  [{name}] {row['qid']} 채점 실패: {type(e).__name__}: {str(e)[:100]}")
                return row["qid"], name, None

    tasks = [score_one(r, name) for r in rows for name in metrics]
    scores = {}
    for i, coro in enumerate(asyncio.as_completed(tasks), start=1):
        qid, name, value = await coro
        scores.setdefault(qid, {})[name] = value
        if i % 20 == 0 or i == len(tasks):
            print(f"  RAGAS 채점 {i}/{len(tasks)}", flush=True)
    return scores


def outcome(row):
    if row["correct"]:
        return "성공"
    return "실패-보류" if row["status"] == "withheld" else "실패-오답"


def diagnose(row):
    """실패 원인을 한 가지로 정한다 (위 docstring의 진단 규칙)"""
    if row["correct"]:
        return "-"
    recall, faith = row.get("context_recall"), row.get("faithfulness")
    if recall is None:
        return "채점 실패"
    if recall < 0.5:
        return "검색 실패 (근거가 검색 결과에 없음)"
    if row["status"] == "withheld":
        return "판단 실패 (근거가 있는데 보류)"
    if faith is not None and faith < 0.5:
        return "지어냄 (근거에 없는 내용으로 답함)"
    return "근거 읽기 실패 (근거대로 답했는데 틀림)"


def mean(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None


def write_report(rows, path, title):
    cell = lambda v: "-" if v is None else f"{v:.3f}"
    md = [f"# {title}", "",
          "- 지표: RAGAS context_recall / context_precision (정답 기준), faithfulness (답한 문제만)",
          f"- 채점 모델: {JUDGE_MODEL}", "", "## 결과별 평균", "",
          "| 결과 | 문제 | " + " | ".join(METRICS) + " |", "|---|---|" + "---|" * len(METRICS)]
    for group in ("성공", "실패-오답", "실패-보류"):
        sel = [r for r in rows if outcome(r) == group]
        md.append(f"| {group} | {len(sel)} | " + " | ".join(cell(mean(r.get(m) for r in sel)) for m in METRICS) + " |")

    fails = [r for r in rows if not r["correct"]]
    md += ["", "## 실패 원인", "", "| 원인 | 문제 | 표 질문 |", "|---|---|---|"]
    for cause, n in Counter(r["cause"] for r in fails).most_common():
        n_table = sum(r["cause"] == cause and r["context_type"] == "table" for r in fails)
        md.append(f"| {cause} | {n} | {n_table} |")

    md += ["", "## 실패 사례", ""]
    for cause in sorted({r["cause"] for r in fails}):
        md += [f"### {cause}", ""]
        for r in (r for r in fails if r["cause"] == cause):
            scores = ", ".join(f"{m} {cell(r.get(m))}" for m in METRICS)
            md.append(f"- **{r['qid']}** [{r['context_type']}] {r['question']}  \n"
                      f"  정답: {r['target_answer'][:150]}  \n"
                      f"  에이전트[{r['status']}]: {r['answer'][:150]}  \n  {scores}")
        md.append("")
    path.write_text("\n".join(md) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=DEFAULT_RUN, help="output/eval/agent 아래 에이전트 결과 폴더 이름")
    parser.add_argument("--limit", type=int, help="앞에서부터 N문제만 (확인용)")
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()
    load_dotenv(BASE_DIR / ".env", override=True)

    # [1] 대상: 실패 전부 + 같은 수의 성공 문제
    done = [r for r in load_done(AGENT_DIR / args.run / "details.jsonl").values()
            if "error" not in r and r["answerable"]]
    fails = [r for r in done if not r["correct"]]
    succ = random.Random(42).sample([r for r in done if r["correct"]], min(len(fails), len(done) - len(fails)))
    rows = fails + succ
    if args.limit:
        rows = rows[:args.limit]
    print(f"{args.run}: 실패 {len(fails)} + 성공 {len(succ)} -> 이번에 {len(rows)}문제")

    # [2] 청크 본문 + RAGAS 채점
    config = args.run.split("__")[1]
    by_id = {c["chunk_id"]: c for c in load_chunk_rows(config)}
    scores = asyncio.run(score_all(build_metrics(), rows, by_id, args.concurrency))

    # [3] 진단 + 저장
    out_dir = RAGAS_DIR / args.run
    out_dir.mkdir(parents=True, exist_ok=True)
    for r in rows:
        r.update(scores.get(r["qid"], {}))
        r["cause"] = diagnose(r)
    with (out_dir / "details.jsonl").open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    write_report(rows, out_dir / "report.md", f"RAGAS 실패 분석 - {args.run}")
    print((out_dir / "report.md").read_text(encoding="utf-8").split("## 실패 사례")[0])


if __name__ == "__main__":
    main()
