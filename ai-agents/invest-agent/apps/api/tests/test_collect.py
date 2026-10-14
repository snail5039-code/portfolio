"""수집 명령 테스트. 공공데이터포털·OpenDART·임베딩은 가짜로 바꿔 끼운다."""

from datetime import date

import psycopg
import pytest
from psycopg.rows import dict_row

from app import collect
from app.integrations import market_data, opendart


def price_row(code, name, day, close, cap):
    return {"stock_code": code, "stock_name": name, "trade_date": day, "close": close,
            "market_cap": cap, "listed_shares": cap // close}


@pytest.fixture
def conn(migrated):
    with psycopg.connect(migrated, row_factory=dict_row) as c:
        yield c
        c.rollback()


def test_amount_parsing() -> None:
    assert collect.amount("1,234") == 1234
    assert collect.amount("-1,234") == -1234
    assert collect.amount("-") is None
    assert collect.amount("") is None
    assert collect.amount(None) is None


def test_collect_prices_marks_top_by_market_cap_on_latest_day(conn, monkeypatch) -> None:
    old, new = date(2026, 10, 1), date(2026, 10, 2)
    rows = {
        "KOSPI": [
            price_row("111111", "작은회사", new, 1000, 10_000),
            price_row("222222", "큰회사", new, 5000, 900_000),
            price_row("333333", "어제만큰회사", old, 9000, 9_000_000),  # 최신일이 아니라 순위에서 빠진다
            price_row("222225", "큰회사우", new, 5000, 950_000),       # 우선주: OpenDART에 없어서 빠진다
        ],
        "KOSDAQ": [price_row("444444", "코닥회사", new, 2000, 50_000)],
    }
    calls = []

    def fake_daily_prices(api_key, begin, end, stock_code=None, market="KOSPI"):
        calls.append(stock_code)
        return [r for r in rows[market] if stock_code in (None, r["stock_code"])]

    monkeypatch.setattr(market_data, "daily_prices", fake_daily_prices)
    monkeypatch.setattr(collect, "TARGETS", {"KOSPI": 1, "KOSDAQ": 1})

    assert collect.collect_prices(conn, "key", new, eligible={"111111", "222222", "333333", "444444"}) == ["222222", "444444"]
    targets = conn.execute("SELECT code, market FROM stocks WHERE is_target ORDER BY code").fetchall()
    assert [(t["code"], t["market"]) for t in targets] == [("222222", "KOSPI"), ("444444", "KOSDAQ")]
    assert conn.execute("SELECT close FROM stock_prices WHERE stock_code = '222222'").fetchone()["close"] == 5000
    assert calls == [None, "222222", None, "444444"]  # 처음 보는 종목은 100일치를 따로 받는다

    # 다음 날: 기록이 충분한 종목은 시장 전체 시세로만 갱신한다 (종목별 호출 없음)
    conn.execute("INSERT INTO stock_prices SELECT '222222', d::date, 5000, 900000, 180 FROM"
                 " generate_series('2026-06-20'::date, '2026-09-30'::date, '1 day') d ON CONFLICT DO NOTHING")
    rows["KOSPI"].append(price_row("222222", "큰회사", date(2026, 10, 5), 5100, 918_000))
    calls.clear()
    collect.collect_prices(conn, "key", date(2026, 10, 5), eligible={"222222", "444444"})
    assert calls == [None, None, "444444"]  # 코닥회사는 기록이 짧아 아직 따로 받는다
    assert conn.execute("SELECT close FROM stock_prices WHERE stock_code = '222222' AND trade_date = '2026-10-05'"
                        ).fetchone()["close"] == 5100


def test_risk_grade_from_exchange_disclosures(conn) -> None:
    from app.functions.suitability import stock_risk
    conn.execute("INSERT INTO stocks (code, name, market) VALUES ('888888', '위험회사', 'KOSDAQ') ON CONFLICT DO NOTHING")
    conn.execute("INSERT INTO disclosures VALUES ('W1', '888888', '주권매매거래정지(풍문또는보도관련)', 'u', '2026-09-01'),"
                 " ('W2', '888888', '기타시장안내(관리종목지정우려종목)', 'u', '2026-03-25'),"
                 " ('W3', '888888', '내부결산시점관리종목지정ㆍ형식적상장폐지ㆍ상장적격성 실질심사사유발생', 'u', '2025-03-01'),"
                 " ('W4', '888888', '상장폐지승인을위한의안상정결정', 'u', '2026-09-20'),"  # 이전상장 준비: 위험 아님
                 " ('W5', '888888', '주권매매거래정지해제 (상장적격성 실질심사 대상 제외 결정)', 'u', '2026-09-10')")
    assert collect.refresh_risk_grade(conn, "888888", date(2026, 10, 5)) == 1
    assert stock_risk(conn, "888888") == (1, {"rcept_no": "W2", "title": "기타시장안내(관리종목지정우려종목)",
                                              "filed_at": date(2026, 3, 25),
                                              "later": "상장폐지승인을위한의안상정결정 (2026-09-20)"})  # 뒤에 나온 관련 공시도 함께
    # 1년이 지나면 2등급으로 돌아온다. 풍문 거래정지는 위험 공시로 보지 않는다
    assert collect.refresh_risk_grade(conn, "888888", date(2027, 3, 30)) == 2
    assert stock_risk(conn, "888888") == (2, None)


def test_collect_financials_and_disclosures(conn, monkeypatch) -> None:
    conn.execute("INSERT INTO stocks (code, name, market) VALUES ('999999', '테스트회사', 'KOSPI') ON CONFLICT DO NOTHING")
    accounts = [
        {"fs_div": "CFS", "account_nm": "자본총계", "thstrm_amount": "1,000", "frmtrm_amount": "900", "rcept_no": "R1"},
        {"fs_div": "CFS", "account_nm": "당기순이익(손실)", "thstrm_amount": "-50", "frmtrm_amount": "-", "rcept_no": "R1"},
    ]
    monkeypatch.setattr(opendart, "major_accounts",
                        lambda corp, year, reprt, key: accounts if (year, reprt) == (2025, "11011") else [])
    filing = {"rcept_no": "R1", "report_nm": "사업보고서 (2025.12) ", "rcept_dt": "20260310"}
    other = {"rcept_no": "R2", "report_nm": "주요사항보고서", "rcept_dt": "20260401"}
    monkeypatch.setattr(opendart, "disclosures",
                        lambda corp, key, begin, end, kind=None: {"A": [filing], "B": []}.get(kind, [other, filing]))
    monkeypatch.setattr(opendart, "document_sections",
                        lambda rcept_no, key, wanted: [("II. 사업의 내용", "반도체를 만든다. " * 200)])
    embedded = []
    monkeypatch.setattr(collect.llm, "embed_documents",
                        lambda texts: embedded.extend(texts) or [[0.1] * 768 for _ in texts])

    asked = []
    monkeypatch.setattr(opendart, "major_accounts",
                        lambda corp, year, reprt, key: asked.append((year, reprt)) or (accounts if (year, reprt) == (2025, "11011") else []))
    assert collect.collect_financials(conn, "key", "999999", "C1", 2026) == 2 and len(asked) == 8
    asked.clear()
    assert collect.collect_financials(conn, "key", "999999", "C1", 2026) == 0
    assert len(asked) == 7 and (2025, "11011") not in asked  # 이미 받은 보고서는 다시 묻지 않는다
    first = collect.collect_disclosures(conn, "key", "999999", "C1", date(2026, 10, 5))
    since = []
    monkeypatch.setattr(opendart, "disclosures",
                        lambda corp, key, begin, end, kind=None: since.append((begin, kind)) or ([filing] if kind == "A" else []))
    second = collect.collect_disclosures(conn, "key", "999999", "C1", date(2026, 10, 5))
    # 목록은 마지막 공시일부터, 정기보고서·주요사항보고서는 1년치
    assert since == [("20260401", None), ("20251005", "A"), ("20251005", "B")]

    row = conn.execute("SELECT amount, prev_amount FROM financials WHERE stock_code = '999999'"
                       " AND account = '당기순이익(손실)'").fetchone()
    assert (row["amount"], row["prev_amount"]) == (-50, None)
    assert conn.execute("SELECT count(*) AS n FROM disclosures WHERE stock_code = '999999'").fetchone()["n"] == 2
    chunks = conn.execute("SELECT count(*) AS n, min(section) AS section FROM disclosure_chunks WHERE rcept_no = 'R1'").fetchone()
    assert chunks["n"] == len(embedded) > 1
    assert chunks["section"] == "II. 사업의 내용"
    assert "본문" in first and "이미 조각냄" in second  # 두 번째 실행은 다시 임베딩하지 않는다


def test_sections_of_extracts_titles_and_plain_text() -> None:
    document = ("<SECTION-1><TITLE>I. 회사의 개요</TITLE><P>개요</P></SECTION-1>"
                "<SECTION-1><TITLE ATOC=\"Y\">II. 사업의 내용</TITLE><P>메모리 &amp; 파운드리</P>"
                "<TABLE><TR><TH>구분</TH><TH>2025</TH></TR><TR><TD>매출</TD><TE ALIGN=\"R\">1,200</TE></TR></TABLE></SECTION-1>")
    assert opendart.sections_of(document) == [
        ("I. 회사의 개요", "I. 회사의 개요 개요"),
        ("II. 사업의 내용", "II. 사업의 내용 메모리 & 파운드리 [표] 구분 | 2025 ; 매출 | 1,200 [표 끝]"),  # 표의 줄·칸을 남긴다
    ]


def test_major_reports_are_embedded_with_chunk_limit(conn, monkeypatch) -> None:
    conn.execute("INSERT INTO stocks (code, name, market) VALUES ('999998', '주요사항회사', 'KOSPI') ON CONFLICT DO NOTHING")
    major = {"rcept_no": "M1", "report_nm": "주요사항보고서(유상증자결정)", "rcept_dt": "20260901"}
    monkeypatch.setattr(opendart, "disclosures", lambda corp, key, begin, end, kind=None: [major] if kind == "B" else [])
    monkeypatch.setattr(opendart, "document_sections", lambda rcept_no, key, wanted: [("", "유상증자를 결정했다. " * 2000)])
    monkeypatch.setattr(collect.llm, "embed_documents", lambda texts: [[0.1] * 768 for _ in texts])
    summary = collect.collect_disclosures(conn, "key", "999998", "C2", date(2026, 10, 5))
    row = conn.execute("SELECT count(*) AS n, min(section) AS section FROM disclosure_chunks WHERE rcept_no = 'M1'").fetchone()
    assert row["n"] == collect.MAJOR_MAX_CHUNKS and row["section"] == "주요사항보고서(유상증자결정)"  # 제목 없는 단원은 공시 이름
    assert "주요사항보고서(유상증자결정) 본문 20조각" in summary


def test_seconds_until_next_run() -> None:
    from datetime import datetime

    from app.clock import KST
    assert collect.seconds_until(15, datetime(2026, 10, 6, 14, 0, tzinfo=KST)) == 3600
    assert collect.seconds_until(15, datetime(2026, 10, 6, 15, 0, tzinfo=KST)) == 24 * 3600  # 정각이면 다음 날
    assert collect.seconds_until(15, datetime(2026, 10, 6, 16, 30, tzinfo=KST)) == 22.5 * 3600


def test_run_daily_stops_when_asked(monkeypatch) -> None:
    import threading
    calls = []
    monkeypatch.setattr(collect, "seconds_until", lambda hour, now: 0)
    stop = threading.Event()

    def fake_run():
        calls.append(1)
        if len(calls) == 2:
            stop.set()
        raise RuntimeError("하루 실패해도 계속")

    monkeypatch.setattr(collect, "run", fake_run)
    collect.run_daily(stop, 15)
    assert len(calls) == 2


def test_document_without_file_has_no_sections(monkeypatch) -> None:
    body = '<?xml version="1.0" encoding="UTF-8"?><result><status>014</status><message>파일이 존재하지 않습니다.</message></result>'
    monkeypatch.setattr(opendart.httpx, "get", lambda *a, **k: type("R", (), {"content": body.encode()})())
    assert opendart.document_sections("R1", "key", ("사업의 내용",)) == []  # 실패로 종목 전체를 되돌리지 않는다
