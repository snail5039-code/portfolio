"""Local evidence packet fixture. Ported from `src/fixtures/evidencePackets.ts`.

The one packet here describes DEC-1042, the same decision the dashboard and
approvals queue track. Its quantity/price/amount/target weight come from
`app/fixtures/decisions.py` so this screen cannot state different numbers for
the same proposal, and its `decisionStatus` is passed in by the router from
the same approval store — not hardcoded — for the same reason.
"""

from app.fixtures.decisions import (
    DEC_1042,
    DEC_1042_EXPIRES_AT,
    DEC_1042_TARGET_WEIGHT_FROM,
    DEC_1042_TARGET_WEIGHT_TO,
)
from app.schemas.common import DecisionStatus
from app.schemas.evidence_packets import (
    EvidenceCalculation,
    EvidenceChecklistItem,
    EvidenceCost,
    EvidencePacket,
    EvidencePacketsData,
    EvidenceRisk,
    EvidenceRoleCheck,
)

EVIDENCE_PACKETS_DATA_AS_OF = "2026-08-27T14:31:00+09:00"

EVIDENCE_PACKETS_SOURCE_LABEL = "로컬 fixture"

EVIDENCE_PACKETS_DISCLAIMER = "모의투자 · 가상 예시 · 실제 주문은 생성되지 않았습니다."


def build_evidence_packets_data(
    decision_status: DecisionStatus = "pending",
    decided_at: str | None = None,
) -> EvidencePacketsData:
    return EvidencePacketsData(
        packets=[
            EvidencePacket(
                id=DEC_1042.id,
                company=DEC_1042.company,
                code=DEC_1042.code,
                status="조건부 승인 후보",
                statusTone="warning",
                proposal=f"{DEC_1042.company} {DEC_1042.quantity}주 지정가 {DEC_1042.side}",
                quantity=DEC_1042.quantity,
                price=DEC_1042.price,
                amount=DEC_1042.amount,
                targetWeightFrom=DEC_1042_TARGET_WEIGHT_FROM,
                targetWeightTo=DEC_1042_TARGET_WEIGHT_TO,
                expiresAt=DEC_1042_EXPIRES_AT,
                sourceState="실제 공시·시세·계좌 미연결",
                safetyCopy="모의투자 · 가상 예시 · 실제 주문은 생성되지 않았습니다.",
                summary=(
                    "승인 대기 DEC-1042와 연결된 화면용 근거 패킷입니다. 계산, 정책, "
                    "비용, 출처, 리스크, 역할 확인, 사용자 승인 경계를 한 화면에서 "
                    "검토합니다."
                ),
                calculation=EvidenceCalculation(
                    formula=f"{DEC_1042.quantity}주 x {DEC_1042.price:,}원",
                    result=f"{DEC_1042.amount:,}원",
                    rounding="원 단위 정수 표시, 환율 적용 없음",
                ),
                cost=EvidenceCost(
                    fee="수수료 0.015% 가정 예시",
                    tax="매수 단계 세금 없음으로 단순화",
                    slippage="지정가 이하 체결 조건을 화면용으로만 표시",
                ),
                risk=EvidenceRisk(
                    concentration=f"삼성전자 목표 비중 {DEC_1042_TARGET_WEIGHT_TO:.2f}% 예시",
                    volatility="최근 변동성 사용자 기준 근접 예시",
                    invalidCondition="실제 시세, 공시, 계좌 검증이 필요해지면 이 패킷은 무효",
                ),
                roles=[
                    EvidenceRoleCheck(role="분석 에이전트", check="후보 산출", tone="info"),
                    EvidenceRoleCheck(role="검증 에이전트", check="계산 형식 일치", tone="success"),
                    EvidenceRoleCheck(role="정책 감시", check="조건부 한도 예시", tone="warning"),
                    EvidenceRoleCheck(role="관리자", check="사용자 승인 전 대기", tone="info"),
                ],
                approvalBoundary=(
                    "이 화면은 승인 전 검토용입니다. 모의승인 또는 반려는 로컬 화면 상태만 "
                    "바꾸며 실제 금융 행동, 계좌 요청, 주문 생성, 체결은 발생하지 않습니다."
                ),
                items=[
                    EvidenceChecklistItem(
                        title="계산 재현성", status="확인", tone="success",
                        summary="수량과 지정가 곱셈으로 최대 금액 재현",
                        detail=(
                            f"{DEC_1042.quantity}주 x {DEC_1042.price:,}원 = {DEC_1042.amount:,}원으로 "
                            "승인 대기 화면의 DEC-1042 최대 금액과 일치합니다."
                        ),
                    ),
                    EvidenceChecklistItem(
                        title="정책 한도", status="주의", tone="warning",
                        summary="목표 비중은 한도 안의 예시이나 조건부 유지",
                        detail="정책 값은 실제 정책 엔진이 아닌 로컬 fixture입니다. 한도 통과를 실제 판단으로 확정하지 않습니다.",
                    ),
                    EvidenceChecklistItem(
                        title="비용/수수료", status="주의", tone="warning",
                        summary="수수료와 슬리피지는 화면용 가정",
                        detail="수수료, 세금, 슬리피지는 실제 증권사 조건과 연결되지 않았고 정산 금액으로 쓰지 않습니다.",
                    ),
                    EvidenceChecklistItem(
                        title="출처 상태", status="주의", tone="warning",
                        summary="외부 연결 0건, 출처 미확인",
                        detail="공시, 시세, 환율, 계좌, 주문 API를 호출하지 않는 로컬 예시 데이터입니다.",
                    ),
                    EvidenceChecklistItem(
                        title="리스크", status="주의", tone="warning",
                        summary="단일 종목 비중과 변동성 경계 표시",
                        detail="집중도와 변동성 알림은 실제 리스크 엔진 결과가 아니라 화면 검토용 문구입니다.",
                    ),
                    EvidenceChecklistItem(
                        title="역할 확인", status="확인", tone="success",
                        summary="분석, 검증, 정책, 관리자 경계 표시",
                        detail="역할별 상태를 보여주지만 에이전트 자동 실행이나 외부 AI 실행은 연결하지 않았습니다.",
                    ),
                    EvidenceChecklistItem(
                        title="사용자 승인 경계", status="확인", tone="success",
                        summary="승인 전 금융 행동 없음",
                        detail="승인 대기 화면으로 이동해도 실제 주문은 생성되지 않고 로컬 화면 상태만 변경됩니다.",
                    ),
                ],
                decisionStatus=decision_status,
                decidedAt=decided_at,
            ),
        ],
    )
