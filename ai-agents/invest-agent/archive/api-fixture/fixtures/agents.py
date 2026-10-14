"""Local fixtures for the 분석 / 검증 / 실행 agent screens.

The three screens are stage views of one pipeline described in
`FINANCIAL_AI_AGENT_IDEA.md`. The pipeline state is the same on all three; only
the viewing stage differs.

No agent runs here. There is no model call, no data collection, no order
conversion, and no execution. Every capability is `connected: False`, every work
item ends at a user decision, and the envelope keeps `executed: False`.
"""

from app.schemas.agents import (
    AgentCapability,
    AgentMetric,
    AgentScreenData,
    AgentStageStep,
    AgentWorkField,
    AgentWorkItem,
)

AGENTS_DATA_AS_OF = "2026-08-27T15:20:00+09:00"

AGENTS_SOURCE_LABEL = "로컬 fixture"

AGENTS_DISCLAIMER = (
    "화면 검토용 가상 에이전트 상태이며 실제 AI 실행, 자료 수집, 주문 변환, "
    "외부 API와 연결되지 않습니다."
)

# One pipeline state, shared by all three stage screens.
PIPELINE = [
    AgentStageStep(
        stage="analysis",
        label="분석 에이전트",
        state="done",
        detail="투자안 3건 작성 · 출처 미확인 표시 유지",
    ),
    AgentStageStep(
        stage="verification",
        label="검증 에이전트",
        state="current",
        detail="독립 감사 진행 · 조건부 승인 1건, 반려 1건",
    ),
    AgentStageStep(
        stage="execution",
        label="실행 에이전트",
        state="blocked",
        detail="사용자 승인 전 실행 금지 · 실행 0건",
    ),
]


def _field(label: str, value: str) -> AgentWorkField:
    return AgentWorkField(label=label, value=value)


def build_analysis_agent_data() -> AgentScreenData:
    return AgentScreenData(
        stage="analysis",
        title="분석 에이전트",
        agentName="분석 에이전트",
        roleSummary=(
            "사용자가 설정한 투자 목표와 위험 한도 안에서 자료를 모아 구조화된 "
            "투자안을 만듭니다. 스스로 주문을 만들지 않고 검증 단계로 넘깁니다."
        ),
        status="투자안 3건 작성 · 전 건 검증 대기",
        statusTone="info",
        pipeline=PIPELINE,
        metrics=[
            AgentMetric(label="작성한 투자안", value="3건", tone="neutral"),
            AgentMetric(label="출처 확인", value="0건 확인", tone="warning"),
            AgentMetric(label="자동 생성 주문", value="없음", tone="success"),
            AgentMetric(label="외부 요청", value="0건", tone="success"),
        ],
        capabilities=[
            AgentCapability(
                label="공시·재무제표 수집",
                detail="DART 원문 수집 경로가 없어 화면용 예시 수치만 사용합니다.",
            ),
            AgentCapability(
                label="재무 지표 계산",
                detail="매출·영업이익·현금흐름·부채 계산은 fixture 값 표시로 대체합니다.",
            ),
            AgentCapability(
                label="뉴스·산업 환경 분석",
                detail="뉴스 API가 없어 시나리오 문구만 표시합니다.",
            ),
            AgentCapability(
                label="투자 후보 탐색",
                detail="탐색 범위는 fixture에 고정된 3개 후보로 한정합니다.",
            ),
        ],
        items=[
            AgentWorkItem(
                id="AN-1042",
                title="삼성전자 10주 지정가 매수 제안",
                subtitle="005930 · 반도체",
                decisionId="DEC-1042",
                action="매수",
                status="검증 대기",
                statusTone="warning",
                userApprovalRequired=True,
                fields=[
                    _field("행동", "매수"),
                    _field("대상 및 목표 비중", "삼성전자 6.65% → 7.20%"),
                    _field("판단 시점", "2026-08-27 14:28 KST"),
                    _field("데이터 기준일", "2026-08-27 15:20 KST · 화면용 예시"),
                    _field("핵심 근거", "영업현금흐름 개선, 부채비율 산업 평균 하회, 메모리 가격 회복 구간 진입"),
                    _field("사용한 원문 출처", "실제 공시 미연결 · 출처 미확인"),
                    _field("계산 과정", "10주 × 71,200원 = 712,000원 · 현금 23,640,000원 내 집행 가능"),
                    _field("반대 근거와 주요 위험", "최근 20일 변동성이 사용자 기준에 근접, 단일 종목 집중도 상승"),
                    _field("판단 무효 조건", "지정가 71,200원 초과 · 목표 비중 8% 초과 · 정정 공시 확인 시"),
                ],
                notes=[
                    "출처를 확인하지 못했으므로 이 투자안 단독으로는 승인 조건을 만족하지 않습니다.",
                    "검증 에이전트의 재계산과 사용자 승인 없이는 어떤 주문도 만들어지지 않습니다.",
                ],
                summary="가장 진행이 앞선 투자안이지만 출처가 미확인이라 조건부로만 넘어갑니다.",
                linkPage="evidence",
                linkLabel="근거 패킷 보기",
            ),
            AgentWorkItem(
                id="AN-1057",
                title="NAVER 관찰 유지 제안",
                subtitle="035420 · 인터넷 서비스",
                decisionId="DEC-1057",
                action="관찰",
                status="출처 보강 필요",
                statusTone="warning",
                userApprovalRequired=False,
                fields=[
                    _field("행동", "관찰"),
                    _field("대상 및 목표 비중", "NAVER 7.47% 유지"),
                    _field("판단 시점", "2026-08-27 13:52 KST"),
                    _field("데이터 기준일", "2026-08-27 15:20 KST · 화면용 예시"),
                    _field("핵심 근거", "평가손익 -374,400원 구간이나 매도 조건에는 미달"),
                    _field("사용한 원문 출처", "실제 공시 미연결 · 출처 미확인"),
                    _field("계산 과정", "48주 × 200,000원 = 9,600,000원 · 손실률 -3.75%"),
                    _field("반대 근거와 주요 위험", "손실 구간 장기화 가능성, 대체 후보 대비 기회비용"),
                    _field("판단 무효 조건", "손실률 -8% 도달 · 실적 정정 공시 확인 시"),
                ],
                notes=[
                    "행동을 바꾸지 않는 제안이라 주문 후보를 만들지 않습니다.",
                    "출처 보강 전에는 검증 결과가 반려로 돌아올 수 있습니다.",
                ],
                summary="현 상태 유지를 제안하며 사용자 승인 없이도 아무 변화가 없습니다.",
                linkPage="company",
                linkLabel="기업 상세 보기",
            ),
            AgentWorkItem(
                id="AN-1052",
                title="SK하이닉스 비중 축소 제안",
                subtitle="000660 · 반도체",
                decisionId="DEC-1052",
                action="매도",
                status="비용 재검토",
                statusTone="warning",
                userApprovalRequired=True,
                fields=[
                    _field("행동", "매도"),
                    _field("대상 및 목표 비중", "SK하이닉스 13.90% → 11.50%"),
                    _field("판단 시점", "2026-08-27 13:20 KST"),
                    _field("데이터 기준일", "2026-08-27 15:20 KST · 화면용 예시"),
                    _field("핵심 근거", "반도체 섹터 합산 비중이 정책 검토 구간에 근접"),
                    _field("사용한 원문 출처", "실제 공시 미연결 · 출처 미확인"),
                    _field("계산 과정", "평가금액 17,856,000원 중 약 3,084,000원 축소 상당"),
                    _field("반대 근거와 주요 위험", "매도 시 실현손익에 따른 세금·수수료 발생, 회복 구간 이탈 가능성"),
                    _field("판단 무효 조건", "섹터 비중이 정책 한도 아래로 내려갈 때 · 비용이 기대 효과를 초과할 때"),
                ],
                notes=[
                    "세금·수수료 점검 결과에 따라 제안 자체가 철회될 수 있습니다.",
                    "매도 제안도 사용자 승인 없이는 주문으로 전환되지 않습니다.",
                ],
                summary="집중도 완화 목적이지만 비용이 효과를 넘을 수 있어 재검토 중입니다.",
                linkPage="taxFee",
                linkLabel="세금·수수료 점검 보기",
            ),
        ],
        safetyCopy=(
            "모의투자 · 화면 검토용 가상 분석 상태입니다. 실제 AI 실행, 공시·시세·뉴스 "
            "수집, 외부 API 연결은 없으며 이 화면에서 주문이 만들어지지 않습니다."
        ),
    )


def build_verification_agent_data() -> AgentScreenData:
    return AgentScreenData(
        stage="verification",
        title="검증 에이전트",
        agentName="검증 에이전트",
        roleSummary=(
            "분석 에이전트와 독립된 문맥에서 투자안을 감사합니다. 같은 결론을 "
            "공유하지 않고 수치·출처·논리를 다시 확인해 판정을 냅니다."
        ),
        status="조건부 승인 1건 · 반려 1건 · 사용자 판단 필요 1건",
        statusTone="warning",
        pipeline=PIPELINE,
        metrics=[
            AgentMetric(label="감사한 투자안", value="3건", tone="neutral"),
            AgentMetric(label="그대로 승인", value="0건", tone="warning"),
            AgentMetric(label="출처 뒷받침 실패", value="3건", tone="danger"),
            AgentMetric(label="외부 요청", value="0건", tone="success"),
        ],
        capabilities=[
            AgentCapability(
                label="재무 수치 재검산",
                detail="원문이 없어 fixture에 적힌 값의 형식 일치만 확인합니다.",
            ),
            AgentCapability(
                label="기준 혼동 검사",
                detail="전년 대비와 전분기 대비 혼동 여부를 화면용 문구로만 표시합니다.",
            ),
            AgentCapability(
                label="출처 뒷받침 확인",
                detail="공시 원문 연결이 없어 전 건 미확인으로 처리합니다.",
            ),
            AgentCapability(
                label="최신 공시 누락 탐지",
                detail="정정 공시 조회 경로가 없어 누락 여부를 확정할 수 없습니다.",
            ),
            AgentCapability(
                label="사실·추론·예측 분리",
                detail="문장 단위 분리 결과를 예시로 표시합니다.",
            ),
            AgentCapability(
                label="위험 한도 부합 확인",
                detail="투자 정책 화면의 한도 값과 비교한 예시 결과입니다.",
            ),
        ],
        items=[
            AgentWorkItem(
                id="VF-1042",
                title="삼성전자 매수 제안 감사",
                subtitle="AN-1042 검증 · 005930",
                decisionId="DEC-1042",
                action="조건부 승인",
                status="조건부 승인",
                statusTone="warning",
                userApprovalRequired=True,
                fields=[
                    _field("검증 대상", "AN-1042 삼성전자 10주 지정가 매수"),
                    _field("검증 결과", "조건부 승인"),
                    _field("재검산 결과", "8/8 항목 형식 일치 · 원문 대조는 불가"),
                    _field("기준 혼동 검사", "전년 대비와 전분기 대비 혼용 없음"),
                    _field("출처 뒷받침", "미확인 · 공시 원문 연결 없음"),
                    _field("최신 공시 누락", "확인 불가 · 정정 공시 조회 경로 없음"),
                    _field("사실·추론·예측 분리", "사실 2문장, 추론 3문장, 예측 1문장으로 분리"),
                    _field("위험 한도 부합", "단일 종목 8% 한도 내 · 변동성 기준에는 근접"),
                    _field("반대 시나리오", "메모리 가격 회복이 지연되면 목표 비중 상향의 근거가 사라짐"),
                    _field("대안 행동", "출처 확인 후 재제출, 또는 절반 수량으로 축소 집행"),
                ],
                notes=[
                    "출처가 확인되지 않아 무조건 승인으로 올리지 않았습니다.",
                    "조건부 승인은 사용자 승인을 대신하지 않습니다.",
                ],
                summary="형식은 통과했지만 출처 미확인이라 조건을 달아 사용자에게 넘깁니다.",
                linkPage="approvals",
                linkLabel="승인 대기 보기",
            ),
            AgentWorkItem(
                id="VF-1057",
                title="NAVER 관찰 제안 감사",
                subtitle="AN-1057 검증 · 035420",
                decisionId="DEC-1057",
                action="반려",
                status="반려",
                statusTone="danger",
                userApprovalRequired=False,
                fields=[
                    _field("검증 대상", "AN-1057 NAVER 관찰 유지"),
                    _field("검증 결과", "반려"),
                    _field("재검산 결과", "손실률 -3.75%는 평가금액 기준과 일치"),
                    _field("기준 혼동 검사", "손실률 기준 시점이 제안서에 명시되지 않음"),
                    _field("출처 뒷받침", "미확인 · 근거 문장이 출처와 연결되지 않음"),
                    _field("최신 공시 누락", "확인 불가"),
                    _field("사실·추론·예측 분리", "추론과 예측이 한 문장에 섞여 있음"),
                    _field("위험 한도 부합", "행동 변경이 없어 한도 영향 없음"),
                    _field("반대 시나리오", "손실 구간이 길어지면 관찰 유지가 기회비용을 키움"),
                    _field("대안 행동", "기준 시점을 명시해 재제출, 또는 손절 조건을 함께 제출"),
                ],
                notes=[
                    "반려는 화면 상태 변경일 뿐이며 보유 종목에 아무 영향이 없습니다.",
                    "반려 사유는 결정 회고 화면에 기록 예시로 남습니다.",
                ],
                summary="근거 문장과 출처가 연결되지 않아 반려로 판정했습니다.",
                linkPage="decisionReview",
                linkLabel="결정 회고 보기",
            ),
            AgentWorkItem(
                id="VF-1052",
                title="SK하이닉스 비중 축소 제안 감사",
                subtitle="AN-1052 검증 · 000660",
                decisionId="DEC-1052",
                action="사용자 판단 필요",
                status="사용자 판단 필요",
                statusTone="warning",
                userApprovalRequired=True,
                fields=[
                    _field("검증 대상", "AN-1052 SK하이닉스 비중 축소"),
                    _field("검증 결과", "사용자 판단 필요"),
                    _field("재검산 결과", "축소 상당액 3,084,000원은 목표 비중 차이와 일치"),
                    _field("기준 혼동 검사", "섹터 비중 기준이 평가금액 기준으로 일관됨"),
                    _field("출처 뒷받침", "미확인"),
                    _field("최신 공시 누락", "확인 불가"),
                    _field("사실·추론·예측 분리", "사실 1문장, 추론 2문장, 예측 2문장"),
                    _field("위험 한도 부합", "집중도는 낮아지나 비용이 기대 효과를 넘을 수 있음"),
                    _field("반대 시나리오", "매도 후 회복 구간에 재진입하면 비용만 남음"),
                    _field("대안 행동", "신규 매수를 멈춰 자연 희석, 또는 축소 폭을 절반으로"),
                ],
                notes=[
                    "손익과 비용의 절충이라 에이전트가 대신 결정하지 않습니다.",
                    "사용자 판단 필요는 승인도 반려도 아닌 보류 상태입니다.",
                ],
                summary="수치는 맞지만 비용과 효과의 절충이라 사용자에게 판단을 넘깁니다.",
                linkPage="taxFee",
                linkLabel="세금·수수료 점검 보기",
            ),
        ],
        safetyCopy=(
            "모의투자 · 화면 검토용 가상 검증 결과입니다. 실제 공시 검증이나 외부 "
            "데이터 대조를 수행하지 않았으며 판정은 투자 권유가 아닙니다."
        ),
    )


def build_execution_agent_data() -> AgentScreenData:
    return AgentScreenData(
        stage="execution",
        title="실행 에이전트",
        agentName="실행 에이전트",
        roleSummary=(
            "투자안과 검증 결과가 모두 준비된 뒤에만 작동합니다. 스스로 판단을 "
            "바꾸지 않고 권한과 안전 조건만 다시 확인합니다. 현재 실행 등급은 "
            "강화 승인이며 사용자 승인 없이 실행하지 않습니다."
        ),
        status="실행 0건 · 전 건 사용자 승인 대기",
        statusTone="danger",
        executionGrade="강화 승인",
        pipeline=PIPELINE,
        metrics=[
            AgentMetric(label="실행한 주문", value="0건", tone="success"),
            AgentMetric(label="현재 실행 등급", value="강화 승인", tone="warning"),
            AgentMetric(label="실행 금지 처리", value="1건", tone="danger"),
            AgentMetric(label="외부 주문 요청", value="0건", tone="success"),
        ],
        capabilities=[
            AgentCapability(
                label="주문 명령 변환",
                detail="증권사 API가 없어 주문 형식으로 변환하지 않습니다.",
            ),
            AgentCapability(
                label="리밸런싱 집행",
                detail="전략 조정 화면의 제안은 집행되지 않고 비교 표시만 됩니다.",
            ),
            AgentCapability(
                label="계좌 간 이체",
                detail="계좌 연결이 없어 이체 경로가 존재하지 않습니다.",
            ),
            AgentCapability(
                label="환전 예약",
                detail="환율 조회가 없어 조건 예약을 만들지 않습니다.",
            ),
            AgentCapability(
                label="실행 전 잔액·한도 확인",
                detail="fixture 잔액과 정책 한도를 비교한 화면용 결과입니다.",
            ),
        ],
        items=[
            AgentWorkItem(
                id="EX-1042",
                title="삼성전자 10주 매수 · 실행 보류",
                subtitle="DEC-1042 · 조건부 승인 수신",
                decisionId="DEC-1042",
                action="실행 보류",
                status="사용자 승인 대기",
                statusTone="warning",
                userApprovalRequired=True,
                fields=[
                    _field("실행 등급", "강화 승인 · 사용자 승인 필수"),
                    _field("잔액 확인", "현금 23,640,000원 · 필요 712,000원 충족"),
                    _field("한도 확인", "단일 종목 8% 한도 내 · 통과 예시"),
                    _field("시장 상태", "확인 불가 · 시세 연결 없음"),
                    _field("중복 요청", "없음"),
                    _field("실행 결과", "실행 안 됨"),
                    _field("실패 사유", "해당 없음 · 애초에 실행을 시도하지 않음"),
                ],
                notes=[
                    "잔액과 한도를 통과해도 실행하지 않습니다. 승인 권한은 사용자에게 있습니다.",
                    "승인 대기 화면에서 모의승인해도 실제 주문은 생성되지 않습니다.",
                ],
                summary="안전 조건은 통과했지만 강화 승인 등급이라 사용자 승인 전 대기합니다.",
                linkPage="approvals",
                linkLabel="승인 대기 보기",
            ),
            AgentWorkItem(
                id="EX-1057",
                title="NAVER 관련 실행 · 실행 금지",
                subtitle="DEC-1057 · 반려 수신",
                decisionId="DEC-1057",
                action="실행 금지",
                status="실행 금지",
                statusTone="danger",
                userApprovalRequired=False,
                fields=[
                    _field("실행 등급", "실행 금지"),
                    _field("잔액 확인", "해당 없음"),
                    _field("한도 확인", "해당 없음"),
                    _field("시장 상태", "확인 불가 · 시세 연결 없음"),
                    _field("중복 요청", "없음"),
                    _field("실행 결과", "실행 안 됨"),
                    _field("실패 사유", "검증 반려 · 실행 단계로 넘어오지 않음"),
                ],
                notes=[
                    "검증에서 반려된 건은 실행 후보로 만들어지지 않습니다.",
                    "실행 금지 등급은 사용자가 승인해도 해제되지 않습니다.",
                ],
                summary="검증 반려로 실행 경로 자체가 닫힌 상태입니다.",
                linkPage="audit",
                linkLabel="감사 로그 보기",
            ),
            AgentWorkItem(
                id="EX-1052",
                title="SK하이닉스 비중 축소 · 실행 보류",
                subtitle="DEC-1052 · 사용자 판단 필요 수신",
                decisionId="DEC-1052",
                action="실행 보류",
                status="사용자 판단 대기",
                statusTone="warning",
                userApprovalRequired=True,
                fields=[
                    _field("실행 등급", "강화 승인 · 사용자 승인 필수"),
                    _field("잔액 확인", "매도 제안이라 현금 필요 없음"),
                    _field("한도 확인", "축소 후에도 정책 한도 내"),
                    _field("시장 상태", "확인 불가 · 시세 연결 없음"),
                    _field("중복 요청", "없음"),
                    _field("실행 결과", "실행 안 됨"),
                    _field("실패 사유", "해당 없음 · 사용자 판단 대기"),
                ],
                notes=[
                    "비용과 효과의 절충 판단이 끝나기 전에는 실행 후보로 올리지 않습니다.",
                    "세금·수수료 점검 결과가 바뀌면 제안이 철회될 수 있습니다.",
                ],
                summary="검증이 사용자 판단으로 넘긴 건이라 실행 단계에서도 대기합니다.",
                linkPage="compare",
                linkLabel="변경 비교 보기",
            ),
        ],
        safetyCopy=(
            "모의투자 · 이 화면에서는 어떤 주문, 매수, 매도, 체결, 이체, 환전도 "
            "발생하지 않습니다. 증권사 API와 계좌가 연결되어 있지 않으며 실행 건수는 "
            "항상 0건입니다."
        ),
    )
