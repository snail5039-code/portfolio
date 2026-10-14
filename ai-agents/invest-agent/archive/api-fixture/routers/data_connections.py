from fastapi import APIRouter

from app.clock import now_kst_iso
from app.fixtures.data_connections import (
    DATA_CONNECTIONS_DATA_AS_OF,
    DATA_CONNECTIONS_DISCLAIMER,
    DATA_CONNECTIONS_SOURCE_LABEL,
    build_data_connections_data,
)
from app.schemas.data_connections import DataConnectionsEnvelope

router = APIRouter(prefix="/api", tags=["data-connections"])


@router.get("/data-connections", response_model=DataConnectionsEnvelope)
def get_data_connections() -> DataConnectionsEnvelope:
    return DataConnectionsEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=DATA_CONNECTIONS_DATA_AS_OF,
        sourceLabel=DATA_CONNECTIONS_SOURCE_LABEL,
        disclaimer=DATA_CONNECTIONS_DISCLAIMER,
        data=build_data_connections_data(),
    )
