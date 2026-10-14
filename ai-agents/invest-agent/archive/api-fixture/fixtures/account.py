"""Local simulation account fixture.

The numbers are derived from the dashboard fixture so the two screens cannot
disagree:

- totalAsset, principal, cash amount and the accumulated profit are the same values
- unrealizedProfit is the sum of the dashboard holdings' profit
- realizedProfit is the remainder of the accumulated profit
- depositTotal - withdrawalTotal equals principal

This is a simulation account. There is no brokerage, no balance inquiry, no
transfer, and no deposit or withdrawal that moves real money.
"""

from app.schemas.account import (
    AccountData,
    AccountSummary,
    AssetClassRow,
    CashFlowRow,
    CurrencyRow,
    ReturnRow,
)

ACCOUNT_DATA_AS_OF = "2026-08-27T15:20:00+09:00"

ACCOUNT_SOURCE_LABEL = "로컬 fixture"

ACCOUNT_DISCLAIMER = (
    "화면 검토용 가상 시뮬레이션 계좌이며 실제 계좌, 잔고, 입출금, 이체, "
    "증권사 API와 연결되지 않습니다."
)


def build_account_data() -> AccountData:
    return AccountData(
        title="계좌",
        accountLabel="시뮬레이션 계좌",
        accountKind="모의투자 · 실제 계좌 아님",
        currency="KRW",
        summary=AccountSummary(
            totalAsset=128_450_000,
            investedAmount=104_810_000,
            cashAmount=23_640_000,
            principal=112_000_000,
            realizedProfit=10_766_200,
            unrealizedProfit=5_683_800,
            depositTotal=120_000_000,
            withdrawalTotal=8_000_000,
            lastVerifiedAt="2026-08-27T14:31:00+09:00",
        ),
        assetClasses=[
            AssetClassRow(
                label="국내주식",
                value=36_000_000,
                weight=28.03,
                tone="neutral",
                note="삼성전자·SK하이닉스·NAVER 화면용 예시 보유",
            ),
            AssetClassRow(
                label="국내 ETF",
                value=21_350_000,
                weight=16.62,
                tone="neutral",
                note="KODEX 200 화면용 예시 보유",
            ),
            AssetClassRow(
                label="해외지수 ETF",
                value=47_460_000,
                weight=36.95,
                tone="warning",
                note="단일 상품 비중이 정책 검토 구간에 가까운 예시",
            ),
            AssetClassRow(
                label="현금성 자산",
                value=23_640_000,
                weight=18.40,
                tone="info",
                note="승인 대기 제안에 사용되지 않은 예시 잔액",
            ),
        ],
        currencies=[
            CurrencyRow(
                code="KRW",
                label="원화 자산",
                value=80_990_000,
                weight=63.05,
                note="원화로 거래·표시되는 예시 자산",
            ),
            CurrencyRow(
                code="USD",
                label="달러 기초자산 노출",
                value=47_460_000,
                weight=36.95,
                note="원화 표시 ETF의 기초자산 기준 추정 노출. 실제 환율 미연결",
            ),
        ],
        returns=[
            ReturnRow(
                period="오늘",
                profit=1_042_000,
                profitRate=0.82,
                netInvestmentRate=0.82,
                benchmarkRate=0.41,
            ),
            ReturnRow(
                period="이번 달",
                profit=3_210_000,
                profitRate=2.56,
                netInvestmentRate=2.56,
                benchmarkRate=1.42,
            ),
            ReturnRow(
                period="올해",
                profit=11_280_000,
                profitRate=10.73,
                # 3월 12일 입금 12,000,000원을 기간 가중해 제외한 값이다.
                # 평균 투자자본 114,836,000원 기준.
                netInvestmentRate=9.82,
                benchmarkRate=6.18,
            ),
            ReturnRow(
                period="전체",
                profit=16_450_000,
                profitRate=14.69,
                netInvestmentRate=14.69,
                benchmarkRate=8.94,
            ),
        ],
        cashFlows=[
            CashFlowRow(
                id="CF-004",
                occurredAt="2026-03-12T10:05:00+09:00",
                kind="입금",
                amount=12_000_000,
                memo="정기 납입 예시 · 실제 이체 아님",
            ),
            CashFlowRow(
                id="CF-003",
                occurredAt="2025-11-04T14:22:00+09:00",
                kind="출금",
                amount=8_000_000,
                memo="생활자금 인출 예시 · 실제 이체 아님",
            ),
            CashFlowRow(
                id="CF-002",
                occurredAt="2025-06-20T09:41:00+09:00",
                kind="입금",
                amount=38_000_000,
                memo="추가 납입 예시 · 실제 이체 아님",
            ),
            CashFlowRow(
                id="CF-001",
                occurredAt="2024-09-02T11:00:00+09:00",
                kind="입금",
                amount=70_000_000,
                memo="최초 납입 예시 · 실제 이체 아님",
            ),
        ],
        safetyCopy=(
            "모의투자 · 화면 검토용 가상 계좌입니다. 실제 증권사 계좌, 잔고 조회, "
            "입출금, 이체, 환전은 연결되지 않으며 이 화면에서 어떤 금융 행동도 "
            "발생하지 않습니다."
        ),
    )
