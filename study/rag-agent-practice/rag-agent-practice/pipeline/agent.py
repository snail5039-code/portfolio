"""RAG 에이전트 (LangChain create_agent)

- 검색 툴 search(query, domain): Hybrid + 앞뒤 청크 + 분야 보완 (retriever.py)
- 근거 판단: 검색 결과로 답할 수 있는지 LLM이 판단하고 이유를 judgement에 남긴다
- 재검색: 부족하면 검색어를 바꿔 다시 검색. 검색은 최초 포함 최대 3회 (ToolCallLimitMiddleware로 강제)
- 보류: 3번 검색해도 근거가 없으면 status="withheld"
- 실행 결과 저장: 질문, 답변, 근거, 검색어·검색한 청크 ID, 검색 횟수, 실행 시간 -> output/runs/agent_runs.jsonl

흐름
    RagAgent()
     [1] Retriever 준비 (청크·벡터DB·BM25)
     [2] search 툴 정의: 검색 결과를 [번호] chunk_id | 파일명 p.쪽 + 본문 텍스트로 LLM에 주고,
         청크 목록은 artifact로 따로 남겨 실행 기록에 쓴다
     [3] create_agent(모델, [search], 시스템 프롬프트, 검색 3회 제한 미들웨어, 구조화 출력 Answer)
    RagAgent.ask(question)
     [1] 에이전트 실행 -> LLM이 search 호출(최대 3회) -> 근거 판단 -> Answer 생성
     [2] 메시지 기록에서 검색어·옵션·청크 ID 뽑기 (extract_searches)
     [3] 결과 dict 만들어 agent_runs.jsonl에 한 줄 저장

실행
    python -m pipeline.agent "보험업권 상생금융이 뭐야?"
    python -m pipeline.agent "질문" --show-searches     # 검색 과정까지 출력
"""

import sys
from pathlib import Path

# pipeline 폴더 안에서 python 파일명.py 로 바로 실행해도 pipeline 패키지를 찾게 한다
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import json
import logging
import os
import time
import uuid
import warnings
from datetime import datetime
from typing import Literal, Optional

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import tool
from pydantic import BaseModel, Field

from pipeline.chunk import DEFAULT_CONFIG
from pipeline.extract import BASE_DIR
from pipeline.retriever import Retriever

# 결과와 상관없는 라이브러리 경고를 끈다 (aim-ai-agent-my 10번 스크립트의 quiet_library_noise와 같은 방식)
# - gemini-3.x는 temperature를 무시한다는 경고, google-genai의 API 키·AFC·function_call 안내 로그
warnings.filterwarnings("ignore", message=r"Model .* uses fixed sampling defaults", category=UserWarning)
logging.getLogger("google_genai").setLevel(logging.ERROR)

RUNS_DIR = BASE_DIR / "output" / "runs"
# 3.6-flash·2.5-flash·2.5-flash-lite와 비교해 가장 빠르고(질문당 약 4초) 재검색·보류도 제대로 해서 선택
DEFAULT_MODEL = "gemini-3.5-flash-lite"
MAX_SEARCHES = 3
# 프롬프트를 바꾸면 올린다 (평가 결과 폴더 이름에 들어가 결과끼리 섞이지 않게)
# p1: 처음 프롬프트 / p2: is_table 제거, 계산·질문 부분·조건 일치 규칙 추가, judgement를 status보다 먼저
PROMPT_VERSION = "p2"

# 에이전트와 기본 RAG가 같이 쓰는 답변 규칙
ANSWER_RULES = """[답변]
- 검색 결과에 있는 내용만으로 한국어로 답한다. 추측하거나 문서 밖 지식을 보태지 않는다.
- 질문의 모든 부분에 답한다. 계산했으면 계산에 쓴 수치와 결과를 함께 쓴다.
- 수치는 연도·대상·단위가 질문과 같은 것을 쓴다 (비슷한 다른 연도·다른 대상의 수치와 헷갈리지 않는다).
- citations에는 실제로 답에 쓴 근거만 넣는다: chunk_id, file_name, page_no, quote(검색 결과 원문 그대로 짧게).
- judgement에 근거가 충분/부족한 이유를 먼저 쓰고, 그 판단에 맞게 status를 정한다.
"""

SYSTEM_PROMPT = f"""너는 한국어 PDF 문서(금융·공공·커머스·법률·의료)에 근거해서만 답하는 RAG 에이전트다.

[검색]
- 답하기 전에 반드시 search 툴로 문서를 검색한다. 검색은 최초 포함 최대 {MAX_SEARCHES}번까지만 할 수 있다.
- 분야가 확실하면 domain(finance, public, commerce, law, medical)을 지정하고, 애매하면 비워 둔다.

[근거 판단]
- 질문이 여러 부분(예: 목적과 활동, 금액과 변화율)이면 부분마다 근거가 있는지 따로 확인한다.
- 부족한 부분이 있으면 그 부분을 찾도록 검색어를 바꿔 다시 검색한다: 핵심어만 남기기,
  동의어·문서에 나올 법한 표현으로 바꾸기, domain을 지정했다면 풀기.
- 표·그래프의 수치로 차이·증감률·순위·비교를 계산할 수 있으면 근거가 있는 것으로 본다.
  문서에 비교·결론 문장이 따로 없다는 이유만으로 보류하지 않는다.
- {MAX_SEARCHES}번 검색해도 근거가 없으면 지어내지 말고 status="withheld"로 답변을 보류한다.

{ANSWER_RULES}"""

# 기본 RAG(비교용): 검색 결과를 미리 넣어 주고 한 번에 답하게 한다. 근거 판단·답변 규칙은 에이전트와 같고 재검색만 없다
BASIC_RAG_PROMPT = """너는 한국어 PDF 문서(금융·공공·커머스·법률·의료)에 근거해서만 답하는 RAG 어시스턴트다.
아래 검색 결과만 보고 답한다. 다시 검색할 수 없다.

[근거 판단]
- 질문이 여러 부분(예: 목적과 활동, 금액과 변화율)이면 부분마다 근거가 있는지 따로 확인한다.
- 표·그래프의 수치로 차이·증감률·순위·비교를 계산할 수 있으면 근거가 있는 것으로 본다.
  문서에 비교·결론 문장이 따로 없다는 이유만으로 보류하지 않는다.
- 검색 결과에 근거가 없으면 지어내지 말고 status="withheld"로 답변을 보류한다.

""" + ANSWER_RULES + """
질문: {question}

검색 결과:
{context}
"""


class Citation(BaseModel):
    chunk_id: str = Field(description="검색 결과의 chunk_id")
    file_name: str = Field(description="파일명")
    page_no: int = Field(description="쪽 번호")
    quote: str = Field(description="답의 근거가 된 원문 구절 (검색 결과에서 그대로)")


class Answer(BaseModel):
    # 필드 순서대로 생성되므로 근거 판단(judgement)을 먼저 쓰고 그에 맞춰 status를 정하게 한다
    judgement: str = Field(description="질문의 부분마다 근거가 충분/부족한지와 그 이유")
    status: Literal["answered", "withheld"] = Field(description="answered=답변, withheld=근거 부족으로 보류")
    answer: str = Field(description="한국어 답변. 보류면 근거를 찾지 못했다는 안내")
    citations: list[Citation] = Field(default_factory=list, description="답에 쓴 근거")


def chunk_records(chunks):
    """검색 결과 -> 실행 기록용 청크 목록. 앞뒤 청크를 붙였으면(chunk_ids) LLM이 실제로 본 청크를 모두 남긴다"""
    return [{"chunk_id": cid, **{k: c[k] for k in ("file_name", "page_no", "content_type")}}
            for c in chunks for cid in c.get("chunk_ids", [c["chunk_id"]])]


def format_results(chunks):
    """검색 결과를 LLM이 읽을 텍스트로"""
    if not chunks:
        return "검색 결과 없음"
    return "\n\n".join(
        f"[{i}] chunk_id={c['chunk_id']} | {c['file_name']} p.{c['page_no']} ({c['content_type']})\n{c['text']}"
        for i, c in enumerate(chunks, start=1)
    )


class RagAgent:
    def __init__(self, config=DEFAULT_CONFIG, k=5, model=None, **retriever_options):
        load_dotenv(BASE_DIR / ".env", override=True)
        self.model_name = model or os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
        self.config = config
        # [1] 검색기 (retriever_options: neighbors, table_mode, domain_fallback -> Retriever 참고)
        self.retriever = Retriever(config=config, k=k, **retriever_options)

        # [2] 검색 툴 (본문은 LLM에게, 청크 목록은 artifact로 실행 기록에)
        retriever = self.retriever

        @tool(response_format="content_and_artifact")
        def search(query: str, domain: Optional[str] = None):
            """PDF 문서에서 질문의 근거를 검색한다.

            Args:
                query: 검색어 (질문 그대로 또는 핵심어)
                domain: finance, public, commerce, law, medical 중 하나. 애매하면 비워 둔다
            """
            chunks = retriever.search(query, domain=domain)
            return format_results(chunks), chunk_records(chunks)

        # [3] 에이전트: 검색 툴 + 검색 3회 제한 + 구조화 출력
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(model=self.model_name, timeout=120, max_retries=2)
        self.agent = create_agent(
            model=llm,
            tools=[search],
            system_prompt=SYSTEM_PROMPT,
            middleware=[ToolCallLimitMiddleware(tool_name="search", run_limit=MAX_SEARCHES)],
            response_format=Answer,
        )

    def ask(self, question, save=True):
        t0 = time.time()
        # [1] 실행
        state = self.agent.invoke({"messages": [{"role": "user", "content": question}]})
        elapsed = time.time() - t0
        # [2] 검색 기록 / [3] 결과 저장
        return make_result("agent", self, question, state.get("structured_response"),
                           extract_searches(state["messages"]), elapsed, save)


class BasicRag:
    """기본 RAG (에이전트와 비교용): 질문 그대로 한 번만 검색하고 바로 답변/보류한다.
    검색기·모델·답변 형식(Answer)·답변 규칙은 RagAgent와 같고, 재검색과 검색어 고르기만 없다."""

    def __init__(self, config=DEFAULT_CONFIG, k=5, model=None, **retriever_options):
        load_dotenv(BASE_DIR / ".env", override=True)
        self.model_name = model or os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
        self.config = config
        self.retriever = Retriever(config=config, k=k, **retriever_options)
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(model=self.model_name, timeout=120, max_retries=2)
        self.llm = llm.with_structured_output(Answer)

    def ask(self, question, save=True):
        t0 = time.time()
        chunks = self.retriever.search(question)  # 질문 그대로, 분야 지정 없이 한 번
        answer = self.llm.invoke(BASIC_RAG_PROMPT.format(question=question, context=format_results(chunks)))
        records = chunk_records(chunks)
        searches = [{"query": question, "is_table": False, "domain": None, "blocked": False,
                     "chunk_ids": [c["chunk_id"] for c in records],
                     "pages": [f"{c['file_name']} p.{c['page_no']}" for c in records]}]
        return make_result("rag", self, question, answer, searches, time.time() - t0, save)


def make_result(mode, runner, question, answer, searches, elapsed, save):
    """실행 결과 dict (에이전트·기본 RAG 공통). save면 output/runs/agent_runs.jsonl에 한 줄 저장"""
    result = {
        "run_id": uuid.uuid4().hex[:12],
        "time": datetime.now().isoformat(timespec="seconds"),
        "mode": mode,
        "model": runner.model_name,
        "retriever_config": runner.config,
        "question": question,
        "status": answer.status if answer else "error",
        "answer": answer.answer if answer else "",
        "judgement": answer.judgement if answer else "",
        "citations": [c.model_dump() for c in answer.citations] if answer else [],
        "n_searches": sum(1 for s in searches if not s.get("blocked")),
        "searches": searches,
        "retrieved_chunk_ids": sorted({cid for s in searches for cid in s.get("chunk_ids", [])}),
        "elapsed_sec": round(elapsed, 2),
    }
    if save:
        RUNS_DIR.mkdir(parents=True, exist_ok=True)
        with (RUNS_DIR / "agent_runs.jsonl").open("a", encoding="utf-8") as f:
            f.write(json.dumps(result, ensure_ascii=False) + "\n")
    return result


def extract_searches(messages):
    """메시지 기록에서 search 호출(검색어·옵션)과 그 결과 청크 ID를 순서대로 뽑는다."""
    calls, outputs = {}, {}
    order = []
    for m in messages:
        if isinstance(m, AIMessage):
            for tc in m.tool_calls or []:
                if tc["name"] == "search":
                    calls[tc["id"]] = tc["args"]
                    order.append(tc["id"])
        elif isinstance(m, ToolMessage) and m.tool_call_id in calls:
            outputs[m.tool_call_id] = m
    searches = []
    for cid in order:
        msg = outputs.get(cid)
        artifact = getattr(msg, "artifact", None) if msg else None
        searches.append({
            "query": calls[cid].get("query", ""),
            "is_table": bool(calls[cid].get("is_table", False)),
            "domain": calls[cid].get("domain"),
            # 3회 제한에 걸린 호출은 실행되지 않아 결과(artifact)가 없다
            "blocked": artifact is None,
            "chunk_ids": [c["chunk_id"] for c in artifact] if artifact else [],
            "pages": [f"{c['file_name']} p.{c['page_no']}" for c in artifact] if artifact else [],
        })
    return searches


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("question")
    parser.add_argument("--show-searches", action="store_true")
    args = parser.parse_args()

    agent = RagAgent()
    r = agent.ask(args.question)
    print(f"\n[{r['status']}] {r['answer']}\n")
    print(f"근거 판단: {r['judgement']}")
    for c in r["citations"]:
        print(f"  - {c['file_name']} p.{c['page_no']} ({c['chunk_id']}): {c['quote'][:80]}")
    print(f"검색 {r['n_searches']}회 / {r['elapsed_sec']}초")
    if args.show_searches:
        for i, s in enumerate(r["searches"], start=1):
            opt = f"is_table={s['is_table']}, domain={s['domain']}"
            print(f"  검색{i}: {s['query']} ({opt}){' [제한 초과로 차단]' if s['blocked'] else ''}")
            for p in s["pages"][:5]:
                print(f"      {p}")


if __name__ == "__main__":
    main()
