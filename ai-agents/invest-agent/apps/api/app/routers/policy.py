"""투자성향 퀴즈, 일반·맞춤 모드, 투자 정책 (FR-02, FR-03, FR-07 ~ FR-07b).

- 일반 모드: 퀴즈를 안 했거나 결과가 24개월 지난 상태. AI는 정보·분석만 주고, 한도는 안정형 기본값보다 올릴 수 없다
- 맞춤 모드: 퀴즈 결과가 유효한 상태. 한도를 성향 기본값보다 올리면 저장하고 경고한다
규칙 설명: docs/plan/09-investor-profile.md
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

import psycopg
from fastapi import APIRouter, HTTPException
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field, model_validator

from app.clock import KST
from app.db import Conn, audit
from app.functions.behavior import behavior
from app.functions.profile import (
    DEFAULT_POLICIES,
    GENERAL_MODE_LEVEL,
    LABELS,
    QuizAnswers,
    assess,
    lowered_policy,
    policy_warnings,
)
from app.routers.auth import UserId

router = APIRouter(prefix="/api", tags=["profile", "policy"])

# 1조 원. bigint 범위를 넘는 값이 DB까지 가지 않게 막는다
MAX_KRW = 10**12
LIMIT_FIELDS = ("max_order_krw", "max_daily_krw", "max_weight_pct")
QUIZ_VALID_FOR = "24 months"
# 결과를 본 뒤 답을 바꿔 가며 성향을 올리지 못하게 한다 (온라인 증권사 기준과 같음)
MAX_QUIZ_PER_DAY = 3


class PolicyRequest(BaseModel):
    max_order_krw: int = Field(gt=0, le=MAX_KRW)
    max_daily_krw: int = Field(gt=0, le=MAX_KRW)
    max_weight_pct: Decimal = Field(ge=0, le=100, decimal_places=2)
    fee_rate_pct: Decimal | None = Field(default=None, ge=0, le=1, decimal_places=4)

    @model_validator(mode="after")
    def check_daily_covers_order(self) -> "PolicyRequest":
        if self.max_daily_krw < self.max_order_krw:
            raise ValueError("1일 한도는 1회 한도보다 작을 수 없어요")
        return self


# ---------- DB 읽기·쓰기 ----------

def load_policy(conn: psycopg.Connection, user_id: UUID) -> dict:
    """정책과 성향(있으면)을 함께 읽는다. 정책은 가입할 때 만들어지므로 항상 있다."""
    return conn.execute(
        "SELECT p.*, ip.risk_level, ip.expires_at > now() AS profile_valid"
        " FROM policies p LEFT JOIN investor_profiles ip USING (user_id)"
        " WHERE p.user_id = %s",
        (user_id,),
    ).fetchone()


def save_limits(conn: psycopg.Connection, user_id: UUID, limits: dict) -> None:
    conn.execute(
        "UPDATE policies SET max_order_krw = %(max_order_krw)s, max_daily_krw = %(max_daily_krw)s,"
        " max_weight_pct = %(max_weight_pct)s, updated_at = now() WHERE user_id = %(user_id)s",
        {"user_id": user_id, **limits},
    )


def profile_summary(conn: psycopg.Connection, user_id: UUID) -> dict:
    """대화 그래프에 넘길 성향 요약. 퀴즈 결과가 없거나 24개월이 지났으면 일반 모드.
    flags에는 퀴즈 표시 값에 최근 매매 습관(functions/behavior.py)을 더한다. 성향 단계는 퀴즈 그대로다."""
    row = conn.execute(
        "SELECT risk_level, flags FROM investor_profiles WHERE user_id = %s AND expires_at > now()", (user_id,)
    ).fetchone()
    summary = {"mode": "custom", **row} if row else {"mode": "general", "risk_level": None, "flags": []}
    habits = behavior(conn, user_id)["flags"]
    return {**summary, "flags": list(dict.fromkeys([*summary["flags"], *habits]))}


# ---------- 응답 만들기 ----------

def mode_and_level(row: dict) -> tuple[str, int]:
    """맞춤 모드면 퀴즈 단계, 일반 모드면 안정형(1단계)을 기준으로 쓴다."""
    if row["profile_valid"]:
        return "custom", row["risk_level"]
    return "general", GENERAL_MODE_LEVEL


def as_json_numbers(values: dict) -> dict:
    """비율(Decimal)을 JSON 숫자로 내보낸다. FastAPI는 Decimal을 문자열로 바꾸기 때문이다. 계산은 Decimal로 한다."""
    return {key: float(value) if isinstance(value, Decimal) else value for key, value in values.items()}


def policy_response(row: dict) -> dict:
    mode, level = mode_and_level(row)
    return {
        **as_json_numbers({key: row[key] for key in (*LIMIT_FIELDS, "fee_rate_pct")}),
        "updated_at": row["updated_at"],
        "mode": mode,
        "default_policy": as_json_numbers(DEFAULT_POLICIES[level]),
        "warnings": policy_warnings(row, level),
    }


# ---------- API ----------

@router.get("/profile")
def get_profile(conn: Conn, user_id: UserId) -> dict:
    row = conn.execute(
        "SELECT risk_level, answers, flags, updated_at, expires_at, expires_at > now() AS valid"
        " FROM investor_profiles WHERE user_id = %s",
        (user_id,),
    ).fetchone()
    if row is None:
        return {"mode": "general"}
    return {
        "mode": "custom" if row["valid"] else "general",
        "risk_level": row["risk_level"],
        "label": LABELS[row["risk_level"]],
        "flags": row["flags"],
        "answers": row["answers"],
        "updated_at": row["updated_at"],
        "expires_at": row["expires_at"],
        "expired": not row["valid"],
    }


@router.get("/profile/behavior")
def get_behavior(conn: Conn, user_id: UserId) -> dict:
    """내 투자 습관 (최근 30일). 성향 단계·한도는 바꾸지 않고 조심하는 쪽으로만 쓴다."""
    return behavior(conn, user_id)


@router.put("/profile")
def put_profile(body: QuizAnswers, conn: Conn, user_id: UserId) -> dict:
    """퀴즈 답 → 성향 단계, 맞춤 모드로 전환.

    처음(또는 일반 모드로 돌아간 뒤 다시) 하면 그 단계 기본 한도로 바꾸고,
    퀴즈 결과가 있는 상태에서 다시 하면 한도를 올리지 않고 내리기만 한다.
    """
    taken_today = conn.execute(
        "SELECT count(*) AS n FROM audit_logs WHERE user_id = %s AND event = 'profile_updated'"
        " AND created_at >= date_trunc('day', now())",
        (user_id,),
    ).fetchone()["n"]
    if taken_today >= MAX_QUIZ_PER_DAY:
        raise HTTPException(429, f"성향 퀴즈는 하루 {MAX_QUIZ_PER_DAY}번까지 할 수 있어요")

    try:
        result = assess(body, this_year=datetime.now(KST).year)
    except ValueError as error:
        raise HTTPException(422, str(error)) from None

    level = result.risk_level
    previous = conn.execute("SELECT 1 FROM investor_profiles WHERE user_id = %s", (user_id,)).fetchone()
    current = load_policy(conn, user_id)
    limits = DEFAULT_POLICIES[level] if previous is None else lowered_policy(current, level)

    profile = conn.execute(
        "INSERT INTO investor_profiles (user_id, risk_level, answers, birth_year, flags, expires_at)"
        " VALUES (%s, %s, %s, %s, %s, now() + %s::interval)"
        " ON CONFLICT (user_id) DO UPDATE SET risk_level = EXCLUDED.risk_level, answers = EXCLUDED.answers,"
        " birth_year = EXCLUDED.birth_year, flags = EXCLUDED.flags, expires_at = EXCLUDED.expires_at,"
        " updated_at = now()"
        " RETURNING expires_at",
        (user_id, level, Jsonb(body.model_dump()), body.birth_year, result.flags, QUIZ_VALID_FOR),
    ).fetchone()
    save_limits(conn, user_id, limits)
    audit(conn, user_id, "profile_updated", {"risk_level": level, "flags": result.flags, "policy": limits})
    conn.commit()
    return {
        "mode": "custom",
        "risk_level": level,
        "label": LABELS[level],
        "flags": result.flags,
        "notices": result.notices,
        "quiz_feedback": result.quiz_feedback,
        "expires_at": profile["expires_at"],
        "policy": policy_response(load_policy(conn, user_id)),
    }


@router.delete("/profile", status_code=204)
def delete_profile(conn: Conn, user_id: UserId) -> None:
    """일반 모드로 돌아간다. 퀴즈 결과를 지우고, 한도는 안정형 기본값보다 높은 것만 내린다."""
    current = load_policy(conn, user_id)
    conn.execute("DELETE FROM investor_profiles WHERE user_id = %s", (user_id,))
    limits = lowered_policy(current, GENERAL_MODE_LEVEL)
    save_limits(conn, user_id, limits)
    audit(conn, user_id, "switched_to_general", {"policy": limits})
    conn.commit()


@router.get("/policy")
def get_policy(conn: Conn, user_id: UserId) -> dict:
    return policy_response(load_policy(conn, user_id))


@router.put("/policy")
def put_policy(body: PolicyRequest, conn: Conn, user_id: UserId) -> dict:
    """한도 수정.

    - 맞춤 모드: 성향 기본값보다 높아도 저장하고 warnings로 알려준다 (FR-07a)
    - 일반 모드: 지금 값과 안정형 기본값 중 큰 쪽보다 올릴 수 없다. 올리려면 퀴즈를 해야 한다
    """
    before = load_policy(conn, user_id)
    mode, _ = mode_and_level(before)
    if mode == "general":
        general_defaults = DEFAULT_POLICIES[GENERAL_MODE_LEVEL]
        if any(getattr(body, key) > max(before[key], general_defaults[key]) for key in LIMIT_FIELDS):
            raise HTTPException(403, "한도를 올리려면 성향 퀴즈를 해 주세요")

    save_limits(conn, user_id, body.model_dump())
    conn.execute("UPDATE policies SET fee_rate_pct = %s WHERE user_id = %s", (body.fee_rate_pct, user_id))
    audit(conn, user_id, "policy_updated", {
        "before": {key: before[key] for key in (*LIMIT_FIELDS, "fee_rate_pct")},
        "after": body.model_dump(),
    })
    conn.commit()
    return policy_response(load_policy(conn, user_id))


@router.get("/portfolio/analysis")
def portfolio_analysis(conn: Conn, user_id: UserId) -> dict:
    """5단계 포트폴리오 점검 (functions/portfolio.py). 폰이 보낸 최근 계좌 요약과 서버 최근 종가로 계산한다. 주문은 만들지 않는다"""
    from app.agents.query import latest_snapshot
    from app.functions.portfolio import analyze

    snapshot = latest_snapshot(conn, user_id)
    if snapshot is None:
        raise HTTPException(404, "계좌 요약이 아직 없어요. 앱에서 자산 화면을 한 번 열어 주세요")
    codes = [h["stock_code"] for h in snapshot["holdings"]]
    latest = conn.execute(
        "SELECT DISTINCT ON (stock_code) stock_code, close, trade_date FROM stock_prices WHERE stock_code = ANY(%s)"
        " ORDER BY stock_code, trade_date DESC", (codes,)).fetchall()
    closes = {r["stock_code"]: r["close"] for r in latest}
    risky = {r["code"]: r["title"] for r in conn.execute(
        "SELECT s.code, d.title FROM stocks s JOIN disclosures d ON d.rcept_no = s.risk_rcept_no"
        " WHERE s.code = ANY(%s) AND s.risk_grade = 1", (codes,))}
    policy = conn.execute("SELECT max_weight_pct FROM policies WHERE user_id = %s", (user_id,)).fetchone()
    profile = profile_summary(conn, user_id)
    result = analyze(snapshot, closes, policy["max_weight_pct"], profile.get("risk_level") or 1, risky, profile["mode"])
    # 공개 시세는 다음 영업일 오후에 나와서 하루 이상 늦을 수 있다. 화면에 어느 날 종가인지 보여준다
    return {**result, "fetched_at": snapshot["fetched_at"], "price_date": max((r["trade_date"] for r in latest), default=None)}
