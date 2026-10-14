from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.agents import (
    AGENTS_DATA_AS_OF,
    AGENTS_DISCLAIMER,
    AGENTS_SOURCE_LABEL,
    build_analysis_agent_data,
    build_execution_agent_data,
    build_verification_agent_data,
)
from app.schemas.agents import AgentScreenData, AgentScreenEnvelope

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _envelope(data: AgentScreenData) -> AgentScreenEnvelope:
    return AgentScreenEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=AGENTS_DATA_AS_OF,
        sourceLabel=AGENTS_SOURCE_LABEL,
        disclaimer=AGENTS_DISCLAIMER,
        data=data,
    )


@router.get("/analysis", response_model=AgentScreenEnvelope)
def get_analysis_agent() -> AgentScreenEnvelope:
    """Return the 분석 에이전트 stage fixture. No model call, no data collection."""
    return _envelope(build_analysis_agent_data())


@router.get("/verification", response_model=AgentScreenEnvelope)
def get_verification_agent() -> AgentScreenEnvelope:
    """Return the 검증 에이전트 stage fixture. No source is actually verified."""
    return _envelope(build_verification_agent_data())


@router.get("/execution", response_model=AgentScreenEnvelope)
def get_execution_agent() -> AgentScreenEnvelope:
    """Return the 실행 에이전트 stage fixture.

    This endpoint never executes anything. It reports a held pipeline: every item
    stops at a user decision and the executed count stays at zero.
    """
    return _envelope(build_execution_agent_data())
