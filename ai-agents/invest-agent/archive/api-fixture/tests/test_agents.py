import pytest
from fastapi.testclient import TestClient

from app.main import create_app

STAGE_PATHS = {
    "analysis": "/api/agents/analysis",
    "verification": "/api/agents/verification",
    "execution": "/api/agents/execution",
}


def get_payload(stage: str) -> dict:
    client = TestClient(create_app())
    response = client.get(STAGE_PATHS[stage])
    assert response.status_code == 200
    return response.json()


@pytest.mark.parametrize("stage", sorted(STAGE_PATHS))
def test_agent_envelope_carries_safety_flags(stage: str) -> None:
    payload = get_payload(stage)

    assert payload["isMock"] is True
    assert payload["paperOnly"] is True
    assert payload["executed"] is False
    assert payload["externalConnections"] == 0
    assert "연결되지 않습니다" in payload["disclaimer"]


@pytest.mark.parametrize("stage", sorted(STAGE_PATHS))
def test_endpoint_reports_its_own_stage(stage: str) -> None:
    assert get_payload(stage)["data"]["stage"] == stage


@pytest.mark.parametrize("stage", sorted(STAGE_PATHS))
def test_no_capability_is_connected(stage: str) -> None:
    # Every capability is a description of what the agent would do if anything
    # were wired up. None of them may claim a live integration.
    for capability in get_payload(stage)["data"]["capabilities"]:
        assert capability["connected"] is False, capability["label"]


@pytest.mark.parametrize("stage", sorted(STAGE_PATHS))
def test_pipeline_is_shared_across_stages(stage: str) -> None:
    pipeline = get_payload(stage)["data"]["pipeline"]

    assert [step["stage"] for step in pipeline] == ["analysis", "verification", "execution"]
    # The execution stage is held everywhere, never running.
    assert pipeline[2]["state"] == "blocked"


@pytest.mark.parametrize("stage", sorted(STAGE_PATHS))
def test_work_items_reference_a_decision_and_a_local_screen(stage: str) -> None:
    items = get_payload(stage)["data"]["items"]

    assert items
    for item in items:
        assert item["decisionId"].startswith("DEC-")
        assert item["linkPage"]
        assert not item["linkPage"].startswith("http")


def test_execution_agent_never_reports_an_execution() -> None:
    data = get_payload("execution")["data"]

    # The grade must always keep a human in the loop.
    assert data["executionGrade"] in ("간편 승인", "강화 승인", "실행 금지")
    assert data["executionGrade"] != "자동 실행"

    executed_metric = next(m for m in data["metrics"] if m["label"] == "실행한 주문")
    assert executed_metric["value"] == "0건"

    external_metric = next(m for m in data["metrics"] if m["label"] == "외부 주문 요청")
    assert external_metric["value"] == "0건"

    for item in data["items"]:
        result = next(f for f in item["fields"] if f["label"] == "실행 결과")
        assert result["value"] == "실행 안 됨", item["id"]
        assert item["action"] in ("실행 보류", "실행 금지"), item["id"]


def test_execution_agent_states_that_nothing_can_be_ordered() -> None:
    safety = get_payload("execution")["data"]["safetyCopy"]

    for word in ("주문", "매수", "매도", "체결", "이체", "환전"):
        assert word in safety


def test_verification_agent_does_not_pass_unverified_sources() -> None:
    data = get_payload("verification")["data"]

    # No source can be confirmed without a disclosure connection, so no item may
    # come back as a plain approval.
    for item in data["items"]:
        assert item["action"] in ("조건부 승인", "반려", "사용자 판단 필요"), item["id"]
        source = next(f for f in item["fields"] if f["label"] == "출처 뒷받침")
        assert "미확인" in source["value"], item["id"]


def test_analysis_agent_does_not_create_orders() -> None:
    data = get_payload("analysis")["data"]

    auto_order = next(m for m in data["metrics"] if m["label"] == "자동 생성 주문")
    assert auto_order["value"] == "없음"

    for item in data["items"]:
        assert item["action"] in ("매수", "매도", "보유", "관찰"), item["id"]


def test_agent_paths_share_the_same_pipeline_object() -> None:
    pipelines = [get_payload(stage)["data"]["pipeline"] for stage in STAGE_PATHS]

    assert pipelines[0] == pipelines[1] == pipelines[2]
