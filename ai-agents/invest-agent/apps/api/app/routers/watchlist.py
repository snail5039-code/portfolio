"""관심 종목 (docs/plan/12-todo-by-stage.md 2-3). 채팅 탭 동그라미, 아침 브리핑(소식·매수 후보)에 쓴다."""

from fastapi import APIRouter, HTTPException

from app.agents.analysis import news_disclosure, recent_news
from app.db import Conn
from app.routers.auth import UserId

router = APIRouter(prefix="/api", tags=["watchlist"])
MAX_WATCH = 30


@router.get("/stocks")
def list_stocks(conn: Conn, user_id: UserId) -> list[dict]:
    """관심 종목을 고를 수 있는 종목 (지금은 분석 대상만). watching: 내 관심 종목인지."""
    return conn.execute(
        "SELECT s.code, s.name, s.market, EXISTS (SELECT 1 FROM watchlist w WHERE w.user_id = %s AND w.stock_code = s.code) AS watching"
        " FROM stocks s WHERE s.is_target ORDER BY s.market DESC, s.name COLLATE \"C\"",
        (user_id,),
    ).fetchall()


@router.get("/stocks/{stock_code}/feed")
def stock_feed(stock_code: str, conn: Conn, user_id: UserId) -> dict:
    """뉴스·공시 탭 (2-2, FR-40): 최근 뉴스(제목·언론사·링크, 같은 무렵 공시가 있으면 함께)와 최근 30일 공시.
    뉴스는 30분 안에 받은 적이 없으면 새로 받는다. 기사 본문은 없다"""
    stock = conn.execute("SELECT code, name FROM stocks WHERE code = %s AND is_target", (stock_code,)).fetchone()
    if stock is None:
        raise HTTPException(404, "분석 대상 종목이 아니에요")
    ids = recent_news(conn, stock_code, stock["name"])
    conn.commit()  # 새로 받은 뉴스 저장
    news = conn.execute(
        "SELECT id, title, press, url, published_at FROM news WHERE id = ANY(%s) ORDER BY published_at DESC",
        ([int(i.split(":")[1]) for i in ids],)).fetchall()
    for item in news:
        item["disclosure"] = news_disclosure(conn, stock_code, item["published_at"])
    disclosures = conn.execute(
        "SELECT rcept_no, title, url, filed_at FROM disclosures WHERE stock_code = %s AND filed_at >= current_date - 30"
        " ORDER BY filed_at DESC, rcept_no DESC LIMIT 30", (stock_code,)).fetchall()
    return {"stock_code": stock_code, "stock_name": stock["name"], "news": news, "disclosures": disclosures}


@router.get("/watchlist")
def list_watchlist(conn: Conn, user_id: UserId) -> list[dict]:
    return conn.execute(
        "SELECT w.stock_code, s.name AS stock_name, w.created_at FROM watchlist w JOIN stocks s ON s.code = w.stock_code"
        " WHERE w.user_id = %s ORDER BY w.created_at",
        (user_id,),
    ).fetchall()


@router.put("/watchlist/{stock_code}", status_code=204)
def add_watch(stock_code: str, conn: Conn, user_id: UserId) -> None:
    if not conn.execute("SELECT 1 FROM stocks WHERE code = %s AND is_target", (stock_code,)).fetchone():
        raise HTTPException(404, "관심 종목으로 넣을 수 없는 종목이에요 (지금은 분석 대상만)")
    count = conn.execute("SELECT count(*) AS n FROM watchlist WHERE user_id = %s", (user_id,)).fetchone()["n"]
    if count >= MAX_WATCH:
        raise HTTPException(422, f"관심 종목은 {MAX_WATCH}개까지예요")
    conn.execute("INSERT INTO watchlist (user_id, stock_code) VALUES (%s, %s) ON CONFLICT DO NOTHING", (user_id, stock_code))
    conn.commit()


@router.delete("/watchlist/{stock_code}", status_code=204)
def remove_watch(stock_code: str, conn: Conn, user_id: UserId) -> None:
    conn.execute("DELETE FROM watchlist WHERE user_id = %s AND stock_code = %s", (user_id, stock_code))
    conn.commit()
