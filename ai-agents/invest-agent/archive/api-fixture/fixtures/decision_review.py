"""Local decision review fixture. Ported from `src/fixtures/decisionReview.ts`.

Neither row here reuses a live, currently-pending id from `approvals.py`:

- The Samsung row uses DEC-1058, not DEC-1042. The original fixture narrated
  it as already "승인"(approved) on 2026-08-25, two days before dashboard/
  approvals present DEC-1042 as a fresh pending proposal dated 2026-08-27 —
  same id, contradictory timeline. This is a retrospective log entry about a
  *different* past Samsung decision, not the live one, so it gets its own id.
- The NAVER row uses DEC-1057, not DEC-1043 — same reasoning as `agents.py`:
  the real DEC-1043 in `approvals.py` is a pending, verified NAVER sell order,
  so this screen's "반려"(rejected) NAVER row cannot also claim that id.
- The KODEX 200 row uses DEC-1059, not DEC-1044, for the same reason: the real
  DEC-1044 in `approvals.py` is a pending buy order, not a past "보류"(held)
  decision from 2026-08-25.

`test_no_row_contradicts_a_currently_pending_approval` in
`tests/test_decision_review.py` guards this: any row here that reuses a
still-pending id from the live approvals queue fails the build.
"""

from app.schemas.decision_review import DecisionReviewData, DecisionReviewItem

DECISION_REVIEW_DATA_AS_OF = "2026-08-27T10:20:00+09:00"

DECISION_REVIEW_SOURCE_LABEL = "로컬 fixture"

DECISION_REVIEW_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문·체결 아님 · 실제 계좌·API·DB 미연결 · "
    "실제 AI 실행 또는 외부 에이전트 실행 아님 · 외부 요청 0건"
)


def build_decision_review_data() -> DecisionReviewData:
    return DecisionReviewData(
        title="사용자 승인 이력·결정 회고",
        safetyCopy=DECISION_REVIEW_DISCLAIMER,
        decisions=[
            DecisionReviewItem(
                id="DEC-1058", name="삼성전자", ticker="005930", decision="승인", memo=True,
                reviewedAt="2026-08-25T14:42:00+09:00", statusText="조건부 승인",
                reason="검증 후 지정가와 최대 금액 조건을 붙여 사용자가 모의승인",
                memoText="지정가 조건과 출처 미확인 표시가 함께 남아 있어 소액으로만 검토한다는 메모 예시",
                policy="한도 통과", verification="형식·정책 비교 완료", source="공시 원문 미연결",
                pathDiff="+1.2%", chosen="조건부 승인 경로 유지", alternate="반려 후 현금 유지 경로",
                pathCopy="동일 가정에서 두 경로를 나란히 둔 화면용 비교입니다. 실제 수익, 후회, 성공 여부를 뜻하지 않습니다.",
                focus="조건부 기록", linkPage="approvals",
                summary="승인 당시 근거와 남긴 메모를 함께 보되 실제 투자 판단 평가는 하지 않습니다.",
            ),
            DecisionReviewItem(
                id="DEC-1057", name="NAVER", ticker="035420", decision="반려", memo=True,
                reviewedAt="2026-08-25T14:51:00+09:00", statusText="사용자 반려",
                reason="검증 결과는 형식상 정리됐지만 출처 신뢰도와 변동성 설명이 부족해 반려",
                memoText="근거 출처가 더 명확해질 때 다시 비교한다는 사용자 메모 예시",
                policy="한도 통과", verification="출처 보강 필요", source="가격·뉴스 실제 연결 없음",
                pathDiff="-0.4%", chosen="반려 후 대기 경로", alternate="승인 후 보유 경로",
                pathCopy="차이는 가상 가격 경로를 비교한 값이며 투자 판단이 맞았는지 채점하지 않습니다.",
                focus="근거 보강", linkPage="audit",
                summary="반려 이유를 판단 실패나 성공으로 해석하지 않고 당시 확인 부족 항목으로 정리합니다.",
            ),
            DecisionReviewItem(
                id="DEC-1059", name="KODEX 200", ticker="069500", decision="보류", memo=False,
                reviewedAt="2026-08-25T15:05:00+09:00", statusText="보류",
                reason="정책에는 큰 충돌이 없지만 리밸런싱 목표와 현금 비중을 더 비교해야 해 보류",
                memoText="사용자 메모 없음. 화면은 메모가 없는 결정도 회고 대상에 남깁니다.",
                policy="추가 확인", verification="정책 비교 예시", source="실제 ETF 데이터 미연결",
                pathDiff="+0.0%", chosen="보류 후 관찰 경로", alternate="즉시 승인 경로",
                pathCopy="보류 경로와 즉시 승인 경로의 차이를 단정하지 않고, 비교 조건만 남긴 화면 예시입니다.",
                focus="대기 사유", linkPage="rebalance",
                summary="보류 결정은 실행 실패가 아니라 추가 확인을 남긴 사용자 통제 기록으로 표시합니다.",
            ),
            DecisionReviewItem(
                id="DEC-1052", name="SK하이닉스", ticker="000660", decision="반려", memo=True,
                reviewedAt="2026-08-27T09:28:00+09:00", statusText="비용 재검토 후 반려",
                reason="세금·수수료 영향 점검에서 비용 가정이 순손익 여유를 크게 줄여 반려",
                memoText="비용 가정이 줄어들기 전에는 매도 제안을 다시 올리지 말자는 사용자 메모 예시",
                policy="비용 재검토", verification="비용 화면 연계", source="실제 세금·수수료 계산 아님",
                pathDiff="-1.8%", chosen="반려 후 보유 경로", alternate="매도 승인 경로",
                pathCopy="비용 화면과 연결된 가상 경로 비교입니다. 실제 매도 권유나 보유 권유가 아닙니다.",
                focus="비용 영향", linkPage="taxFee",
                summary="비용 점검과 사용자 메모를 묶어 승인 전 판단 기록을 확인합니다.",
            ),
        ],
    )
