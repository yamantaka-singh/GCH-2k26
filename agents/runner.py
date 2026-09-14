"""No framework. An agent is a directory: AGENT.md (prompt) + schema.json
(the shape its output must satisfy). run() loads both, fills {{variables}},
calls the hosted NVIDIA endpoint, parses JSON, validates against the schema,
retries once on failure, raises otherwise.
(docs/superpowers/specs/2026-09-04-sentinel-design.md#7-agent-tier-markdown-files-and-a-thin-runner)
"""

import json
import os
import re
from pathlib import Path
from urllib import error, request

import jsonschema

AGENTS_DIR = Path(__file__).parent
VARIABLE_RE = re.compile(r"\{\{(\w+)\}\}")


class AgentError(RuntimeError):
    pass


def _load(agent_name: str) -> tuple[str, dict]:
    agent_dir = AGENTS_DIR / agent_name
    if not agent_dir.is_dir():
        raise AgentError(f"no such agent: {agent_name}")
    prompt = (agent_dir / "AGENT.md").read_text()
    schema = json.loads((agent_dir / "schema.json").read_text())
    return prompt, schema


def _fill(prompt: str, variables: dict) -> str:
    def substitute(match: re.Match) -> str:
        key = match.group(1)
        if key not in variables:
            raise AgentError(f"missing template variable: {key}")
        return str(variables[key])

    return VARIABLE_RE.sub(substitute, prompt)


def _call_endpoint(prompt: str) -> str:
    url = os.environ.get("NVIDIA_ENDPOINT_URL")
    key = os.environ.get("NVIDIA_API_KEY")
    if not url or not key:
        raise AgentError("NVIDIA_ENDPOINT_URL / NVIDIA_API_KEY not configured")
    body = json.dumps({"messages": [{"role": "user", "content": prompt}]}).encode()
    req = request.Request(
        url, data=body, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read())
    except error.URLError as e:
        raise AgentError(f"endpoint call failed: {e}") from e
    return payload["choices"][0]["message"]["content"]


def run(agent_name: str, variables: dict, *, call_endpoint=_call_endpoint) -> dict:
    """Runs one agent end to end. call_endpoint is swappable for tests --
    everything else (prompt fill, parse, validate, retry) is the real logic."""
    prompt_template, schema = _load(agent_name)
    prompt = _fill(prompt_template, variables)

    last_error: Exception | None = None
    for _attempt in range(2):
        raw = call_endpoint(prompt)
        try:
            data = json.loads(raw)
            jsonschema.validate(data, schema)
            return data
        except (json.JSONDecodeError, jsonschema.ValidationError) as e:
            last_error = e
    raise AgentError(f"{agent_name} output failed schema validation twice: {last_error}")
