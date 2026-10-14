"""Local trade history fixture. Ported from `src/fixtures/tradeHistory.ts`.

Known content note (not fixed here): the last item reuses id "DEC-1042" for a
historical policy-blocked attempt 47 days before the current pending DEC-1042
proposal shown by the dashboard/approvals screens, with the same quantity and
price. Whether that is the same decision resubmitted or an authoring mistake
is ambiguous rather than a flat contradiction (unlike the DEC-1043 case fixed
in BACKEND-006), so it was left as-is and flagged in
docs/backend/10-decision-consolidation.md rather than silently renamed.
"""

from app.schemas.trade_history import TradeHistoryData, TradeHistoryItem, TradeRelatedLink

TRADE_HISTORY_DATA_AS_OF = "2026-08-26T14:20:00+09:00"

TRADE_HISTORY_SOURCE_LABEL = "로컬 fixture"

TRADE_HISTORY_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문 아님 · 실제 계좌·API·DB 미연결 · "
    "외부 요청 0건"
)


def build_trade_history_data() -> TradeHistoryData:
    return TradeHistoryData(
        items=[
            TradeHistoryItem(
                id="DEC-1051", days=0, occurredAt="08.26 14:20", name="삼성전자", ticker="005930",
                side="매수", qty="10주", price="지정가 71,200원", amount="712,000원", status="대기",
                summary="사용자 결정을 기다리는 화면용 제안입니다.", fee="약 107원", tax="해당 없음",
                slippage="미반영", policyResult="검토 대기", sourceState="가격·공시 가상 예시",
            ),
            TradeHistoryItem(
                id="DEC-1050", days=1, occurredAt="08.25 15:04", name="현대차", ticker="005380",
                side="매도", qty="2주", price="예상가 241,500원", amount="483,000원", status="모의승인",
                summary="화면 상태에서만 모의승인된 가상 이력입니다.", fee="약 72원", tax="약 868원",
                slippage="0.10% 가정", policyResult="가상 한도 충족", sourceState="가격·공시 가상 예시",
            ),
            TradeHistoryItem(
                id="DEC-1049", days=3, occurredAt="08.23 10:18", name="NAVER", ticker="035420",
                side="매수", qty="3주", price="지정가 184,000원", amount="552,000원", status="반려",
                summary="사용자가 화면에서 반려한 가상 제안입니다.", fee="약 83원", tax="해당 없음",
                slippage="미반영", policyResult="가상 한도 충족", sourceState="가격·공시 가상 예시",
            ),
            TradeHistoryItem(
                id="DEC-1048", days=6, occurredAt="08.20 09:42", name="삼성SDI", ticker="006400",
                side="매수", qty="4주", price="지정가 246,000원", amount="984,000원", status="정책 차단",
                summary="종목 비중 한도를 넘는다는 가상 정책 판정입니다.", fee="약 148원", tax="해당 없음",
                slippage="0.15% 가정", policyResult="종목 비중 한도 초과", sourceState="가상 출처 표시 완료",
            ),
            TradeHistoryItem(
                id="DEC-1047", days=9, occurredAt="08.17 13:11", name="카카오", ticker="035720",
                side="매수", qty="8주", price="예상가 40,100원", amount="320,800원", status="만료",
                summary="가상 승인 제한 시간이 지나 만료된 제안입니다.", fee="약 48원", tax="해당 없음",
                slippage="0.20% 가정", policyResult="승인 시간 만료", sourceState="가격·공시 가상 예시",
            ),
            TradeHistoryItem(
                id="DEC-1046", days=18, occurredAt="08.08 11:27", name="SK하이닉스", ticker="000660",
                side="매도", qty="2주", price="지정가 193,500원", amount="387,000원", status="모의승인",
                summary="실제 체결 없이 화면에서만 처리된 가상 이력입니다.", fee="약 58원", tax="약 696원",
                slippage="미반영", policyResult="가상 한도 충족", sourceState="가격·공시 가상 예시",
            ),
            TradeHistoryItem(
                id="DEC-1042", days=47, occurredAt="07.10 14:32", name="삼성전자", ticker="005930",
                side="매수", qty="10주", price="지정가 71,200원", amount="712,000원", status="정책 차단",
                summary="출처 미확인으로 차단된 정책 적용 예시입니다.", fee="약 107원", tax="해당 없음",
                slippage="미반영", policyResult="출처 규칙으로 차단", sourceState="출처 미확인",
            ),
        ],
        relatedLinks=[
            TradeRelatedLink(label="감사 로그 보기", page="audit"),
            TradeRelatedLink(label="투자 정책 보기", page="policy"),
            TradeRelatedLink(label="주간 리포트 보기", page=None, disabled=True),
        ],
        safetyCopy=TRADE_HISTORY_DISCLAIMER,
    )
