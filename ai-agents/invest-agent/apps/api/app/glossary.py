"""투자 용어 (docs/plan/11-rag-expansion.md 2-2, 12-todo-by-stage.md 1-6).

"PER이 뭐야?"에 LLM 없이 용어집 그대로 답한다 (지어낼 일이 없다).
  data/glossary_fsc.json  금융위원회 금융용어사전 (fsc.go.kr/in090301, 공공데이터포털 15160317, 이용허락 제한 없음)
  data/glossary_app.json  금융위 사전에 없는 기초 용어. 이 앱이 쉬운 말로 쓴 것, reviewed=false면 "검토 전 초안"

찾기: 이름·다른 이름 정확히 일치(공백·대소문자·기호 무시) → 없으면 비슷한 이름 후보만 보여준다 (억지로 붙이지 않음).
ponytail: 벡터 검색은 없다. 용어가 수천 개로 늘거나 "주가가 이익의 몇 배인지" 같은 풀어쓴 질문이 많아지면 임베딩을 붙인다

    uv run python -m app.glossary           # JSON → glossary_terms 테이블
    uv run python -m app.glossary --fetch   # 금융위 사전을 다시 받아 data/glossary_fsc.json 갱신 (23쪽, 1초 간격)
"""

import argparse
import difflib
import html
import json
import re
import time
from datetime import date
from pathlib import Path

from langgraph.runtime import Runtime
from psycopg.rows import dict_row

from app.agents.state import Context, InvestState
from app.db import connect

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FSC_FILE, APP_FILE = DATA_DIR / "glossary_fsc.json", DATA_DIR / "glossary_app.json"
FSC_LIST_URL = "https://www.fsc.go.kr/in090301"
FSC_SOURCE = "금융위원회 금융용어사전"
APP_SOURCE = "투자 에이전트 용어집"


def normalize(text: str) -> str:
    """비교용: 소문자, 공백·기호 제거 ("P/E 비율" = "pe비율")."""
    return re.sub(r"[\s\W_]+", "", text.lower())


def names_of(term: str, aliases: list[str]) -> list[str]:
    """이름과 다른 이름. 괄호 안·밖도 각각 이름으로 본다: "ROE(Return To Equity)" → ROE, Return To Equity."""
    names = [term, *aliases]
    for name in (term, *aliases):
        outside = re.sub(r"\(.*?\)", "", name).strip()
        names += [outside, *[part.strip() for inside in re.findall(r"\((.*?)\)", name) for part in inside.split(",")]]
    return [n for n in dict.fromkeys(names) if normalize(n)]


# ---------- 금융위 사전 받기 ----------

def fetch_fsc() -> list[dict]:
    import httpx  # 받을 때만 필요

    terms = {}
    with httpx.Client(timeout=20, headers={"User-Agent": "invest-agent-glossary"}) as client:
        page, last = 1, 1
        while page <= last:
            text = client.get(FSC_LIST_URL, params={"curPage": page}).text
            last = max([last, *map(int, re.findall(r"curPage=(\d+)", text))])
            for m in re.finditer(r'dicId=(\d+)[^"]*" title="[^"]*">(.*?)</a>\s*</div>\s*<div class="info2">(.*?)</div>', text, re.S):
                body = html.unescape(re.sub(r"<[^>]+>", "", re.sub(r"<br\s*/?>|</p>", "\n", m.group(3))))
                body = "\n".join(line.strip() for line in re.sub(r"[ \t\xa0]+", " ", body).splitlines() if line.strip())
                term = html.unescape(m.group(2)).strip()
                # 같은 용어가 여러 번 올라와 있다. 번호(dicId)가 큰 것(최근 것)을 쓴다
                if term not in terms or int(m.group(1)) > terms[term]["dic_id"]:
                    terms[term] = {"term": term, "dic_id": int(m.group(1)), "body": body,
                                   "url": f"{FSC_LIST_URL}/view?dicId={m.group(1)}"}
            page += 1
            time.sleep(1)
    rows = sorted(terms.values(), key=lambda t: t["term"])
    FSC_FILE.write_text(json.dumps({"source": FSC_SOURCE, "license": "공공데이터포털 15160317, 이용허락범위 제한 없음",
                                    "fetched": str(date.today()), "terms": rows}, ensure_ascii=False, indent=1),
                        encoding="utf-8")
    return rows


# ---------- 테이블에 넣기 ----------

def load(database_url: str | None = None) -> int:
    """두 JSON을 glossary_terms에 덮어쓴다. 같은 이름이면 이 앱 용어집이 우선한다 (기초 용어를 쉬운 말로)."""
    fsc = json.loads(FSC_FILE.read_text(encoding="utf-8"))["terms"]
    app = json.loads(APP_FILE.read_text(encoding="utf-8"))["terms"]
    rows = {}
    for t in fsc:
        rows[normalize(t["term"])] = (t["term"], [], None, t["body"], None, FSC_SOURCE, t["url"], True)
    for t in app:
        rows[normalize(t["term"])] = (t["term"], t.get("aliases", []), t["short"], t["body"], t.get("caution"),
                                      APP_SOURCE, None, t.get("reviewed", False))
    with connect(database_url) as conn:
        conn.execute("DELETE FROM glossary_terms")
        for term, aliases, short, body, caution, source, url, reviewed in rows.values():
            conn.execute(
                "INSERT INTO glossary_terms (term, names, short, body, caution, source, url, reviewed)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (term, [normalize(n) for n in names_of(term, aliases)], short, body, caution, source, url, reviewed),
            )
    return len(rows)


# ---------- 찾기 · 답 ----------

def lookup(conn, text: str) -> tuple[dict | None, list[str]]:
    """(찾은 용어, 못 찾았을 때 비슷한 이름 후보)."""
    key = normalize(text)
    if not key:
        return None, []
    row = conn.execute("SELECT * FROM glossary_terms WHERE %s = ANY(names) ORDER BY source = %s DESC LIMIT 1",
                       (key, APP_SOURCE)).fetchone()
    if row:
        return row, []
    terms = conn.execute("SELECT term, names FROM glossary_terms").fetchall()
    by_name = {name: t["term"] for t in terms for name in t["names"]}
    close = difflib.get_close_matches(key, list(by_name), n=6, cutoff=0.6)
    close += [name for name in by_name if len(key) >= 2 and key in name and name not in close][:6]  # "자본비율" → BIS 자기자본비율
    return None, list(dict.fromkeys(by_name[name] for name in close))[:5]


def format_term(row: dict) -> str:
    lines = [f"{row['term']}"]
    if row["short"]:
        lines.append(row["short"])
    lines += ["", row["body"]]
    if row["caution"]:
        lines += ["", f"주의: {row['caution']}"]
    source = f"출처: {row['source']}" + (f" {row['url']}" if row["url"] else "")
    lines += ["", source + ("" if row["reviewed"] else " (검토 전 초안)")]
    return "\n".join(lines)


def explain_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    term = (state.get("term") or "").strip()
    if not term:
        return {"answer": "어떤 용어가 궁금한지 알려 주세요. 예: PER이 뭐야?"}
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        row, candidates = lookup(conn, term)
    if row:
        return {"answer": format_term(row)}
    hint = f" 비슷한 용어: {', '.join(candidates)}" if candidates else ""
    return {"answer": f"'{term}'은(는) 용어집에 없어요.{hint}"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="투자 용어집 넣기")
    parser.add_argument("--fetch", action="store_true", help="금융위 사전을 다시 받는다")
    if parser.parse_args().fetch:
        print(f"금융위 사전 {len(fetch_fsc())}개 받음")
    print(f"용어집 {load()}개 넣음")
