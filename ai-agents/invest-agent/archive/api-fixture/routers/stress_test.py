from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.stress_test import (
    STRESS_TEST_DATA_AS_OF,
    STRESS_TEST_DISCLAIMER,
    STRESS_TEST_SOURCE_LABEL,
    build_stress_test_data,
)
from app.schemas.stress_test import StressTestEnvelope

router = APIRouter(prefix="/api", tags=["stress-test"])


@router.get("/stress-test", response_model=StressTestEnvelope)
def get_stress_test() -> StressTestEnvelope:
    return StressTestEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=STRESS_TEST_DATA_AS_OF,
        sourceLabel=STRESS_TEST_SOURCE_LABEL,
        disclaimer=STRESS_TEST_DISCLAIMER,
        data=build_stress_test_data(),
    )
