"""테스트는 개발 DB(invest)가 아니라 invest_test에서만 돈다."""

from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.conninfo import conninfo_to_dict, make_conninfo

from app import config
from app.main import create_app
from app.migrate import migrate

TEST_DB = "invest_test"
# 개발용 .env의 장 시간 고정(MARKET_CLOCK)이 테스트에 섞이지 않게 한다. 테스트는 clock.now를 직접 바꾼다
config.MARKET_CLOCK = None
config.NEWS_FETCH = False  # 테스트는 인터넷에서 뉴스를 받지 않는다
config.LIVE_DISCLOSURES = False  # 장중 공시도 DART에서 받지 않는다
config.MOCK_ORDER_LIMITS = True  # 한도 규칙 테스트는 모의 주문으로 한다. 끈 경우는 test_mock_has_no_amount_limits
config.SIGNAL_MODEL_URL = None  # 학습한 성향 신호 모델은 테스트에서 끈다 (켤 때는 가짜로 바꿔 끼운다)


@pytest.fixture(scope="session")
def test_db_url() -> str:
    if not config.DATABASE_URL:
        pytest.skip("DATABASE_URL이 없습니다 (apps/api/.env)")
    params = conninfo_to_dict(config.DATABASE_URL)
    admin_url = make_conninfo(**{**params, "dbname": "postgres"})
    with psycopg.connect(admin_url, autocommit=True, connect_timeout=3) as conn:
        conn.execute(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)")
        conn.execute(f"CREATE DATABASE {TEST_DB}")
    return make_conninfo(**{**params, "dbname": TEST_DB})


@pytest.fixture(scope="session")
def migrated(test_db_url: str) -> str:
    assert migrate(test_db_url) == ["001_init.sql", "002_auth_policy.sql", "003_quiz_modes.sql", "004_market_data.sql", "005_analysis.sql", "006_financials_cumulative.sql", "007_orders.sql", "008_order_fills.sql", "009_briefings.sql", "010_stock_rooms.sql", "011_glossary.sql", "012_watchlist.sql", "013_close_summary.sql", "014_risk_grade.sql", "015_news.sql", "016_order_changes.sql", "017_notifications.sql", "018_reservations.sql", "019_market_history.sql", "020_equity.sql", "021_sell_deferrals.sql", "022_snapshot_market.sql"]
    return test_db_url


@pytest.fixture(scope="session")
def client(migrated: str):
    # with: 서버 시작·종료(lifespan)를 실행해서 대화 그래프와 체크포인트 연결을 만들고 닫는다
    with TestClient(create_app(migrated)) as test_client:
        yield test_client


PASSWORD = "correct-horse-1"


@pytest.fixture
def user(client: TestClient) -> dict:
    """가입·로그인한 새 회원. 테스트마다 다른 이메일을 쓴다."""
    email = f"{uuid4().hex}@test.kr"
    signup = client.post("/api/auth/signup", json={"email": email, "password": PASSWORD, "agreed_terms": True})
    assert signup.status_code == 201
    token = client.post("/api/auth/login", json={"email": email, "password": PASSWORD}).json()["token"]
    return {"id": signup.json()["user_id"], "email": email, "headers": {"Authorization": f"Bearer {token}"}}


# 30대, 여유자금, 비상금 있음, 기다린다(3) + C(3) = 6점, 퀴즈 모두 정답 → 4단계 적극투자형
LEVEL_4_QUIZ = {
    "birth_year": 1995,
    "money_use": "spare",
    "emergency": "fund",
    "drop_reaction": "wait",
    "portfolio_choice": "C",
    "hot_tip": "research",
    "quiz_diversify": "ten_stocks",
    "quiz_trading_cost": "frequent_earns_less",
}
