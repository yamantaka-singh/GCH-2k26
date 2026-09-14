import pytest
from psycopg.types.json import Json

from src.registry.policy import (
    active_escalations,
    clear_override,
    evaluate,
    set_override,
    verify_chain,
)


@pytest.fixture
def profile(cur):
    cur.execute(
        "INSERT INTO response_profile (zone, name, allowed_actions, "
        "max_escalation_seconds, active) VALUES (%s, %s, %s, %s, true)",
        ("gandhinagar", "Festival", Json(["raise_recording_quality", "push_geo_alert"]), 3600),
    )


def test_allowed_action_is_logged_and_chained(cur, profile):
    d1 = evaluate(cur, zone="gandhinagar", action="raise_recording_quality", actor="policy-engine")
    assert d1.allowed
    d2 = evaluate(cur, zone="gandhinagar", action="push_geo_alert", actor="policy-engine")
    assert d2.allowed

    cur.execute("SELECT prev_hash, hash FROM audit_log ORDER BY id")
    rows = cur.fetchall()
    assert len(rows) == 2
    assert rows[1]["prev_hash"] == rows[0]["hash"]  # second row chains to the first
    assert verify_chain(cur)


def test_action_outside_profile_is_denied_and_not_logged(cur, profile):
    decision = evaluate(cur, zone="gandhinagar", action="dispatch_drone", actor="policy-engine")
    assert not decision.allowed
    cur.execute("SELECT count(*) AS n FROM audit_log")
    assert cur.fetchone()["n"] == 0


def test_no_profile_denies_everything(cur):
    decision = evaluate(cur, zone="unconfigured-zone", action="anything", actor="policy-engine")
    assert not decision.allowed
    assert "no active response profile" in decision.reason


def test_override_kills_autonomy_immediately(cur, profile):
    set_override(cur, zone="gandhinagar", actor="human-operator")
    decision = evaluate(cur, zone="gandhinagar", action="raise_recording_quality", actor="policy-engine")
    assert not decision.allowed
    assert "manual override" in decision.reason

    clear_override(cur, zone="gandhinagar")
    decision = evaluate(cur, zone="gandhinagar", action="raise_recording_quality", actor="policy-engine")
    assert decision.allowed


def test_tampered_row_breaks_the_chain(cur, profile):
    evaluate(cur, zone="gandhinagar", action="raise_recording_quality", actor="policy-engine")
    cur.execute("UPDATE audit_log SET action = 'push_geo_alert' WHERE action = 'raise_recording_quality'")
    assert not verify_chain(cur)


def test_active_escalations_lists_unexpired_actions(cur, profile):
    evaluate(cur, zone="gandhinagar", action="raise_recording_quality", actor="policy-engine")
    escalations = active_escalations(cur, zone="gandhinagar")
    assert len(escalations) == 1
    assert escalations[0]["action"] == "raise_recording_quality"
