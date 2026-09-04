"""Probe every active camera on a fixed interval.

Run from the repo root as a module, not by path:

    uv run python -m workers.health_probe

Running it by path puts workers/ on sys.path instead of the repo root and
`import src` fails.
"""
import os
import time
from concurrent.futures import ThreadPoolExecutor

from src.registry.db import cursor
from src.registry.health import probe, record_check

INTERVAL_SECONDS = int(os.environ.get("HEALTH_INTERVAL_SECONDS", "60"))
WORKERS = int(os.environ.get("HEALTH_WORKERS", "16"))


def sweep() -> int:
    with cursor() as cur:
        cur.execute(
            "SELECT id, rtsp_url FROM camera"
            " WHERE status = 'active' AND rtsp_url IS NOT NULL"
        )
        targets = [(row["id"], row["rtsp_url"]) for row in cur.fetchall()]

    with ThreadPoolExecutor(max_workers=WORKERS) as executor:
        results = list(executor.map(lambda t: (t[0], *probe(t[1])), targets))

    with cursor() as cur:
        for camera_id, reachable, latency_ms, error in results:
            record_check(cur, camera_id, reachable=reachable,
                         latency_ms=latency_ms, error=error)
    return len(results)


if __name__ == "__main__":
    while True:
        print(f"probed {sweep()} cameras")
        time.sleep(INTERVAL_SECONDS)
