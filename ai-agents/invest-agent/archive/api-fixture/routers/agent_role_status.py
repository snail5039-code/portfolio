from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.agent_role_status import (
    AGENT_ROLE_STATUS_DATA_AS_OF,
    AGENT_ROLE_STATUS_DISCLAIMER,
    AGENT_ROLE_STATUS_SOURCE_LABEL,
    build_agent_role_status_data,
)
from app.schemas.agent_role_status import AgentRoleStatusEnvelope

router = APIRouter(prefix="/api", tags=["agent-role-status"])


@router.get("/agent-role-status", response_model=AgentRoleStatusEnvelope)
def get_agent_role_status() -> AgentRoleStatusEnvelope:
    return AgentRoleStatusEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=AGENT_ROLE_STATUS_DATA_AS_OF,
        sourceLabel=AGENT_ROLE_STATUS_SOURCE_LABEL,
        disclaimer=AGENT_ROLE_STATUS_DISCLAIMER,
        data=build_agent_role_status_data(),
    )
