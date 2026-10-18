"""추출 결과(JSONL)를 문서 유형·콘텐츠 종류별로 청킹한다.

문서 유형
- paper  : 의학 학술지 논문 -> 문단 단위 (줄 길이로 문단 끝을 찾고, 긴 문단은 PAPER_MAX에서 자름)
- general: 보도자료·보고서·판례·책자 -> RecursiveCharacterTextSplitter(chunk_size, overlap)

콘텐츠 종류 (모든 문서 공통)
- text      : 본문 (위 문서 유형 규칙)
- table     : PDF 표 -> 행 단위로 자르고 헤더·각주 반복
- image_text: 스캔·이미지의 OCR/Gemini 텍스트 -> 안의 마크다운 표는 행 단위, 나머지는 chunk_size/overlap
- figure    : Gemini 차트·다이어그램·표 -> 그림 하나를 한 청크로, 길면 제목을 반복해서 나눔
- 사진·로고로 판정된 이미지("[이미지] ...")는 정보가 없어 제외

청크는 페이지를 넘지 않는다 (출처 페이지를 정확히 남기기 위해).

흐름
    main() -> build()
     ├─ jsonl 파일마다
     │   [1] 문서 유형 정하기: PAPER_FILES에 있으면 paper, 아니면 general
     │   [2] paper면 running_lines()로 러닝 타이틀(3쪽 이상 반복되는 줄) 목록 만들기
     │   [3] 페이지마다 chunk_page() -> 청크마다 chunk_id·메타데이터 붙이기
     │       chunk_page(): 블록을 순서대로 보면서
     │         - text  : 버퍼에 모았다가 다른 종류 블록이 나오면 flush_text()
     │                   paper   -> split_paragraphs()로 문단 나누기 (긴 문단은 소제목 반복하며 자름)
     │                   general -> RecursiveCharacterTextSplitter(size, overlap)
     │         - table : split_pdf_table() -> split_table_rows() (행 단위, 헤더·각주 반복)
     │         - figure: split_figure() (그림 하나 = 한 청크, 길면 제목 반복하며 나눔)
     │         - image : 사진("[이미지]")은 버림 / 나머지 split_markdown() (표 구간은 행 단위)
     │         - 20자 미만 조각은 버림
     │   [4] 파일별 미리보기 md 저장 (write_file_preview)
     ├─ 전체 청크를 chunks.jsonl로 저장
     └─ write_stats()로 STATS.md (유형·종류·분야별 개수·길이)

실행
    python -m pipeline.chunk                         # 기본 500/60 -> output/chunks/base_500_60/
    python -m pipeline.chunk --size 800 --overlap 100
    python -m pipeline.chunk --with-header           # 청크 앞에 [파일명 | p.N] 붙이기 (설계 md의 '나중에 추가')
"""

import sys
from pathlib import Path

# pipeline 폴더 안에서 python 파일명.py 로 바로 실행해도 pipeline 패키지를 찾게 한다
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import argparse
import json
import re
import statistics
from collections import Counter

from langchain_text_splitters import RecursiveCharacterTextSplitter

from pipeline.extract import BASE_DIR, jsonl_files, load_records, markdown_row, markdown_table

CHUNK_DIR = BASE_DIR / "output" / "chunks"
# 기본 청킹: 300/50·500/60·800/100 비교 결과 500/60 선택
# (에이전트 정답률 2회 평균 0.819 vs 300/50 0.791, 검색 횟수·응답 시간도 더 적음)
DEFAULT_SIZE, DEFAULT_OVERLAP = 500, 60
DEFAULT_CONFIG = f"base_{DEFAULT_SIZE}_{DEFAULT_OVERLAP}"

# 의학 학술지 논문 (2단·쪽당 2천자 이상 + 1단 논문 journal-31 + 스캔 논문 Kafm015)
PAPER_FILES = {
    "4e304ca4ed0e0b678457e0cf26e372f42395.pdf", "9906002.pdf", "KJFP003-01-08.pdf",
    "enm-26-126.pdf", "jkan-38-140.pdf", "jksc-25-356.pdf", "kjg-74-4.pdf",
    "journal-31-3-308.pdf", "Kafm015-11-15.pdf",
}
PAPER_MAX = 800        # 논문 문단이 이보다 길면 자른다
PAPER_OVERLAP = 100
FIGURE_MAX = 1000      # 그림 하나가 이보다 길면 나눈다
MIN_CHUNK = 20         # 이보다 짧은 조각은 버린다 (쪽 제목 잔여 등)

SENT_END = re.compile(r"[.?!。」”’)\]다요음함됨임]$")
# 번호 소제목은 뒤에 공백이 있을 때만 (예: "1. 대상") - "2010-\n04)." 같은 줄바꿈 숫자와 구분
HEADING = re.compile(r"^(\d{1,2}[.)]\s|\(\d{1,2}\)\s?|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\.\s?|[가-하][.)]\s|[A-Z][.)]\s|[①-⑳]|Table \d|Fig\. ?\d)")
PAGE_NUM = re.compile(r"^[\d\s\-–|]+$")
HANGUL = re.compile(r"[가-힣]")


# ---------------- 논문: 문단 나누기 ----------------

def join_lines(lines):
    """(논문 문단용) 줄바꿈으로 끊긴 단어를 잇는다. 한글-한글 사이는 붙이고(줄 끝 단어 잘림), 나머지는 공백."""
    out = ""
    for line in lines:
        line = line.strip()
        if not out:
            out = line
        elif HANGUL.match(out[-1]) and HANGUL.match(line[:1] or " "):
            out += line
        elif out.endswith("-") and line[:1].isalpha():
            out = out[:-1] + line  # 영어 하이픈 줄바꿈
        else:
            out += " " + line
    return out


def split_paragraphs(text, drop_lines=frozenset()):
    """한 페이지 본문 줄들을 문단으로 나눈다.

    PDF 줄에는 들여쓰기 정보가 없어서 줄 길이로 판단한다.
    - 그 페이지의 일반적인 줄 길이(상위 80%)보다 확연히 짧은 줄 = 문단의 마지막 줄 또는 소제목
    - 번호·로마숫자·Table/Fig로 시작하는 줄 = 새 문단 시작
    - 쪽번호(숫자만 있는 줄)와 러닝 타이틀(drop_lines)은 지운다 -> 단 끝에서 문단이 끊기지 않게
    """
    lines = [l for l in text.split("\n")
             if l.strip() and not PAGE_NUM.match(l.strip()) and l.strip() not in drop_lines]
    if not lines:
        return []
    lengths = sorted(len(l) for l in lines)
    typical = lengths[int(len(lengths) * 0.8) - 1] if len(lengths) >= 5 else max(lengths)

    paras, cur = [], []
    for line in lines:
        if cur and HEADING.match(line.strip()):
            paras.append(cur)
            cur = []
        cur.append(line)
        if len(line) < typical * 0.75:
            paras.append(cur)
            cur = []
    if cur:
        paras.append(cur)

    # 소제목(짧고 문장 끝이 아님)은 다음 문단 앞에 붙인다
    merged, carry = [], ""
    for p in paras:
        t = join_lines(p)
        if len(p) == 1 and len(t) < 40 and not SENT_END.search(t):
            carry = f"{carry}\n{t}" if carry else t
            continue
        merged.append(f"{carry}\n{t}" if carry else t)
        carry = ""
    if carry:
        merged.append(carry)
    return merged


# ---------------- 표: 행 단위로 자르고 헤더 반복 ----------------

def split_table_rows(header_lines, row_lines, suffix, size):
    """34번 노트북 방식: 행 사이에서만 자르고, 모든 조각에 헤더(와 각주)를 반복한다.

    - 헤더(+각주)가 청크 크기의 절반을 넘으면 반복하면 청크가 너무 커지므로 일반 텍스트로 자른다
    - 한 행이 청크 크기를 넘으면 그 행만 길이로 자르고 조각마다 헤더를 붙인다
    """
    render = lambda rows: "\n".join(header_lines + rows) + (f"\n\n{suffix}" if suffix else "")
    splitter = RecursiveCharacterTextSplitter(chunk_size=size, chunk_overlap=0)
    if len(render([])) > size // 2:
        return splitter.split_text(render(row_lines))
    parts, cur = [], []
    for row in row_lines:
        if len(render([row])) > size:
            if cur:
                parts.append(render(cur))
                cur = []
            room = size - len(render([]))
            parts += [render([piece]) for piece in
                      RecursiveCharacterTextSplitter(chunk_size=room, chunk_overlap=0).split_text(row)]
            continue
        if cur and len(render(cur + [row])) > size:
            parts.append(render(cur))
            cur = []
        cur.append(row)
    if cur or not parts:
        parts.append(render(cur))
    return parts


def split_pdf_table(block, size):
    """extract.py가 저장한 표 블록(headers, rows, footnotes) -> 행 단위 청크"""
    header_lines = markdown_table(block["headers"], []).split("\n")
    rows = [markdown_row(r) for r in block["rows"]]
    return split_table_rows(header_lines, rows, block.get("footnotes", ""), size)


def split_markdown(text, size, overlap):
    """마크다운 텍스트(OCR·Gemini 결과): 표 구간은 행 단위로, 나머지는 길이 기준으로 자른다."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=size, chunk_overlap=overlap)
    pieces, buf = [], []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        if lines[i].lstrip().startswith("|"):
            if buf:
                pieces += splitter.split_text("\n".join(buf))
                buf = []
            table = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                table.append(lines[i])
                i += 1
            if len(table) >= 3 and set(table[1].replace("|", "").strip()) <= set("-: "):
                pieces += split_table_rows(table[:2], table[2:], "", size)
            else:
                pieces += splitter.split_text("\n".join(table))
            continue
        buf.append(lines[i])
        i += 1
    if buf:
        pieces += splitter.split_text("\n".join(buf))
    return pieces


def split_figure(text, overlap):
    """Gemini 그림 결과: 짧으면 통째로, 길면 첫 줄(### [차트] 제목)을 조각마다 붙여서 나눈다."""
    if len(text) <= FIGURE_MAX:
        return [text]
    title, _, body = text.partition("\n")
    if not title.startswith("#"):
        return split_markdown(text, FIGURE_MAX, overlap)
    return [f"{title}\n{p}" for p in split_markdown(body, FIGURE_MAX - len(title), overlap)]


# ---------------- 페이지 -> 청크 ----------------

def running_lines(records):
    """같은 파일에서 3쪽 이상 똑같이 반복되는 짧은 줄 = 러닝 타이틀(학술지명·논문 제목 등)"""
    seen = Counter()
    for r in records:
        page_lines = {l.strip() for b in r["blocks"] if b["content_type"] == "text"
                      for l in b["text"].split("\n") if 0 < len(l.strip()) <= 80}
        seen.update(page_lines)
    return frozenset(l for l, n in seen.items() if n >= 3)


def chunk_page(r, doc_type, size, overlap, drop_lines=frozenset()):
    """(텍스트, content_type, 추가 메타데이터) 목록을 페이지 읽기 순서대로 반환한다."""
    splitter = RecursiveCharacterTextSplitter(chunk_size=size, chunk_overlap=overlap)
    # 긴 문단은 문장 끝에서 자르고, 마침표는 앞 조각에 남긴다
    paper_splitter = RecursiveCharacterTextSplitter(
        chunk_size=PAPER_MAX, chunk_overlap=PAPER_OVERLAP,
        separators=["다. ", ". ", " ", ""], keep_separator="end",
    )
    out = []
    text_buf = []

    def flush_text():
        # 모아 둔 본문 줄을 문서 유형 규칙대로 잘라 out에 넣는다
        if not text_buf:
            return
        text = "\n".join(text_buf)
        text_buf.clear()
        if doc_type == "paper":
            for para in split_paragraphs(text, drop_lines):
                if len(para) <= PAPER_MAX:
                    out.append((para, "text", {"method": "paragraph"}))
                    continue
                # 앞에 붙은 소제목은 나눈 조각마다 반복한다
                heading, _, body = para.rpartition("\n")
                for piece in paper_splitter.split_text(body):
                    out.append(((f"{heading}\n{piece}" if heading else piece).strip(), "text",
                                {"method": "paragraph_split"}))
        else:
            for piece in splitter.split_text(text):
                out.append((piece, "text", {"method": f"recursive_{size}_{overlap}"}))

    # 블록을 읽기 순서대로 처리 (본문이 아닌 블록을 만나면 그 전까지의 본문을 먼저 자른다)
    for b in r["blocks"]:
        ct = b["content_type"]
        if ct == "text":
            text_buf.append(b["text"])
            continue
        flush_text()
        if ct == "table":
            for piece in split_pdf_table(b, size):
                out.append((piece, "table", {"table_id": b["table_id"], "method": "table_rows"}))
        elif ct == "figure":
            for piece in split_figure(b["text"], overlap):
                out.append((piece, "figure", {"figure_kind": b["figure_kind"], "figure_id": b["figure_id"],
                                              "image_path": b["image_path"], "method": "figure"}))
        elif ct == "image":
            text = b.get("text", "").strip()
            if not text or text.startswith("[이미지]"):
                continue  # 사진·로고·빈 이미지
            if doc_type == "paper" and r["page_type"] == "scan":
                # 스캔 논문(Kafm015)도 문단 단위로
                text_buf.append(text)
                flush_text()
                continue
            for piece in split_markdown(text, size, overlap):
                out.append((piece, "image_text", {"image_id": b["image_id"], "image_path": b.get("image_path"),
                                                  "source": "gemini" if b.get("vision_method") else "ocr",
                                                  "method": f"markdown_{size}_{overlap}"}))
    flush_text()
    return [(t.strip(), ct, m) for t, ct, m in out if len(t.strip()) >= MIN_CHUNK]


def build(size, overlap, with_header):
    """모든 jsonl -> 청크 목록 -> chunks.jsonl, 파일별 미리보기, STATS.md 저장"""
    name = f"base_{size}_{overlap}" + ("_header" if with_header else "")
    out_dir = CHUNK_DIR / name
    (out_dir / "preview").mkdir(parents=True, exist_ok=True)
    all_chunks = []

    for jsonl in jsonl_files():
        records = load_records(jsonl)
        first = records[0]
        # [1] 문서 유형 / [2] 러닝 타이틀
        doc_type = "paper" if first["file_name"] in PAPER_FILES else "general"
        drop = running_lines(records) if doc_type == "paper" else frozenset()
        # [3] 페이지별 청킹 + ID·메타데이터
        file_chunks = []
        for r in records:
            for idx, (text, ct, meta) in enumerate(chunk_page(r, doc_type, size, overlap, drop)):
                header = f"[{first['file_name']} | p.{r['page_no']}]\n" if with_header else ""
                file_chunks.append({
                    "chunk_id": f"{first['domain']}/{jsonl.stem}/p{r['page_no']:03d}/c{idx:02d}",
                    "text": header + text,
                    "metadata": {
                        "file_name": first["file_name"], "domain": first["domain"], "page_no": r["page_no"],
                        "doc_type": doc_type, "page_type": r["page_type"], "content_type": ct, **meta,
                    },
                })
        all_chunks += file_chunks
        # [4] 파일별 미리보기
        write_file_preview(out_dir / "preview" / first["domain"] / f"{jsonl.stem}.md", first, doc_type, file_chunks)

    with (out_dir / "chunks.jsonl").open("w", encoding="utf-8") as f:
        for c in all_chunks:
            f.write(json.dumps(c, ensure_ascii=False) + "\n")
    write_stats(out_dir, name, all_chunks)
    return out_dir, all_chunks


# ---------------- 미리보기·통계 ----------------

def write_file_preview(path, first, doc_type, chunks):
    """파일 하나의 청크를 순서대로 보여 주는 md"""
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"# {first['file_name']}", "", f"- 유형: {doc_type} / 청크 {len(chunks)}개", ""]
    for c in chunks:
        m = c["metadata"]
        lines += ["---", "",
                  f"### `{c['chunk_id']}`  {m['content_type']} · {m['method']} · {len(c['text'])}자", "",
                  c["text"], ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def write_stats(out_dir, name, chunks):
    """문서 유형·콘텐츠 종류·분야별 청크 수와 길이(평균·중앙값·최소·최대) 표"""
    def row(label, items):
        ls = [len(c["text"]) for c in items]
        if not ls:
            return f"| {label} | 0 | - | - | - | - |"
        return (f"| {label} | {len(ls)} | {int(statistics.mean(ls))} | {int(statistics.median(ls))} "
                f"| {min(ls)} | {max(ls)} |")

    header = ["| 구분 | 청크 수 | 평균 | 중앙값 | 최소 | 최대 |", "|---|---|---|---|---|---|"]
    lines = [f"# 청킹 결과 - {name}", "", row("전체", chunks).replace("| 전체", "전체 요약:"), "",
             "## 문서 유형별", ""] + header
    for dt in ("paper", "general"):
        lines.append(row(dt, [c for c in chunks if c["metadata"]["doc_type"] == dt]))
    lines += ["", "## 콘텐츠 종류별", ""] + header
    for ct in ("text", "table", "image_text", "figure"):
        lines.append(row(ct, [c for c in chunks if c["metadata"]["content_type"] == ct]))
    lines += ["", "## 분야별", ""] + header
    for d in sorted({c["metadata"]["domain"] for c in chunks}):
        lines.append(row(d, [c for c in chunks if c["metadata"]["domain"] == d]))
    lines += ["", "## 파일별 미리보기", ""]
    per_file = Counter((c["metadata"]["domain"], c["chunk_id"].split("/")[1], c["metadata"]["file_name"],
                        c["metadata"]["doc_type"]) for c in chunks)
    for (d, stem, fname, dt), n in sorted(per_file.items()):
        lines.append(f"- [{fname}](<preview/{d}/{stem}.md>) — {dt}, {n}개")
    (out_dir / "STATS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    """청크 크기·겹침을 받아 build() 실행"""
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE)
    parser.add_argument("--overlap", type=int, default=DEFAULT_OVERLAP)
    parser.add_argument("--with-header", action="store_true")
    args = parser.parse_args()
    out_dir, chunks = build(args.size, args.overlap, args.with_header)
    print(f"청크 {len(chunks)}개 -> {out_dir}")


if __name__ == "__main__":
    main()
