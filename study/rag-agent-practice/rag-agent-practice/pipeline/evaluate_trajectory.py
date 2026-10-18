"""에이전트의 검색 과정(trajectory)을 채점한다 - 답이 아니라 search 툴을 어떻게 불렀는지

aim-ai-agent-my 30번 노트북처럼 agentevals의 create_trajectory_match_evaluator를 쓴다.
에이전트를 다시 돌리지 않고 evaluate_agent가 저장한 details.jsonl의 검색 기록(searches)을 읽는다.

검사 항목 (답할 수 있는 문제만)
- table_flag   : 표 질문(context_type=table)에 is_table=true로 검색한 적이 있나 (agentevals superset 매칭)
- query_changed: 2번 이상 검색했을 때 검색어가 매번 달랐나 (같은 검색어 반복은 재검색 의미 없음)
- domain_ok    : domain을 지정했다면 질문의 실제 분야와 같았나 (틀리면 엉뚱한 분야만 검색)
각 항목이 지켜졌을 때와 아닐 때의 정답률을 나란히 본다.

실행
    python -m pipeline.evaluate_trajectory                  # 기본: 500/60 1차 결과
    python -m pipeline.evaluate_trajectory --run goldenset_200__base_300_50__gemini-3.5-flash-lite

결과: output/eval/trajectory/<에이전트 결과 폴더>/report.md
"""

import sys
from pathlib import Path

# pipeline 폴더 안에서 python 파일명.py 로 바로 실행해도 pipeline 패키지를 찾게 한다
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse

from agentevals.trajectory.match import create_trajectory_match_evaluator
from langchain_core.messages import AIMessage

from pipeline.evaluate_agent import EVAL_DIR as AGENT_DIR, load_done
from pipeline.evaluate_ragas import DEFAULT_RUN
from pipeline.extract import BASE_DIR

TRAJ_DIR = BASE_DIR / "output" / "eval" / "trajectory"

# 기대한 호출이 실제 호출 안에 들어 있으면 통과 (다른 호출이 더 있어도 됨), 인자도 기대한 것만 맞으면 됨
superset_match = create_trajectory_match_evaluator(trajectory_match_mode="superset", tool_args_match_mode="superset")


def as_messages(calls):
    """검색 기록 -> agentevals가 받는 메시지 형식 (30번 노트북의 as_messages와 같음)"""
    return [AIMessage(content="", tool_calls=[{"id": str(i), "name": "search", "args": args}])
            for i, args in enumerate(calls)]


def check_table_flag(row):
    if row["context_type"] != "table":
        return None
    actual = [{"is_table": s["is_table"]} for s in row["searches"] if not s.get("blocked")]
    return bool(superset_match(outputs=as_messages(actual), reference_outputs=as_messages([{"is_table": True}]))["score"])


def check_query_changed(row):
    queries = [s["query"].strip() for s in row["searches"] if not s.get("blocked")]
    return len(set(queries)) == len(queries) if len(queries) >= 2 else None


def check_domain_ok(row):
    domains = {s["domain"] for s in row["searches"] if s.get("domain")}
    return domains <= {row["domain"]} if domains else None


CHECKS = {"table_flag": ("표 질문에 is_table=true 사용", check_table_flag),
          "query_changed": ("재검색 때 검색어를 바꿈", check_query_changed),
          "domain_ok": ("지정한 분야가 맞음", check_domain_ok)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", default=DEFAULT_RUN, help="output/eval/agent 아래 에이전트 결과 폴더 이름")
    args = parser.parse_args()

    rows = [r for r in load_done(AGENT_DIR / args.run / "details.jsonl").values()
            if "error" not in r and r["answerable"]]
    acc = lambda rs: f"{sum(r['correct'] for r in rs) / len(rs):.3f}" if rs else "-"

    md = [f"# 검색 과정 채점 - {args.run}", "", f"- 답할 수 있는 문제 {len(rows)}개, agentevals superset 매칭", "",
          "| 검사 | 대상 문제 | 지켜짐 | 지켜진 비율 | 지켜졌을 때 정답률 | 안 지켜졌을 때 정답률 |",
          "|---|---|---|---|---|---|"]
    misses = {}
    for key, (label, check) in CHECKS.items():
        results = [(r, check(r)) for r in rows]
        target = [(r, ok) for r, ok in results if ok is not None]
        ok_rows = [r for r, ok in target if ok]
        bad_rows = [r for r, ok in target if not ok]
        misses[label] = bad_rows
        rate = f"{len(ok_rows) / len(target):.3f}" if target else "-"
        md.append(f"| {label} | {len(target)} | {len(ok_rows)} | {rate} | {acc(ok_rows)} | {acc(bad_rows)} |")

    md += ["", "## 안 지켜진 사례", ""]
    for label, bad in misses.items():
        md += [f"### {label} ({len(bad)})", ""]
        md += [f"- **{r['qid']}** [{'O' if r['correct'] else 'X'}, {r['domain']}] {r['question'][:80]}  \n  검색: "
               + " / ".join(f"`{s['query']}` (is_table={s['is_table']}, domain={s['domain']})" for s in r["searches"])
               for r in bad] or ["없음"]
        md.append("")

    out_dir = TRAJ_DIR / args.run
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "report.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md[:8 + len(CHECKS)]))
    print(f"\n보고서: {out_dir / 'report.md'}")


if __name__ == "__main__":
    main()
