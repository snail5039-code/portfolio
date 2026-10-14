"""금융감독원 OpenDART: 공시 목록, 주요 재무 계정, 공시 원문 (읽기 전용 공개 데이터).

https://opendart.fss.or.kr/guide/main.do
"""

import html
import io
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import httpx

BASE_URL = "https://opendart.fss.or.kr/api"
CORP_CODE_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "opendart_corp_codes.xml"
TIMEOUT_SECONDS = 60
# OpenDART 자체 상태 코드: "000" 정상, "013" 조회 결과 없음(오류 아님)
STATUS_OK, STATUS_NO_DATA = "000", "013"

REPORT_CODES = {"11013": "1분기", "11012": "반기", "11014": "3분기", "11011": "사업"}


class OpenDartError(Exception):
    pass


def disclosure_url(rcept_no: str) -> str:
    return f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"


def get_json(path: str, api_key: str, **params) -> list[dict]:
    payload = httpx.get(f"{BASE_URL}/{path}", params={"crtfc_key": api_key, **params}, timeout=TIMEOUT_SECONDS).json()
    if payload.get("status") == STATUS_NO_DATA:
        return []
    if payload.get("status") != STATUS_OK:
        raise OpenDartError(f"{path}: {payload.get('status')} {payload.get('message')}")
    return payload.get("list", [])


def corp_codes(api_key: str) -> dict[str, str]:
    """종목 코드 → OpenDART 회사 코드. 목록 파일은 거의 안 바뀌어서 한 번 받아 저장해 둔다 (지우면 다시 받음)."""
    if not CORP_CODE_CACHE_PATH.exists():
        raw = httpx.get(f"{BASE_URL}/corpCode.xml", params={"crtfc_key": api_key}, timeout=TIMEOUT_SECONDS).content
        try:
            xml_bytes = zipfile.ZipFile(io.BytesIO(raw)).read("CORPCODE.xml")
        except zipfile.BadZipFile as error:  # 키가 틀리면 zip 대신 오류 XML이 온다
            raise OpenDartError(f"corpCode.xml이 zip이 아님: {raw[:200]!r}") from error
        CORP_CODE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CORP_CODE_CACHE_PATH.write_bytes(xml_bytes)
    root = ET.parse(CORP_CODE_CACHE_PATH).getroot()
    return {
        item.findtext("stock_code").strip(): item.findtext("corp_code")
        for item in root.iter("list") if (item.findtext("stock_code") or "").strip()
    }


def disclosures(corp_code: str, api_key: str, begin: str, end: str, kind: str | None = None) -> list[dict]:
    """공시 목록 (최신부터, 최대 100건). kind="A"면 정기공시(사업·반기·분기보고서)만, "B"면 주요사항보고만. 날짜는 YYYYMMDD."""
    params = {"corp_code": corp_code, "bgn_de": begin, "end_de": end, "page_count": 100}
    return get_json("list.json", api_key, **params, **({"pblntf_ty": kind} if kind else {}))


def major_accounts(corp_code: str, year: int, reprt_code: str, api_key: str) -> list[dict]:
    """단일회사 주요 계정 (매출액, 영업이익, 당기순이익, 부채총계, 자본총계 등, 연결·별도)."""
    return get_json("fnlttSinglAcnt.json", api_key, corp_code=corp_code, bsns_year=str(year), reprt_code=reprt_code)


def document_sections(rcept_no: str, api_key: str, wanted: tuple[str, ...]) -> list[tuple[str, str]]:
    """공시 원문에서 제목에 wanted 글자가 들어간 큰 단원만 꺼내 (제목, 본문 글자)로 돌려준다."""
    raw = httpx.get(f"{BASE_URL}/document.xml", params={"crtfc_key": api_key, "rcept_no": rcept_no},
                    timeout=TIMEOUT_SECONDS).content
    if b"<status>014</status>" in raw[:300]:
        return []  # "파일이 존재하지 않습니다": 원문 파일이 없는 공시 (2026-10-07 신한지주 반기보고서). 본문 없이 넘어간다
    try:
        archive = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile as error:
        raise OpenDartError(f"document.xml이 zip이 아님: {raw[:200]!r}") from error
    document = archive.read(archive.namelist()[0]).decode("utf-8", "replace")
    return [(title, text) for title, text in sections_of(document) if any(word in title for word in wanted)]


def table_text(table: str) -> str:
    """<TABLE>을 "[표] 칸 | 칸 ; 칸 | 칸 [표 끝]"으로. 표의 줄·칸 구분을 살려서 숫자가 어느 항목 것인지 남게 한다 (2-8)"""
    rows = []
    for row in re.findall(r"<TR[^>]*>(.*?)</TR>", table, re.DOTALL):
        cells = [" ".join(re.sub(r"<[^>]+>", " ", cell).split()) for cell in re.findall(r"<T[DHEU][^>]*>(.*?)</T[DHEU]>", row, re.DOTALL)]
        if any(cells):
            rows.append(" | ".join(cells))
    return f" [표] {' ; '.join(rows)} [표 끝] " if rows else " "


def sections_of(document: str) -> list[tuple[str, str]]:
    """<SECTION-1> 단원마다 (제목, 태그를 지운 본문). 표는 줄·칸 구분을 남긴다."""
    result = []
    for block in re.findall(r"<SECTION-1[^>]*>(.*?)</SECTION-1>", document, re.DOTALL):
        title = re.search(r"<TITLE[^>]*>(.*?)</TITLE>", block, re.DOTALL)
        block = re.sub(r"<TABLE[^>]*>(.*?)</TABLE>", lambda m: table_text(m.group(1)), block, flags=re.DOTALL)
        text = html.unescape(re.sub(r"<[^>]+>", " ", block))
        result.append((title.group(1).strip() if title else "", re.sub(r"\s+", " ", text).strip()))
    return result
