"""회원가입 · 로그인 · 로그아웃 · 내 정보 · 탈퇴 (FR-01, FR-04, NFR-03)."""

import hashlib
import hmac
import re
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import timedelta
from typing import Annotated
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.db import Conn, audit
from app.functions.profile import DEFAULT_POLICIES, GENERAL_MODE_LEVEL

router = APIRouter(prefix="/api", tags=["auth"])

SESSION_LIFETIME = timedelta(days=14)
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# scrypt 비용 설정 (메모리 약 16MB). 해시 문자열에 같이 저장하므로 나중에 올려도 예전 해시를 확인할 수 있다
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1
# 로그인 실패 제한: 같은 이메일 5번, 같은 접속 주소 20번을 15분 안에 틀리면 잠시 막는다 (비밀번호 대입 공격 방지)
LOGIN_WINDOW_SECONDS = 15 * 60
MAX_FAILURES_PER_EMAIL, MAX_FAILURES_PER_IP = 5, 20


class LoginLimiter:
    """최근 실패 시각을 키(이메일, 접속 주소)별로 기억한다.

    ponytail: 서버 메모리에 둔다 (서버 한 대, 재시작하면 초기화). 서버를 여러 대로 늘리면 DB나 Redis로 옮긴다
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._failures: dict[str, deque] = defaultdict(deque)

    def _recent(self, key: str, now: float) -> deque:
        failures = self._failures[key]
        while failures and failures[0] <= now - LOGIN_WINDOW_SECONDS:
            failures.popleft()
        return failures

    def blocked(self, email: str, ip: str) -> bool:
        now = time.monotonic()
        with self._lock:
            return (len(self._recent(f"email:{email}", now)) >= MAX_FAILURES_PER_EMAIL
                    or len(self._recent(f"ip:{ip}", now)) >= MAX_FAILURES_PER_IP)

    def failed(self, email: str, ip: str) -> None:
        now = time.monotonic()
        with self._lock:
            self._recent(f"email:{email}", now).append(now)
            self._recent(f"ip:{ip}", now).append(now)

    def succeeded(self, email: str) -> None:
        with self._lock:
            self._failures.pop(f"email:{email}", None)


login_limiter = LoginLimiter()


# ---------- 비밀번호와 토큰 ----------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    _, n, r, p, salt, digest = stored.split("$")
    actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p))
    return hmac.compare_digest(actual.hex(), digest)


# 없는 이메일로 로그인할 때도 같은 계산을 해서, 응답 시간으로 가입 여부를 알 수 없게 한다
DUMMY_PASSWORD_HASH = hash_password(secrets.token_hex(16))


def token_hash(token: str) -> str:
    """DB에는 토큰 원문 대신 이 해시만 저장한다."""
    return hashlib.sha256(token.encode()).hexdigest()


def bearer_token_hash(authorization: str | None) -> str | None:
    scheme, _, token = (authorization or "").partition(" ")
    return token_hash(token) if scheme.lower() == "bearer" and token else None


def current_user_id(conn: Conn, authorization: Annotated[str | None, Header()] = None) -> UUID:
    """FastAPI 의존성: `Authorization: Bearer <토큰>`을 확인해 로그인한 사용자 ID를 돌려준다."""
    hashed = bearer_token_hash(authorization)
    row = hashed and conn.execute(
        "SELECT user_id FROM sessions WHERE token_hash = %s AND expires_at > now()", (hashed,)
    ).fetchone()
    if not row:
        raise HTTPException(401, "로그인이 필요해요", headers={"WWW-Authenticate": "Bearer"})
    return row["user_id"]


UserId = Annotated[UUID, Depends(current_user_id)]


# ---------- 요청 형식 ----------

def normalize_email(value: str) -> str:
    return value.strip().lower()


class SignupRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
    agreed_terms: bool  # 이용 안내: 투자 판단과 책임은 사용자에게 있음

    @field_validator("email")
    @classmethod
    def check_email(cls, value: str) -> str:
        value = normalize_email(value)
        if not EMAIL_PATTERN.match(value):
            raise ValueError("이메일 형식이 아니에요")
        return value

    @field_validator("agreed_terms")
    @classmethod
    def check_agreed(cls, value: bool) -> bool:
        if not value:
            raise ValueError("이용 안내에 동의해야 가입할 수 있어요")
        return value


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)

    @field_validator("email")
    @classmethod
    def check_email(cls, value: str) -> str:
        return normalize_email(value)


class PasswordConfirm(BaseModel):
    password: str = Field(max_length=128)


# ---------- API ----------

@router.post("/auth/signup", status_code=201)
def signup(body: SignupRequest, conn: Conn) -> dict:
    try:
        user = conn.execute(
            "INSERT INTO users (email, password_hash, terms_agreed_at) VALUES (%s, %s, now()) RETURNING id",
            (body.email, hash_password(body.password)),
        ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(409, "이미 가입된 이메일이에요") from None
    # 가입하면 일반 모드로 시작한다: 한도는 안정형 기본값
    conn.execute(
        "INSERT INTO policies (user_id, max_order_krw, max_daily_krw, max_weight_pct)"
        " VALUES (%(user_id)s, %(max_order_krw)s, %(max_daily_krw)s, %(max_weight_pct)s)",
        {"user_id": user["id"], **DEFAULT_POLICIES[GENERAL_MODE_LEVEL]},
    )
    audit(conn, user["id"], "signup")
    conn.commit()
    return {"user_id": user["id"]}


@router.post("/auth/login")
def login(body: LoginRequest, request: Request, conn: Conn) -> dict:
    ip = request.client.host if request.client else "unknown"
    if login_limiter.blocked(body.email, ip):
        # 맞는 비밀번호여도 막는다 (막힌 동안 대입을 계속 시도하지 못하게)
        raise HTTPException(429, "로그인 시도가 너무 많아요. 15분 뒤에 다시 시도해 주세요")
    user = conn.execute("SELECT id, password_hash FROM users WHERE email = %s", (body.email,)).fetchone()
    password_ok = verify_password(body.password, user["password_hash"] if user else DUMMY_PASSWORD_HASH)
    if not (user and password_ok):
        login_limiter.failed(body.email, ip)
        # 이메일이 틀렸는지 비밀번호가 틀렸는지 알려주지 않는다
        raise HTTPException(401, "이메일 또는 비밀번호가 맞지 않아요")
    login_limiter.succeeded(body.email)

    token = secrets.token_urlsafe(32)
    conn.execute("DELETE FROM sessions WHERE user_id = %s AND expires_at <= now()", (user["id"],))
    session = conn.execute(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (%s, %s, now() + %s) RETURNING expires_at",
        (token_hash(token), user["id"], SESSION_LIFETIME),
    ).fetchone()
    audit(conn, user["id"], "login")
    conn.commit()
    return {"token": token, "expires_at": session["expires_at"]}


@router.post("/auth/logout", status_code=204)
def logout(conn: Conn, user_id: UserId, authorization: Annotated[str, Header()]) -> None:
    conn.execute("DELETE FROM sessions WHERE token_hash = %s", (bearer_token_hash(authorization),))
    conn.commit()


@router.get("/me")
def get_me(conn: Conn, user_id: UserId) -> dict:
    return conn.execute(
        "SELECT id AS user_id, email, created_at FROM users WHERE id = %s", (user_id,)
    ).fetchone()


@router.delete("/me", status_code=204)
def delete_me(body: PasswordConfirm, conn: Conn, user_id: UserId) -> None:
    """탈퇴. 비밀번호를 다시 확인하고, 회원을 지우면 관련 데이터가 모두 함께 지워진다 (ON DELETE CASCADE)."""
    user = conn.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,)).fetchone()
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(403, "비밀번호가 맞지 않아요")
    conn.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
