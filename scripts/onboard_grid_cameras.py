"""Onboards the organiser's camera grid (cam01..cam30) into the registry.

The grid's authenticated camera catalogue (cameras.json, real names and
coordinates) sits behind a portal login this script doesn't have -- only the
RTSP credentials in .env, which prove a camera id exists and is reachable,
not where it is. So every row here is honestly placed: real external_ref
(the only verified fact), a deterministic scatter around one Gujarat point
for map usability, and an address that says outright the location is
unconfirmed. Nothing here claims a precision the grid never gave us.

Idempotent -- re-run any time (e.g. once cam16 is reachable, or after the
real catalogue becomes available) and it only touches missing cameras.

    uv run python -m scripts.onboard_grid_cameras
"""

import math
import sys

from src.registry.cameras import create_camera, update_camera
from src.registry.db import cursor

CAMERA_COUNT = 30
BASE_LAT, BASE_LON = 23.043, 72.573  # Sabarmati riverfront, Ahmedabad -- cam01's real area
SPIRAL_STEP_DEG = 0.012             # ~1.3km per step; keeps 30 points visibly separate, tightly clustered
UNCONFIRMED_ADDRESS = (
    "Sentinel camera grid feed -- exact site unconfirmed. The organiser's "
    "authenticated camera catalogue was not reachable without a portal login; "
    "this pin is a deterministic placeholder, not a surveyed location."
)


def scattered_point(index: int) -> tuple[float, float]:
    """Golden-angle spiral so 30 points land visibly apart, not in a grid that
    could be mistaken for real survey spacing."""
    angle = index * 137.5 * math.pi / 180
    radius = SPIRAL_STEP_DEG * math.sqrt(index)
    return BASE_LAT + radius * math.cos(angle), BASE_LON + radius * math.sin(angle)


def ensure_grid_department(cur) -> int:
    cur.execute("SELECT id FROM department WHERE code = 'GRID'")
    row = cur.fetchone()
    if row:
        return row["id"]
    cur.execute(
        "INSERT INTO department (code, name) VALUES ('GRID', %s) RETURNING id",
        ("Sentinel Camera Grid (Organiser Feed)",),
    )
    return cur.fetchone()["id"]


def existing_camera_id(cur, department_id: int, external_ref: str) -> int | None:
    cur.execute("SELECT id FROM camera WHERE department_id = %s AND external_ref = %s",
                (department_id, external_ref))
    row = cur.fetchone()
    return row["id"] if row else None


def main() -> int:
    created, moved, skipped = 0, 0, 0
    with cursor() as cur:
        dept_id = ensure_grid_department(cur)
        for i in range(1, CAMERA_COUNT + 1):
            camera_id = f"cam{i:02d}"
            if existing_camera_id(cur, dept_id, camera_id):
                skipped += 1
                continue

            lat, lon = scattered_point(i)
            # cam01 was already onboarded (id 63) under the wrong department
            # before this script existed; move it in place rather than
            # duplicating it, keeping its real captured name.
            cur.execute("SELECT id FROM camera WHERE external_ref = %s AND department_id != %s",
                       (camera_id, dept_id))
            elsewhere = cur.fetchone()
            if elsewhere:
                update_camera(cur, elsewhere["id"], department_id=dept_id)
                moved += 1
                continue

            create_camera(
                cur, department_id=dept_id, name=f"Grid Camera {camera_id}",
                lat=lat, lon=lon, external_ref=camera_id, address=UNCONFIRMED_ADDRESS,
                kind="ip", rtsp_url=f"rtsp://103.250.160.189:8554/stream/{camera_id}",
                status="active",
            )
            created += 1
    print(f"created {created}, moved {moved}, already present {skipped} (department id {dept_id})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
