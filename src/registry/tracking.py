"""ANPR scaffold: the tables and queries a real LPDNet/LPRNet worker writes
into and reads from. Cross-camera tracking is a SQL join on the plate string,
not visual re-ID (docs/superpowers/specs/2026-09-04-sentinel-design.md#4-architecture);
watchlist match is a string-equality index lookup.
"""

from datetime import datetime


def _normalise(plate: str) -> str:
    return plate.strip().upper()


def record_sighting(cur, *, camera_id: int, plate: str, confidence: float,
                     crop_uri: str | None = None) -> int:
    cur.execute(
        "INSERT INTO plate_sighting (camera_id, plate, confidence, crop_uri) "
        "VALUES (%s, %s, %s, %s) RETURNING id",
        (camera_id, _normalise(plate), confidence, crop_uri),
    )
    return cur.fetchone()["id"]


def watchlist_match(cur, *, plate: str) -> dict | None:
    cur.execute(
        "SELECT id, reason, severity FROM watchlist WHERE plate = %s AND active",
        (_normalise(plate),),
    )
    return cur.fetchone()


def movement_history(cur, *, plate: str, since: datetime | None = None) -> list[dict]:
    """Camera A reads a plate at 10:03, camera C reads it at 10:07 -- ordering
    sightings by ts across every camera *is* the track."""
    cur.execute(
        """
        SELECT ps.camera_id, c.name AS camera_name, ps.ts, ps.confidence
        FROM plate_sighting ps
        JOIN camera c ON c.id = ps.camera_id
        WHERE ps.plate = %s AND ps.ts >= COALESCE(%s, '-infinity'::timestamptz)
        ORDER BY ps.ts
        """,
        (_normalise(plate), since),
    )
    return cur.fetchall()
