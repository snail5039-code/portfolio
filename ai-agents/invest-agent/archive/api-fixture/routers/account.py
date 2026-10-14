from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.account import (
    ACCOUNT_DATA_AS_OF,
    ACCOUNT_DISCLAIMER,
    ACCOUNT_SOURCE_LABEL,
    build_account_data,
)
from app.schemas.account import AccountEnvelope

router = APIRouter(prefix="/api", tags=["account"])


@router.get("/account", response_model=AccountEnvelope)
def get_account() -> AccountEnvelope:
    """Return the local simulation account fixture.

    Read only. No brokerage account, balance inquiry, transfer, or FX request.
    """
    return AccountEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=ACCOUNT_DATA_AS_OF,
        sourceLabel=ACCOUNT_SOURCE_LABEL,
        disclaimer=ACCOUNT_DISCLAIMER,
        data=build_account_data(),
    )
