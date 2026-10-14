from fastapi import APIRouter, Request

from app.clock import now_kst_iso
from app.fixtures.notification_settings import (
    NOTIFICATION_SETTINGS_DATA_AS_OF,
    NOTIFICATION_SETTINGS_DISCLAIMER,
    NOTIFICATION_SETTINGS_SOURCE_LABEL,
    build_notification_settings_data,
)
from app.schemas.notification_settings import (
    NotificationApplyRequest,
    NotificationSettingsData,
    NotificationSettingsEnvelope,
)
from app.store.notification_settings import NotificationSettingsStore

router = APIRouter(prefix="/api", tags=["notification-settings"])


def _store(request: Request) -> NotificationSettingsStore:
    return request.app.state.notification_settings_store


def _current_data(store: NotificationSettingsStore) -> NotificationSettingsData:
    data = build_notification_settings_data()
    applied = store.get_applied()
    if applied is None:
        return data

    payload, applied_at = applied
    channels = [channel.model_copy(update={"enabled": payload.channels[channel.id]}) for channel in data.channels]
    types = [type_.model_copy(update={"enabled": payload.types[type_.id]}) for type_ in data.types]
    return data.model_copy(
        update={"channels": channels, "types": types, "defaultSeverity": payload.defaultSeverity, "appliedAt": applied_at}
    )


@router.get("/notification-settings", response_model=NotificationSettingsEnvelope)
def get_notification_settings(request: Request) -> NotificationSettingsEnvelope:
    return NotificationSettingsEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=NOTIFICATION_SETTINGS_DATA_AS_OF,
        sourceLabel=NOTIFICATION_SETTINGS_SOURCE_LABEL,
        disclaimer=NOTIFICATION_SETTINGS_DISCLAIMER,
        data=_current_data(request.app.state.notification_settings_store),
    )


@router.post("/notification-settings/apply", response_model=NotificationSettingsEnvelope)
def apply_notification_settings(payload: NotificationApplyRequest, request: Request) -> NotificationSettingsEnvelope:
    """Saves the channel/event-type toggles and severity threshold so they
    survive a restart. A channel's `enabled` flag is purely a virtual
    preference (see `NotificationApplyRequest`) — its `state`/`summary` text
    always comes from the fixture and is never overridden, so "미연결"/
    "권한 요청 없음" keeps describing the channel honestly regardless of this
    toggle. No real notification is ever sent by this endpoint or anything it
    configures.
    """
    store = _store(request)
    store.apply(payload)
    return NotificationSettingsEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=NOTIFICATION_SETTINGS_DATA_AS_OF,
        sourceLabel=NOTIFICATION_SETTINGS_SOURCE_LABEL,
        disclaimer=NOTIFICATION_SETTINGS_DISCLAIMER,
        data=_current_data(store),
    )
