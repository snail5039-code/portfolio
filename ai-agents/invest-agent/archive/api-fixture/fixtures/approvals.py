"""Seed data for the local pending-approvals demo.

These four orders are the same ones the frontend used to keep in
`src/fixtures/approvals.ts`. They start `decisionStatus="pending"` every time
the process starts; `app/store/approvals.py` is what remembers a decision for
the rest of that process's lifetime.
"""

from app.fixtures.decisions import DEC_1042, DEC_1042_EXPIRES_AT, DEC_1043, DEC_1044
from app.schemas.approvals import ApprovalOrder

APPROVALS_DATA_AS_OF = "2026-08-27T15:20:00+09:00"

APPROVALS_SOURCE_LABEL = "로컬 fixture"

APPROVALS_DISCLAIMER = (
    "화면 검토용 가상 승인 대기 목록이며 실제 주문, 체결, 증권사 API와 "
    "연결되지 않습니다. 모의승인과 반려는 로컬 데모 상태만 변경합니다."
)

# Shown instead of APPROVALS_DISCLAIMER once at least one order here actually
# went to KIS's 모의투자(paper trading) server — see app/routers/approvals.py.
APPROVALS_DISCLAIMER_WITH_LIVE_ORDERS = (
    "모의승인 시 한국투자증권 모의투자(가상계좌) 서버에 실제로 지정가 주문이 "
    "전송됩니다 · 그 계좌는 KIS가 관리하는 가상계좌이므로 실제 자금은 이동하지 "
    "않습니다 · 반려는 여전히 로컬 데모 상태만 변경합니다."
)


def build_approval_orders() -> list[ApprovalOrder]:
    return [
        ApprovalOrder(
            id=DEC_1042.id,
            company=DEC_1042.company,
            code=DEC_1042.code,
            side=DEC_1042.side,
            quantity=DEC_1042.quantity,
            price=DEC_1042.price,
            amount=DEC_1042.amount,
            reviewLabel="조건부 승인",
            category="conditional",
            decisionStatus="pending",
            verification="조건부",
            expiresAt=DEC_1042_EXPIRES_AT,
            policyLabel="통과 예시",
            policyPassed=True,
            sourceLabel="실제 공시 미연결 · 출처 미확인",
            warningTitle="변동성 주의",
            warningDetail="지정가 이하에서만 유효한 화면용 조건입니다.",
            tone="warning",
        ),
        ApprovalOrder(
            id=DEC_1043.id,
            company=DEC_1043.company,
            code=DEC_1043.code,
            side=DEC_1043.side,
            quantity=DEC_1043.quantity,
            price=DEC_1043.price,
            amount=DEC_1043.amount,
            reviewLabel="검토 완료",
            category="verified",
            decisionStatus="pending",
            verification="형식 확인",
            expiresAt="2026-08-27T15:51:00+09:00",
            policyLabel="통과 예시",
            policyPassed=True,
            sourceLabel="화면용 예시 · 실제 출처 미연결",
            warningTitle="가격 조건 확인",
            warningDetail="지정가 조건은 실제 시세와 비교되지 않았습니다.",
            tone="success",
        ),
        ApprovalOrder(
            id=DEC_1044.id,
            company=DEC_1044.company,
            code=DEC_1044.code,
            side=DEC_1044.side,
            quantity=DEC_1044.quantity,
            price=DEC_1044.price,
            amount=DEC_1044.amount,
            reviewLabel="정책 확인 필요",
            category="attention",
            decisionStatus="pending",
            verification="한도 확인",
            expiresAt="2026-08-27T16:03:00+09:00",
            policyLabel="확인 필요",
            policyPassed=False,
            sourceLabel="화면용 예시 · 실제 출처 미연결",
            warningTitle="정책 확인 필요",
            warningDetail="사용자 정책 한도를 실제 시스템에서 확인하지 않았습니다.",
            tone="warning",
        ),
        ApprovalOrder(
            id="DEC-1045",
            company="TIGER 미국S&P500",
            code="360750",
            side="매수",
            quantity=15,
            price=21_000,
            amount=315_000,
            reviewLabel="출처 미확인",
            category="attention",
            decisionStatus="pending",
            verification="출처 미확인",
            expiresAt="2026-08-27T16:10:00+09:00",
            policyLabel="확인 필요",
            policyPassed=False,
            sourceLabel="출처 미확인 · 확인으로 표시하지 않음",
            warningTitle="출처 주의",
            warningDetail="외부 출처가 연결되지 않아 확인 완료로 취급할 수 없습니다.",
            tone="danger",
        ),
    ]
