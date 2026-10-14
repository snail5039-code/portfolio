import psycopg
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.migrate import migrate

TABLES = {
    "users", "investor_profiles", "policies", "account_snapshots", "threads", "messages",
    "stocks", "proposals", "verifications", "policy_checks", "approvals", "orders",
    "audit_logs", "disclosures", "disclosure_chunks", "sessions", "stock_prices", "financials", "briefings", "glossary_terms", "watchlist", "news", "devices", "notifications", "reservations", "market_history",
}


@pytest.fixture
def conn(migrated: str):
    # 테스트마다 트랜잭션 안에서 돌리고 마지막에 되돌린다
    with psycopg.connect(migrated) as c:
        yield c
        c.rollback()


def test_creates_26_tables(conn) -> None:
    rows = conn.execute(
        "SELECT table_name FROM information_schema.tables"
        " WHERE table_schema = 'public' AND table_name <> 'schema_migrations'"
        " AND table_name NOT LIKE 'checkpoint%'"  # LangGraph PostgresSaver가 직접 만드는 테이블
    ).fetchall()
    assert {r[0] for r in rows} == TABLES


def test_migrate_twice_applies_nothing(migrated: str) -> None:
    assert migrate(migrated) == []


def test_health_ok_when_db_up(migrated: str) -> None:
    response = TestClient(create_app(migrated)).get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": "ok"}


def test_health_503_when_db_down() -> None:
    bad_url = "postgresql://postgres:x@127.0.0.1:1/none"
    response = TestClient(create_app(bad_url)).get("/api/health")
    assert response.status_code == 503
    assert response.json() == {"status": "degraded", "db": "error"}


def _user(conn) -> str:
    return conn.execute(
        "INSERT INTO users (email, password_hash, terms_agreed_at)"
        " VALUES (gen_random_uuid() || '@t.kr', 'h', now()) RETURNING id"
    ).fetchone()[0]


def _approval(conn, user_id) -> str:
    conn.execute("INSERT INTO stocks VALUES ('000660', 'SK하이닉스', 'KOSPI', true) ON CONFLICT DO NOTHING")
    thread_id = conn.execute("INSERT INTO threads (user_id) VALUES (%s) RETURNING id", (user_id,)).fetchone()[0]
    proposal_id = conn.execute(
        "INSERT INTO proposals (user_id, thread_id, stock_code, action, qty, limit_price)"
        " VALUES (%s, %s, '000660', 'buy', 4, 200000) RETURNING id",
        (user_id, thread_id),
    ).fetchone()[0]
    return conn.execute(
        "INSERT INTO approvals (proposal_id, expires_at) VALUES (%s, now() + interval '10 minutes') RETURNING id",
        (proposal_id,),
    ).fetchone()[0]


def _order(conn, approval_id, key: str, broker: str = "kis_mock", mode: str = "mock", price: int = 200000) -> None:
    conn.execute(
        "INSERT INTO orders (approval_id, idempotency_key, broker, mode, side, qty, price, status)"
        " VALUES (%s, %s, %s, %s, 'buy', 4, %s, 'accepted')",
        (approval_id, key, broker, mode, price),
    )


@pytest.mark.parametrize("risk_level", [0, 6])
def test_risk_level_out_of_range_rejected(conn, risk_level: int) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO investor_profiles (user_id, risk_level, birth_year, expires_at) VALUES (%s, %s, 1990, now())",
            (_user(conn), risk_level),
        )


@pytest.mark.parametrize(
    "order_krw, daily_krw, weight_pct",
    [(0, 1000, 10), (1000, -1, 10), (1000, 1000, 100.01), (1000, 1000, -1)],
)
def test_policy_limits_out_of_range_rejected(conn, order_krw, daily_krw, weight_pct) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO policies (user_id, max_order_krw, max_daily_krw, max_weight_pct) VALUES (%s, %s, %s, %s)",
            (_user(conn), order_krw, daily_krw, weight_pct),
        )


def test_same_idempotency_key_rejected(conn) -> None:
    approval_id = _approval(conn, _user(conn))
    _order(conn, approval_id, "k-1")
    with pytest.raises(psycopg.errors.UniqueViolation):
        _order(conn, approval_id, "k-1")


def test_order_price_must_be_positive(conn) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        _order(conn, _approval(conn, _user(conn)), "k-2", price=0)


def test_kis_mock_cannot_be_real_mode(conn) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        _order(conn, _approval(conn, _user(conn)), "k-3", broker="kis_mock", mode="real")


def test_deleting_user_deletes_their_data(conn) -> None:
    user_id = _user(conn)
    _order(conn, _approval(conn, user_id), "k-4")
    conn.execute("INSERT INTO audit_logs (user_id, event) VALUES (%s, 'test')", (user_id,))

    conn.execute("DELETE FROM users WHERE id = %s", (user_id,))

    for table in ["threads", "proposals", "audit_logs"]:
        assert conn.execute(f"SELECT count(*) FROM {table} WHERE user_id = %s", (user_id,)).fetchone()[0] == 0
    assert conn.execute("SELECT count(*) FROM orders WHERE idempotency_key = 'k-4'").fetchone()[0] == 0
