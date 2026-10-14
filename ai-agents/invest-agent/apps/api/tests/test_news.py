"""뉴스 (2-2): Google 뉴스 RSS 읽기, 저장, 출처로 쓰기. 인터넷은 쓰지 않는다 (search를 가짜로 바꾼다)."""

from datetime import datetime, timedelta

import psycopg
from psycopg.rows import dict_row

from app import config
from app.agents import analysis
from app.clock import KST
from app.db import connect
from app.integrations import google_news

RSS = """<?xml version="1.0" encoding="UTF-8"?><rss><channel>
<item><title>NH투자증권 목표가 하향…3분기 실적 우려 - 녹색경제신문</title><link>https://news.google.com/a1</link>
<pubDate>Thu, 08 Oct 2026 02:54:00 GMT</pubDate><source url="https://www.greened.kr">녹색경제신문</source></item>
<item><title>[리포트 브리핑]하이브, 목표가 250,000원 - NH투자증권 - 뉴스핌</title><link>https://news.google.com/a3</link>
<pubDate>Thu, 08 Oct 2026 02:53:00 GMT</pubDate><source url="https://www.newspim.com">뉴스핌</source></item>
<item><title>코스피 2% 급락 마감 - 뉴스핌</title><link>https://news.google.com/a2</link>
<pubDate>Thu, 08 Oct 2026 07:00:00 GMT</pubDate><source url="https://www.newspim.com">뉴스핌</source></item>
</channel></rss>"""


def test_parse_keeps_titles_with_stock_name_and_strips_press() -> None:
    items = google_news.parse(RSS, "NH투자증권")
    assert items == [{"title": "NH투자증권 목표가 하향…3분기 실적 우려", "press": "녹색경제신문",
                      "url": "https://news.google.com/a1",
                      "published_at": datetime(2026, 10, 8, 2, 54, tzinfo=items[0]["published_at"].tzinfo)}]
    assert items[0]["published_at"].utcoffset() == timedelta(0)


def test_mentions_ignores_longer_stock_names() -> None:
    assert google_news.mentions("현대건설이 원전 수주", "현대건설")
    assert google_news.mentions("삼성물산·현대건설 선점한 여의도", "현대건설")
    assert not google_news.mentions("적정가치, HD현대건설기계 41% 급락", "현대건설")
    assert not google_news.mentions("현대건설기계 실적", "현대건설", ("현대건설기계",))


def test_recent_news_fetches_once_stores_and_becomes_source(migrated, monkeypatch) -> None:
    code, name = "666661", "뉴스테스트"
    published = datetime.now(KST) - timedelta(hours=3)
    calls = []

    def fake_search(query_name, days, longer=()):
        calls.append((query_name, days))
        return [{"title": f"{name} 실적 우려", "press": "테스트일보", "url": "https://news/x1", "published_at": published}]

    monkeypatch.setattr(google_news, "search", fake_search)
    monkeypatch.setattr(config, "NEWS_FETCH", True)
    with psycopg.connect(migrated) as conn:
        conn.execute("INSERT INTO stocks VALUES (%s, %s, 'KOSPI', true) ON CONFLICT DO NOTHING", (code, name))
    with connect(migrated, row_factory=dict_row) as conn:
        ids = analysis.recent_news(conn, code, name)
        assert analysis.recent_news(conn, code, name) == ids  # 30분 안에는 다시 받지 않는다
        source = analysis.load_source(conn, ids[0], {})
    assert calls == [(name, analysis.NEWS_DAYS)] and len(ids) == 1
    assert source["kind"] == "news" and source["url"] == "https://news/x1"
    assert source["title"] == f"{name} 실적 우려 (테스트일보)"
    assert "공시로 확인되지 않은 보도" in source["content"] and "본문은 없다" in source["content"]


def test_recent_news_survives_fetch_failure(migrated, monkeypatch) -> None:
    def broken(*_):
        raise RuntimeError("RSS 형식 바뀜")

    monkeypatch.setattr(google_news, "search", broken)
    monkeypatch.setattr(config, "NEWS_FETCH", True)
    with psycopg.connect(migrated) as conn:
        conn.execute("INSERT INTO stocks VALUES ('666662', '뉴스실패', 'KOSPI', true) ON CONFLICT DO NOTHING")
    with connect(migrated, row_factory=dict_row) as conn:
        assert analysis.recent_news(conn, "666662", "뉴스실패") == []  # 뉴스 없이도 분석은 계속한다


def test_stock_feed_shows_news_with_nearby_disclosure(client, user, migrated) -> None:
    code = "666663"
    published = datetime.now(KST) - timedelta(hours=2)
    with psycopg.connect(migrated) as conn:
        conn.execute("INSERT INTO stocks VALUES (%s, '피드테스트', 'KOSPI', true) ON CONFLICT DO NOTHING", (code,))
        conn.execute("INSERT INTO news (stock_code, title, press, url, published_at) VALUES"
                     " (%s, '피드테스트 유상증자', '테스트일보', 'https://news/f1', %s),"
                     " (%s, '피드테스트 신제품', '테스트일보', 'https://news/f2', %s)",
                     (code, published, code, published - timedelta(days=2)))
        conn.execute("INSERT INTO disclosures VALUES ('F1', %s, '주요사항보고서(유상증자결정)', 'https://dart/F1', %s)",
                     (code, published.date()))
    feed = client.get(f"/api/stocks/{code}/feed", headers=user["headers"]).json()
    assert [n["title"] for n in feed["news"]] == ["피드테스트 유상증자", "피드테스트 신제품"]
    assert feed["news"][0]["disclosure"]["rcept_no"] == "F1"   # 같은 날 공시가 있으면 함께
    assert feed["news"][1]["disclosure"] is None               # 이틀 전 기사는 공시로 확인되지 않은 보도
    assert [d["rcept_no"] for d in feed["disclosures"]] == ["F1"]
    with connect(migrated, row_factory=dict_row) as conn:
        news_id = conn.execute("SELECT id FROM news WHERE url = 'https://news/f1'").fetchone()["id"]
        assert "같은 무렵 공시가 있다: 주요사항보고서(유상증자결정)" in analysis.load_source(conn, f"news:{news_id}", {})["content"]
    assert client.get("/api/stocks/000000/feed", headers=user["headers"]).status_code == 404
