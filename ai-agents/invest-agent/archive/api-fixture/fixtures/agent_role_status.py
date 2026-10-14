"""Local agent role status fixture. Ported from `src/fixtures/agentRoleStatus.ts`.

Decision ids here (DEC-1042/1052/1056/1057) are cross-reference labels only —
this screen does not restate any of those decisions' quantity/price, so there
is nothing to pull from `app/fixtures/decisions.py`.

DEC-1057 (not DEC-1043) is used for the NAVER "관찰 유지, 반려" narrative,
matching the BACKEND-006 fix in `agents.py`: the real DEC-1043 in
`approvals.py` is a pending, verified NAVER sell order, so this screen cannot
also call DEC-1043 rejected without contradicting the approvals queue.
"""

from app.schemas.agent_role_status import AgentRoleStatusData, AgentRoleStatusItem

AGENT_ROLE_STATUS_DATA_AS_OF = "2026-08-27T11:40:00+09:00"

AGENT_ROLE_STATUS_SOURCE_LABEL = "로컬 fixture"

AGENT_ROLE_STATUS_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문·체결 아님 · 실제 계좌·API·DB 미연결 · "
    "실제 AI 실행 또는 외부 에이전트 실행 아님 · 외부 요청 0건"
)


def build_agent_role_status_data() -> AgentRoleStatusData:
    return AgentRoleStatusData(
        title="에이전트별 역할 상태판",
        safetyCopy=AGENT_ROLE_STATUS_DISCLAIMER,
        roles=[
            AgentRoleStatusItem(
                id="proposer", role="제안자", status="대기", badge="대기",
                task="DEC-1056 삼성전자 비중 +2% 후보 작성",
                wait="검증자 출처 신뢰도 점검 대기", approval=False,
                history="DEC-1057 반려 후 근거 보강", decision="DEC-1056",
                summary="제안자는 화면용 후보를 작성한 뒤 검증 역할의 확인을 기다리는 상태로 표시됩니다.",
                conflict="출처 보강 전 승인 관리자에게 넘기지 않음",
                linkPage="decisionReview", linkLabel="결정 회고 보기",
            ),
            AgentRoleStatusItem(
                id="verifier", role="검증자", status="실패 이력", badge="실패 이력",
                task="DEC-1056 출처 신뢰도 점검",
                wait="공시 원문 미연결 표시 유지", approval=False,
                history="DEC-1057 출처 신뢰도 보강 요청", decision="DEC-1057",
                summary="검증자는 실제 공시나 시세를 조회하지 않고, 출처 신뢰도 점검 항목을 화면용으로 정리합니다.",
                conflict="출처 부족 이력을 제안자에게 되돌리는 예시",
                linkPage="audit", linkLabel="감사 로그 보기",
            ),
            AgentRoleStatusItem(
                id="policy", role="정책 감시자", status="승인 필요", badge="승인 필요",
                task="금액 한도·종목 집중도 비교",
                wait="종목 집중도 조건을 사용자 확인 항목으로 남김", approval=True,
                history="DEC-1052 비용 영향 재검토", decision="DEC-1052",
                summary="정책 감시자는 한도와 집중도 조건을 비교하되, 실제 주문 차단이나 외부 정책 실행을 하지 않습니다.",
                conflict="비용·집중도 조건이 승인 전 재검토 항목으로 남음",
                linkPage="taxFee", linkLabel="세금·수수료 보기",
            ),
            AgentRoleStatusItem(
                id="approver", role="승인 관리자", status="승인 필요", badge="승인 필요",
                task="DEC-1056 승인 항목 정리",
                wait="사용자 최종 확인 전 대기", approval=True,
                history="DEC-1042 조건부 승인 기록", decision="DEC-1042",
                summary="승인 관리자는 사용자가 볼 확인 항목을 정리하는 화면용 역할이며 금융 행동을 수행하지 않습니다.",
                conflict="조건부 승인 기록과 새 승인 필요 항목을 분리",
                linkPage="approvals", linkLabel="승인 대기 보기",
            ),
        ],
    )
