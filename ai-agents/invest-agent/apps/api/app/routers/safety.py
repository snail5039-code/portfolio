"""실전 전환 안전장치 (docs/plan/12-todo-by-stage.md 4-1, 4-2).

- 긴급 중단: 기다리는 예약을 모두 취소하고, 승인 대기 처리안을 거절한다. 앱은 같은 버튼에서 자동매매도 끈다.
  이미 증권사에 들어간 주문은 여기서 취소하지 않는다 (증권사 키가 폰에만 있어서, 앱이 미체결 주문 취소를 안내한다)
- 실전 준비 확인: 실전 모드를 켜기 전 조건. 서버는 기록만 보고 판단하고, 켜는 것은 사용자가 폰에서 직접 한다
"""

from fastapi import APIRouter

from app.db import Conn, audit
from app.notify import notify
from app.routers.auth import UserId
from app.routers.policy import profile_summary

router = APIRouter(prefix="/api", tags=["safety"])

# 실전 모드를 켜기 전 조건 (4-1). 모의투자로 충분히 써 보고, 성향 퀴즈를 했어야 한다
REAL_MIN_FILLS = 10      # 모의투자 체결 건수
REAL_MIN_DAYS = 5        # 모의투자로 주문한 날 수


@router.post("/emergency-stop")
def emergency_stop(conn: Conn, user_id: UserId) -> dict:
    reservations = conn.execute(
        "UPDATE reservations SET status = 'cancelled' WHERE user_id = %s AND status = 'active' RETURNING id", (user_id,)
    ).fetchall()
    approvals = conn.execute(
        "UPDATE approvals a SET status = 'rejected', decided_at = now() FROM proposals p"
        " WHERE p.id = a.proposal_id AND p.user_id = %s AND a.status = 'pending' RETURNING a.id",
        (user_id,),
    ).fetchall()
    result = {"cancelled_reservations": len(reservations), "rejected_approvals": len(approvals)}
    audit(conn, user_id, "emergency_stop", result)
    notify(conn, user_id, "emergency_stop", "긴급 중단했어요",
           f"예약 {len(reservations)}건 취소, 승인 대기 처리안 {len(approvals)}건 거절. 이미 낸 미체결 주문은 앱에서 취소해 주세요")
    conn.commit()
    return result


@router.get("/real-readiness")
def real_readiness(conn: Conn, user_id: UserId) -> dict:
    profile = profile_summary(conn, user_id)
    row = conn.execute(
        "SELECT count(*) FILTER (WHERE o.filled_qty > 0) AS fills, count(DISTINCT o.created_at::date) AS days"
        " FROM orders o JOIN approvals a ON a.id = o.approval_id JOIN proposals p ON p.id = a.proposal_id"
        " WHERE p.user_id = %s AND o.mode = 'mock' AND o.kind = 'new'",
        (user_id,),
    ).fetchone()
    checks = [
        {"label": "성향 퀴즈를 하고 맞춤 모드를 쓴다", "ok": profile["mode"] == "custom"},
        {"label": f"모의투자 체결 {REAL_MIN_FILLS}건 이상 (지금 {row['fills']}건)", "ok": row["fills"] >= REAL_MIN_FILLS},
        {"label": f"모의투자로 주문한 날 {REAL_MIN_DAYS}일 이상 (지금 {row['days']}일)", "ok": row["days"] >= REAL_MIN_DAYS},
    ]
    return {"ok": all(c["ok"] for c in checks), "checks": checks}
