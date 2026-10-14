from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import FixtureEnvelope

DataConnectionKey = Literal[
    "opendart", "price", "securities", "database", "report", "unknown", "stale", "permission", "paper",
]
DataConnectionKind = Literal["blocked", "mock"]


class DataConnectionFact(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    value: str


class DataConnectionDetail(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: DataConnectionKey
    title: str
    summary: str
    facts: list[DataConnectionFact]


class DataConnectionCard(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: DataConnectionKey
    label: str
    value: str
    note: str


class DataConnectionRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: DataConnectionKey
    name: str
    status: str
    detail: str
    note: str
    kind: DataConnectionKind


class DataQualityChip(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: DataConnectionKey
    label: str


class DataConnectionsData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    safetyCopy: str
    details: dict[DataConnectionKey, DataConnectionDetail]
    cards: list[DataConnectionCard] = Field(min_length=1)
    rows: list[DataConnectionRow] = Field(min_length=1)
    qualityChips: list[DataQualityChip]


class DataConnectionsEnvelope(FixtureEnvelope):
    data: DataConnectionsData
