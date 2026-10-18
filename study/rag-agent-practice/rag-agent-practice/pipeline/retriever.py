"""검색기 모듈 - 에이전트와 평가 코드가 같은 검색기를 쓰도록 한곳에 모았다.

검색 방식
- similarity: Chroma 벡터 검색 (gemini-embedding-2, 코사인)
- mmr       : 벡터 후보 fetch_k개 중 다양성을 고려해 k개
- bm25      : Kiwi 형태소 토큰 + BM25Okapi
- hybrid    : similarity·bm25 각각 fetch_k개를 RRF(순위 합산)로 합쳐 k개

에이전트 검색 규칙
- Hybrid로 k개 찾기 (처음에는 표 질문만 MMR이었지만 실패 분석 후 표도 Hybrid로 바꿈 - Retriever 옵션 참고)
- domain을 주면 그 분야 결과와 전체 결과를 RRF로 섞는다
- 찾은 청크마다 같은 쪽의 앞뒤 청크 1개씩을 붙여서 넘긴다

흐름
    Retriever(config)
     [1] chunks.jsonl 읽기 -> chunk_id로 본문·메타데이터를 찾을 수 있게 사전으로
     [2] Chroma 컬렉션 열기(embed.get_store) -> similarity, mmr
     [3] BM25Search로 전체 청크 색인 (Kiwi 형태소, vectordb/bm25_<설정>.pkl에 저장해 두고 재사용)
    Retriever.search(query, is_table, domain, k)
     [1] hybrid() (table_mode="mmr"이고 표 질문이면 mmr())
     [2] domain_fallback: 분야 결과 + 전체 결과를 RRF로
     [3] with_neighbors(): 앞뒤 청크를 붙여 한 덩어리로 -> 청크 dict 목록 (chunk_id, chunk_ids, 파일명, 쪽, 본문 ...)

실행 (동작 확인용)
    python -m pipeline.retriever "보험업권 상생금융이 뭐야?"
    python -m pipeline.retriever "DC 퇴직연금에서 투자위험은 누가 부담하나요?" --table
"""

import sys
from pathlib import Path

# pipeline 폴더 안에서 python 파일명.py 로 바로 실행해도 pipeline 패키지를 찾게 한다
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import hashlib
import json
import pickle
import time
from collections import defaultdict

from rank_bm25 import BM25Okapi

from pipeline.chunk import CHUNK_DIR, DEFAULT_CONFIG
from pipeline.embed import VECTORDB_DIR, get_store

RRF_C = 60  # RRF 상수 (순위 1등 = 1/61)
DOMAINS = ("finance", "public", "commerce", "law", "medical")


class BM25Search:
    """Kiwi로 형태소를 나눠 BM25로 검색한다. 조사·어미는 빼고 의미 있는 품사만 쓴다.

    청크를 형태소로 나누는 데 20초쯤 걸려서, cache_path를 주면 나눈 결과를 파일로 저장해 두고
    다음부터는 읽어 온다. 청크 본문이 하나라도 바뀌면(fingerprint가 다르면) 다시 만든다.
    """
    KEEP = ("NN", "NR", "NP", "VV", "VA", "XR", "SL", "SN", "SH", "MAG")

    def __init__(self, chunks, cache_path=None):
        from kiwipiepy import Kiwi
        self.kiwi = Kiwi()
        self.chunks = chunks
        t0 = time.time()
        fingerprint = hashlib.sha1("".join(c["chunk_id"] + c["text"] for c in chunks).encode()).hexdigest()
        cache = pickle.loads(cache_path.read_bytes()) if cache_path and cache_path.exists() else {}
        if cache.get("fingerprint") == fingerprint:
            corpus, how = cache["corpus"], "저장된 색인 사용"
        else:
            corpus, how = [self.tokenize(c["text"]) for c in chunks], "새로 만듦"
            if cache_path:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_bytes(pickle.dumps({"fingerprint": fingerprint, "corpus": corpus}))
        self.bm25 = BM25Okapi(corpus)
        print(f"  BM25 색인: 청크 {len(chunks)}개, {how} ({time.time() - t0:.1f}초)")

    def tokenize(self, text):
        return [t.form.lower() for t in self.kiwi.tokenize(text) if t.tag.startswith(self.KEEP)]

    def search(self, query, k, keep=None):
        """BM25 상위 k개. keep(청크 -> bool)을 주면 조건에 맞는 청크 중에서만 고른다."""
        scores = self.bm25.get_scores(self.tokenize(query))
        order = sorted(range(len(scores)), key=lambda i: -scores[i])
        return [self.chunks[i] for i in order if keep is None or keep(self.chunks[i])][:k]


def rrf(*ranked_lists, top):
    """여러 순위 목록을 RRF로 합친다: 점수 = Σ 1 / (60 + 순위). 청크 dict에는 chunk_id가 있어야 한다."""
    scores, items = defaultdict(float), {}
    for ranked in ranked_lists:
        for rank, c in enumerate(ranked, start=1):
            scores[c["chunk_id"]] += 1 / (RRF_C + rank)
            items[c["chunk_id"]] = c
    return [items[cid] for cid in sorted(scores, key=lambda x: -scores[x])[:top]]


def load_chunk_rows(config):
    """chunks.jsonl -> 검색에 쓰는 평평한 dict 목록 (본문 + 주요 메타데이터)"""
    rows = []
    for line in (CHUNK_DIR / config / "chunks.jsonl").open(encoding="utf-8"):
        c = json.loads(line)
        m = c["metadata"]
        rows.append({"chunk_id": c["chunk_id"], "file_name": m["file_name"], "page_no": m["page_no"],
                     "domain": m["domain"], "content_type": m["content_type"], "text": c["text"]})
    return rows


def chunk_pos(chunk_id):
    """"domain/stem/p003/c02" -> ("domain/stem/p003", 2): 같은 쪽 안에서 몇 번째 청크인지"""
    prefix, idx = chunk_id.rsplit("/c", 1)
    return prefix, int(idx)


def join_overlap(a, b, max_overlap=100):
    """이어진 두 청크를 합친다. 청킹 겹침(overlap)으로 b 앞부분이 a 끝과 같으면 한 번만 쓴다."""
    for n in range(min(len(a), len(b), max_overlap), 0, -1):
        if a.endswith(b[:n]):
            return a + b[n:]
    return a + "\n" + b


class Retriever:
    """검색기. 옵션 (RAGAS·agentevals 실패 분석으로 추가, 200문제 정답률 0.827·0.811 -> 0.872)
    - neighbors      : 찾은 청크마다 같은 쪽의 앞뒤 청크를 n개씩 붙여 한 덩어리로 넘긴다 (0이면 안 붙임)
                       -> 쪽은 찾았는데 답이 적힌 청크가 빠지는 문제 대응
    - table_mode     : 표 질문 검색 방식 "mmr" 또는 "hybrid"
                       -> MMR은 같은 표의 행 청크를 하나만 가져와서 표 질문 정답률이 낮았음 (0.55 -> 0.67)
    - domain_fallback: domain을 지정해도 전체 검색 결과를 RRF로 섞는다
                       -> 분야를 잘못 고르면 정답률 0.3 수준이었음
    """

    def __init__(self, config=DEFAULT_CONFIG, k=5, fetch_k=20, neighbors=1, table_mode="hybrid", domain_fallback=True):
        self.k, self.fetch_k = k, fetch_k
        self.neighbors, self.table_mode, self.domain_fallback = neighbors, table_mode, domain_fallback
        # [1] 청크 읽기
        self.rows = load_chunk_rows(config)
        self.by_id = {r["chunk_id"]: r for r in self.rows}
        # [2] 벡터DB / [3] BM25 색인
        self.store = get_store(config)
        self.bm25_index = BM25Search(self.rows, cache_path=VECTORDB_DIR / f"bm25_{config}.pkl")

    def _docs(self, docs):
        # Chroma 결과(Document) -> chunks.jsonl의 청크 dict
        return [self.by_id[d.metadata["chunk_id"]] for d in docs]

    def similarity(self, query, k, domain=None):
        flt = {"domain": domain} if domain else None
        return self._docs(self.store.similarity_search(query, k=k, filter=flt))

    def mmr(self, query, k, domain=None):
        flt = {"domain": domain} if domain else None
        return self._docs(self.store.max_marginal_relevance_search(query, k=k, fetch_k=self.fetch_k, filter=flt))

    def bm25(self, query, k, domain=None):
        keep = (lambda c: c["domain"] == domain) if domain else None
        return self.bm25_index.search(query, k, keep=keep)

    def hybrid(self, query, k, domain=None):
        return rrf(self.similarity(query, self.fetch_k, domain), self.bm25(query, self.fetch_k, domain), top=k)

    def with_neighbors(self, hits, n):
        """찾은 청크마다 같은 쪽의 앞뒤 n개를 붙인다. 겹치거나 이어지는 구간은 한 덩어리로 합치고,
        덩어리 순서는 그 안에서 가장 순위가 높은 청크 기준. 덩어리의 chunk_id·출처는 그 청크를 따른다."""
        spans = {}   # 쪽 -> 붙일 청크 번호들
        best = {}    # (쪽, 청크 번호) -> 검색 순위
        for rank, hit in enumerate(hits):
            prefix, idx = chunk_pos(hit["chunk_id"])
            best[(prefix, idx)] = rank
            spans.setdefault(prefix, set()).update(
                j for j in range(idx - n, idx + n + 1) if f"{prefix}/c{j:02d}" in self.by_id)

        blocks = []
        for prefix, nums in spans.items():
            run = []
            for j in sorted(nums) + [None]:  # None: 마지막 구간을 내보내기 위한 표시
                if run and (j is None or j != run[-1] + 1):
                    ranked = [(best[(prefix, x)], x) for x in run if (prefix, x) in best]
                    rank, hit_idx = min(ranked)
                    ids = [f"{prefix}/c{x:02d}" for x in run]
                    text = self.by_id[ids[0]]["text"]
                    for cid in ids[1:]:
                        text = join_overlap(text, self.by_id[cid]["text"])
                    blocks.append((rank, {**self.by_id[f"{prefix}/c{hit_idx:02d}"], "text": text, "chunk_ids": ids}))
                    run = []
                if j is not None:
                    run.append(j)
        return [b for _, b in sorted(blocks, key=lambda x: x[0])]

    def search(self, query, is_table=False, domain=None, k=None):
        """에이전트 검색: 표 질문이면 table_mode(기본 MMR), 아니면 Hybrid (+ 옵션: 분야 보완, 앞뒤 청크)"""
        k = k or self.k
        domain = domain if domain in DOMAINS else None
        find = self.mmr if is_table and self.table_mode == "mmr" else self.hybrid
        hits = find(query, k, domain)
        if domain and self.domain_fallback:
            hits = rrf(hits, find(query, k, None), top=k)
        return self.with_neighbors(hits, self.neighbors) if self.neighbors else hits


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query")
    parser.add_argument("--table", action="store_true", help="표 질문으로 검색 (MMR)")
    parser.add_argument("--domain", choices=DOMAINS)
    parser.add_argument("--k", type=int, default=5)
    args = parser.parse_args()
    r = Retriever(k=args.k)
    for i, c in enumerate(r.search(args.query, args.table, args.domain), start=1):
        print(f"[{i}] {c['file_name']} p.{c['page_no']} ({c['content_type']}) {c['chunk_id']}")
        print("    ", c["text"][:150].replace("\n", " "))


if __name__ == "__main__":
    main()
