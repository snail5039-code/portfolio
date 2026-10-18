"""RAG 에이전트 평가 (골든셋으로 문제를 풀리고 채점)

aim-ai-agent-my 30번 노트북(langgraph-evaluation)과 같은 구조:
골든셋 문제 -> 에이전트 실행 -> 채점 함수(evaluator)들로 채점 -> 결과 비교

채점 항목
- 답변 정확도 evaluate_answer(): openevals CORRECTNESS_PROMPT로 LLM이 에이전트 답 vs target_answer 채점
    - 답할 수 있는 문제인데 보류했으면 LLM 채점 없이 오답
    - 답변 불가 문제(answerable=false)는 보류했으면 정답, 답했으면 오답
- 근거·검색 적중 evaluate_pages(): 답할 수 있는 문제만
    - 근거 쪽 적중: 에이전트가 근거(citations)로 든 (파일명, 쪽)이 정답 쪽과 하나라도 같은지
    - 검색 적중: 검색한 청크 중 정답 쪽이 있었는지 ("검색은 찾았는데 답이 틀림" / "검색부터 못 찾음" 구분용)
- 보류 판단, 검색 횟수, 응답 시간: 에이전트 실행 결과에서 그대로

실행
    python -m pipeline.evaluate_agent --limit 5            # 앞 5문제만 먼저 확인
    python -m pipeline.evaluate_agent                      # 전체 (이미 푼 문제는 건너뛰고 이어서)
    python -m pipeline.evaluate_agent --ids my-03,gs-010   # 특정 문제만
    python -m pipeline.evaluate_agent --fresh              # 처음부터 다시
    python -m pipeline.evaluate_agent --model gemini-3.6-flash   # 문제 푸는 모델 바꾸기 (채점 모델은 그대로)
    python -m pipeline.evaluate_agent --neighbors 0 --table-mode mmr --no-domain-fallback   # 처음 검색 방식
    python -m pipeline.evaluate_agent --mode rag           # 기본 RAG(한 번만 검색)로 같은 채점 -> 에이전트와 비교

모델
- 문제 푸는 모델: --model (기본은 agent.py의 DEFAULT_MODEL)
- 채점 모델: JUDGE_MODEL로 고정. 실험끼리 공정하게 비교하려면 채점 기준이 같아야 하기 때문
  (3.6-flash·3.5-flash-lite·2.5-flash·2.5-flash-lite 모두 맞은 답 8개·틀린 답 4개를 12/12로 판정 -> 가장 빠른 것)

결과: output/eval/agent/<골든셋>__<청킹설정>__<모델>__<검색설정>/details.jsonl (문제별), report.md (요약·실패 사례)
     검색설정 예: nb1_hybrid_fb_p2 = 앞뒤 청크 1개 + 표도 Hybrid + 분야 결과에 전체 결과 섞기 + 프롬프트 p2 (기본)

흐름
    main()
     [1] 골든셋 읽기 (evaluate_retrievers.load_golden, 답변 불가 문제 포함)
     [2] details.jsonl에서 이미 채점한 문제는 빼기 (오류 난 문제는 다시)
     [3] 문제마다: agent.ask -> evaluate_answer + evaluate_pages -> details.jsonl에 한 줄씩 바로 저장
     [4] summarize(): 전체 / 분야별 / 근거 유형별 / 출처별 -> report.md
"""

import sys
from pathlib import Path

# pipeline 폴더 안에서 python 파일명.py 로 바로 실행해도 pipeline 패키지를 찾게 한다
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import json

from langsmith import tracing_context

from pipeline.agent import DEFAULT_MODEL, PROMPT_VERSION, BasicRag, RagAgent
from pipeline.chunk import DEFAULT_CONFIG
from pipeline.evaluate_retrievers import load_golden, norm_name
from pipeline.extract import BASE_DIR

EVAL_DIR = BASE_DIR / "output" / "eval" / "agent"
JUDGE_MODEL = "gemini-3.5-flash-lite"


# ---------------- 채점 함수 ----------------

def make_answer_judge():
    """30번 노트북과 같은 LLM 채점기: CORRECTNESS_PROMPT + Gemini -> {score: True/False, comment}"""
    from langchain_google_genai import ChatGoogleGenerativeAI
    from openevals.llm import create_llm_as_judge
    from openevals.prompts import CORRECTNESS_PROMPT

    return create_llm_as_judge(
        prompt=CORRECTNESS_PROMPT,
        judge=ChatGoogleGenerativeAI(model=JUDGE_MODEL, timeout=120, max_retries=6),
        feedback_key="answer_correct",
    )


def evaluate_answer(judge, case, run):
    """답변 정확도 -> (정답 여부, 채점 이유)"""
    withheld = run["status"] == "withheld"
    if not case["answerable"]:
        return withheld, "답변 불가 문제: " + ("보류함" if withheld else "답을 지어냄")
    if withheld:
        return False, "답할 수 있는 문제인데 보류함"
    res = judge(inputs=case["question"], outputs=run["answer"], reference_outputs=case["target_answer"])
    return bool(res["score"]), res["comment"]


def evaluate_pages(case, run, by_id):
    """근거 쪽 적중·검색 적중 (답변 불가 문제는 정답 쪽이 없어 None)"""
    if not case["answerable"]:
        return {"citation_hit": None, "retrieval_hit": None}
    cited = {(norm_name(c["file_name"]), int(c["page_no"])) for c in run["citations"]}
    searched = {(norm_name(by_id[cid]["file_name"]), by_id[cid]["page_no"]) for cid in run["retrieved_chunk_ids"]}
    return {"citation_hit": bool(cited & case["gold"]), "retrieval_hit": bool(searched & case["gold"])}


# ---------------- 요약 ----------------

def mean(values):
    values = list(values)
    return sum(values) / len(values) if values else None


def summarize(name, rows):
    """그룹 하나의 평균. 정답률·적중률·잘못된 보류는 답할 수 있는 문제 기준"""
    ans = [r for r in rows if r["answerable"]]
    unans = [r for r in rows if not r["answerable"]]
    return {
        "name": name, "count": len(rows),
        "answer_acc": mean(r["correct"] for r in ans),
        "citation_hit": mean(r["citation_hit"] for r in ans),
        "retrieval_hit": mean(r["retrieval_hit"] for r in ans),
        "false_withhold": mean(r["status"] == "withheld" for r in ans),
        "unans_withheld": mean(r["status"] == "withheld" for r in unans),
        "avg_searches": mean(r["n_searches"] for r in rows),
        "avg_sec": mean(r["elapsed_sec"] for r in rows),
    }


COLUMNS = {"name": "그룹", "count": "문제", "answer_acc": "정답률", "citation_hit": "근거 쪽 적중",
           "retrieval_hit": "검색 적중", "false_withhold": "잘못된 보류", "unans_withheld": "답변 불가 보류",
           "avg_searches": "평균 검색", "avg_sec": "평균 초"}


def md_table(summaries):
    def cell(v):
        return "-" if v is None else f"{v:.3f}" if isinstance(v, float) else str(v)
    lines = ["| " + " | ".join(COLUMNS.values()) + " |", "|" + "---|" * len(COLUMNS)]
    lines += ["| " + " | ".join(cell(s[k]) for k in COLUMNS) + " |" for s in summaries]
    return "\n".join(lines)


def write_report(rows, path, title):
    md = [f"# {title}", "",
          "- 채점: openevals CORRECTNESS_PROMPT (LLM, 정답/오답). 보류한 문제는 오답으로 셈",
          "- 정답률·근거 쪽 적중·검색 적중·잘못된 보류는 답할 수 있는 문제 기준", "",
          "## 전체", "", md_table([summarize("전체", rows)]), ""]
    for key, label in (("domain", "분야별"), ("context_type", "근거 유형별"), ("source", "출처별")):
        groups = sorted({r[key] for r in rows if r[key]})
        md += [f"## {label}", "", md_table([summarize(g, [r for r in rows if r[key] == g]) for g in groups]), ""]

    failures = {
        "답했는데 오답 - 검색은 정답 쪽을 찾음": lambda r: r["answerable"] and r["status"] == "answered"
                                                    and not r["correct"] and r["retrieval_hit"],
        "답했는데 오답 - 검색도 못 찾음": lambda r: r["answerable"] and r["status"] == "answered"
                                                and not r["correct"] and not r["retrieval_hit"],
        "잘못된 보류": lambda r: r["answerable"] and r["status"] == "withheld",
        "답변 불가 문제에 답함": lambda r: not r["answerable"] and r["status"] != "withheld",
    }
    md += ["## 실패 사례", ""]
    for label, cond in failures.items():
        cases = [r for r in rows if cond(r)]
        md += [f"### {label} ({len(cases)})", ""]
        md += [f"- **{r['qid']}** {r['question']}  \n  정답: {r['target_answer'][:150]}  \n"
               f"  에이전트[{r['status']}, 검색 {r['n_searches']}회]: {r['answer'][:150]}  \n"
               f"  채점: {r['judge_comment'][:200]}" for r in cases] or ["없음"]
        md.append("")
    path.write_text("\n".join(md) + "\n", encoding="utf-8")


def load_done(path):
    """details.jsonl -> {qid: 마지막 기록}"""
    if not path.exists():
        return {}
    return {r["qid"]: r for r in map(json.loads, path.open(encoding="utf-8"))}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--golden", default="data/goldenset_all.csv")
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument("--limit", type=int, help="앞에서부터 N문제만")
    parser.add_argument("--ids", help="풀 문제 id (쉼표로 구분)")
    parser.add_argument("--fresh", action="store_true", help="이전 결과를 지우고 처음부터")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="문제 푸는 모델 (채점 모델은 JUDGE_MODEL로 고정)")
    parser.add_argument("--mode", choices=["agent", "rag"], default="agent",
                        help="agent=재검색하는 에이전트, rag=한 번만 검색하는 기본 RAG (비교용)")
    parser.add_argument("--tag", help="같은 설정을 한 번 더 돌릴 때 결과 폴더 뒤에 붙일 이름 (예: run2)")
    # 검색 옵션 (retriever.Retriever 참고). 결과 폴더 이름에 들어가서 설정끼리 섞이지 않는다
    parser.add_argument("--neighbors", type=int, default=1, help="찾은 청크의 앞뒤 청크를 몇 개씩 붙일지")
    parser.add_argument("--table-mode", choices=["mmr", "hybrid"], default="hybrid", help="표 질문 검색 방식")
    parser.add_argument("--no-domain-fallback", dest="domain_fallback", action="store_false",
                        help="분야를 지정하면 그 분야 안에서만 검색 (기본은 전체 결과도 섞음)")
    args = parser.parse_args()

    # [1] 골든셋
    golden_path = BASE_DIR / args.golden
    golden = load_golden(golden_path, keep_unanswerable=True)
    if args.ids:
        golden = [q for q in golden if q["qid"] in args.ids.split(",")]
    if args.limit:
        golden = golden[:args.limit]

    # 예: goldenset_200__base_500_60__gemini-3.5-flash-lite__nb1_hybrid_fb_p2 (검색 설정 + 프롬프트 버전)
    # 검색 설정 표시가 없는 옛 폴더는 처음 검색 방식(앞뒤 청크 없음·표 MMR·분야 필터), 프롬프트 표시가 없으면 p1
    search_opts = f"nb{args.neighbors}_{args.table_mode}" + ("_fb" if args.domain_fallback else "") + f"_{PROMPT_VERSION}"
    if args.mode == "rag":
        search_opts += "_rag"  # 예: ..._nb1_hybrid_fb_p2_rag
    out_dir = EVAL_DIR / (f"{golden_path.stem}__{args.config}__{args.model}__{search_opts}"
                          + (f"__{args.tag}" if args.tag else ""))
    out_dir.mkdir(parents=True, exist_ok=True)
    details = out_dir / "details.jsonl"
    if args.fresh:
        details.unlink(missing_ok=True)

    # [2] 이미 채점한 문제 빼기 (오류 난 문제는 다시)
    done = load_done(details)
    todo = [q for q in golden if q["qid"] not in done or "error" in done[q["qid"]]]
    print(f"골든셋 {golden_path.name}: {len(golden)}문제 / 이미 채점 {len(golden) - len(todo)} / 이번에 {len(todo)}")

    # [3] 풀고 채점 -> 한 줄씩 바로 저장 (중간에 끊겨도 다시 실행하면 이어서)
    if todo:
        runner = RagAgent if args.mode == "agent" else BasicRag
        agent = runner(config=args.config, model=args.model, neighbors=args.neighbors,
                       table_mode=args.table_mode, domain_fallback=args.domain_fallback)
        judge = make_answer_judge()
        for i, q in enumerate(todo, start=1):
            row = {k: q[k] for k in ("qid", "domain", "context_type", "source", "question",
                                     "target_answer", "answerable")}
            row["gold"] = sorted(f"{f} p.{p}" for f, p in q["gold"])
            try:
                # .env의 LANGSMITH_TRACING이 켜져 있어도 평가 중에는 LangSmith로 실행 기록을 보내지 않는다
                # (문제마다 호출이 많아 무료 사용량을 금방 넘고, 평가 결과는 details.jsonl에 따로 남는다)
                with tracing_context(enabled=False):
                    run = agent.ask(q["question"], save=False)
                    correct, comment = evaluate_answer(judge, q, run)
                row.update({k: run[k] for k in ("status", "answer", "judgement", "citations", "n_searches",
                                                "searches", "retrieved_chunk_ids", "elapsed_sec", "model")})
                row.update({"correct": correct, "judge_comment": comment,
                            **evaluate_pages(q, run, agent.retriever.by_id)})
                mark = "O" if correct else "X"
            except Exception as e:  # 한 문제 실패로 전체가 멈추지 않게 기록만 남기고 다음 실행 때 다시 푼다
                row["error"] = f"{type(e).__name__}: {e}"
                mark = "오류 " + row["error"][:80]
            with details.open("a", encoding="utf-8") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"  [{i}/{len(todo)}] {q['qid']} {mark}", flush=True)

    # [4] 요약 (이번 골든셋 범위만, 오류는 빼고)
    done = load_done(details)
    rows = [done[q["qid"]] for q in golden if q["qid"] in done and "error" not in done[q["qid"]]]
    if not rows:
        print("채점된 문제가 없습니다.")
        return
    write_report(rows, out_dir / "report.md",
                 f"에이전트 평가 - {golden_path.name} / {args.config} / 푼 모델 {args.model} / 채점 {JUDGE_MODEL}")
    print("\n" + md_table([summarize("전체", rows)]))
    print(f"오류로 빠진 문제 {len(golden) - len(rows)}개 (다시 실행하면 이어서 풂)")
    print(f"보고서: {out_dir / 'report.md'}")


if __name__ == "__main__":
    main()
