"""Canonical facts for decisions that appear in more than one backend screen.

`DEC-1042` (삼성전자 매수) is shown by both the dashboard's "현재 판단" panel and
the approvals queue. Before this module existed, each fixture file typed its
own copy of the quantity, price, and target weight — nothing stopped them from
drifting apart if one was edited and the other wasn't. Any screen describing
this decision imports these constants instead of retyping the numbers.

This module holds only the numeric/identifying facts (what is being proposed).
The prose — evidence bullets, warnings, review labels — stays local to each
screen's fixture file, since that copy is written for that screen's framing
and isn't a source of drift the way a duplicated number is.

Live decision state (pending/approved/rejected) is NOT here — that lives in
`app/store/approvals.py`, the one place that remembers a user's decision.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DecisionFacts:
    id: str
    company: str
    code: str
    side: str
    quantity: int
    price: int

    @property
    def amount(self) -> int:
        return self.quantity * self.price


DEC_1042 = DecisionFacts(
    id="DEC-1042",
    company="삼성전자",
    code="005930",
    side="매수",
    quantity=10,
    price=71_200,
)

DEC_1042_TARGET_WEIGHT_FROM = 6.65
DEC_1042_TARGET_WEIGHT_TO = 7.20
DEC_1042_EXPIRES_AT = "2026-08-27T15:42:00+09:00"

DEC_1043 = DecisionFacts(
    id="DEC-1043",
    company="NAVER",
    code="035420",
    side="매도",
    quantity=8,
    price=220_000,
)

DEC_1044 = DecisionFacts(
    id="DEC-1044",
    company="KODEX 200",
    code="069500",
    side="매수",
    quantity=20,
    price=35_000,
)
