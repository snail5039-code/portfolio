from uuid import uuid4

import psycopg
import pytest

from tests.conftest import LEVEL_4_QUIZ, PASSWORD


def signup(client, **overrides):
    body = {"email": f"{uuid4().hex}@test.kr", "password": PASSWORD, "agreed_terms": True, **overrides}
    return client.post("/api/auth/signup", json=body)


@pytest.mark.parametrize(
    "overrides",
    [
        {"email": "not-an-email"},
        {"email": "a b@test.kr"},
        {"password": "short"},
        {"password": "x" * 129},
        {"agreed_terms": False},
    ],
)
def test_signup_rejects_bad_input(client, overrides: dict) -> None:
    response = signup(client, **overrides)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)


def test_signup_duplicate_email_is_409_even_with_different_case(client, user) -> None:
    response = signup(client, email=user["email"].upper())
    assert response.status_code == 409


def test_password_is_stored_as_hash(client, migrated) -> None:
    email = f"{uuid4().hex}@test.kr"
    signup(client, email=email)
    with psycopg.connect(migrated) as conn:
        stored = conn.execute("SELECT password_hash FROM users WHERE email = %s", (email,)).fetchone()[0]
    assert PASSWORD not in stored
    assert stored.startswith("scrypt$")


def test_login_failure_does_not_say_which_part_was_wrong(client, user) -> None:
    wrong_password = client.post("/api/auth/login", json={"email": user["email"], "password": "wrong-pass-1"})
    unknown_email = client.post("/api/auth/login", json={"email": "nobody@test.kr", "password": PASSWORD})
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_login_is_blocked_after_too_many_failures(client, user) -> None:
    from app.routers.auth import MAX_FAILURES_PER_EMAIL, login_limiter

    for _ in range(MAX_FAILURES_PER_EMAIL):
        assert client.post("/api/auth/login", json={"email": user["email"], "password": "wrong-pass-1"}).status_code == 401
    blocked = client.post("/api/auth/login", json={"email": user["email"], "password": PASSWORD})
    assert blocked.status_code == 429  # 맞는 비밀번호여도 막힌 동안은 안 된다
    other = client.post("/api/auth/login", json={"email": "other-" + user["email"], "password": PASSWORD})
    assert other.status_code == 401  # 다른 이메일은 막히지 않는다 (접속 주소 한도 전)
    login_limiter.__init__()  # 다른 테스트에 영향이 없게 초기화


def test_me_returns_my_info(client, user) -> None:
    response = client.get("/api/me", headers=user["headers"])
    assert response.status_code == 200
    assert response.json()["email"] == user["email"]
    assert response.json()["created_at"].endswith("+09:00")


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer wrong"}, {"Authorization": "Basic abc"}])
def test_me_requires_valid_token(client, headers: dict) -> None:
    assert client.get("/api/me", headers=headers).status_code == 401


def test_expired_token_is_rejected(client, user, migrated) -> None:
    with psycopg.connect(migrated) as conn:
        conn.execute("UPDATE sessions SET expires_at = now() - interval '1 second' WHERE user_id = %s", (user["id"],))
    assert client.get("/api/me", headers=user["headers"]).status_code == 401


def test_logout_invalidates_token(client, user) -> None:
    assert client.post("/api/auth/logout", headers=user["headers"]).status_code == 204
    assert client.get("/api/me", headers=user["headers"]).status_code == 401


def test_delete_me_needs_password(client, user) -> None:
    response = client.request("DELETE", "/api/me", headers=user["headers"], json={"password": "wrong-pass-1"})
    assert response.status_code == 403
    assert client.get("/api/me", headers=user["headers"]).status_code == 200


def test_delete_me_removes_all_my_data(client, user, migrated) -> None:
    client.put("/api/profile", headers=user["headers"], json=LEVEL_4_QUIZ)

    response = client.request("DELETE", "/api/me", headers=user["headers"], json={"password": PASSWORD})

    assert response.status_code == 204
    with psycopg.connect(migrated) as conn:
        for table in ["users", "sessions", "investor_profiles", "policies", "audit_logs"]:
            column = "id" if table == "users" else "user_id"
            count = conn.execute(f"SELECT count(*) FROM {table} WHERE {column} = %s", (user["id"],)).fetchone()[0]
            assert count == 0, table
    assert client.post("/api/auth/login", json={"email": user["email"], "password": PASSWORD}).status_code == 401
