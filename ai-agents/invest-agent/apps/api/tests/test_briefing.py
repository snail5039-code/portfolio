"""아침 브리핑 테스트. Gemini는 가짜로 바꿔 끼운다 (비용 0)."""

from datetime import date, datetime, timedelta

import psycopg
import pytest

from app import briefing
from app.agents import llm
from app.agents.schemas import ProposalDraft, VerificationDraft
from app.clock import KST
from tests.conftest import LEVEL_4_QUIZ

CODE, NAME = "666666", "브리핑전자"
HELD, HELD_NAME = "666667", "보유전자"
TODAY = datetime.now(KST).date()


@pytest.fixture(scope="module", autouse=True)
def market_data(migrated):
    """후보 1종목(오늘 공시), 보유 1종목(어제 공시). 후보는 조금, 보유 종목은 크게 출렁여 후보의 변동성 순위가 낮다."""
    with psycopg.connect(migrated) as conn:
        for code, name, swing in ((CODE, NAME, 100), (HELD, HELD_NAME, 5000)):
            conn.execute("INSERT INTO stocks VALUES (%s, %s, 'KOSPI', true) ON CONFLICT DO NOTHING", (code, name))
            for days_ago in range(70):
                close = 50000 + (swing if days_ago % 2 else 0)
                conn.execute("INSERT INTO stock_prices VALUES (%s, %s, %s, %s, 1000) ON CONFLICT DO NOTHING",
                             (code, date(2026, 10, 1) - timedelta(days=days_ago), close, close * 1000))
        conn.execute("INSERT INTO disclosures VALUES ('B1', %s, '단일판매·공급계약체결', 'https://dart/B1', %s),"
                     " ('B2', %s, '자기주식취득결정', 'https://dart/B2', %s) ON CONFLICT DO NOTHING",
                     (CODE, TODAY, HELD, TODAY - timedelta(days=1)))


@pytest.fixture
def ai(monkeypatch):
    record = {"action": "buy", "verdicts": ["approve"], "invest": 0, "portion": None}

    def write(context):
        record["invest"] += 1
        return ProposalDraft(action=record["action"],
                             claims=[{"text": "공급계약을 맺었다", "type": "fact", "source_ids": ["dart:B1"]}],
                             counter_arguments=["계약 규모가 작다"], risks=["손실 가능"], invalid_if=["계약 해지"],
                             buy_portion=record["portion"])

    def verify(context):
        verdicts = record["verdicts"]
        return VerificationDraft(verdict=verdicts.pop(0) if len(verdicts) > 1 else verdicts[0], checks=[],
                                 risk_fit="ok", summary="공시 원문과 맞아요")

    monkeypatch.setattr(llm, "embed_query", lambda text: [0.1] * 768)
    monkeypatch.setattr(llm, "write_proposal", write)
    monkeypatch.setattr(llm, "verify_proposal", verify)
    return record


def setup_user(client, user, quiz=True):
    if quiz:
        assert client.put("/api/profile", headers=user["headers"], json=LEVEL_4_QUIZ).status_code == 200
    snapshot = {"cash_krw": 5_000_000, "fetched_at": datetime.now(KST).isoformat(),
                "holdings": [{"stock_code": HELD, "stock_name": HELD_NAME, "qty": 3, "avg_price": 48000}]}
    assert client.post("/api/snapshot", headers=user["headers"], json=snapshot).status_code == 204


def test_briefing_with_pick(client, user, ai, migrated) -> None:
    setup_user(client, user)
    assert client.get("/api/briefings/latest", headers=user["headers"]).status_code == 404

    content = briefing.build_briefing(migrated, user["id"])

    assert [n["title"] for n in content["news"]] == ["자기주식취득결정"]  # 보유 종목 공시만
    assert content["limits"]["clean_days"] == 0
    [pick] = content["picks"]  # 보유 종목은 후보에서 빠진다
    assert (pick["stock_name"], pick["verdict"], pick["last_close"], pick["worst_case_loss"]) == (NAME, "approve", 50000, 5000)
    assert pick["portion"] == "all"
    assert pick["claims"][0] == {"type": "사실", "text": "공급계약을 맺었다", "sources": ["단일판매·공급계약체결"]}
    saved = client.get("/api/briefings/latest", headers=user["headers"]).json()
    assert saved["content"]["picks"][0]["proposal_id"] == pick["proposal_id"]
    # 제안서는 기록에 남아 근거·검증 과정을 볼 수 있다
    assert pick["proposal_id"] in [h["proposal_id"] for h in client.get("/api/history", headers=user["headers"]).json()]


def test_rejected_or_not_buy_is_not_picked(client, user, ai, migrated, monkeypatch) -> None:
    setup_user(client, user)
    monkeypatch.setattr(briefing, "MAX_CANDIDATES", 1)  # 이 종목만 본다 (다른 테스트의 분석 대상 종목도 후보가 될 수 있어서)
    ai["verdicts"] = ["reject"]  # 2번 고쳐도 반려 → 사용자 판단 필요 → 제안하지 않음
    content = briefing.build_briefing(migrated, user["id"], movers=[CODE])
    assert content["picks"] == [] and content["checked"] == [{"stock_name": NAME, "action": "buy", "verdict": "user_judgement"}]
    assert ai["invest"] == 3

    ai["verdicts"], ai["action"] = ["approve"], "watch"
    assert briefing.build_briefing(migrated, user["id"], movers=[CODE])["picks"] == []


def test_general_mode_gets_no_picks(client, user, ai, migrated) -> None:
    setup_user(client, user, quiz=False)
    content = briefing.build_briefing(migrated, user["id"])
    assert content["mode"] == "general" and content["picks"] == [] and ai["invest"] == 0
    assert [n["title"] for n in content["news"]] == ["자기주식취득결정"]


def test_grade_1_stock_is_not_picked(client, user, ai, migrated) -> None:
    setup_user(client, user)
    with psycopg.connect(migrated) as conn:
        conn.execute("UPDATE stocks SET risk_grade = 1, risk_rcept_no = 'B1' WHERE code = %s", (CODE,))
    try:
        content = briefing.build_briefing(migrated, user["id"], movers=[CODE])  # 4단계(적극투자형)는 1등급 매수 제안 불가
        assert NAME not in [c["stock_name"] for c in content["checked"]]
    finally:
        with psycopg.connect(migrated) as conn:
            conn.execute("UPDATE stocks SET risk_grade = 2, risk_rcept_no = NULL WHERE code = %s", (CODE,))


def test_next_run_skips_weekend_and_holidays() -> None:
    friday_evening = datetime(2026, 10, 2, 18, 0, tzinfo=KST)  # 10/3 토, 10/4 일, 10/5 대체공휴일 → 10/6 화
    at = briefing.time(8, 30)
    assert briefing.seconds_until(at, friday_evening) == (datetime(2026, 10, 6, 8, 30, tzinfo=KST) - friday_evening).total_seconds()
    thursday = datetime(2026, 10, 8, 9, 0, tzinfo=KST)  # 지났으니 다음 날인데 금요일은 한글날
    assert briefing.seconds_until(at, thursday) == (datetime(2026, 10, 12, 8, 30, tzinfo=KST) - thursday).total_seconds()


def test_watchlist_api_and_briefing(client, user, ai, migrated) -> None:
    setup_user(client, user)
    headers = user["headers"]
    with psycopg.connect(migrated) as conn:  # 공시 없는 관심 종목
        conn.execute("INSERT INTO stocks VALUES ('666668', '관심전자', 'KOSPI', true) ON CONFLICT DO NOTHING")
        for days_ago in range(70):
            conn.execute("INSERT INTO stock_prices VALUES ('666668', %s, %s, 1, 1000) ON CONFLICT DO NOTHING",
                         (date(2026, 10, 1) - timedelta(days=days_ago), 50000 + (50 if days_ago % 2 else 0)))
    assert client.put("/api/watchlist/666668", headers=headers).status_code == 204
    assert client.put("/api/watchlist/666668", headers=headers).status_code == 204  # 두 번 넣어도 하나
    assert client.put("/api/watchlist/999999", headers=headers).status_code == 404
    assert [w["stock_name"] for w in client.get("/api/watchlist", headers=headers).json()] == ["관심전자"]
    stock = next(s for s in client.get("/api/stocks", headers=headers).json() if s["code"] == "666668")
    assert stock["watching"] is True

    content = briefing.build_briefing(migrated, user["id"])
    assert [c["stock_name"] for c in content["checked"]][:1] == ["관심전자"]  # 관심 종목이 먼저 후보 (공시가 없어도)

    assert client.delete("/api/watchlist/666668", headers=headers).status_code == 204
    assert client.get("/api/watchlist", headers=headers).json() == []


def test_refresh_rebuilds_today_briefing_once_per_gap(client, user, monkeypatch, migrated) -> None:
    """장중 매수 후보 다시 찾기: 이 사용자 것만 다시 만들고, REFRESH_GAP_MINUTES(30분) 안에 또 부르면 막는다 (Gemini 비용)"""
    from app.routers import briefings as router
    made = []

    def fake_build(database_url, user_id, movers=()):
        made.append((user_id, list(movers)))
        briefing.save_briefing(database_url, user_id, datetime.now(KST).date(), "morning",
                               {"picks": [], "news": [], "checked": [], "limits": {}, "mode": "custom"})

    monkeypatch.setattr(router, "build_briefing", fake_build)
    # 폰이 보낸 거래대금·상승률 상위 종목 코드가 후보로 넘어간다
    first = client.post("/api/briefings/refresh", headers=user["headers"], json={"candidates": ["000660", "005930"]})
    assert first.status_code == 200 and made == [(user["id"], ["000660", "005930"])] and first.json()["kind"] == "morning"
    again = client.post("/api/briefings/refresh", headers=user["headers"])
    assert again.status_code == 429 and len(made) == 1


def test_half_buy_pick_tells_app_to_buy_half(client, user, ai, migrated) -> None:
    # 2026-10-14: 추세는 좋지만 위험도 큰 종목은 관찰 대신 절반 매수를 고를 수 있다 (앱은 종목 몫의 절반만 먼저 산다)
    setup_user(client, user)
    ai["portion"] = "half"
    [pick] = briefing.build_briefing(migrated, user["id"])["picks"]
    assert pick["portion"] == "half"


def test_candidates_prefer_uptrend_and_skip_recent_watch(migrated) -> None:
    """2026-10-15: 공시 기준으로 골라 하락 추세 종목만 반복해서 봤다. 상승 추세·강한 순으로, 최근 관찰한 종목은 뺀다"""
    with psycopg.connect(migrated) as conn:
        for code, step in (("666670", 300), ("666671", 100), ("666672", -200)):  # 강한 상승, 약한 상승, 하락
            conn.execute("INSERT INTO stocks VALUES (%s, %s, 'KOSPI', true) ON CONFLICT DO NOTHING", (code, f"추세{code}"))
            for days_ago in range(70):
                close = 50000 + step * (70 - days_ago) + (100 if days_ago % 2 else 0)
                conn.execute("INSERT INTO stock_prices VALUES (%s, %s, %s, 1, 1000) ON CONFLICT DO NOTHING",
                             (code, date(2026, 10, 1) - timedelta(days=days_ago), close))
    profile = {"mode": "custom", "risk_level": 5, "flags": []}
    with psycopg.connect(migrated, row_factory=psycopg.rows.dict_row) as conn:
        ranks = briefing.trend_ranks(conn)
        assert ranks["666670"][0] and ranks["666671"][0] and not ranks["666672"][0]
        codes = [c["code"] for c in briefing.pick_candidates(conn, profile, set())]
        assert codes.index("666670") < codes.index("666671") if "666671" in codes else "666670" in codes
        assert "666672" not in codes[:codes.index("666670")]
        assert "666670" not in [c["code"] for c in briefing.pick_candidates(conn, profile, set(), skip={"666670"})]


def test_uptrend_watch_goes_to_rechecks_for_live_check(client, user, ai, migrated, monkeypatch) -> None:
    """2026-10-15: 서버(실시간 시세 없음)가 상승 추세 종목을 관찰로 끝내 반등 매수가 시험되지 못했다. 앱이 실시간으로 다시 본다"""
    setup_user(client, user)
    monkeypatch.setattr(briefing, "MAX_CANDIDATES", 1)
    monkeypatch.setattr(briefing, "trend_ranks", lambda conn: {CODE: (True, 10.0)})
    ai["action"] = "watch"
    content = briefing.build_briefing(migrated, user["id"], movers=[CODE])
    assert content["picks"] == []
    [recheck] = content["rechecks"]
    assert (recheck["stock_code"], recheck["portion"]) == (CODE, "half")


def test_missed_morning_only_on_trading_day_after_time_without_briefing(migrated) -> None:
    """2026-10-16: 서버가 08:20에 꺼져 있어 브리핑을 놓쳤다. 장중에 켜지면 바로 만든다"""
    at = briefing.time(8, 20)
    thursday = datetime(2026, 10, 15, 9, 5, tzinfo=KST)  # 거래일, 이 날짜 브리핑은 테스트 DB에 없다
    assert briefing.missed_morning(migrated, at, thursday)
    assert not briefing.missed_morning(migrated, at, thursday.replace(hour=8, minute=0))  # 아직 시각 전
    assert not briefing.missed_morning(migrated, at, thursday.replace(hour=15, minute=30))  # 장 끝
    assert not briefing.missed_morning(migrated, at, datetime(2026, 10, 17, 9, 5, tzinfo=KST))  # 토요일
