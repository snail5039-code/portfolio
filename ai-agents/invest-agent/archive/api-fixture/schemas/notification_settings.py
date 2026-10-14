from typing import Literal, get_args

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.common import FixtureEnvelope

NotificationChannelId = Literal["inapp", "browser", "email", "messenger"]
NotificationTypeId = Literal["policy", "source", "approval", "data", "volatility", "cost"]
NotificationSeverity = Literal["중대", "높음", "보통"]


class NotificationChannel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: NotificationChannelId
    name: str
    state: str
    summary: str
    enabled: bool


class NotificationType(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: NotificationTypeId
    name: str
    desc: str
    enabled: bool


class NotificationSettingsData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    safetyCopy: str
    channels: list[NotificationChannel] = Field(min_length=1)
    types: list[NotificationType] = Field(min_length=1)
    defaultSeverity: NotificationSeverity
    # None until the first save — set to that save's server time afterward.
    appliedAt: str | None = None


class NotificationSettingsEnvelope(FixtureEnvelope):
    data: NotificationSettingsData


class NotificationApplyRequest(BaseModel):
    """`channels` here is only ever a virtual on/off preference — saving
    `browser`/`email`/`messenger` as enabled never requests a real browser
    permission or opens a real connection. Each channel's `state`/`summary`
    text (from the fixture, never overridden) is what honestly describes its
    real (dis)connection status regardless of this toggle."""

    model_config = ConfigDict(extra="forbid")

    channels: dict[NotificationChannelId, bool]
    types: dict[NotificationTypeId, bool]
    defaultSeverity: NotificationSeverity

    @model_validator(mode="after")
    def _require_every_channel_and_type(self) -> "NotificationApplyRequest":
        missing_channels = set(get_args(NotificationChannelId)) - self.channels.keys()
        missing_types = set(get_args(NotificationTypeId)) - self.types.keys()
        if missing_channels or missing_types:
            raise ValueError(f"missing channels: {sorted(missing_channels)}, missing types: {sorted(missing_types)}")
        return self
