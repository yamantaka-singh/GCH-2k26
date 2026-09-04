import csv
import io
from dataclasses import dataclass, field

import psycopg

from .cameras import create_camera

REQUIRED = {"name", "lat", "lon"}
OPTIONAL = (
    "external_ref", "address", "kind", "vendor", "model", "rtsp_url",
    "resolution", "storage",
)


@dataclass
class ImportResult:
    inserted: int = 0
    errors: list[tuple[int, str]] = field(default_factory=list)


def _normalise(row: dict) -> dict:
    return {(k or "").strip().lower(): (v or "").strip() for k, v in row.items()}


def import_csv(cur, department_id: int, text: str) -> ImportResult:
    reader = csv.DictReader(io.StringIO(text))
    headers = {(h or "").strip().lower() for h in (reader.fieldnames or [])}
    missing = REQUIRED - headers
    if missing:
        raise ValueError(f"missing required columns: {', '.join(sorted(missing))}")

    result = ImportResult()
    for line, raw in enumerate(reader, start=2):  # line 1 is the header
        row = _normalise(raw)
        try:
            lat, lon = float(row["lat"]), float(row["lon"])
        except ValueError:
            result.errors.append((line, "lat and lon must be numbers"))
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            result.errors.append((line, f"coordinates out of range: {lat}, {lon}"))
            continue
        if not row["name"]:
            result.errors.append((line, "name is empty"))
            continue

        extras = {k: (row.get(k) or None) for k in OPTIONAL if row.get(k)}
        bad_number = None
        for field in ("fps", "retention_days"):
            raw_value = row.get(field)
            if not raw_value:
                continue
            if raw_value.isdigit():
                extras[field] = int(raw_value)
            else:
                bad_number = f"{field} must be a whole number, got {raw_value!r}"
                break
        if bad_number:
            result.errors.append((line, bad_number))
            continue

        # A savepoint per row: a constraint violation aborts only this row, not the
        # whole import, and the caller's outer transaction stays usable.
        try:
            with cur.connection.transaction():
                create_camera(cur, department_id=department_id, name=row["name"],
                              lat=lat, lon=lon, **extras)
            result.inserted += 1
        except psycopg.Error as exc:
            result.errors.append((line, str(exc).strip().splitlines()[0]))
    return result
