"""Policy-bound response with a hash-chained audit log
(docs/superpowers/specs/2026-09-04-sentinel-design.md#82-policy-bound-response-with-hash-chained-audit).

A per-zone Response Profile declares what the system may do without a human.
evaluate() is the single gate every autonomous action must pass: denied unless
the zone has no manual override, has an active profile, and that profile lists
the action. Anything allowed is chained into audit_log so the trail is
tamper-evident; anything denied is not logged, because it was never taken.
"""

import hashlib
import json
from dataclasses import dataclass

from psycopg.types.json import Json

GENESIS_HASH = "0" * 64


@dataclass
class PolicyDecision:
    allowed: bool
    reason: str
    audit_id: int | None = None


def _canonical(params: dict) -> str:
    return json.dumps(params, sort_keys=True, separators=(",", ":"))


def _chain_hash(prev_hash: str, *, actor: str, action: str, zone: str, params: dict) -> str:
    payload = f"{prev_hash}|{actor}|{action}|{zone}|{_canonical(params)}"
    return hashlib.sha256(payload.encode()).hexdigest()


def _append_audit(cur, *, actor: str, action: str, zone: str, params: dict) -> int:
    cur.execute("SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1")
    row = cur.fetchone()
    prev_hash = row["hash"] if row else GENESIS_HASH
    new_hash = _chain_hash(prev_hash, actor=actor, action=action, zone=zone, params=params)
    cur.execute(
        """
        INSERT INTO audit_log (actor, action, zone, params, prev_hash, hash)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (actor, action, zone, Json(params), prev_hash, new_hash),
    )
    return cur.fetchone()["id"]


def verify_chain(cur) -> bool:
    """Walks audit_log in id order and recomputes every hash. One mismatch
    means a row was edited or deleted after the fact -- the whole point of
    the chain."""
    cur.execute("SELECT id, actor, action, zone, params, prev_hash, hash FROM audit_log ORDER BY id")
    expected_prev = GENESIS_HASH
    for row in cur.fetchall():
        if row["prev_hash"] != expected_prev:
            return False
        if _chain_hash(expected_prev, actor=row["actor"], action=row["action"],
                        zone=row["zone"], params=row["params"]) != row["hash"]:
            return False
        expected_prev = row["hash"]
    return True


def set_override(cur, *, zone: str, actor: str) -> None:
    """Kills all autonomy for a zone immediately. Not itself an autonomous
    action, so it is not chained -- it is the thing that stops the chain."""
    cur.execute(
        "INSERT INTO zone_override (zone, overridden_by) VALUES (%s, %s) "
        "ON CONFLICT (zone) DO UPDATE SET overridden_by = EXCLUDED.overridden_by, "
        "overridden_at = now()",
        (zone, actor),
    )


def clear_override(cur, *, zone: str) -> None:
    cur.execute("DELETE FROM zone_override WHERE zone = %s", (zone,))


def evaluate(cur, *, zone: str, action: str, actor: str, params: dict | None = None) -> PolicyDecision:
    """The gate. Call this before taking any autonomous action; act only if
    .allowed is True."""
    params = params or {}

    cur.execute("SELECT 1 FROM zone_override WHERE zone = %s", (zone,))
    if cur.fetchone():
        return PolicyDecision(False, "zone under manual override")

    cur.execute(
        "SELECT name, allowed_actions, max_escalation_seconds "
        "FROM response_profile WHERE zone = %s AND active",
        (zone,),
    )
    profile = cur.fetchone()
    if not profile:
        return PolicyDecision(False, "no active response profile for zone")

    if action not in profile["allowed_actions"]:
        return PolicyDecision(False, f"'{action}' not permitted under {profile['name']} profile")

    audit_id = _append_audit(cur, actor=actor, action=action, zone=zone, params=params)
    return PolicyDecision(True, f"allowed under {profile['name']} profile", audit_id=audit_id)


def active_escalations(cur, *, zone: str) -> list[dict]:
    """Autonomous actions for this zone still inside their profile's
    max_escalation_seconds -- the live 'what's currently elevated' view.
    Expiry is computed at query time; nothing needs a background sweep."""
    cur.execute(
        """
        SELECT a.id, a.action, a.ts, a.params
        FROM audit_log a
        JOIN response_profile p ON p.zone = a.zone AND p.active
        WHERE a.zone = %s
          AND a.ts + make_interval(secs => p.max_escalation_seconds) > now()
        ORDER BY a.ts DESC
        """,
        (zone,),
    )
    return cur.fetchall()
