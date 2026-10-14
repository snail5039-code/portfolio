import psycopg
import pytest

from tests.conftest import LEVEL_4_QUIZ

GENERAL_DEFAULT = {"max_order_krw": 300_000, "max_daily_krw": 500_000, "max_weight_pct": 20}
VALID_POLICY = {"max_order_krw": 500_000, "max_daily_krw": 1_000_000, "max_weight_pct": 20}


def take_quiz(client, user, **changes):
    return client.put("/api/profile", headers=user["headers"], json={**LEVEL_4_QUIZ, **changes})


def limits(body: dict) -> dict:
    return {key: body[key] for key in GENERAL_DEFAULT}


def test_profile_and_policy_need_login(client) -> None:
    assert client.get("/api/profile").status_code == 401
    assert client.put("/api/policy", json=VALID_POLICY).status_code == 401


# ---------- 일반 모드 ----------

def test_new_user_starts_in_general_mode_with_safe_limits(client, user) -> None:
    assert client.get("/api/profile", headers=user["headers"]).json() == {"mode": "general"}
    policy = client.get("/api/policy", headers=user["headers"]).json()
    assert policy["mode"] == "general"
    assert limits(policy) == GENERAL_DEFAULT


def test_general_mode_cannot_raise_limits(client, user) -> None:
    response = client.put("/api/policy", headers=user["headers"], json=VALID_POLICY)
    assert response.status_code == 403


def test_general_mode_can_lower_limits_and_set_fee(client, user) -> None:
    body = {**GENERAL_DEFAULT, "max_order_krw": 100_000, "fee_rate_pct": 0.015}
    response = client.put("/api/policy", headers=user["headers"], json=body)
    assert response.status_code == 200
    assert response.json()["max_order_krw"] == 100_000
    assert response.json()["fee_rate_pct"] == 0.015


# ---------- 퀴즈 → 맞춤 모드 ----------

def test_quiz_switches_to_custom_mode_with_level_defaults(client, user) -> None:
    response = take_quiz(client, user)

    assert response.status_code == 200
    body = response.json()
    assert (body["mode"], body["risk_level"], body["label"]) == ("custom", 4, "적극투자형")
    assert limits(body["policy"]) == {"max_order_krw": 2_000_000, "max_daily_krw": 5_000_000, "max_weight_pct": 40}
    assert body["expires_at"].startswith("2028-")  # 24개월 뒤
    profile = client.get("/api/profile", headers=user["headers"]).json()
    assert (profile["mode"], profile["expired"]) == ("custom", False)


def test_quiz_returns_flags_notices_and_feedback(client, user) -> None:
    body = take_quiz(client, user, money_use="borrowed", portfolio_choice="D", quiz_diversify="one_stock").json()
    assert body["risk_level"] == 1
    assert {"no_buy_proposals", "quiz_missed"} <= set(body["flags"])
    assert len(body["notices"]) == 1
    assert len(body["quiz_feedback"]) == 2


@pytest.mark.parametrize(
    "changes",
    [{"birth_year": 2010}, {"money_use": "lottery"}, {"portfolio_choice": "E"}, {"drop_reaction": None}],
)
def test_bad_quiz_answers_are_422(client, user, changes: dict) -> None:
    assert take_quiz(client, user, **changes).status_code == 422


def test_quiz_limited_to_3_times_a_day(client, user) -> None:
    for _ in range(3):
        assert take_quiz(client, user).status_code == 200
    response = take_quiz(client, user)
    assert response.status_code == 429


def test_requiz_lowers_limits_but_never_raises_them(client, user) -> None:
    take_quiz(client, user)  # 4단계
    lower = take_quiz(client, user, drop_reaction="sell_some", portfolio_choice="A").json()["policy"]  # 1단계
    assert limits(lower) == GENERAL_DEFAULT

    higher = take_quiz(client, user, drop_reaction="buy_more", portfolio_choice="D").json()["policy"]  # 5단계
    assert limits(higher) == GENERAL_DEFAULT


def test_custom_mode_limits_above_default_save_with_warning(client, user) -> None:
    take_quiz(client, user)  # 4단계: 200만 / 500만 / 40%

    response = client.put(
        "/api/policy", headers=user["headers"],
        json={"max_order_krw": 2_500_000, "max_daily_krw": 6_000_000, "max_weight_pct": 40},
    )

    assert response.status_code == 200
    assert response.json()["max_order_krw"] == 2_500_000
    assert len(response.json()["warnings"]) == 2


def test_back_to_general_mode_lowers_limits(client, user) -> None:
    take_quiz(client, user)

    assert client.delete("/api/profile", headers=user["headers"]).status_code == 204

    policy = client.get("/api/policy", headers=user["headers"]).json()
    assert policy["mode"] == "general"
    assert limits(policy) == GENERAL_DEFAULT


def test_expired_quiz_falls_back_to_general_mode(client, user, migrated) -> None:
    take_quiz(client, user)
    with psycopg.connect(migrated) as conn:
        conn.execute("UPDATE investor_profiles SET expires_at = now() - interval '1 second' WHERE user_id = %s",
                     (user["id"],))

    profile = client.get("/api/profile", headers=user["headers"]).json()
    policy = client.get("/api/policy", headers=user["headers"]).json()

    assert (profile["mode"], profile["expired"]) == ("general", True)
    assert policy["mode"] == "general"
    assert limits(policy)["max_order_krw"] == 2_000_000  # 한도는 그대로 두고
    assert len(policy["warnings"]) == 3  # 안정형 기준으로 경고한다
    # 지금 값보다 올릴 수는 없다
    raise_body = {"max_order_krw": 2_000_001, "max_daily_krw": 5_000_000, "max_weight_pct": 40}
    assert client.put("/api/policy", headers=user["headers"], json=raise_body).status_code == 403


# ---------- 입력 검사 ----------

@pytest.mark.parametrize(
    "changes",
    [
        {"max_order_krw": 0},
        {"max_order_krw": -1},
        {"max_order_krw": 10**12 + 1},
        {"max_order_krw": 1.5},
        {"max_daily_krw": 400_000},  # 1회 한도(50만)보다 작음
        {"max_weight_pct": 100.01},
        {"max_weight_pct": -1},
        {"max_weight_pct": 10.123},
        {"fee_rate_pct": 1.01},
        {"fee_rate_pct": -0.01},
        {"fee_rate_pct": 0.00001},
    ],
)
def test_policy_rejects_out_of_range(client, user, changes: dict) -> None:
    take_quiz(client, user)
    response = client.put("/api/policy", headers=user["headers"], json={**VALID_POLICY, **changes})
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


def test_users_cannot_see_each_others_profile(client, user) -> None:
    take_quiz(client, user)
    email = "other-" + user["email"]
    client.post("/api/auth/signup", json={"email": email, "password": "pw-other-1", "agreed_terms": True})
    token = client.post("/api/auth/login", json={"email": email, "password": "pw-other-1"}).json()["token"]

    response = client.get("/api/profile", headers={"Authorization": f"Bearer {token}"})

    assert response.json() == {"mode": "general"}  # 내 퀴즈 결과가 보이면 안 된다
