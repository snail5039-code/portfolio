from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.tax_fee_impact import (
    TAX_FEE_IMPACT_DATA_AS_OF,
    TAX_FEE_IMPACT_DISCLAIMER,
    TAX_FEE_IMPACT_SOURCE_LABEL,
    build_tax_fee_impact_data,
)
from app.schemas.tax_fee_impact import TaxFeeImpactEnvelope

router = APIRouter(prefix="/api", tags=["tax-fee-impact"])


@router.get("/tax-fee-impact", response_model=TaxFeeImpactEnvelope)
def get_tax_fee_impact() -> TaxFeeImpactEnvelope:
    return TaxFeeImpactEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=TAX_FEE_IMPACT_DATA_AS_OF,
        sourceLabel=TAX_FEE_IMPACT_SOURCE_LABEL,
        disclaimer=TAX_FEE_IMPACT_DISCLAIMER,
        data=build_tax_fee_impact_data(),
    )
