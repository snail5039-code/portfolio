"""Local tax/fee impact fixture. Ported from `src/fixtures/taxFeeImpact.ts`.

`gross`/`fee`/`tax`/`slippage`/`fx` are a cost/P&L breakdown, not a quantity ×
price restatement of an order — they don't need to match any single order
value in `decisions.py`, so nothing here is pulled from that module.
"""

from app.schemas.tax_fee_impact import TaxFeeImpactData, TaxFeeOrder

TAX_FEE_IMPACT_DATA_AS_OF = "2026-08-27T09:10:00+09:00"

TAX_FEE_IMPACT_SOURCE_LABEL = "로컬 fixture"

TAX_FEE_IMPACT_DISCLAIMER = (
    "모의투자 · 화면 검토용 가상 예시 · 실제 주문·체결 아님 · 실제 계좌·API·DB 미연결 · "
    "실제 AI 실행 또는 외부 에이전트 실행 아님 · 외부 요청 0건"
)


def build_tax_fee_impact_data() -> TaxFeeImpactData:
    return TaxFeeImpactData(
        title="세금·수수료 영향 점검",
        safetyCopy=TAX_FEE_IMPACT_DISCLAIMER,
        orders=[
            TaxFeeOrder(
                id="DEC-1051", name="삼성전자", ticker="005930", side="매수", market="국내 주식", currency="KRW",
                gross=164000, fee=2400, tax=0, slippage=18000, fx=0, status="영향 작음",
                basis="77,600원 지정가 · 25주", period="승인 전 1회 주문 예시",
                assumption="위탁 수수료 0.12%, 세금 없음 가정, 슬리피지 0.18%",
                summary="비용 차감 후에도 화면용 순손익 예시가 양수로 남지만 실제 성과 판단은 아닙니다.",
                next="승인 대기에서 수량과 지정가 재확인", linkPage="approvals",
            ),
            TaxFeeOrder(
                id="DEC-1052", name="SK하이닉스", ticker="000660", side="매도", market="국내 주식", currency="KRW",
                gross=91000, fee=3100, tax=54000, slippage=26000, fx=0, status="재검토",
                basis="238,000원 지정가 · 12주", period="매도 제안 1건 예시",
                assumption="위탁 수수료 0.11%, 거래세 0.20% 화면 가정, 슬리피지 0.09%",
                summary="세금 가정과 슬리피지를 반영하면 순손익 여유가 크게 줄어드는 점검 상태입니다.",
                next="정책 설정과 매도 사유 재검토", linkPage="policy",
            ),
            TaxFeeOrder(
                id="DEC-1053", name="현대차", ticker="005380", side="매수", market="국내 주식", currency="KRW",
                gross=-28000, fee=1900, tax=0, slippage=21000, fx=0, status="보류 권장",
                basis="214,000원 지정가 · 10주", period="승인 전 단일 주문 예시",
                assumption="위탁 수수료 0.09%, 세금 없음 가정, 슬리피지 0.10%",
                summary="비용 전 손익 예시가 이미 음수라 비용 반영 뒤 보류 검토 대상으로 표시합니다.",
                next="리밸런싱 필요성과 대체안 확인", linkPage="rebalance",
            ),
            TaxFeeOrder(
                id="DEC-1054", name="Apple", ticker="AAPL", side="매수", market="해외 주식", currency="USD 가정",
                gross=246000, fee=7600, tax=0, slippage=33000, fx=12800, status="재검토",
                basis="$226.40 지정가 · 8주 · 환율 1,335원 가정", period="해외 주식 1건 화면 예시",
                assumption="해외 위탁 수수료 0.25%, 환전 비용 0.35%, 세금 없음 화면 가정",
                summary="해외 주문은 환율과 환전 비용 가정이 추가되어 실제 조회 없이 비용 영향을 따로 표시합니다.",
                next="데이터 연결과 환율 가정 문구 확인", linkPage="data",
            ),
        ],
    )
