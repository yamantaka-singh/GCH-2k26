import socket
import time
from urllib.parse import urlparse

from .models import HealthCheck

DEFAULT_RTSP_PORT = 554


def probe(url: str, timeout: float = 3.0) -> tuple[bool, int | None, str | None]:
    """A TCP connect to the RTSP port separates a live camera from a dead one.

    ponytail: this proves the port answers, not that video decodes. The ingest
    milestone needs the stronger check -- ffprobe against the stream -- but that
    costs a subprocess and seconds per camera, so it does not belong in a sweep
    that runs every 60s across 80,000 cameras.
    """
    parsed = urlparse(url)
    if not parsed.hostname:
        return False, None, f"no host in url: {url!r}"
    port = parsed.port or DEFAULT_RTSP_PORT
    start = time.perf_counter()
    try:
        with socket.create_connection((parsed.hostname, port), timeout=timeout):
            return True, int((time.perf_counter() - start) * 1000), None
    except OSError as exc:
        return False, None, str(exc)


def record_check(cur, camera_id: int, *, reachable: bool,
                 latency_ms: int | None = None, error: str | None = None) -> None:
    cur.execute(
        "INSERT INTO camera_health (camera_id, reachable, latency_ms, error)"
        " VALUES (%s, %s, %s, %s)",
        (camera_id, reachable, latency_ms, error),
    )
    if reachable:
        cur.execute("UPDATE camera SET last_seen_at = now() WHERE id = %s", (camera_id,))


def latest_health(cur, camera_id: int) -> HealthCheck | None:
    cur.execute(
        "SELECT camera_id, checked_at, reachable, latency_ms, error FROM camera_health"
        " WHERE camera_id = %s ORDER BY checked_at DESC, id DESC LIMIT 1",
        (camera_id,),
    )
    row = cur.fetchone()
    return HealthCheck(**row) if row else None


def health_summary(cur) -> dict:
    """DISTINCT ON gives the most recent row per camera; the LEFT JOIN keeps
    cameras that have never been probed so they can be counted as unknown."""
    cur.execute(
        """
        WITH newest AS (
          SELECT DISTINCT ON (camera_id) camera_id, reachable
          FROM camera_health
          ORDER BY camera_id, checked_at DESC, id DESC
        )
        SELECT count(*) AS total,
               count(*) FILTER (WHERE n.reachable IS TRUE)  AS reachable,
               count(*) FILTER (WHERE n.reachable IS FALSE) AS unreachable,
               count(*) FILTER (WHERE n.reachable IS NULL)  AS unknown
        FROM camera c
        LEFT JOIN newest n ON n.camera_id = c.id
        """
    )
    return dict(cur.fetchone())
