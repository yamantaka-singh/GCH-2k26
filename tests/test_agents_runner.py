import json

import pytest

from agents.runner import AgentError, run


def test_fills_variables_and_validates_schema():
    calls = []

    def fake_endpoint(prompt: str) -> str:
        calls.append(prompt)
        return json.dumps({"sql": "SELECT 1", "explanation": "test"})

    result = run("nl_query", {"question": "how many cameras are offline?"}, call_endpoint=fake_endpoint)
    assert result == {"sql": "SELECT 1", "explanation": "test"}
    assert "how many cameras are offline?" in calls[0]
    assert "{{question}}" not in calls[0]


def test_missing_variable_raises_before_calling_endpoint():
    with pytest.raises(AgentError, match="missing template variable"):
        run("nl_query", {}, call_endpoint=lambda p: pytest.fail("should not be called"))


def test_unknown_agent_raises():
    with pytest.raises(AgentError, match="no such agent"):
        run("does_not_exist", {}, call_endpoint=lambda p: "")


def test_retries_once_then_raises_on_repeated_schema_failure():
    calls = []

    def bad_endpoint(prompt: str) -> str:
        calls.append(prompt)
        return json.dumps({"sql": "SELECT 1"})  # missing required "explanation"

    with pytest.raises(AgentError, match="failed schema validation twice"):
        run("nl_query", {"question": "x"}, call_endpoint=bad_endpoint)
    assert len(calls) == 2


def test_succeeds_on_second_attempt_after_one_bad_response():
    responses = iter([
        json.dumps({"sql": "SELECT 1"}),  # invalid: missing explanation
        json.dumps({"sql": "SELECT 1", "explanation": "ok"}),
    ])
    result = run("nl_query", {"question": "x"}, call_endpoint=lambda p: next(responses))
    assert result["explanation"] == "ok"


@pytest.mark.parametrize("agent_name", [
    "inventory_mapper", "nl_query", "scene_caption", "incident_report",
])
def test_every_agent_has_prompt_and_schema(agent_name):
    from agents.runner import AGENTS_DIR
    agent_dir = AGENTS_DIR / agent_name
    assert (agent_dir / "AGENT.md").is_file()
    schema = json.loads((agent_dir / "schema.json").read_text())
    assert schema["type"] == "object"
