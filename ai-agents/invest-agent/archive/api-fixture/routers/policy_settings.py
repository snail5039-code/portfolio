from fastapi import APIRouter, HTTPException, Request

from app.clock import now_kst_iso
from app.fixtures.policy_settings import (
    POLICY_SETTINGS_DATA_AS_OF,
    POLICY_SETTINGS_DISCLAIMER,
    POLICY_SETTINGS_SOURCE_LABEL,
    build_policy_settings_data,
)
from app.schemas.policy_settings import PolicyApplyRequest, PolicySettingsData, PolicySettingsEnvelope
from app.store.policy_settings import PolicySettingsStore

router = APIRouter(prefix="/api", tags=["policy-settings"])


def _store(request: Request) -> PolicySettingsStore:
    return request.app.state.policy_settings_store


def _out_of_range_errors(payload: PolicyApplyRequest) -> dict[str, str]:
    """Re-checks each number field against its own rule's min/max — the
    frontend already enforces this (plus step/decimal-place rules) before its
    "가상 정책 적용" button is even clickable, but a persisted value outliving a
    restart is worse than a rejected request, so the server re-validates the
    one thing that would actually corrupt saved state: out-of-range numbers.
    """
    errors: dict[str, str] = {}
    for rule in build_policy_settings_data().numberRules:
        raw = getattr(payload, rule.key)
        try:
            numeric = float(raw)
        except ValueError:
            errors[rule.key] = f"{raw!r} is not a number"
            continue
        if not (rule.min <= numeric <= rule.max):
            errors[rule.key] = f"{numeric} is outside [{rule.min}, {rule.max}]"
    return errors


def _current_data(store: PolicySettingsStore) -> PolicySettingsData:
    data = build_policy_settings_data()
    applied = store.get_applied()
    if applied is None:
        return data

    payload, applied_at = applied
    number_rules = [rule.model_copy(update={"value": getattr(payload, rule.key)}) for rule in data.numberRules]
    checks = [check.model_copy(update={"value": getattr(payload, check.key)}) for check in data.checks]
    return data.model_copy(update={"numberRules": number_rules, "checks": checks, "appliedAt": applied_at})


@router.get("/policy-settings", response_model=PolicySettingsEnvelope)
def get_policy_settings(request: Request) -> PolicySettingsEnvelope:
    return PolicySettingsEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=POLICY_SETTINGS_DATA_AS_OF,
        sourceLabel=POLICY_SETTINGS_SOURCE_LABEL,
        disclaimer=POLICY_SETTINGS_DISCLAIMER,
        data=_current_data(request.app.state.policy_settings_store),
    )


@router.post("/policy-settings/apply", response_model=PolicySettingsEnvelope)
def apply_policy_settings(payload: PolicyApplyRequest, request: Request) -> PolicySettingsEnvelope:
    """Saves a "가상 정책 적용" so it survives a restart. This never enforces a
    real order or touches a real account.
    """
    errors = _out_of_range_errors(payload)
    if errors:
        raise HTTPException(status_code=422, detail=errors)

    store = _store(request)
    store.apply(payload)
    return PolicySettingsEnvelope(
        generatedAt=now_kst_iso(),
        dataAsOf=POLICY_SETTINGS_DATA_AS_OF,
        sourceLabel=POLICY_SETTINGS_SOURCE_LABEL,
        disclaimer=POLICY_SETTINGS_DISCLAIMER,
        data=_current_data(store),
    )
