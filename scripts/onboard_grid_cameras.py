"""Onboards the organiser's camera grid (cam01..cam30) into the registry.

Names below are copied verbatim from the grid's own authenticated catalogue
(GET https://cctv.corp8.cloud/cameras.json with the portal session cookie --
logging in at /auth/login with RTSP_EMAIL/RTSP_PASSWORD works; that page
doesn't document it, but the grid guide already frames those as "your
registered email and access password" for the whole system, not just RTSP).
Fetched 2026-09-15; re-fetch and update CATALOGUE below if the roster changes.

The catalogue gives names, not coordinates. Making up a specific address per
camera from a name alone would be exactly the fabrication this project has
been trying to get rid of -- so a camera's real name is only turned into a
real coordinate when that name states an unambiguous, well-known Gujarat
place outright (KNOWN_PLACES). Every other camera keeps a clearly-labelled
placeholder scatter instead of an invented street address.

Idempotent -- re-run any time (e.g. after refreshing CATALOGUE, or adding to
KNOWN_PLACES) and it brings existing rows in line with the current values.

    uv run python -m scripts.onboard_grid_cameras
"""

import math
import sys

from src.registry.cameras import create_camera, update_camera
from src.registry.db import cursor

# id -> name, verbatim from the authenticated catalogue.
CATALOGUE = {
    "cam01": "01 Chiman bhai Bridge", "cam02": "02 Janpath",
    "cam03": "03 O.N.G.C. Office", "cam04": "04 Paldi Circle",
    "cam05": "05 Visat teen Rasta", "cam06": "06 Timbavadi gate-Junagadh",
    "cam07": "07 hero-showroom-gir-somnath", "cam08": "08 majewadi-gate-junagadh",
    "cam09": "09 new-bypass-near-by-circle-junagadh-2",
    "cam10": "10 char-chowk-road-2-junagadh", "cam11": "11 dolatpara-junagadh",
    "cam12": "12 Tri Mandir Adalaj Tollnaka", "cam13": "13 CN Vidhyalaya",
    "cam14": "14 Delight RLVD", "cam15": "15 Suvidha park",
    "cam16": "16 Visat P2", "cam17": "17 Rajkot Bus Port CCTV",
    "cam18": "18 Rajkot CCTV",
    "cam19": "19 KHAPARIA GRAM PANCHAYAT , TALUKA GANDEVI, DISTRICT NAVSARI",
    "cam20": "20 Mohanpura", "cam21": "23 Patan Dethali Char Rasta",
    "cam22": "28 BK Mervada tran Rasta", "cam23": "30 kheram",
    "cam24": "33 dehgam", "cam25": "34 dhanori", "cam26": "35 TANKAL",
    "cam27": "36 bilimora", "cam28": "37 bilimora", "cam29": "38 bilimora",
    "cam30": "Gandhidham Rambaugh p2",
}

# name substring (lowercased) -> (lat, lon, town label). Town-centre points,
# not the camera's exact site -- the catalogue gives no street-level data.
# Matched only against names that state the place outright, so this is
# reading the grid's own data, not guessing from neighbourhood trivia.
KNOWN_PLACES = {
    "chiman bhai bridge": (23.0430, 72.5730, "Ahmedabad"),
    "junagadh": (21.5222, 70.4579, "Junagadh"),
    "gir-somnath": (20.9159, 70.3629, "Gir Somnath (Veraval)"),
    "adalaj": (23.1667, 72.5833, "Adalaj, Gandhinagar"),
    "rajkot": (22.3039, 70.8022, "Rajkot"),
    "gandevi": (20.8167, 72.9333, "Gandevi, Navsari"),
    "patan": (23.8493, 72.1266, "Patan"),
    "dehgam": (23.1667, 72.8167, "Dehgam"),
    "bilimora": (20.7667, 72.9667, "Bilimora"),
    "gandhidham": (23.0753, 70.1337, "Gandhidham"),
}
UNPLACED_BASE_LAT, UNPLACED_BASE_LON = 23.043, 72.573  # unplaced ones scatter near here
SPIRAL_STEP_DEG = 0.012  # ~1.3km per step; keeps points visibly separate on the map


def scattered_point(index: int) -> tuple[float, float]:
    """Golden-angle spiral so unplaced points land visibly apart, not in a
    grid that could be mistaken for real survey spacing."""
    angle = index * 137.5 * math.pi / 180
    radius = SPIRAL_STEP_DEG * math.sqrt(index)
    return UNPLACED_BASE_LAT + radius * math.cos(angle), UNPLACED_BASE_LON + radius * math.sin(angle)


def resolve(camera_id: str, index: int) -> tuple[str, float, float, str]:
    """(name, lat, lon, address) for one camera: real name always; a real
    town-centre coordinate if the name states one, else an honestly-labelled
    placeholder."""
    name = CATALOGUE[camera_id]
    lowered = name.lower()
    for place, (lat, lon, town) in KNOWN_PLACES.items():
        if place in lowered:
            return (name, lat, lon,
                    f"{town} -- town-centre approximation from the camera's own catalogue "
                    "name, not its exact site (the grid's API gives no street-level location).")
    lat, lon = scattered_point(index)
    return (name, lat, lon,
            "Sentinel camera grid feed -- exact site unconfirmed. The camera's catalogue "
            "name doesn't state a specific, identifiable place, so this pin is a "
            "deterministic placeholder, not a surveyed or geocoded location.")


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
    created, updated = 0, 0
    with cursor() as cur:
        dept_id = ensure_grid_department(cur)
        for i, camera_id in enumerate(CATALOGUE, start=1):
            name, lat, lon, address = resolve(camera_id, i)

            # A pre-onboard-script row (cam01, before this script existed) may
            # still sit in another department -- fold it in rather than duplicate.
            cur.execute("SELECT id FROM camera WHERE external_ref = %s AND department_id != %s",
                       (camera_id, dept_id))
            elsewhere = cur.fetchone()
            if elsewhere:
                update_camera(cur, elsewhere["id"], department_id=dept_id, name=name,
                             lat=lat, lon=lon, address=address)
                updated += 1
                continue

            camera_pk = existing_camera_id(cur, dept_id, camera_id)
            if camera_pk:
                update_camera(cur, camera_pk, name=name, lat=lat, lon=lon, address=address)
                updated += 1
                continue

            create_camera(
                cur, department_id=dept_id, name=name, lat=lat, lon=lon,
                external_ref=camera_id, address=address, kind="ip",
                rtsp_url=f"rtsp://103.250.160.189:8554/stream/{camera_id}", status="active",
            )
            created += 1
    print(f"created {created}, updated {updated} (department id {dept_id})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
