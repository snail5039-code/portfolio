from typing import Literal

from pydantic import BaseModel, ConfigDict

Tone = Literal["neutral", "info", "success", "warning", "danger"]

# The only three states any decision can be in across every screen that
# references one. There is no "executed"/"filled" value — approving a demo
# decision never means a *real* order was placed (see the `executed` note on
# `FixtureEnvelope` below for what changes once KIS 모의투자 is configured).
# Defined once here so screens that both read and write a decision's status
# (dashboard, approvals) cannot each invent their own slightly different
# literal.
DecisionStatus = Literal["pending", "approved", "rejected"]


class FixtureEnvelope(BaseModel):
    """Common safety metadata carried by every local fixture response.

    Subclasses add a `data` field with the screen specific fixture body.
    `isMock`/`paperOnly`/`executed` are typed as literals so this contract can
    never claim a *real* trade happened — `executed` stays `False` even when
    approving an order places a live order against KIS's own 모의투자(paper
    trading) account (`app/integrations/kis.py`, `app/routers/approvals.py`):
    that account is virtual and KIS itself manages it, so no real money or
    real securities are ever involved, regardless of the order's own result.

    `externalConnections` is a plain, honest count of live external calls
    instead: every screen still defaults to 0, except the few narrow,
    explicitly-justified cases where a screen's data can honestly come from a
    live call — Company Detail's filings (a live OpenDART call), and the
    Dashboard/Approvals holdings-or-order state (a live KIS 모의투자 call).
    Both integrations are either read-only or reversible-paper-only with no
    real account or money involved — nothing else in this app is allowed to
    raise this above 0 without the same explicit, narrow justification.
    """

    model_config = ConfigDict(extra="forbid")

    generatedAt: str
    dataAsOf: str
    sourceLabel: str
    isMock: Literal[True] = True
    paperOnly: Literal[True] = True
    executed: Literal[False] = False
    externalConnections: int = 0
    disclaimer: str
