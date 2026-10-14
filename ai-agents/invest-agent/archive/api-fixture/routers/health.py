from fastapi import APIRouter

from app.clock import now_kst_iso
from app.schemas.health import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    now = now_kst_iso()
    return HealthResponse(
        status="ok",
        service="financial-ai-agent-api",
        generatedAt=now,
        dataAsOf=now,
        sourceLabel="local FastAPI health",
        isMock=True,
        paperOnly=True,
        externalConnections=0,
        executed=False,
        disclaimer=(
            "Local development status only. "
            "No real financial data, execution, market data, external API, "
            "or persistent storage is connected."
        ),
    )
