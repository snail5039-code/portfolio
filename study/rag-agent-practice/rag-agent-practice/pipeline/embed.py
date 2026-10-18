"""청크(chunks.jsonl)를 임베딩해 Chroma 벡터DB에 저장한다.

- 임베딩: Google gemini-embedding-2 (수업 09·10번 노트북과 같은 모델)
- 벡터DB: Chroma, 청킹 설정별로 컬렉션을 따로 만든다 (예: base_300_50)
- 저장 위치: rag-agent-practice/vectordb/ (용량이 커서 git에는 올리지 않음)
- 이어서 실행: 저장된 것과 본문이 같은 청크는 건너뛰고, 새 청크·바뀐 청크만 임베딩, 없어진 청크는 지운다

흐름
    main()
     ├─ --query 없으면 embed()
     │   [1] chunks.jsonl 읽기
     │   [2] get_store(): .env 읽기 -> 임베딩 모델 + Chroma 컬렉션(설정 이름) 열기
     │   [3] 저장된 청크와 비교해 바뀐·새 청크만 고르고, 바뀐·없어진 청크는 지우기
     │   [4] 100개씩 add_texts() -> 내부에서 임베딩 API 호출 후 벡터·본문·메타데이터 저장
     │       (메타데이터는 clean_meta()로 Chroma가 받는 형식만 남김, 실패하면 쉬었다가 재시도)
     └─ --query 있으면 search(): 질문을 임베딩해 가장 가까운 청크 k개 출력 (거리 작을수록 비슷)

    get_store()는 retriever.py에서도 같은 컬렉션을 열 때 쓴다.

실행
    python -m pipeline.embed                         # output/chunks/base_500_60 -> 컬렉션 base_500_60
    python -m pipeline.embed --config base_800_100
    python -m pipeline.embed --query "보험업권 상생금융이 뭐야?"   # 저장된 컬렉션으로 검색 확인
"""

import sys
from pathlib import Path

# pipeline 폴더 안에서 python 파일명.py 로 바로 실행해도 pipeline 패키지를 찾게 한다
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import json
import os
import time

import chromadb
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings

from pipeline.chunk import CHUNK_DIR, DEFAULT_CONFIG
from pipeline.extract import BASE_DIR

VECTORDB_DIR = BASE_DIR / "vectordb"
EMBEDDING_MODEL = "gemini-embedding-2"
BATCH = 100


def get_store(collection):
    """임베딩 모델 + Chroma 컬렉션(코사인 거리)을 연다."""
    load_dotenv(BASE_DIR / ".env", override=True)
    embeddings = GoogleGenerativeAIEmbeddings(model=os.getenv("EMBEDDING_MODEL", EMBEDDING_MODEL))
    client = chromadb.PersistentClient(path=str(VECTORDB_DIR))
    return Chroma(collection_name=collection, embedding_function=embeddings, client=client,
                  collection_metadata={"hnsw:space": "cosine"})


def clean_meta(meta, chunk_id):
    # Chroma 메타데이터는 문자열·숫자·불리언만 된다 (None 불가)
    out = {k: v for k, v in meta.items() if isinstance(v, (str, int, float, bool))}
    out["chunk_id"] = chunk_id
    return out


def embed(config):
    """청킹 설정 이름(예: base_300_50)의 청크를 같은 이름의 컬렉션에 임베딩·저장한다."""
    # [1] 청크 읽기 / [2] 컬렉션 열기
    chunks = [json.loads(l) for l in (CHUNK_DIR / config / "chunks.jsonl").open(encoding="utf-8")]
    store = get_store(config)
    # [3] 저장된 것과 비교: 새 청크·본문이 바뀐 청크만 임베딩, 바뀌거나 없어진 청크는 먼저 지운다
    #     (추출을 일부 고친 뒤 다시 청킹해도 바뀐 것만 다시 임베딩하면 된다)
    saved = store.get(include=["documents"])
    existing = dict(zip(saved["ids"], saved["documents"]))
    new_ids = {c["chunk_id"] for c in chunks}
    todo = [c for c in chunks if existing.get(c["chunk_id"]) != c["text"]]
    stale = [cid for cid in existing if cid not in new_ids or cid in {c["chunk_id"] for c in todo}]
    if stale:
        store.delete(ids=stale)
    print(f"청크 {len(chunks)}개 / 저장됨 {len(existing)}개 / 지움 {len(stale)}개 / 이번에 임베딩 {len(todo)}개",
          flush=True)

    t0 = time.time()
    # [4] 100개씩 임베딩·저장
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        for attempt in range(5):
            try:
                store.add_texts(
                    texts=[c["text"] for c in batch],
                    metadatas=[clean_meta(c["metadata"], c["chunk_id"]) for c in batch],
                    ids=[c["chunk_id"] for c in batch],
                )
                break
            except Exception as e:  # 속도 제한 등 -> 쉬었다가 재시도
                if attempt == 4:
                    raise
                wait = 10 * (attempt + 1)
                print(f"  재시도 {attempt + 1} ({wait}초 대기): {repr(e)[:120]}", flush=True)
                time.sleep(wait)
        done = min(i + BATCH, len(todo))
        if done % 1000 < BATCH or done == len(todo):
            print(f"  {done}/{len(todo)} ({time.time() - t0:.0f}초)", flush=True)
    print(f"컬렉션 '{config}': 총 {store._collection.count()}개 저장 -> {VECTORDB_DIR}")


def search(config, query, k):
    """저장된 컬렉션으로 유사도 검색 결과를 출력한다 (동작 확인용)."""
    store = get_store(config)
    for doc, dist in store.similarity_search_with_score(query, k=k):
        m = doc.metadata
        print(f"[{dist:.3f}] {m['file_name']} p.{m['page_no']} ({m['content_type']}) {m['chunk_id']}")
        print("   ", doc.page_content[:150].replace("\n", " "))


def main():
    """--query가 있으면 검색, 없으면 임베딩"""
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default=DEFAULT_CONFIG)
    parser.add_argument("--query")
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()
    if args.query:
        search(args.config, args.query, args.k)
    else:
        embed(args.config)


if __name__ == "__main__":
    main()
