from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope, Tone

# Numeric conventions match docs/backend/07-dashboard-api.md:
# money is an integer in `currency`, percent fields are in percent units.


class AccountSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    totalAsset: int
    investedAmount: int
    cashAmount: int
    principal: int
    realizedProfit: int
    unrealizedProfit: int
    depositTotal: int
    withdrawalTotal: int
    lastVerifiedAt: str


class AssetClassRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    value: int
    weight: float
    tone: Tone
    note: str


class CurrencyRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    label: str
    value: int
    weight: float
    note: str


class ReturnRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    period: str
    profit: int
    profitRate: float
    # Return with deposits and withdrawals removed. Kept separate because a
    # simple balance delta counts transfers as performance.
    netInvestmentRate: float
    benchmarkRate: float


class CashFlowRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    occurredAt: str
    kind: Literal["입금", "출금"]
    amount: int
    memo: str


class AccountData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    accountLabel: str
    accountKind: str
    currency: Literal["KRW"] = "KRW"
    summary: AccountSummary
    assetClasses: list[AssetClassRow] = Field(min_length=1)
    currencies: list[CurrencyRow] = Field(min_length=1)
    returns: list[ReturnRow] = Field(min_length=1)
    cashFlows: list[CashFlowRow] = Field(min_length=1)
    safetyCopy: str


class AccountEnvelope(FixtureEnvelope):
    data: AccountData
