"""분석 그래프: 투자 AI ↔ 검증 AI (docs/plan/04-graph-design.md 4장).

    find_stock → check_target → get_account → gather → invest_agent → verify_agent ─┬─ record → END
                                                              ↑                      │
                                                              └── 반려, 수정 2번 미만 ─┘

- gather: 출처(공시·재무·시세·계좌)를 모으고 지표를 코드로 계산한다. 출처마다 ID를 붙인다
- invest_agent: 투자 AI가 제안서를 쓴다. 성향에 맞지 않는 행동이면 코드가 '관찰'로 바꾼다
- verify_agent: 검증 AI는 투자 AI의 입력을 보지 않는다. 제안서의 근거·출처 ID만 받아서
  출처 원문을 DB에서 다시 읽고, 지표를 다시 계산하고, 코드 검사를 먼저 한 뒤 판정한다 (FR-17)
- record: 제안서와 판정을 저장하고 답을 만든다 (저장은 이 노드에서만)
"""

import json
import logging
import re
from datetime import datetime, timedelta

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.agents import llm
from app.agents.interrupts import pause
from app.agents.query import SOURCE_LABELS, as_of, end_if_answered, find_stock_node, fresh_snapshot, latest_close, won
from app.agents.state import Context, InvestState
from app.clock import KST
from app.db import connect
from app.functions import metrics, orders
from app.functions.profile import LABELS
from app.functions.suitability import allowed_actions, buy_block_reason, stock_risk
from app import config, signals
from app.integrations import google_news
from app.integrations.opendart import disclosure_url

MAX_REVISIONS = 2
MAX_ANALYSES_PER_DAY = 100  # Gemini 비용 관리 (NFR-14). 2026-10-12 사용자 결정: 장중 AI 매도 점검으로 20 → 100
SEARCH_RESULTS = 6
# 공시 본문 검색 (12-todo-by-stage.md 2-8). 요청 하나에 관점 3개를 더해 검색한다 ("사도 돼?"처럼 막연한 요청도 근거가 고르게)
SEARCH_ASPECTS = ("실적과 수익성", "위험 요인", "사업 전망과 계획")
SEARCH_PER_QUERY = 3      # 검색어마다 이만큼 후보
SEARCH_MAX_DISTANCE = 0.6  # 코사인 거리. 이보다 멀면 관련 없다고 본다 (2026-10-07 측정: 관련 문단 0.33~0.56)
SEARCH_RELATIVE_GAP = 0.05  # 그 검색어의 1등보다 이만큼 넘게 먼 문단은 쓰지 않는다 (질문마다 거리 수준이 달라 상대 기준)
MIN_HANGUL_SHARE = 0.3      # 한글이 이보다 적은 조각은 깨진 표 조각으로 보고 근거로 쓰지 않는다
RECENT_DISCLOSURES = 5
# 뉴스 (12-todo-by-stage.md 2-2): 종목마다 최근 NEWS_DAYS일 기사 NEWS_RESULTS개. 같은 종목은 NEWS_REFRESH 안에 다시 받지 않는다
NEWS_DAYS, NEWS_RESULTS, NEWS_REFRESH = 3, 5, timedelta(minutes=30)

NOT_TARGET_MESSAGE = ("{name}은(는) 아직 분석·주문 대상이 아니에요. 지금은 코스피 시가총액 상위 100개, "
                      "코스닥 상위 50개 종목(우선주 제외)만 분석·주문할 수 있어요.")
LIMIT_MESSAGE = f"오늘 분석은 {MAX_ANALYSES_PER_DAY}번까지 할 수 있어요. 내일 다시 시도해 주세요."
ACTION_LABELS = {"buy": "매수 검토", "sell": "매도 검토", "hold": "보유", "watch": "관찰"}
FALLING_REASON = "장중 하락 중 (최근 5분 저가가 3번 연속 낮아지고 현재가가 VWAP 아래). 반등을 확인한 뒤 다시 판단"
SELL_PORTIONS = {"all": "전부", "half": "절반"}  # 매도·매수 몫. 앱 자동매매가 이 말을 보고 판다 (auto_trader.dart sellPortion)
VERDICT_LABELS = {"approve": "승인", "conditional": "조건부 승인", "reject": "반려", "user_judgement": "사용자 판단 필요"}
CLAIM_LABELS = {"fact": "사실", "calc": "계산", "inference": "추론", "opinion": "의견"}
FLAG_GUIDES = {
    "vulnerable": "65세 이상이다. 손실 가능성과 불리한 점을 먼저 쓴다.",
    "no_buy_proposals": "생활비나 빌린 돈으로 투자한다. 매수를 제안하지 않는다.",
    "high_interest_debt": "고금리 빚을 갚는 중이다. 빚을 먼저 갚는 것이 확실한 수익이라는 점을 위험에 쓴다.",
    "chases_hot_stocks": "급등주를 바로 사는 경향이 있다. 최근 가격 흐름의 위험을 쓴다.",
    "quiz_missed": "분산 투자와 매매 비용(수수료·세금) 개념을 짧게 설명한다.",
    # 최근 매매 습관 (functions/behavior.py)
    "frequent_trading": "최근 30일 동안 자주 거래했다. 잦은 매매 비용(수수료·세금)이 수익을 깎는 점을 위험에 쓴다.",
    "hot_buys": "최근 급등 경고를 받고도 산 적이 여러 번 있다. 최근 가격 흐름의 위험을 쓴다.",
    "sells_winners": "오른 종목만 먼저 파는 습관이 있다. 보유 중인 손실 종목도 함께 점검하라고 쓴다.",
}
GENERAL_MODE_GUIDE = "일반 모드다 (성향 퀴즈 안 함). 판단하지 말고 사실·지표·장단점·위험만 쓴다. 의견(opinion) 근거는 쓰지 않는다."


# ---------- 출처 ----------
# 출처 ID 규칙
#   dart:{접수번호}         공시 (제목·접수일)          dart:{접수번호}#{조각번호}  정기보고서 본문 조각
#   fin:{접수번호}          그 공시의 주요 재무 계정     price:{종목}:{날짜}        그날 종가·시가총액 (하루 늦은 공개 데이터)
#   quote:{종목}            폰이 증권사에서 받은 현재가  snapshot                  폰이 보낸 내 계좌 요약
#   intraday:{종목}         폰이 받은 오늘 1분봉 최근 30분과 전일 대비 등락률 (장중 흐름)
#   news:{번호}             뉴스 제목·언론사·발행 시각·링크 (Google 뉴스 RSS, 본문 없음, 미확인 보도)
#   market:{KOSPI|KOSDAQ}   폰이 받은 시장 지수: 지금 지수·등락률·오른/내린 종목 수, 최근 거래일 종가 (시장 전체 흐름)
#   trend:{종목}            코드가 계산한 추세: 20·60일 평균 대비, 20일 평균 방향, 20일 등락률·고점 대비, 시장 대비

def load_sources(conn, ids: list[str], state: InvestState) -> dict[str, dict]:
    """출처 ID → {kind, title, url, as_of, content}. 없는 ID는 결과에서 빠진다 (검증에서 '없는 출처'로 잡힘)."""
    found = {}
    for source_id in dict.fromkeys(ids):
        source = load_source(conn, source_id, state)
        if source:
            found[source_id] = source
    return found


def load_source(conn, source_id: str, state: InvestState) -> dict | None:
    kind, _, rest = source_id.partition(":")
    if kind == "dart" and "#" in rest:
        rcept_no, seq = rest.split("#", 1)
        row = conn.execute(
            "SELECT d.stock_code, d.title, d.url, d.filed_at, c.section, c.content FROM disclosure_chunks c"
            " JOIN disclosures d USING (rcept_no) WHERE c.rcept_no = %s AND c.seq::text = %s", (rcept_no, seq),
        ).fetchone()
        return row and {"kind": "dart", "title": f"{row['title']} · {row['section']}", "url": row["url"],
                        "as_of": str(row["filed_at"]), "content": row["content"], "stock_code": row["stock_code"]}
    if kind == "dart":
        row = conn.execute("SELECT stock_code, title, url, filed_at FROM disclosures WHERE rcept_no = %s", (rest,)).fetchone()
        return row and {"kind": "dart", "title": row["title"], "url": row["url"], "stock_code": row["stock_code"],
                        "as_of": str(row["filed_at"]), "content": f"공시 제목: {row['title']} (접수일 {row['filed_at']})"}
    if kind == "fin":
        rows = conn.execute(
            "SELECT stock_code, bsns_year, reprt_code, account, amount, prev_amount, add_amount, prev_add_amount FROM financials"
            " WHERE rcept_no = %s AND fs_div = 'CFS' ORDER BY account", (rest,),
        ).fetchall()
        if not rows:
            return None
        lines = [f"{r['account']}: 이번 기간 {fmt_amount(r['amount'])}"
                 + (f" (누적 {fmt_amount(r['add_amount'])})" if r["add_amount"] is not None else "")
                 + f", 비교 기간 {fmt_amount(r['prev_amount'])}"
                 + (f" (누적 {fmt_amount(r['prev_add_amount'])})" if r["prev_add_amount"] is not None else "")
                 for r in rows]
        return {"kind": "dart", "title": f"OpenDART 주요 재무 ({report_name(rows[0]['bsns_year'], rows[0]['reprt_code'])}, 연결)",
                "url": disclosure_url(rest), "as_of": None, "content": "\n".join(lines), "stock_code": rows[0]["stock_code"]}
    if kind == "price":
        code, _, day = rest.partition(":")
        row = conn.execute("SELECT close, market_cap FROM stock_prices WHERE stock_code = %s AND trade_date::text = %s",
                           (code, day)).fetchone()
        return row and {"kind": "price", "title": f"{day} 종가 (금융위원회_주식시세정보)", "url": None, "as_of": day,
                        "content": f"종가 {won(row['close'])}, 시가총액 {won(row['market_cap'])}", "stock_code": code}
    if kind == "news":
        row = conn.execute("SELECT stock_code, title, press, url, published_at FROM news WHERE id::text = %s", (rest,)).fetchone()
        if row is None:
            return None
        nearby = news_disclosure(conn, row["stock_code"], row["published_at"])
        check = (f"같은 무렵 공시가 있다: {nearby['title']} ({nearby['filed_at']}, 출처 dart:{nearby['rcept_no']}). 내용이 같은지는 공시로 확인한다"
                 if nearby else "공시로 확인되지 않은 보도다")
        return {"kind": "news", "title": f"{row['title']} ({row['press'] or '언론사 미확인'})", "url": row["url"],
                "stock_code": row["stock_code"],
                "as_of": row["published_at"].isoformat(),
                "content": f"뉴스 제목: {row['title']}. 언론사 {row['press'] or '미확인'}, "
                           f"발행 {row['published_at']:%Y-%m-%d %H:%M}. 본문은 없다. {check}"}
    if kind == "quote" and state.get("prices"):
        price = state["prices"][0]
        return {"kind": "price", "title": "현재가 (앱 실시간 조회)", "url": None, "as_of": price["as_of"],
                "content": f"현재가 {won(price['price'])}"}
    if kind == "intraday" and state.get("prices") and state["prices"][0].get("intraday"):
        return intraday_source(state["prices"][0])
    if kind == "market":
        found = next((m for m in state.get("market") or [] if m.get("index") == rest), None)
        return found and market_source(found)
    if kind == "trend":
        return trend_source(conn, rest, state)
    if source_id == "snapshot" and state.get("snapshot"):
        snapshot = state["snapshot"]
        held = [h for h in snapshot["holdings"] if h["stock_code"] == state["stock_code"]]
        holding = (f"이 종목 {held[0]['qty']:,}주, 평균 매입가 {won(held[0]['avg_price'])}" if held else "이 종목 없음")
        if held and state.get("prices"):
            market = conn.execute("SELECT market FROM stocks WHERE code = %s", (state["stock_code"],)).fetchone()
            policy = conn.execute("SELECT fee_rate_pct FROM policies WHERE user_id = %s", (state["user_id"],)).fetchone()
            if market:
                holding += ", " + net_sell_text(held[0]["qty"], held[0]["avg_price"], state["prices"][0]["price"],
                                                market["market"], policy and policy["fee_rate_pct"])
        return {"kind": "snapshot", "title": f"내 계좌 ({SOURCE_LABELS[snapshot['source']]})", "url": None,
                "as_of": snapshot["fetched_at"], "content": f"현금 {won(snapshot['cash_krw'])}, {holding}"}
    return None


def intraday_source(price: dict) -> dict | None:
    """폰이 보낸 1분봉 [[HHmmss, 가격], ...] (오래된 것부터) → 장중 흐름 요약. 계산은 코드가 한다."""
    flow = price["intraday"]
    bars = [(str(t), int(p)) for t, p in flow.get("bars") or [] if int(p) > 0]
    if not bars:
        return None
    values = [p for _, p in bars]
    (start_time, start), (end_time, end) = bars[0], bars[-1]
    day = f"전일 대비 {flow['change_pct']:+.2f}%. " if flow.get("change_pct") is not None else ""
    vwap = flow.get("vwap")
    vwap_text = (f". 오늘 거래량 가중 평균가(VWAP) {won(vwap)}, 현재가는 그보다 {(price['price'] - vwap) * 100 / vwap:+.2f}% "
                 f"({'위' if price['price'] >= vwap else '아래'})" if vwap else "")
    return {"kind": "price", "title": "오늘 장중 흐름 (앱 실시간 조회, 1분봉)", "url": None, "as_of": price["as_of"],
            "content": f"{day}{start_time[:2]}:{start_time[2:4]}~{end_time[:2]}:{end_time[2:4]} 1분봉 {len(bars)}개: "
                       f"{won(start)} → {won(end)} ({(end - start) * 100 / start:+.2f}%), "
                       f"이 사이 고가 {won(max(values))}, 저가 {won(min(values))}{vwap_text}"
                       + (". 최근 5분 저가가 3번 연속 낮아짐 (하락 중)" if lows_falling(bars) else "")}


def lows_falling(bars: list[tuple[str, int]]) -> bool:
    """1분봉을 5분씩 묶은 저가가 마지막 3묶음 연속 낮아지면 True (떨어지는 칼날, 2026-10-14 점검)"""
    lows: dict[int, int] = {}
    for t, p in bars:
        key = (int(t[:2]) * 60 + int(t[2:4])) // 5
        lows[key] = min(lows.get(key, p), p)
    last = [lows[k] for k in sorted(lows)][-3:]
    return len(last) == 3 and last[0] > last[1] > last[2]


def falling_now(price: dict) -> bool:
    """장중 하락 중: 5분 저가가 연속 낮아지고, VWAP를 받았으면 현재가가 그 아래. 자동매매 매수는 이때 막는다
    (10/8 하락 중 매수 손실. 실무 공통 규칙 '떨어지는 칼날을 잡지 않는다')"""
    flow = price.get("intraday") or {}
    bars = [(str(t), int(p)) for t, p in flow.get("bars") or [] if int(p) > 0]
    vwap = flow.get("vwap")
    return lows_falling(bars) and (not vwap or price["price"] < vwap)


MARKET_NAMES = {"KOSPI": "코스피", "KOSDAQ": "코스닥"}


def past_closes(m: dict) -> list[tuple[str, float]]:
    """지수의 지난 거래일 종가 [(YYYYMMDD, 종가)] (최신부터, 오늘 것은 뺀다). 날짜로 거른다:
    KIS 모의는 일별 지수가 며칠 늦게 와서(10/14에 10/12까지) 첫 값을 어제 종가로 보면 틀린다 (2026-10-14)"""
    today = (datetime.fromisoformat(m["as_of"]).astimezone(KST) if m.get("as_of") else datetime.now(KST)).strftime("%Y%m%d")
    return [(d, float(c)) for d, c in m.get("daily") or [] if float(c) > 0 and d < today]


def market_source(m: dict) -> dict | None:
    """폰이 보낸 지수 → 시장 전체 흐름 요약. 며칠 흐름(최근 종가 대비 등락률)은 코드가 계산한다 (2026-10-12: 10/8·10/12 손실 원인이 시장 급락)."""
    value = float(m.get("value") or 0)
    if value <= 0 or m.get("index") not in MARKET_NAMES:
        return None
    closes = past_closes(m)

    def since(days: int) -> str:
        return (f"{days}거래일 {(value - closes[days - 1][1]) * 100 / closes[days - 1][1]:+.2f}%"
                if len(closes) >= days else f"{days}거래일 미확인")
    series = [value] + [c for _, c in closes]
    streak = 0
    while streak + 1 < len(series) and series[streak] < series[streak + 1]:
        streak += 1
    breadth = (f", 오른 종목 {int(m['up']):,} · 내린 종목 {int(m['down']):,} · 보합 {int(m.get('flat') or 0):,}"
               if m.get("up") is not None and m.get("down") is not None else "")
    day_range = (f", 오늘 시가 {float(m['open']):,.2f} 고가 {float(m['high']):,.2f} 저가 {float(m['low']):,.2f}"
                 if m.get("open") and m.get("high") and m.get("low") else "")
    total = sum(c for _, c in closes[:20])
    average = (f", 20거래일 평균 {total / 20:,.2f}보다 {(value * 20 / total - 1) * 100:+.2f}% "
               f"({'위' if value * 20 >= total else '아래'})" if len(closes) >= 20 else "")
    last = f"(지난 종가 {closes[0][0][4:6]}/{closes[0][0][6:]}까지)" if closes else ""
    name = MARKET_NAMES[m["index"]]
    return {"kind": "price", "title": f"{name} 지수 (앱 실시간 조회)", "url": None, "stock_code": None, "as_of": m.get("as_of"),
            "content": f"{name} {value:,.2f} (전일 대비 {float(m.get('change_pct') or 0):+.2f}%){day_range}{breadth}. "
                       f"최근 흐름{last}: {since(1)}, {since(5)}, {since(20)}"
                       + (f", {streak}거래일 연속 하락" if streak >= 2 else "") + average}


def trend_text(closes: list[int], price: int, index_return: float | None) -> str:
    """최근 종가(오래된 것부터)와 지금 가격으로 추세를 코드가 계산한다. LLM은 이 값만 쓴다 (2026-10-14 점검:
    AI가 이동평균·시장 대비 흐름 없이 사고팔았다. 실무 공통 규칙: 20·60일 평균 위·오르는 중이면 상승 추세)"""
    def average(n: int) -> float:
        return sum(closes[-n:]) / n

    def gap(n: int) -> str:
        if len(closes) < n:
            return f"{n}일 평균 미확인"
        ma = average(n)
        return f"{n}일 평균 {won(round(ma))}보다 {(price - ma) * 100 / ma:+.2f}% ({'위' if price >= ma else '아래'})"
    parts = [gap(20), gap(60)]
    if len(closes) >= 25:
        before = sum(closes[-25:-5]) / 20
        parts.append(f"20일 평균은 5거래일 전보다 {'오르는' if average(20) >= before else '내리는'} 중 "
                     f"({(average(20) - before) * 100 / before:+.2f}%)")
    if len(closes) >= 21:
        change = (price - closes[-21]) * 100 / closes[-21]
        parts.append(f"약 20거래일 등락률 {change:+.2f}%"
                     + (f" (같은 기간 시장 {index_return:+.2f}%, 시장보다 {change - index_return:+.2f}%p)"
                        if index_return is not None else ""))
        high = max(closes[-20:] + [price])
        parts.append(f"20일 최고가 {won(high)}보다 {(price - high) * 100 / high:+.2f}%")
    return ", ".join(parts)


def trend_source(conn, code: str, state: InvestState) -> dict | None:
    rows = recent_closes(conn, code)
    if len(rows) < 20:
        return None
    price = next((p["price"] for p in state.get("prices") or [] if p["stock_code"] == code), None)
    basis = "현재가" if price else f"{rows[-1]['trade_date']} 종가"
    market = conn.execute("SELECT market FROM stocks WHERE code = %s", (code,)).fetchone()
    index = next((m for m in state.get("market") or [] if market and m.get("index") == market["market"]), None)
    closes = past_closes(index) if index else []
    index_return = (float(index["value"]) - closes[19][1]) * 100 / closes[19][1] if len(closes) >= 20 else None
    return {"kind": "price", "title": "추세 (코드 계산: 최근 종가·지금 가격·시장 지수)", "url": None, "stock_code": code,
            "as_of": str(rows[-1]["trade_date"]),
            "content": f"{basis} 기준 (평균은 {rows[-1]['trade_date']}까지 종가로 계산): "
                       + trend_text([r["close"] for r in rows], price or rows[-1]["close"], index_return)}


def net_sell_text(qty: int, avg_price: int, price: int, market: str, fee_rate_pct) -> str:
    """지금 다 팔면 손익 (매도 세금, 사고팔 때 수수료를 뺀 추정). 작은 이익을 비용으로 다 내주는 잦은 매매를 막는다"""
    bought, sold = qty * avg_price, qty * price
    cost = orders.sell_tax(sold, market)
    if fee_rate_pct is not None:
        cost += orders.fee_estimate(bought, fee_rate_pct) + orders.fee_estimate(sold, fee_rate_pct)
    net = sold - bought - cost
    return (f"지금 다 팔면 손익 {won(net)} ({net * 100 / bought:+.2f}%, 매도 세금"
            + ("·수수료 뺀 추정)" if fee_rate_pct is not None else "만 뺀 추정, 수수료 미확인)"))


def fmt_amount(value: int | None) -> str:
    return "없음" if value is None else won(value)


# ---------- 지표 (코드 계산) ----------

PERIOD_ORDER = {"11013": 1, "11012": 2, "11014": 3, "11011": 4}  # 1분기 < 반기 < 3분기 < 사업(연간)
PERIOD_NAMES = {"11013": "1분기", "11012": "반기", "11014": "3분기", "11011": "사업"}


def report_name(year: int, reprt_code: str) -> str:
    return f"{year}년 {PERIOD_NAMES[reprt_code]}보고서"


def report_accounts(conn, code: str, year: int, reprt_code: str) -> dict[str, dict]:
    """한 보고서(연결)의 계정 → 행. "당기순이익(손실)"처럼 이름이 조금씩 달라도 "당기순이익"으로 모은다."""
    accounts = {}
    for row in conn.execute(
        "SELECT * FROM financials WHERE stock_code = %s AND bsns_year = %s AND reprt_code = %s AND fs_div = 'CFS'",
        (code, year, reprt_code),
    ):
        accounts.setdefault("당기순이익" if row["account"].startswith("당기순이익") else row["account"], row)
    return accounts


def financial_basis(conn, code: str) -> dict | None:
    """지표 계산에 쓸 재무 값. 가장 최근 정기보고서 기준으로 맞춘다.

    - 자본·부채: 최근 보고서 기말 값
    - 매출·영업이익 증감: 최근 보고서의 올해 누적 vs 전년 같은 기간 누적 (사업보고서면 연간)
    - 순이익(PER용): 최근 4개 분기 = 작년 연간 + 올해 누적 − 작년 같은 기간 누적 (사업보고서면 연간 그대로)
    """
    reports = conn.execute("SELECT DISTINCT bsns_year, reprt_code FROM financials WHERE stock_code = %s AND fs_div = 'CFS'",
                           (code,)).fetchall()
    if not reports:
        return None
    latest = max(reports, key=lambda r: (r["bsns_year"], PERIOD_ORDER[r["reprt_code"]]))
    year, reprt_code = latest["bsns_year"], latest["reprt_code"]
    accounts = report_accounts(conn, code, year, reprt_code)
    is_annual = reprt_code == "11011"

    def cumulative(name: str) -> tuple[int | None, int | None]:
        row = accounts.get(name) or {}
        if is_annual:
            return row.get("amount"), row.get("prev_amount")
        return (row.get("add_amount") if row.get("add_amount") is not None else row.get("amount"),
                row.get("prev_add_amount") if row.get("prev_add_amount") is not None else row.get("prev_amount"))

    latest_id = f"fin:{next(iter(accounts.values()))['rcept_no']}" if accounts else None
    net_now, net_before = cumulative("당기순이익")
    net_ids = [latest_id]
    if is_annual:
        net_ttm = net_now
    else:
        annual = report_accounts(conn, code, year - 1, "11011").get("당기순이익")
        net_ttm = (annual["amount"] + net_now - net_before
                   if annual and None not in (annual["amount"], net_now, net_before) else None)
        if annual:
            net_ids.append(f"fin:{annual['rcept_no']}")
    period = report_name(year, reprt_code) + ("" if is_annual else " 누적")
    return {
        "period": period, "fin_ids": list(dict.fromkeys(net_ids)), "latest_id": latest_id,
        "equity": (accounts.get("자본총계") or {}).get("amount"),
        "liabilities": (accounts.get("부채총계") or {}).get("amount"),
        "revenue": cumulative("매출액"), "op_income": cumulative("영업이익"), "net_ttm": net_ttm,
    }


def recent_closes(conn, code: str) -> list[dict]:
    """변동성 계산에 필요한 만큼의 최근 종가 (오래된 것부터)."""
    return conn.execute(
        "SELECT trade_date, close, market_cap FROM stock_prices WHERE stock_code = %s ORDER BY trade_date DESC LIMIT %s",
        (code, metrics.VOLATILITY_DAYS + 1),
    ).fetchall()[::-1]


def volatility_ranks(conn) -> dict[str, float]:
    """분석 대상 종목마다 같은 시장(코스피·코스닥) 안의 변동성 순위 (0~1, 1이면 가장 출렁임). 계산할 수 없는 종목은 빠진다.

    = 같은 시장에서 변동성이 이 종목 이하인 대상 종목 수 ÷ 같은 시장에서 변동성을 계산할 수 있는 대상 종목 수
    코스닥 소형주가 코스피 순위 기준을 끌어올리지 않게 시장별로 매긴다 (10-coverage-expansion.md 2-6)
    """
    closes: dict[tuple[str, str], list[int]] = {}
    for row in conn.execute(
        "SELECT s.market, s.code, p.close FROM stocks s CROSS JOIN LATERAL"
        " (SELECT close, trade_date FROM stock_prices WHERE stock_code = s.code ORDER BY trade_date DESC LIMIT %s) p"
        " WHERE s.is_target ORDER BY s.code, p.trade_date", (metrics.VOLATILITY_DAYS + 1,)):
        closes.setdefault((row["market"], row["code"]), []).append(row["close"])
    by_market: dict[str, dict[str, float]] = {}
    for (market, code), series in closes.items():
        value = metrics.volatility(series, metrics.VOLATILITY_DAYS, [])["value"]
        if value is not None:
            by_market.setdefault(market, {})[code] = value
    return {code: sum(1 for v in values.values() if v <= value) / len(values)
            for values in by_market.values() for code, value in values.items()}


def volatility_rank(conn, code: str) -> float | None:
    return volatility_ranks(conn).get(code)


def compute_metrics(conn, code: str) -> list[dict]:
    """DB의 원 자료로 지표를 계산한다. gather와 verify_agent가 따로 부른다 (검증은 다시 계산)."""
    closes = recent_closes(conn, code)
    basis = financial_basis(conn, code) or {}
    price_id = f"price:{code}:{closes[-1]['trade_date']}" if closes else None
    market_cap = closes[-1]["market_cap"] if closes else None
    missing = "시세나 재무 자료가 없음"

    result = [
        metrics.per(market_cap, basis["net_ttm"], [price_id, *basis["fin_ids"]])
        if market_cap and basis.get("net_ttm") is not None else metrics.metric("per", None, "배", "", [], missing),
        metrics.pbr(market_cap, basis["equity"], [price_id, basis["latest_id"]])
        if market_cap and basis.get("equity") is not None else metrics.metric("pbr", None, "배", "", [], missing),
        metrics.debt_ratio(basis["liabilities"], basis["equity"], [basis["latest_id"]])
        if basis.get("liabilities") is not None and basis.get("equity") is not None
        else metrics.metric("debt_ratio", None, "%", "", [], "재무 자료가 없음"),
    ]
    for metric_id, key, account in (("revenue_yoy", "revenue", "매출액"), ("op_income_yoy", "op_income", "영업이익")):
        current, previous = basis.get(key, (None, None))
        if current is None or previous is None:
            result.append(metrics.metric(metric_id, None, "%", "", [], "재무 자료가 없음"))
        else:
            label = f"{account}({basis['period']})"
            result.append(metrics.yoy_growth(metric_id, label, current, previous, [basis["latest_id"]]))
    result.append(metrics.volatility([row["close"] for row in closes], metrics.VOLATILITY_DAYS,
                                     [price_id] if price_id else []))
    return result


def metric_line(metric: dict) -> str:
    if metric["value"] is None:
        return f"- {metric['metric_id']}: 계산 불가 ({metric['reason']})"
    return (f"- {metric['metric_id']}: {metric['value']}{metric['unit']} "
            f"(계산식: {metric['formula']}, 출처: {', '.join(metric['inputs'])})")


# ---------- 공시 본문 검색 ----------

def is_table_noise(text: str) -> bool:
    """숫자·기호만 많은 조각 (태그를 지우며 칸이 섞인 표). 표 구조를 살리는 것은 2-8 다음 일."""
    letters = [ch for ch in text if not ch.isspace()]
    return not letters or sum("가" <= ch <= "힣" for ch in letters) / len(letters) < MIN_HANGUL_SHARE


def search_chunks(conn, code: str, name: str, query: str) -> list[str]:
    """이 종목 정기보고서 본문에서 요청·관점별로 가까운 조각의 출처 ID (최대 SEARCH_RESULTS개).

    벡터 색인(HNSW)은 전체에서 가까운 것을 먼저 고르고 종목으로 걸러서, 종목이 많으면 결과가 비었다
    (2026-10-07, 150종목에서 115종목). 그래서 이 종목 조각만 먼저 고른 뒤 거리를 정확히 잰다 (종목당 수백 개라 빠름).
    """
    if not conn.execute("SELECT 1 FROM disclosure_chunks c JOIN disclosures d USING (rcept_no)"
                        " WHERE d.stock_code = %s LIMIT 1", (code,)).fetchone():
        return []
    picked: dict[str, float] = {}
    for text in (query, *SEARCH_ASPECTS):
        vector = str(llm.embed_query(f"{name} {text}"))
        rows = conn.execute(
            "WITH mine AS MATERIALIZED (SELECT c.rcept_no, c.seq, c.content, c.embedding FROM disclosure_chunks c"
            " JOIN disclosures d USING (rcept_no) WHERE d.stock_code = %s)"
            " SELECT rcept_no, seq, content, embedding <=> %s::vector AS distance FROM mine ORDER BY distance LIMIT %s",
            (code, vector, SEARCH_PER_QUERY * 3)).fetchall()
        rows = [r for r in rows if not is_table_noise(r["content"])]
        if not rows:
            continue
        best = rows[0]["distance"]
        for row in rows[:SEARCH_PER_QUERY]:
            if row["distance"] <= min(SEARCH_MAX_DISTANCE, best + SEARCH_RELATIVE_GAP):
                key = f"dart:{row['rcept_no']}#{row['seq']}"
                picked[key] = min(picked.get(key, 1.0), row["distance"])
    return sorted(picked, key=picked.get)[:SEARCH_RESULTS]


# ---------- 반대 근거·위험 문장의 출처 표시 "(출처: ID, ID)" ----------
# 반대 근거·위험은 문장 목록이라 출처 칸이 없다. 자료에서 온 문장은 끝에 이 표시를 달게 하고 코드가 확인한다 (2-8)

SOURCE_TAG = re.compile(r"\(출처:\s*([^)]*)\)")


def tagged_ids(texts: list[str]) -> list[str]:
    return [sid.strip() for text in texts for tag in SOURCE_TAG.findall(text) for sid in tag.split(",") if sid.strip()]


def cited_ids(proposal: dict) -> list[str]:
    """제안서가 인용한 출처 ID 전부 (근거 + 반대 근거·위험의 출처 표시)."""
    return ([sid for claim in proposal["claims"] for sid in claim["source_ids"]]
            + tagged_ids(proposal["counter_arguments"] + proposal["risks"]))


def with_titles(text: str, sources: dict) -> str:
    """사용자에게 보일 때 "(출처: dart:…#3)"을 출처 제목으로 바꾼다. 모르는 ID는 그대로 둔다."""
    def title(match: re.Match) -> str:
        ids = [sid.strip() for sid in match.group(1).split(",")]
        return "[" + ", ".join(dict.fromkeys(sources[sid]["title"] if sid in sources else sid for sid in ids)) + "]"
    return SOURCE_TAG.sub(title, text)


# ---------- 코드 검사 (검증 AI 전에) ----------

# 금액 표기: "305조 3,729억원", "10조 2,092억 1,490만 500원", "1,500억 원", "48,494,209,688,700원"
AMOUNT = re.compile(r"(?:(\d[\d,]*(?:\.\d+)?)\s*조\s*)?(?:(\d[\d,]*(?:\.\d+)?)\s*억\s*)?(?:(\d[\d,]*)\s*만\s*)?(?:(\d[\d,]*)\s*)?(원)?")
AMOUNT_UNITS = (1e12, 1e8, 1e4, 1)
COMMA_NUMBER = re.compile(r"\d{1,3}(?:,\d{3})+")
# "78조 9,548조"처럼 같은 단위가 두 번 나오면 표기 오류다 (평가 때 투자 AI가 실제로 쓴 실수)
REPEATED_UNIT = re.compile(r"(조|억)\s*\d[\d,]*\s*\1")
AMOUNT_WARN_RATIO = 2      # 원문 금액과 2배 넘게 다르면 주의 (반올림·"약"은 통과)
AMOUNT_FAIL_RATIO = 1000   # 1000배 넘게 다르면 단위 오류(억↔조)로 보고 막는다
# "위험은 없다", "반대 근거는 없다", "비용(수수료·세금)은 없다" 같은 부정. "배제할 수 없다"는 걸리지 않는다
DENIAL = re.compile(r"(위험|리스크|손실|반대\s*근거|수수료|세금|비용)\)?\s*(?:은|는|이|가)\s*(?:사실상\s*|전혀\s*|특별히\s*)?없")


def amounts(text: str) -> list[float]:
    """글 속 금액(원). 조·억·만 단위나 '원'이 붙은 것만 본다 ("29.06%", "3단계", "2026년"은 금액이 아니다)."""
    found = []
    for m in AMOUNT.finditer(text):
        if not (m[1] or m[2] or m[3] or m[5]):
            continue
        value = sum(float(g.replace(",", "")) * unit for g, unit in zip(m.groups()[:4], AMOUNT_UNITS) if g)
        if value > 0:
            found.append(value)
    return found


def amount_check(target: str, claim: dict, known_sources: dict) -> dict | None:
    """근거의 금액이 인용한 원문의 금액 중 하나와 비슷한지. 원문에 금액이 없으면 보지 않는다."""
    if repeated := REPEATED_UNIT.search(claim["text"]):
        return {"target": f"{target}:amount", "result": "fail", "source_ids": claim["source_ids"],
                "detail": f"금액 단위 표기 오류: '{repeated.group()}'"}
    # 원문 표의 금액은 "원"이 칸 제목에만 있어 숫자만 쓰여 있다. 쉼표 숫자도 원문 값으로 본다
    # (2026-10-14: AI가 공시대로 쓴 "100,000,089,900원"을 560,853배 다르다고 반려, 셀트리온 판단 9번이 결론 없이 끝남)
    source_values = [v for sid in claim["source_ids"] if sid in known_sources
                     for content in [known_sources[sid].get("content") or ""]
                     for v in amounts(content) + [float(n.replace(",", "")) for n in COMMA_NUMBER.findall(content)]]
    if not source_values:
        return None
    worst = max((min(max(v / s, s / v) for s in source_values) for v in amounts(claim["text"])), default=1)
    if worst <= AMOUNT_WARN_RATIO:
        return None
    return {"target": f"{target}:amount", "result": "fail" if worst > AMOUNT_FAIL_RATIO else "warn",
            "detail": f"근거의 금액이 인용한 원문 금액과 {worst:,.0f}배 다름" + (" (단위 오류로 보임)" if worst > AMOUNT_FAIL_RATIO else ""),
            "source_ids": claim["source_ids"]}


def code_checks(proposal: dict, known_sources: dict, gathered_metrics: list[dict], recomputed: list[dict],
                offered_chunks: bool = False, stock_code: str | None = None, offered: dict | None = None,
                holds: bool = False, today=None) -> list[dict]:
    """AI 없이 확실히 잡을 수 있는 것: 출처·지표 ID가 실제로 있는지, 사실·계산에 출처가 붙었는지,
    지표를 다시 계산하면 같은 값인지, 반대 근거·위험이 있는지. 하나라도 fail이면 승인하지 않는다.
    offered_chunks: 투자 AI에게 공시 본문 조각을 줬는지. 줬는데 하나도 인용하지 않으면 warn (막지는 않는다).
    stock_code: 이 종목. 다른 종목의 공시·시세를 출처로 달았으면 fail (평가 2026-10-10에서 검증 AI가 놓친 것들을 코드로 막는다).
    offered: 투자 AI에게 준 자료 전체. holds: 이 종목을 갖고 있는지. today: 오늘 날짜 (신선도 검사, 없으면 건너뜀)."""
    metric_ids = {m["metric_id"] for m in recomputed if m["value"] is not None}
    checks = [claim_check(f"claim:{n}", c, known_sources, metric_ids) for n, c in enumerate(proposal["claims"])]
    checks += [a for n, c in enumerate(proposal["claims"]) if (a := amount_check(f"claim:{n}", c, known_sources))]
    if stock_code and (others := sorted({sid for sid in cited_ids(proposal)
                                         if known_sources.get(sid, {}).get("stock_code") not in (None, stock_code)})):
        checks.append({"target": "source_stock", "result": "fail",
                       "detail": f"다른 종목의 자료를 출처로 씀: {', '.join(others)}", "source_ids": others})
    texts = [c["text"] for c in proposal["claims"]] + proposal["counter_arguments"] + proposal["risks"]
    if denied := [t for t in texts if DENIAL.search(t)]:
        checks.append({"target": "denies_risk", "result": "fail",
                       "detail": f"위험·반대 근거·비용이 없다고 씀: {denied[0]}", "source_ids": []})
    tags = tagged_ids(proposal["counter_arguments"] + proposal["risks"])
    # 반대 근거·위험에 지표 ID(per, volatility_60d 등)를 출처처럼 단 것은 있는 값이라 통과 (2026-10-14 반려 4건)
    if missing := [sid for sid in tags if sid not in known_sources and sid not in metric_ids]:
        checks.append({"target": "risk_sources", "result": "fail",
                       "detail": f"반대 근거·위험의 없는 출처 ID: {', '.join(missing)}", "source_ids": missing})
    if offered_chunks and not any("#" in sid for sid in cited_ids(proposal)):
        checks.append({"target": "body_citations", "result": "warn",
                       "detail": "공시 본문 조각을 받았지만 근거·반대 근거·위험 어디에도 인용하지 않음", "source_ids": []})

    checks += freshness_checks(proposal, offered or known_sources, holds, today)

    before = {m["metric_id"]: m["value"] for m in gathered_metrics}
    changed = [m["metric_id"] for m in recomputed if before.get(m["metric_id"]) != m["value"]]
    checks.append({"target": "metrics", "result": "fail" if changed else "pass",
                   "detail": f"다시 계산한 값이 다름: {', '.join(changed)}" if changed else "지표를 다시 계산해 같은 값 확인",
                   "source_ids": []})
    for field, label in (("counter_arguments", "반대 근거"), ("risks", "위험")):
        checks.append({"target": field, "result": "pass" if proposal[field] else "fail",
                       "detail": f"{label} {len(proposal[field])}개" if proposal[field] else f"{label}가 없음",
                       "source_ids": []})
    return checks


TODAY_SOURCES = ("quote:", "intraday:", "market:")
CODE_COMPUTED = ("trend:", "intraday:", "market:", "snapshot")  # 코드가 계산한 값이 담긴 출처


def weekdays_between(start, end) -> int:
    """start와 end 사이(둘 다 빼고) 평일 수. 휴장일은 모른다 (그만큼 경고가 넉넉하게 난다)"""
    return sum(1 for n in range(1, (end - start).days) if (start + timedelta(days=n)).weekday() < 5)


def freshness_checks(proposal: dict, offered: dict, holds: bool, today) -> list[dict]:
    """자료가 오래됐는지와 오늘 자료를 썼는지 코드로 본다 (2026-10-12 아침 분석이 3거래일 전 종가를 썼는데 검증을 통과).
    - 오늘 시세 없이 종가가 2거래일 넘게 묵었으면 warn (공개 종가는 하루 늦게 나오므로 1일은 정상)
    - 보유 종목의 보유·매도 판단인데 오늘 자료(현재가·장중·시장)를 받고도 근거에 하나도 안 쓰면 fail"""
    checks = []
    has_today = any(sid.startswith(TODAY_SOURCES) for sid in offered)
    closes = sorted(sid.rsplit(":", 1)[1] for sid in offered if sid.startswith("price:"))
    if today and closes and not has_today:
        last = datetime.strptime(closes[-1], "%Y-%m-%d").date()
        if weekdays_between(last, today) >= 2:
            checks.append({"target": "freshness", "result": "warn", "source_ids": [],
                           "detail": f"오늘 시세 없이 {last} 종가 기준 (평일 {weekdays_between(last, today)}일 묵음). 지금 가격과 다를 수 있음"})
    cited_today = [sid for sid in cited_ids(proposal) if sid.startswith(TODAY_SOURCES)]
    if holds and has_today and proposal["action"] in ("hold", "sell") and not cited_today:
        checks.append({"target": "today_data", "result": "fail", "source_ids": [],
                       "detail": "보유 종목 판단인데 오늘 현재가·장중 흐름·시장 지수를 근거에 하나도 쓰지 않음"})
    return checks


def claim_check(target: str, claim: dict, known_sources: dict, metric_ids: set[str] | None) -> dict:
    """근거 하나의 출처·지표 ID 검사. metric_ids가 None이면 지표 없이 출처 원문의 숫자를 쓰는 글이다 (장 마감 회고)."""
    problems = []
    if claim["type"] in ("fact", "calc") and not claim["source_ids"]:
        problems.append("사실·계산 근거인데 출처가 없음")
    if missing := [s for s in claim["source_ids"] if s not in known_sources]:
        problems.append(f"없는 출처 ID: {', '.join(missing)}")
    if claim["type"] == "fact" and claim["source_ids"] and all(s.startswith("news:") for s in claim["source_ids"]):
        # 2026-10-12 제안 36건 중 21건이 제목뿐인 보도를 사실로 써서 조건부 승인이 반복됐다. 보도는 추론·위험으로 쓴다
        problems.append("뉴스(제목뿐인 미확인 보도)만 출처인 사실 근거")
    if metric_ids is not None:
        # 코드가 이미 계산해 준 자료(추세·장중 흐름·지수·내 계좌)를 출처로 단 계산 근거는 지표 ID가 없어도 된다
        # (2026-10-14: 추세 자료를 넣자 '지표 ID 없음' 반려가 나와 보유 판단이 결론 없이 끝났다)
        if claim["type"] == "calc" and not claim["metric_ids"] and not any(s.startswith(CODE_COMPUTED) for s in claim["source_ids"]):
            problems.append("계산 근거인데 지표 ID가 없음")
        if unknown := [m for m in claim["metric_ids"] if m not in metric_ids]:
            problems.append(f"없거나 계산할 수 없는 지표 ID: {', '.join(unknown)}")
    return {"target": target, "result": "fail" if problems else "pass",
            "detail": "; ".join(problems) or "출처·지표 ID 확인", "source_ids": claim["source_ids"]}


# ---------- AI에게 넘길 글 ----------

def user_lines(state: InvestState) -> list[str]:
    if state["mode"] != "custom":
        return [GENERAL_MODE_GUIDE]
    lines = [f"성향: {state['risk_level']}단계 {LABELS[state['risk_level']]}"]
    return lines + [FLAG_GUIDES[flag] for flag in state.get("flags") or [] if flag in FLAG_GUIDES]


def source_lines(sources: dict) -> list[str]:
    return [f"- {sid} | {s['title']} | 기준 {s['as_of'] or '미확인'}\n  {s['content']}" for sid, s in sources.items()]


def directed_order_text(state: InvestState) -> str:
    side = {"buy": "매수", "sell": "매도"}[state["side"]]
    target = state.get("target_order")
    if state.get("order_change") == "cancel":
        return (f"이미 낸 {state['stock_name']} {side} 주문(미체결 {target['qty']:,}주, 지정가 {won(target['price'])})의 취소. "
                f"취소하는 근거와, 취소하면 놓치는 것(반대 근거)을 쓴다")
    if state.get("order_change") == "modify":
        return (f"이미 낸 {state['stock_name']} {side} 주문(미체결 {target['qty']:,}주)의 지정가를 "
                f"{won(target['price'])}에서 {won(state['limit_price'])}으로 정정")
    price = f" {won(state['limit_price'])}" if state.get("limit_price") else ""
    return f"{state['stock_name']} {state['qty']:,}주{price} {side}"


def grade_text(state: InvestState) -> str:
    reason = state.get("risk_reason")
    return f"위험등급 {state['risk_grade']}등급" + (f" (1등급 근거: {reason})" if reason else "")


def invest_context(state: InvestState) -> str:
    parts = [
        f"[요청] {state['query']}",
        f"[종목] {state['stock_name']}({state['stock_code']}), {grade_text(state)}",
        "[사용자]\n" + "\n".join(user_lines(state)),
        f"[허용 행동] {', '.join(state['allowed_actions'])}"
        + (f" (매수 제외: {state['buy_block_reason']})" if state.get("buy_block_reason") else ""),
        "[자료]\n" + "\n".join(source_lines(state["sources"])),
        "[지표] (코드가 계산한 값. 이 값만 쓴다)\n" + "\n".join(metric_line(m) for m in state["metrics"]),
    ]
    if state.get("auto_origin") and state.get("user_directed"):
        parts.append(f"[자동매매 주문] {directed_order_text(state)}. 사용자가 지금 직접 지시한 것이 아니라 앱의 자동매매·예약이 낸 주문이다. "
                     "[자료]의 장중 흐름(intraday), 시장 지수(market), 뉴스, 공시를 보고 지금 이 행동이 적절한지 판단한다. "
                     "매수인데 하락 중이거나 악재 보도가 있는 등 지금 사기 적절하지 않으면 행동을 watch(관찰)로 쓰고 이유를 근거에 쓴다.")
    elif state.get("user_directed"):
        parts.append(f"[사용자 지시 주문] {directed_order_text(state)}. 사용자가 직접 지시한 주문이다. "
                     "행동은 지시대로 쓰고, 이 주문의 근거와 함께 반대 근거·위험을 경고 위주로 쓴다 (FR-21).")
    if signal := state.get("conversation_signal"):
        if signal in signals.WARNINGS:  # 투자 AI에게만 준다. 검증 AI는 원문으로 따로 본다
            parts.append(f"[대화 신호] {signals.WARNINGS[signal]} 이 위험을 위험(risks)에 쓰고, "
                         "매수를 고르려 했다면 관찰(watch)이 더 맞는지 따져 근거에 쓴다.")
    if state.get("verifications"):
        last = state["verifications"][-1]
        parts.append("[검증 AI 반박] 아래를 고쳐 다시 써라\n" + "\n".join(f"- {c}" for c in last["challenges"]))
    return "\n\n".join(parts)


def verify_context(state: InvestState, proposal: dict, reloaded: dict, recomputed: list[dict], checks: list[dict]) -> str:
    """검증 AI에게는 제안서의 행동·근거·출처 ID와, 다시 읽은 원문·다시 계산한 지표만 준다.
    투자 AI의 지시문·입력 자료 목록은 주지 않는다."""
    claims = [f"{n}. ({c['type']}) {c['text']} | 출처: {', '.join(c['source_ids']) or '없음'}"
              f" | 지표: {', '.join(c['metric_ids']) or '없음'}" for n, c in enumerate(proposal["claims"])]
    return "\n\n".join([
        f"[종목] {state['stock_name']}({state['stock_code']}), {grade_text(state)}",
        "[사용자]\n" + "\n".join(user_lines(state)),
        f"[제안] 행동: {proposal['action']}"
        + (f" (자동매매가 낸 주문: {directed_order_text(state)}. 지금 이 행동이 적절한지 근거로 본다)" if state.get("auto_origin")
           else f" (사용자가 직접 지시한 주문: {directed_order_text(state)}. 경고 위주로 본다)" if state.get("user_directed") else ""),
        "[근거]\n" + "\n".join(claims),
        "[반대 근거]\n" + "\n".join(f"- {x}" for x in proposal["counter_arguments"]),
        "[위험]\n" + "\n".join(f"- {x}" for x in proposal["risks"]),
        "[판단이 틀리는 조건]\n" + "\n".join(f"- {x}" for x in proposal["invalid_if"]),
        "[원문] (출처 ID로 다시 읽은 것)\n" + "\n".join(source_lines(reloaded)),
        "[다시 계산한 지표]\n" + "\n".join(metric_line(m) for m in recomputed),
        "[코드 검사]\n" + "\n".join(f"- {c['target']}: {c['result']} ({c['detail']})" for c in checks),
    ])


# ---------- 노드 ----------

def check_target_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        stock = conn.execute("SELECT is_target FROM stocks WHERE code = %s", (state["stock_code"],)).fetchone()
        if not stock["is_target"]:
            return {"answer": NOT_TARGET_MESSAGE.format(name=state["stock_name"])}
        today_count = conn.execute(
            "SELECT count(*) AS n FROM proposals WHERE user_id = %s AND created_at >= date_trunc('day', now())",
            (state["user_id"],),
        ).fetchone()["n"]
    if today_count >= MAX_ANALYSES_PER_DAY:
        return {"answer": LIMIT_MESSAGE}
    return {}


def get_account_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    """앱이면 폰에 잔고·현재가를 부탁하고, 웹이면 최근 스냅샷을 쓴다. 웹은 실시간 현재가 없이 전일 종가로 본다."""
    if state["client"] == "web":
        with connect(runtime.context.database_url, row_factory=dict_row) as conn:
            snapshot = fresh_snapshot(conn, state["user_id"])
        # 계좌 없이도 분석은 한다 (보유 여부는 모름)
        return {"snapshot": snapshot, "market": None} if snapshot else {"snapshot": None, "prices": None, "market": None}

    # market: 시장 지수. 예전 앱은 모르는 요청이라 빼고 답한다 (그러면 시장 자료 없이 분석)
    reply = pause("fetch", needs=[{"type": "balance"}, {"type": "price", "stock_code": state["stock_code"]}, {"type": "market"}])
    if reply.get("error"):
        return {"answer": f"증권사 조회에 실패했어요 ({reply['error']}). 잠시 후 다시 시도해 주세요."}
    price = next((p for p in reply.get("prices") or [] if p["stock_code"] == state["stock_code"]), None)
    return {"snapshot": reply.get("balance") and {**reply["balance"], "source": "app"},
            "prices": [price] if price else None, "market": reply.get("market") or None}


def news_disclosure(conn, code: str, published_at) -> dict | None:
    """뉴스와 같은 무렵(발행일 하루 전~다음 날) 나온 이 종목 공시. 있으면 "공시 확인" 후보로 보여준다.
    ponytail: 날짜만 본다. 내용이 같은지는 사람이·검증 AI가 공시 원문으로 확인한다"""
    return conn.execute(
        "SELECT rcept_no, title, url, filed_at FROM disclosures WHERE stock_code = %s"
        " AND filed_at BETWEEN (%s::timestamptz)::date - 1 AND (%s::timestamptz)::date + 1 ORDER BY filed_at DESC LIMIT 1",
        (code, published_at, published_at)).fetchone()


def recent_news(conn, code: str, name: str) -> list[str]:
    """최근 뉴스 출처 ID. 30분 안에 받은 적이 없으면 Google 뉴스 RSS에서 새로 받아 저장한다 (실패하면 저장된 것만)"""
    last = conn.execute("SELECT max(fetched_at) AS at FROM news WHERE stock_code = %s", (code,)).fetchone()["at"]
    if config.NEWS_FETCH and (last is None or datetime.now(KST) - last > NEWS_REFRESH):
        try:
            longer = tuple(r["name"] for r in conn.execute(  # 이름에 이 종목 이름이 들어간 다른 종목 (뉴스 거르기)
                "SELECT name FROM stocks WHERE name LIKE %s AND name <> %s", (f"%{name}%", name)))
            for item in google_news.search(name, NEWS_DAYS, longer):
                conn.execute(
                    "INSERT INTO news (stock_code, title, press, url, published_at) VALUES (%s, %s, %s, %s, %s)"
                    " ON CONFLICT (stock_code, url) DO UPDATE SET fetched_at = now()",
                    (code, item["title"], item["press"], item["url"], item["published_at"]))
            conn.execute("UPDATE news SET fetched_at = now() WHERE stock_code = %s", (code,))  # 기사가 없어도 30분은 다시 안 받는다
        except Exception:  # noqa: BLE001 뉴스는 덤이다. 못 받아도 분석은 한다
            logging.getLogger(__name__).warning("뉴스를 받지 못했어요: %s", code, exc_info=True)
    rows = conn.execute(
        "SELECT id FROM news WHERE stock_code = %s AND published_at >= now() - %s::interval"
        " ORDER BY published_at DESC LIMIT %s", (code, f"{NEWS_DAYS} days", NEWS_RESULTS)).fetchall()
    return [f"news:{row['id']}" for row in rows]


def gather_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    code = state["stock_code"]
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        ids = []
        latest = latest_close(conn, code)
        if latest:
            ids.append(f"price:{code}:{latest['trade_date']}")
        basis = financial_basis(conn, code)
        if basis:
            ids += [i for i in (basis["latest_id"], *basis["fin_ids"]) if i]
        ids += [f"dart:{row['rcept_no']}" for row in conn.execute(
            "SELECT rcept_no FROM disclosures WHERE stock_code = %s ORDER BY filed_at DESC LIMIT %s",
            (code, RECENT_DISCLOSURES))]
        ids += search_chunks(conn, code, state["stock_name"], state["query"])
        ids += recent_news(conn, code, state["stock_name"])
        grade, risk = stock_risk(conn, code)
        if risk:
            ids.append(f"dart:{risk['rcept_no']}")  # 1등급 근거 공시를 자료에 넣는다
        if state.get("prices"):
            ids.append(f"quote:{code}")
            if state["prices"][0].get("intraday"):
                ids.append(f"intraday:{code}")
        ids += [f"market:{m['index']}" for m in state.get("market") or [] if m.get("index")]
        ids.append(f"trend:{code}")
        if state.get("snapshot"):
            ids.append("snapshot")
        sources = load_sources(conn, ids, state)
        found_metrics = compute_metrics(conn, code)

    holds = bool(state.get("snapshot")) and any(h["stock_code"] == code for h in state["snapshot"]["holdings"])
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        rank = volatility_rank(conn, code)
    profile = (state["mode"], state.get("risk_level"), state.get("flags") or [], grade)
    auto_buy = bool(state.get("user_directed") and state.get("auto_origin") and state["side"] == "buy")
    falling = bool(state.get("prices")) and falling_now(state["prices"][0])
    return {
        "sources": sources, "metrics": json.loads(json.dumps(found_metrics, default=str)), "risk_grade": grade,
        "risk_reason": risk and (f"{risk['title']} ({risk['filed_at']} 거래소 공시, 출처 dart:{risk['rcept_no']})"
                                 + (f". 이후 관련 공시: {risk['later']}" if risk["later"] else "")),
        # 사용자가 직접 지시한 주문은 행동을 바꾸지 않는다. 성향에 안 맞으면 처리안에서 확인을 받는다 (주문 그래프)
        # 자동매매의 매수는 투자 AI가 진입 시점을 보고 '관찰'로 거절할 수 있다 (3-4, 2026-10-08 손실 원인)
        # 2026-10-14: 장중 하락 중(5분 저가 연속 하락, VWAP 아래)이면 자동매매 매수는 코드가 막는다 (관찰만)
        "allowed_actions": (["watch"] if falling else [state["side"], "watch"]) if auto_buy
        else [state["side"]] if state.get("user_directed") else allowed_actions(*profile, holds, rank),
        "buy_block_reason": FALLING_REASON if auto_buy and falling else buy_block_reason(*profile, rank),
        "verifications": [], "revision_round": 0,
        # 5-4 대화 속 성향 신호 (모델이 꺼져 있으면 None). 사람이 쓴 말만 본다
        "conversation_signal": None if state.get("auto_origin") else signals.model_signal(state["query"]),
    }


def news_as_inference(claims: list[dict]) -> list[dict]:
    """뉴스(제목뿐인 미확인 보도)만 출처인 '사실' 근거를 '추론'으로 낮추고 보도라고 밝힌다. 뉴스는 근거로 계속 쓴다.
    2026-10-13: 이 근거를 반려하자 투자 AI가 같은 실수를 반복해 반려 48건 중 35건, 최종 55건 중 33건이 결론 없이 끝났다"""
    out = []
    for c in claims:
        if c["type"] == "fact" and c["source_ids"] and all(s.startswith("news:") for s in c["source_ids"]):
            c = {**c, "type": "inference", "text": c["text"] if "보도" in c["text"] else f"보도에 따르면 {c['text']}"}
        out.append(c)
    return out


def invest_agent_node(state: InvestState) -> dict:
    draft = llm.write_proposal(invest_context(state)).model_dump()
    draft["claims"] = news_as_inference(draft["claims"])
    if draft["action"] not in state["allowed_actions"]:
        # 성향 규칙은 AI가 아니라 코드가 지킨다
        reason = f" ({state['buy_block_reason']})" if draft["action"] == "buy" and state.get("buy_block_reason") else ""
        draft["risks"].append(f"성향 규칙에 따라 '{ACTION_LABELS[draft['action']]}' 대신 '관찰'로 바꿨어요{reason}.")
        draft["action"] = "watch"
    return {"proposal": {**draft, "stock_code": state["stock_code"], "stock_name": state["stock_name"],
                         "qty": state.get("qty"), "limit_price": state.get("limit_price"),
                         "user_directed": bool(state.get("user_directed"))}}


def verify_agent_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    proposal = state["proposal"]
    with connect(runtime.context.database_url, row_factory=dict_row) as conn:
        reloaded = load_sources(conn, cited_ids(proposal), state)  # 투자 AI가 본 자료가 아니라 원문을 다시 읽는다
        recomputed = json.loads(json.dumps(compute_metrics(conn, state["stock_code"]), default=str))
    holds = bool(state.get("snapshot")) and any(h["stock_code"] == state["stock_code"] for h in state["snapshot"]["holdings"])
    checks = code_checks(proposal, reloaded, state["metrics"], recomputed,
                         offered_chunks=any("#" in sid for sid in state["sources"]), stock_code=state["stock_code"],
                         offered=state["sources"], holds=holds, today=datetime.now(KST).date())
    draft = llm.verify_proposal(verify_context(state, proposal, reloaded, recomputed, checks)).model_dump()

    failed = [c for c in checks if c["result"] == "fail"]
    if failed and draft["verdict"] in ("approve", "conditional"):
        draft["verdict"] = "reject"  # 코드 검사에서 틀린 것이 나오면 AI가 승인해도 반려
        draft["challenges"] += [f"{c['target']}: {c['detail']}" for c in failed]
    round_number = state["revision_round"]
    if draft["verdict"] == "reject" and round_number >= MAX_REVISIONS:
        draft["verdict"] = "user_judgement"  # 2번 고쳐도 합의가 안 되면 사용자가 판단
        draft["summary"] = f"{MAX_REVISIONS}번 수정했지만 검증을 통과하지 못했어요. " + draft["summary"]
    verification = {**draft, "checks": checks + draft["checks"], "round": round_number}
    return {"verifications": state["verifications"] + [verification], "revision_round": round_number + 1}


def route_after_verify(state: InvestState) -> str:
    return "invest_agent" if state["verifications"][-1]["verdict"] == "reject" else "record"


def save_proposal(conn, state: InvestState) -> str:
    """제안서와 검증 판정(반박-수정 회차마다)을 저장하고 제안서 ID를 돌려준다. 분석·주문이 같이 쓴다."""
    proposal = state["proposal"]
    # 분석에서 "이대로 주문"으로 이어진 주문은 수량·가격이 제안서를 쓴 뒤에 정해진다. 주문 값이 있으면 그것을 저장한다
    qty, limit_price = state.get("qty") or proposal["qty"], state.get("limit_price") or proposal["limit_price"]
    data_as_of = max((s["as_of"] for s in state["sources"].values() if s["as_of"]), default=None)
    sources = [{"source_id": sid, **{k: v for k, v in s.items() if k != "content"}} for sid, s in state["sources"].items()]
    proposal_id = conn.execute(
        "INSERT INTO proposals (user_id, thread_id, stock_code, action, qty, limit_price, claims, sources, metrics,"
        " counter_arguments, risks, invalid_if, user_directed, data_as_of)"
        " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (state["user_id"], state["thread_id"], proposal["stock_code"], proposal["action"], qty,
         limit_price, Jsonb(proposal["claims"]), Jsonb(sources), Jsonb(state["metrics"]),
         Jsonb(proposal["counter_arguments"]), Jsonb(proposal["risks"]), Jsonb(proposal["invalid_if"]),
         proposal["user_directed"], data_as_of),
    ).fetchone()[0]
    for v in state["verifications"]:
        conn.execute(
            "INSERT INTO verifications (proposal_id, round, verdict, checks, challenges, conditions, disagreements,"
            " risk_fit, summary) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (proposal_id, v["round"], v["verdict"], Jsonb(v["checks"]), Jsonb(v["challenges"]),
             Jsonb(v["conditions"]), Jsonb(v["disagreements"]), v["risk_fit"], v["summary"]),
        )
    return str(proposal_id)


def record_node(state: InvestState, runtime: Runtime[Context]) -> dict:
    with connect(runtime.context.database_url) as conn:
        save_proposal(conn, state)
    return {"answer": format_analysis(state)}


# ---------- 답 ----------

def format_analysis(state: InvestState) -> str:
    proposal, verification, sources = state["proposal"], state["verifications"][-1], state["sources"]
    lines = [f"{state['stock_name']}({state['stock_code']}) 분석 · 검증: {VERDICT_LABELS[verification['verdict']]}"]
    if state["mode"] != "custom":
        lines.append("일반 모드라 사라·말라 판단은 하지 않고 정보만 정리했어요. 성향 퀴즈를 하면 맞춤 제안을 받을 수 있어요.")
    else:
        portion = SELL_PORTIONS.get(proposal.get({"sell": "sell_portion", "buy": "buy_portion"}.get(proposal["action"], "")))
        lines.append(f"제안: {ACTION_LABELS[proposal['action']]}" + (f" ({portion})" if portion else ""))
    if state.get("risk_reason"):
        lines.append(f"위험등급 1등급(매우 높음): {state['risk_reason'].split(', 출처')[0]})")

    lines.append("\n근거")
    for claim in proposal["claims"]:
        cited = ", ".join(dict.fromkeys(sources[s]["title"] for s in claim["source_ids"] if s in sources))  # 같은 보고서 조각은 한 번
        lines.append(f"- ({CLAIM_LABELS[claim['type']]}) {claim['text']}" + (f" [{cited}]" if cited else ""))
    for title, items in (("반대 근거", proposal["counter_arguments"]), ("위험", proposal["risks"]),
                         ("이런 경우 판단이 틀린 것", proposal["invalid_if"])):
        lines += [f"\n{title}"] + [f"- {with_titles(item, sources)}" for item in items]

    lines.append("\n지표 (코드 계산)")
    for metric in state["metrics"]:
        value = f"{metric['value']}{metric['unit']}" if metric["value"] is not None else f"계산 불가 ({metric['reason']})"
        lines.append(f"- {METRIC_NAMES.get(metric['metric_id'], metric['metric_id'])}: {value}")

    lines.append(f"\n검증 AI: {verification['summary']}")
    lines += [f"- 조건: {c}" for c in verification["conditions"]]
    lines += [f"- 의견 차이: {d}" for d in verification["disagreements"]]

    lines.append("\n출처 (근거와 지표에 쓴 것)")
    used = cited_ids(proposal)
    used += [sid for metric in state["metrics"] if metric["value"] is not None for sid in metric["inputs"]]
    shown = set()
    for source in (sources[sid] for sid in dict.fromkeys(used) if sid in sources):
        if (source["title"], source["url"]) in shown:
            continue  # 같은 보고서의 여러 조각은 한 번만
        shown.add((source["title"], source["url"]))
        when = f", {source_time(source['as_of'])}" if source["as_of"] else ""
        lines.append(f"- {source['title']}{when}" + (f" {source['url']}" if source["url"] else ""))
    lines.append("\n투자 판단과 책임은 본인에게 있어요. 이 분석은 참고용이며 손실이 날 수 있어요.")
    return "\n".join(lines)


def source_time(value: str) -> str:
    """날짜만 있으면 그대로, 시각까지 있으면 "10-05 17:39 기준"."""
    return as_of(value) if "T" in value else f"{value} 기준"


def offer_order_node(state: InvestState) -> dict:
    """분석 결과가 매수·매도 제안이면 "이대로 주문할까요?"를 묻는다. 예 → 주문 그래프로 (graph.py)."""
    action = state["proposal"]["action"]
    if action not in ("buy", "sell"):
        return {}
    reply = pause("question", text=state["answer"] + "\n\n이대로 주문할까요?",
                  choices=[{"id": "yes", "label": "주문하기"}, {"id": "no", "label": "아니요"}])
    if (reply.get("choice_id") or reply.get("text") or "").strip() in ("yes", "예", "네", "주문하기", "응"):
        return {"intent": "order", "side": action, "from_analysis": True, "user_directed": False,
                "qty": None, "limit_price": None, "answer": None}
    return {}


METRIC_NAMES = {"per": "PER", "pbr": "PBR", "debt_ratio": "부채비율", "revenue_yoy": "매출 전년 대비",
                "op_income_yoy": "영업이익 전년 대비", "volatility_60d": "60일 변동성(연 환산)"}


# ---------- 그래프 ----------

def build_analysis_graph():
    builder = StateGraph(InvestState, context_schema=Context)
    builder.add_node("find_stock", find_stock_node)
    builder.add_node("check_target", check_target_node)
    builder.add_node("get_account", get_account_node)
    builder.add_node("gather", gather_node)
    builder.add_node("invest_agent", invest_agent_node)
    builder.add_node("verify_agent", verify_agent_node)
    builder.add_node("record", record_node)
    builder.add_node("offer_order", offer_order_node)

    builder.add_edge(START, "find_stock")
    builder.add_conditional_edges("find_stock", end_if_answered("check_target"), ["check_target", END])
    builder.add_conditional_edges("check_target", end_if_answered("get_account"), ["get_account", END])
    builder.add_conditional_edges("get_account", end_if_answered("gather"), ["gather", END])
    builder.add_edge("gather", "invest_agent")
    builder.add_edge("invest_agent", "verify_agent")
    builder.add_conditional_edges("verify_agent", route_after_verify, ["invest_agent", "record"])
    builder.add_edge("record", "offer_order")
    builder.add_edge("offer_order", END)
    return builder.compile()
