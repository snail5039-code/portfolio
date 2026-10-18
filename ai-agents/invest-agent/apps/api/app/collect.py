"""분석에 쓰는 데이터 모으기. 실행: uv run python -m app.collect

1. 시세 (공공데이터포털): 코스피 시가총액 상위 100개, 코스닥 상위 50개를 분석 대상(stocks.is_target)으로 정한다 (TARGETS)
   최근 10일 시장 전체 시세(시장마다 1~2번 호출)로 매일 갱신하고, 새 대상이나 빈 날이 있는 종목만 100일치를 따로 받는다
2. 재무 (OpenDART): 대상 종목의 올해·작년 정기보고서 주요 계정. 이미 받은 보고서는 다시 받지 않는다
3. 공시 (OpenDART): 공시 목록은 마지막으로 받은 날부터. 본문 → 조각 → 임베딩은 최근 정기보고서 2건의 "사업의 내용"·"경영진단"
   (지난 보고서와 비교할 수 있게)과 최근 주요사항보고서 3건 전체 (표는 줄·칸 구분을 살린다, 2-8)
4. 종목 위험등급: 최근 1년 거래소 공시에 관리종목·상장폐지 사유 등이 있으면 1등급 (functions/suitability.py)

여러 번 실행해도 된다. 받은 값은 덮어쓰고, 이미 조각낸 공시는 건너뛴다.
종목마다 따로 저장하므로 중간에 실패해도(호출 한도 등) 다음 실행이 받지 못한 것부터 이어 받는다.
서버를 띄워 두면 매일 AUTO_COLLECT_HOUR시(기본 7시·14시, KST)에 자동으로 실행한다 (app/main.py).
    --skip-prices   1단계를 건너뛰고 지금 분석 대상 종목으로만 (시세 키가 아직 안 될 때)
    --codes A,B     이 종목들만 (stocks에 이미 있어야 함)
    --rechunk       이미 조각낸 본문도 지우고 다시 조각·임베딩 (조각 방식이 바뀌었을 때. Gemini 임베딩 비용이 든다)
"""

import argparse
import logging
import threading
from datetime import datetime, time, timedelta

import psycopg
from psycopg.rows import dict_row

from app import config
from app.agents import llm
from app.clock import KST, seconds_until
from app.db import connect
from app.functions.suitability import RISK_DAYS, RISK_TITLE_EXCLUDE, RISK_TITLE_PATTERN
from app.functions.text import split_text
from app.integrations import market_data, opendart

TARGETS = {"KOSPI": 100, "KOSDAQ": 50}  # 시장별 시가총액 상위 몇 개를 분석 대상으로 (2026-10-07 결정: 150종목)
PRICE_DAYS = 100
RECENT_DAYS = 10  # 매일 받는 시장 전체 시세 기간 (주말·연휴를 넘겨도 최신 거래일이 들어가게)
DISCLOSURE_DAYS = 365
WANTED_SECTIONS = ("사업의 내용", "경영진단")
EMBED_BATCH = 100
PERIODIC_REPORTS = 2   # 정기보고서 최신 몇 건의 본문을 임베딩할지 (최신 + 직전, 2026-10-09)
MAJOR_REPORTS, MAJOR_MAX_CHUNKS = 3, 20  # 주요사항보고서 최신 몇 건, 한 건에 조각 최대 몇 개 (비용 상한)


def amount(text: str | None) -> int | None:
    """OpenDART 금액 문자열 ("1,234", "-1,234", "-", "") → 정수."""
    cleaned = (text or "").replace(",", "").strip()
    return int(cleaned) if cleaned not in ("", "-") else None


# ---------- 1. 시세 ----------

def save_prices(conn: psycopg.Connection, rows: list[dict]) -> None:
    for day in rows:
        conn.execute(
            "INSERT INTO stock_prices (stock_code, trade_date, close, market_cap, listed_shares)"
            " VALUES (%(stock_code)s, %(trade_date)s, %(close)s, %(market_cap)s, %(listed_shares)s)"
            " ON CONFLICT (stock_code, trade_date) DO UPDATE SET close = EXCLUDED.close,"
            " market_cap = EXCLUDED.market_cap, listed_shares = EXCLUDED.listed_shares",
            day,
        )


def collect_prices(conn: psycopg.Connection, api_key: str, today, eligible: set[str]) -> list[str]:
    """eligible: OpenDART에 회사가 있는 종목 코드. 우선주(예: 삼성전자우)는 재무·공시가 따로 없어서 뺀다."""
    conn.execute("UPDATE stocks SET is_target = false")
    codes = []
    for market, count in TARGETS.items():
        recent = market_data.daily_prices(api_key, today - timedelta(days=RECENT_DAYS), today, market=market)
        latest, oldest = max(r["trade_date"] for r in recent), min(r["trade_date"] for r in recent)
        top = sorted((r for r in recent if r["trade_date"] == latest and r["stock_code"] in eligible),
                     key=lambda r: r["market_cap"], reverse=True)[:count]
        full = 0
        for row in top:
            code = row["stock_code"]
            conn.execute(
                "INSERT INTO stocks (code, name, market, is_target) VALUES (%s, %s, %s, true)"
                " ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, market = EXCLUDED.market, is_target = true",
                (code, row["stock_name"], market),
            )
            have = conn.execute("SELECT min(trade_date) AS first, max(trade_date) AS last FROM stock_prices"
                                " WHERE stock_code = %s", (code,)).fetchone()
            # 처음 보는 종목, 오래 비어 있던 종목, 기록이 짧은 종목만 100일치를 따로 받는다. 나머지는 최근 10일 시장 전체로 갱신
            if have["last"] is None or have["last"] < oldest or have["first"] > today - timedelta(days=PRICE_DAYS - RECENT_DAYS):
                save_prices(conn, market_data.daily_prices(api_key, today - timedelta(days=PRICE_DAYS), today, code, market))
                full += 1
            else:
                save_prices(conn, [r for r in recent if r["stock_code"] == code])
        conn.commit()
        codes += [row["stock_code"] for row in top]
        print(f"[시세] {market} {latest} 기준 시가총액 상위 {len(top)}개 (100일치 새로 받은 종목 {full}개)")
    return codes


# ---------- 2. 재무 ----------

def collect_financials(conn: psycopg.Connection, api_key: str, code: str, corp_code: str, year: int) -> int:
    """이미 받은 보고서는 건너뛴다 (정기보고서는 나온 뒤 거의 안 바뀐다). 아직 안 나온 보고서만 매일 다시 물어본다."""
    have = {(r["bsns_year"], r["reprt_code"]) for r in conn.execute(
        "SELECT DISTINCT bsns_year, reprt_code FROM financials WHERE stock_code = %s", (code,))}
    count = 0
    for bsns_year in (year - 1, year):
        for reprt_code in opendart.REPORT_CODES:
            if (bsns_year, reprt_code) in have:
                continue
            for row in opendart.major_accounts(corp_code, bsns_year, reprt_code, api_key):
                conn.execute(
                    "INSERT INTO financials (stock_code, bsns_year, reprt_code, fs_div, account, amount, prev_amount,"
                    " add_amount, prev_add_amount, rcept_no) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
                    " ON CONFLICT (stock_code, bsns_year, reprt_code, fs_div, account) DO UPDATE"
                    " SET amount = EXCLUDED.amount, prev_amount = EXCLUDED.prev_amount, add_amount = EXCLUDED.add_amount,"
                    " prev_add_amount = EXCLUDED.prev_add_amount, rcept_no = EXCLUDED.rcept_no",
                    (code, bsns_year, reprt_code, row["fs_div"], row["account_nm"],
                     amount(row.get("thstrm_amount")), amount(row.get("frmtrm_amount")),
                     amount(row.get("thstrm_add_amount")), amount(row.get("frmtrm_add_amount")), row["rcept_no"]),
                )
                count += 1
    return count


# ---------- 3. 공시 ----------

def save_disclosure(conn: psycopg.Connection, code: str, item: dict) -> None:
    conn.execute(
        "INSERT INTO disclosures (rcept_no, stock_code, title, url, filed_at) VALUES (%s, %s, %s, %s, %s)"
        " ON CONFLICT (rcept_no) DO NOTHING",
        (item["rcept_no"], code, " ".join(item["report_nm"].split()), opendart.disclosure_url(item["rcept_no"]),
         datetime.strptime(item["rcept_dt"], "%Y%m%d").date()),
    )


def collect_disclosures(conn: psycopg.Connection, api_key: str, code: str, corp_code: str, today) -> str:
    """공시 목록은 마지막으로 받은 날부터 (그날 늦게 나온 공시까지 받게 그날도 다시). 정기보고서는 늘 1년치에서 최신을 찾는다
    (지난번 임베딩이 실패한 보고서도 다시 잡히게)."""
    begin, end = f"{today - timedelta(days=DISCLOSURE_DAYS):%Y%m%d}", f"{today:%Y%m%d}"
    last = conn.execute("SELECT max(filed_at) AS d FROM disclosures WHERE stock_code = %s", (code,)).fetchone()["d"]
    since = f"{last:%Y%m%d}" if last and f"{last:%Y%m%d}" > begin else begin
    items = opendart.disclosures(corp_code, api_key, since, end)
    for item in items:
        save_disclosure(conn, code, item)

    periodic = opendart.disclosures(corp_code, api_key, begin, end, kind="A")[:PERIODIC_REPORTS]
    major = opendart.disclosures(corp_code, api_key, begin, end, kind="B")[:MAJOR_REPORTS]
    if not periodic and not major:
        return f"공시 {len(items)}건, 본문 공시 없음"
    done = [embed_report(conn, api_key, code, report, WANTED_SECTIONS) for report in periodic]
    done += [embed_report(conn, api_key, code, report, ("",), MAJOR_MAX_CHUNKS) for report in major]  # 주요사항은 단원 전체
    return f"공시 {len(items)}건, " + ", ".join(done)


def embed_report(conn: psycopg.Connection, api_key: str, code: str, report: dict, wanted: tuple[str, ...],
                 limit: int | None = None) -> str:
    """공시 하나의 본문을 조각내 임베딩한다. 이미 조각낸 공시는 건너뛴다 (다시 하려면 --rechunk)."""
    save_disclosure(conn, code, report)
    name = " ".join(report["report_nm"].split())
    if conn.execute("SELECT 1 FROM disclosure_chunks WHERE rcept_no = %s LIMIT 1", (report["rcept_no"],)).fetchone():
        return f"{name} 이미 조각냄"
    chunks = [
        (title, chunk)
        for title, text in opendart.document_sections(report["rcept_no"], api_key, wanted)
        for chunk in split_text(text)
    ][:limit]
    for start in range(0, len(chunks), EMBED_BATCH):
        batch = chunks[start:start + EMBED_BATCH]
        vectors = llm.embed_documents([chunk for _, chunk in batch])
        for seq, ((title, chunk), vector) in enumerate(zip(batch, vectors), start=start):
            conn.execute(
                "INSERT INTO disclosure_chunks (rcept_no, seq, section, content, embedding)"
                " VALUES (%s, %s, %s, %s, %s::vector)",
                (report["rcept_no"], seq, title or name, chunk, str(vector)),
            )
    return f"{name} 본문 {len(chunks)}조각"


# ---------- 4. 종목 위험등급 ----------

def refresh_risk_grade(conn: psycopg.Connection, code: str, today) -> int:
    """최근 1년 공시 중 가장 최근 위험 공시가 있으면 1등급, 없으면 2등급으로 저장한다."""
    row = conn.execute(
        "SELECT rcept_no FROM disclosures WHERE stock_code = %s AND filed_at >= %s AND regexp_replace(title, '\\s', '', 'g') ~ %s"
        " AND title !~ %s ORDER BY filed_at DESC, rcept_no DESC LIMIT 1",
        (code, today - timedelta(days=RISK_DAYS), RISK_TITLE_PATTERN, RISK_TITLE_EXCLUDE)).fetchone()
    grade = 1 if row else 2
    conn.execute("UPDATE stocks SET risk_grade = %s, risk_rcept_no = %s WHERE code = %s", (grade, row and row["rcept_no"], code))
    return grade


# ---------- 실행 ----------

def run(codes: list[str] | None = None, skip_prices: bool = False, rechunk: bool = False) -> None:
    if not config.OPENDART_API_KEY:
        raise SystemExit("OPENDART_API_KEY가 비어 있습니다 (apps/api/.env)")
    today = datetime.now(KST).date()

    with connect(config.DATABASE_URL, row_factory=dict_row) as conn:
        corp_of = opendart.corp_codes(config.OPENDART_API_KEY)
        if codes:
            pass
        elif skip_prices:
            codes = [row["code"] for row in conn.execute("SELECT code FROM stocks WHERE is_target")]
        else:
            if not config.DATA_GO_KR_API_KEY:
                raise SystemExit("DATA_GO_KR_API_KEY가 비어 있습니다 (apps/api/.env)")
            codes = collect_prices(conn, config.DATA_GO_KR_API_KEY, today, set(corp_of))

        failed = []
        for code in codes:
            name = conn.execute("SELECT name FROM stocks WHERE code = %s", (code,)).fetchone()
            if name is None or code not in corp_of:
                print(f"[건너뜀] {code}: stocks 또는 OpenDART 회사 목록에 없음")
                continue
            try:
                financial_rows = collect_financials(conn, config.OPENDART_API_KEY, code, corp_of[code], today.year)
                if rechunk:
                    conn.execute("DELETE FROM disclosure_chunks WHERE rcept_no IN"
                                 " (SELECT rcept_no FROM disclosures WHERE stock_code = %s)", (code,))
                summary = collect_disclosures(conn, config.OPENDART_API_KEY, code, corp_of[code], today)
                grade = refresh_risk_grade(conn, code, today)
                conn.commit()
            except Exception as error:  # 이 종목만 되돌리고 다음 종목으로. 다음 실행이 이어 받는다
                conn.rollback()
                failed.append(code)
                print(f"[실패] {name['name']}({code}): {error}")
                continue
            print(f"[재무·공시] {name['name']}({code}) 재무 {financial_rows}줄, {summary}" + (" · 위험등급 1등급" if grade == 1 else ""))
        if failed:
            print(f"[실패] {len(failed)}개 종목 ({', '.join(failed)}). 다시 실행하면 이어 받는다")


# ---------- 매일 자동 실행 ----------

def run_daily(stop: threading.Event, hour: int) -> None:
    """서버가 켜져 있는 동안 매일 hour시에 수집한다. stop이 켜지면 끝난다."""
    while not stop.wait(seconds_until(time(hour), datetime.now(KST), trading_days_only=False)):
        try:
            run()
        except (Exception, SystemExit):  # 하루 실패해도 서버는 계속 돌고 다음 날 다시 한다
            logging.getLogger(__name__).exception("자동 수집 실패")


def main() -> None:
    parser = argparse.ArgumentParser(description="분석용 시세·재무·공시 수집")
    parser.add_argument("--skip-prices", action="store_true")
    parser.add_argument("--codes", help="쉼표로 구분한 종목 코드")
    parser.add_argument("--rechunk", action="store_true")
    args = parser.parse_args()
    run(args.codes.split(",") if args.codes else None, args.skip_prices, args.rechunk)


if __name__ == "__main__":
    main()
