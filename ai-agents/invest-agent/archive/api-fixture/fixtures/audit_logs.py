"""Local audit log fixture. Ported from `src/fixtures/auditLogs.ts`.

The "verified" column for DEC-1042/1043/1044 restates the same quantity/price/
amount the approvals queue shows for those orders — this fixture pulls those
numbers from `app/fixtures/decisions.py` instead of retyping them, so the two
screens cannot silently disagree on what was actually verified.
"""

from app.fixtures.decisions import DEC_1042, DEC_1043, DEC_1044
from app.schemas.audit_logs import AuditDecisionRow, AuditLogData, AuditSources, AuditStages, AuditStepEntry

AUDIT_LOGS_DATA_AS_OF = "2026-08-25T14:32:00+09:00"

AUDIT_LOGS_SOURCE_LABEL = "로컬 fixture"

AUDIT_LOGS_DISCLAIMER = "화면용 가상 실행 기록 · 실제 에이전트 실행·검증 API·주문 없음"


def _won(amount: int) -> str:
    return f"{amount:,}원"


def build_audit_log_data() -> AuditLogData:
    return AuditLogData(
        safetyCopy=AUDIT_LOGS_DISCLAIMER,
        labels=["가격 유형", "수량", "최대 금액", "목표 비중", "무효 조건"],
        decisions=[
            AuditDecisionRow(
                id=DEC_1042.id,
                company=DEC_1042.company,
                status="조건부 승인",
                runId="DEMO-RUN-1042",
                tone="warning",
                initial=["시장가 10주", "10주", "715,000원", "7.20%", "없음"],
                verified=[
                    f"지정가 {_won(DEC_1042.price)}",
                    f"{DEC_1042.quantity}주",
                    _won(DEC_1042.amount),
                    "7.20%",
                    "가격·비중·정정 공시",
                ],
                changed=[True, False, True, False, True],
            ),
            AuditDecisionRow(
                id=DEC_1043.id,
                company=DEC_1043.company,
                status="검증 완료 예시",
                runId="DEMO-RUN-1043",
                tone="success",
                initial=["지정가 221,000원", "8주", "1,768,000원", "7.10%", "가격"],
                verified=[
                    f"지정가 {_won(DEC_1043.price)}",
                    f"{DEC_1043.quantity}주",
                    _won(DEC_1043.amount),
                    "7.10%",
                    "가격·출처",
                ],
                changed=[True, False, True, False, True],
            ),
            AuditDecisionRow(
                id=DEC_1044.id,
                company=DEC_1044.company,
                status="정책 확인 필요",
                runId="DEMO-RUN-1044",
                tone="warning",
                initial=["지정가 35,000원", "20주", "700,000원", "17.10%", "가격"],
                verified=[
                    f"지정가 {_won(DEC_1044.price)}",
                    f"{DEC_1044.quantity}주",
                    _won(DEC_1044.amount),
                    "17.10%",
                    "정책 확인 전 금지",
                ],
                changed=[False, False, False, False, True],
            ),
        ],
        steps=AuditStages(
            analysis=AuditStepEntry(
                title="분석 완료 단계", type="유형 · AI 해석", input="화면용 가상 수치",
                result="최초 제안 생성 예시", risk="실제 에이전트 실행 아님",
            ),
            verification=AuditStepEntry(
                title="검증 완료 단계", type="유형 · 계산 / 정책 검사", input="최초 제안과 화면용 정책 규칙",
                result="지정가와 최대 금액 조건을 추가한 가상 결과입니다.", risk="실제 공시·시세 미연결",
            ),
            approval=AuditStepEntry(
                title="승인 대기 단계", type="유형 · 정책 검사", input="검증 후 가상 제안",
                result="실제 주문 없는 대기 상태", risk="투자 판단·주문 사용 금지",
            ),
        ),
        sources=AuditSources(
            metrics=AuditStepEntry(
                title="재무 수치 가상 항목", type="유형 · 계산", input="8개 형식 비교",
                result="형식 일치, 사실성 미확인", risk="원문 확인 아님",
            ),
            filing=AuditStepEntry(
                title="공시 원문", type="유형 · 사실", input="실제 원문 입력 없음",
                result="실제 공시 미연결·미확인", risk="원문 미확인",
            ),
            policy=AuditStepEntry(
                title="정책 규칙 예시", type="유형 · 정책 검사", input="가상 규칙 3개",
                result="예시 조건 비교", risk="실제 정책 아님",
            ),
        ),
    )
