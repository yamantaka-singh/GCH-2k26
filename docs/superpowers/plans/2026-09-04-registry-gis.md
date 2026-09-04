# Registry & GIS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Centralised CCTV Registry & GIS Foundation (Model 1), which the organisers require in every submission regardless of track.

**Architecture:** A FastAPI service over Postgres 16 + PostGIS. Raw SQL through psycopg3, no ORM, because PostGIS geography types fight ORMs and the schema is nine tables. Numbered `.sql` migrations applied by a 25-line runner. A React + Leaflet frontend reads GeoJSON straight from PostGIS. No AI anywhere in this plan.

**Tech Stack:** Python 3.12, FastAPI, psycopg3, Postgres 16 + PostGIS 3.4, PyJWT, bcrypt, pytest, React 18 + Vite + Leaflet, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-04-sentinel-design.md`

## Global Constraints

- Python `>=3.12,<3.13`. The host has 3.14; pin with `uv python pin 3.12`. TensorRT and OpenCV wheels used in later milestones do not yet publish for 3.14.
- All dependencies open source. Stated requirement of the organisers.
- Postgres image `postgis/postgis:16-3.4`. `ST_SquareGrid` needs PostGIS >= 3.1.
- Database exposed on host port `55432` to avoid colliding with a local Postgres.
- Coordinates are stored as `geography(Point, 4326)`. `ST_MakePoint` takes **longitude first**.
- Distance and grid maths run in EPSG:3857 (metres). Storage and API stay in 4326.
- No AI, no model calls, no LLM in this plan. The registry is deterministic.
- Every task ends with a commit. Commit messages use Conventional Commits.
- Run tests with `uv run pytest`. Never `pip install` into the system Python.

## Scope Note

The spec covers four subsystems. This plan implements only the first
(milestone M2, Registry + GIS). The remaining three get their own plans once
this one lands and the M1 ANPR spike has reported a read rate:

- `2026-XX-XX-ingest-anpr.md` — M3, M4
- `2026-XX-XX-trust-policy.md` — M6, M7
- `2026-XX-XX-agent-tier.md` — M7.5

## File Structure

```
GCH-2k26/
  docker-compose.yml            Postgres + PostGIS, host port 55432
  pyproject.toml                deps, pytest config
  .env.example                  DATABASE_URL, JWT_SECRET
  migrations/
    001_extensions.sql          postgis
    002_department_camera.sql   core inventory tables + GIST index
    003_camera_health.sql       health check history
    004_users.sql               accounts and roles
  scripts/
    migrate.py                  applies unapplied .sql files in name order
  src/registry/
    config.py                   env -> Settings, fails loudly when unset
    db.py                       psycopg pool, dict_row cursor helper
    models.py                   Camera and HealthCheck dataclasses
    cameras.py                  camera insert / fetch / list
    importer.py                 CSV bulk import with per-row savepoints
    geo.py                      GeoJSON feed and PostGIS gap analysis
    health.py                   TCP reachability probe
    auth.py                     bcrypt hashing, JWT issue/decode, role guard
    api.py                      FastAPI app and all routes
  workers/
    health_probe.py             loop: probe every active camera, write rows
  tests/
    conftest.py                 session migration, per-test rollback
    test_cameras.py
    test_importer.py
    test_geo.py
    test_health.py
    test_auth.py
    test_api.py
  web/
    package.json, vite.config.js, index.html
    src/main.jsx, src/api.js, src/App.jsx
    src/components/CameraMap.jsx
    src/components/CameraTable.jsx
    src/components/CameraDetail.jsx
    src/components/GapLayer.jsx
```

Split by responsibility, not by layer. `geo.py` owns every query that returns
geometry; `cameras.py` owns every query that returns rows. `api.py` is the only
file that knows about HTTP.

---

### Task 1: Skeleton, database, migration runner

**Files:**
- Create: `pyproject.toml`, `.env.example`, `docker-compose.yml`
- Create: `src/registry/config.py`, `src/registry/db.py`
- Create: `migrations/001_extensions.sql`, `scripts/migrate.py`
- Test: `tests/conftest.py`, `tests/test_db.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `load_settings() -> Settings` with fields `database_url: str`, `jwt_secret: str`, `jwt_ttl_seconds: int`. `pool() -> ConnectionPool`. `cursor()` context manager yielding a `psycopg.Cursor` with `row_factory=dict_row`.

- [ ] **Step 1: Write the project files**

`pyproject.toml`:

```toml
[project]
name = "sentinel-registry"
version = "0.1.0"
requires-python = ">=3.12,<3.13"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "psycopg[binary,pool]>=3.2",
  "pyjwt>=2.9",
  "bcrypt>=4.2",
  "python-multipart>=0.0.12",
]

[dependency-groups]
dev = ["pytest>=8.3", "httpx>=0.27"]

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-q"

[tool.setuptools.packages.find]
where = ["."]
include = ["src*", "scripts*", "workers*"]
```

`.env.example`:

```
DATABASE_URL=postgresql://sentinel:sentinel@localhost:55432/registry
JWT_SECRET=change-me-before-any-demo
```

`docker-compose.yml`:

```yaml
services:
  db:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_USER: sentinel
      POSTGRES_PASSWORD: sentinel
      POSTGRES_DB: registry
    ports:
      - "55432:5432"
    volumes:
      - dbdata:/var/lib/postgresql/data
      - ./scripts/init_test_db.sh:/docker-entrypoint-initdb.d/10-test-db.sh:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sentinel"]
      interval: 5s
      retries: 10

volumes:
  dbdata:
```

`scripts/init_test_db.sh`:

```bash
#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE registry_test OWNER $POSTGRES_USER;"
```

`migrations/001_extensions.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

`src/registry/config.py`:

```python
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    jwt_ttl_seconds: int = 43200


def load_settings() -> Settings:
    """Raises RuntimeError rather than defaulting, so a missing secret fails at boot."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not set")
    return Settings(database_url=url, jwt_secret=secret)
```

`src/registry/db.py`:

```python
from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import load_settings

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(load_settings().database_url, min_size=1, max_size=8, open=True)
    return _pool


@contextmanager
def cursor():
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur
```

`scripts/migrate.py`:

```python
import pathlib
import sys

from src.registry.db import cursor

MIGRATIONS = pathlib.Path(__file__).resolve().parent.parent / "migrations"


def main() -> int:
    with cursor() as cur:
        cur.execute(
            "CREATE TABLE IF NOT EXISTS schema_migration ("
            " name text PRIMARY KEY,"
            " applied_at timestamptz NOT NULL DEFAULT now())"
        )
        cur.execute("SELECT name FROM schema_migration")
        done = {row["name"] for row in cur.fetchall()}
        for path in sorted(MIGRATIONS.glob("*.sql")):
            if path.name in done:
                continue
            cur.execute(path.read_text())
            cur.execute("INSERT INTO schema_migration (name) VALUES (%s)", (path.name,))
            print(f"applied {path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

`tests/conftest.py`:

```python
import os
import subprocess

import pytest
from psycopg.rows import dict_row

os.environ.setdefault(
    "DATABASE_URL", "postgresql://sentinel:sentinel@localhost:55432/registry_test"
)
os.environ.setdefault("JWT_SECRET", "test-secret")

from src.registry.db import pool  # noqa: E402  (import after env is set)


@pytest.fixture(scope="session", autouse=True)
def migrated():
    subprocess.run(["uv", "run", "python", "-m", "scripts.migrate"], check=True)


@pytest.fixture
def cur():
    """Every test runs inside a transaction that is rolled back, so tests never see
    each other's rows and no truncation is needed."""
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as c:
            yield c
        conn.rollback()


@pytest.fixture
def department(cur):
    cur.execute(
        "INSERT INTO department (code, name) VALUES ('POL', 'Police') RETURNING id"
    )
    return cur.fetchone()["id"]
```

- [ ] **Step 2: Write the failing test**

`tests/test_db.py`:

```python
def test_postgis_is_available(cur):
    cur.execute("SELECT PostGIS_Version() AS v")
    assert cur.fetchone()["v"]


def test_migration_table_records_applied_files(cur):
    cur.execute("SELECT name FROM schema_migration ORDER BY name")
    names = [row["name"] for row in cur.fetchall()]
    assert "001_extensions.sql" in names
```

- [ ] **Step 3: Run it and watch it fail**

```bash
uv run pytest tests/test_db.py -v
```

Expected: FAIL. The database container is not running yet, so the pool raises a connection error.

- [ ] **Step 4: Bring the stack up and install**

```bash
chmod +x scripts/init_test_db.sh
docker compose up -d db
uv python pin 3.12
uv sync
cp .env.example .env
```

- [ ] **Step 5: Run the tests and watch them pass**

```bash
uv run pytest tests/test_db.py -v
```

Expected: 2 passed. If `test_postgis_is_available` fails with "database registry_test does not exist", the init script did not run because the volume already existed. Fix with `docker compose down -v && docker compose up -d db`.

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml .env.example docker-compose.yml migrations scripts src tests uv.lock
git commit -m "feat: project skeleton, postgis container, migration runner"
```

---

### Task 2: Camera inventory schema and writes

**Files:**
- Create: `migrations/002_department_camera.sql`
- Create: `src/registry/models.py`, `src/registry/cameras.py`
- Test: `tests/test_cameras.py`

**Interfaces:**
- Consumes: `cursor()` from Task 1, the `department` fixture.
- Produces: dataclass `Camera` with fields `id, department_id, name, lat, lon, kind, status, external_ref, address, vendor, model, rtsp_url, resolution, fps, storage, retention_days, last_seen_at`. Functions `create_camera(cur, *, department_id, name, lat, lon, **optional) -> int`, `get_camera(cur, camera_id) -> Camera | None`, `list_cameras(cur, *, department_id=None, status=None, limit=100, offset=0) -> list[Camera]`, `count_cameras(cur, *, department_id=None, status=None) -> int`.

- [ ] **Step 1: Write the migration**

`migrations/002_department_camera.sql`:

```sql
CREATE TABLE department (
  id   serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL
);

CREATE TYPE camera_kind   AS ENUM ('analog', 'ip');
CREATE TYPE camera_status AS ENUM ('active', 'inactive', 'decommissioned');
CREATE TYPE storage_kind  AS ENUM ('local', 'cloud', 'unknown');

CREATE TABLE camera (
  id             serial PRIMARY KEY,
  department_id  integer NOT NULL REFERENCES department(id),
  external_ref   text,
  name           text NOT NULL,
  geom           geography(Point, 4326) NOT NULL,
  address        text,
  kind           camera_kind   NOT NULL DEFAULT 'ip',
  vendor         text,
  model          text,
  rtsp_url       text,
  resolution     text,
  fps            integer,
  storage        storage_kind  NOT NULL DEFAULT 'unknown',
  retention_days integer,
  status         camera_status NOT NULL DEFAULT 'active',
  last_seen_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, external_ref)
);

CREATE INDEX camera_geom_idx       ON camera USING GIST (geom);
CREATE INDEX camera_department_idx ON camera (department_id);
CREATE INDEX camera_status_idx     ON camera (status);
```

The unique constraint treats NULL `external_ref` as distinct, so cameras a
department has no reference number for can still be inserted.

- [ ] **Step 2: Write the failing test**

`tests/test_cameras.py`:

```python
import pytest

from src.registry.cameras import count_cameras, create_camera, get_camera, list_cameras


def test_create_and_read_back_preserves_coordinates(cur, department):
    camera_id = create_camera(
        cur, department_id=department, name="Sector 18 Junction",
        lat=23.2156, lon=72.6369, vendor="Hikvision", kind="ip",
    )
    camera = get_camera(cur, camera_id)
    assert camera.name == "Sector 18 Junction"
    assert camera.vendor == "Hikvision"
    assert camera.lat == pytest.approx(23.2156, abs=1e-6)
    assert camera.lon == pytest.approx(72.6369, abs=1e-6)


def test_get_camera_returns_none_when_absent(cur):
    assert get_camera(cur, 999999) is None


def test_list_filters_by_department_and_status(cur, department):
    cur.execute("INSERT INTO department (code, name) VALUES ('GSRTC', 'Transport') RETURNING id")
    other = cur.fetchone()["id"]
    create_camera(cur, department_id=department, name="A", lat=23.0, lon=72.0)
    create_camera(cur, department_id=department, name="B", lat=23.1, lon=72.1, status="inactive")
    create_camera(cur, department_id=other, name="C", lat=23.2, lon=72.2)

    assert [c.name for c in list_cameras(cur, department_id=department)] == ["A", "B"]
    assert [c.name for c in list_cameras(cur, status="active")] == ["A", "C"]
    assert count_cameras(cur, department_id=department) == 2


def test_list_paginates(cur, department):
    for i in range(5):
        create_camera(cur, department_id=department, name=f"C{i}", lat=23.0, lon=72.0)
    page = list_cameras(cur, limit=2, offset=2)
    assert [c.name for c in page] == ["C2", "C3"]
```

- [ ] **Step 3: Run it and watch it fail**

```bash
uv run pytest tests/test_cameras.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.registry.cameras'`.

- [ ] **Step 4: Write the implementation**

`src/registry/models.py`:

```python
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Camera:
    id: int
    department_id: int
    name: str
    lat: float
    lon: float
    kind: str
    status: str
    external_ref: str | None = None
    address: str | None = None
    vendor: str | None = None
    model: str | None = None
    rtsp_url: str | None = None
    resolution: str | None = None
    fps: int | None = None
    storage: str = "unknown"
    retention_days: int | None = None
    last_seen_at: datetime | None = None


@dataclass(frozen=True)
class HealthCheck:
    camera_id: int
    checked_at: datetime
    reachable: bool
    latency_ms: int | None = None
    error: str | None = None
```

`src/registry/cameras.py`:

```python
from .models import Camera

# Enum columns are cast to text so the dataclass holds plain strings.
# ST_Y is latitude and ST_X is longitude; the cast to geometry is what exposes them.
COLUMNS = """
    id, department_id, name, external_ref, address, kind::text AS kind,
    vendor, model, rtsp_url, resolution, fps, storage::text AS storage,
    retention_days, status::text AS status, last_seen_at,
    ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lon
"""


def create_camera(
    cur, *, department_id: int, name: str, lat: float, lon: float,
    external_ref: str | None = None, address: str | None = None, kind: str = "ip",
    vendor: str | None = None, model: str | None = None, rtsp_url: str | None = None,
    resolution: str | None = None, fps: int | None = None, storage: str = "unknown",
    retention_days: int | None = None, status: str = "active",
) -> int:
    cur.execute(
        """
        INSERT INTO camera (department_id, name, geom, external_ref, address, kind,
                            vendor, model, rtsp_url, resolution, fps, storage,
                            retention_days, status)
        VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (department_id, name, lon, lat, external_ref, address, kind, vendor, model,
         rtsp_url, resolution, fps, storage, retention_days, status),
    )
    return cur.fetchone()["id"]


def get_camera(cur, camera_id: int) -> Camera | None:
    cur.execute(f"SELECT {COLUMNS} FROM camera WHERE id = %s", (camera_id,))
    row = cur.fetchone()
    return Camera(**row) if row else None


def list_cameras(cur, *, department_id: int | None = None, status: str | None = None,
                 limit: int = 100, offset: int = 0) -> list[Camera]:
    cur.execute(
        f"""
        SELECT {COLUMNS} FROM camera
        WHERE (%s::int IS NULL OR department_id = %s)
          AND (%s::text IS NULL OR status::text = %s)
        ORDER BY id
        LIMIT %s OFFSET %s
        """,
        (department_id, department_id, status, status, limit, offset),
    )
    return [Camera(**row) for row in cur.fetchall()]


def count_cameras(cur, *, department_id: int | None = None, status: str | None = None) -> int:
    cur.execute(
        """
        SELECT count(*) AS n FROM camera
        WHERE (%s::int IS NULL OR department_id = %s)
          AND (%s::text IS NULL OR status::text = %s)
        """,
        (department_id, department_id, status, status),
    )
    return cur.fetchone()["n"]
```

- [ ] **Step 5: Run the tests and watch them pass**

```bash
uv run pytest tests/test_cameras.py -v
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add migrations/002_department_camera.sql src/registry/models.py src/registry/cameras.py tests/test_cameras.py
git commit -m "feat: camera inventory schema and query layer"
```

---

### Task 3: CSV bulk import

**Files:**
- Create: `src/registry/importer.py`
- Test: `tests/test_importer.py`

**Interfaces:**
- Consumes: `create_camera` from Task 2.
- Produces: dataclass `ImportResult` with fields `inserted: int` and `errors: list[tuple[int, str]]` (line number, message). Function `import_csv(cur, department_id: int, text: str) -> ImportResult`. Raises `ValueError` when required headers are missing.

Departments will hand over spreadsheets with wrong column order, blank rows,
and coordinates swapped. One bad row must not lose the other forty-nine, so
each row inserts inside its own savepoint.

- [ ] **Step 1: Write the failing test**

`tests/test_importer.py`:

```python
import pytest

from src.registry.cameras import count_cameras, list_cameras
from src.registry.importer import import_csv

GOOD = """name,lat,lon,vendor,external_ref
Sector 18 Junction,23.2156,72.6369,Hikvision,POL-001
Bus Depot Gate,23.2201,72.6410,Dahua,POL-002
"""


def test_imports_every_valid_row(cur, department):
    result = import_csv(cur, department, GOOD)
    assert result.inserted == 2
    assert result.errors == []
    assert count_cameras(cur, department_id=department) == 2
    assert list_cameras(cur)[0].vendor == "Hikvision"


def test_headers_are_case_and_space_insensitive(cur, department):
    result = import_csv(cur, department, " NAME , Lat , LON \nA,23.0,72.0\n")
    assert result.inserted == 1


def test_missing_required_header_raises(cur, department):
    with pytest.raises(ValueError, match="lon"):
        import_csv(cur, department, "name,lat\nA,23.0\n")


def test_bad_row_is_reported_and_others_still_import(cur, department):
    csv_text = (
        "name,lat,lon\n"
        "Good One,23.0,72.0\n"
        "Bad Coords,999,72.0\n"
        "Empty Name,,72.0\n"
        "Good Two,23.1,72.1\n"
    )
    result = import_csv(cur, department, csv_text)
    assert result.inserted == 2
    assert [line for line, _ in result.errors] == [3, 4]
    assert "out of range" in result.errors[0][1]


def test_duplicate_external_ref_is_reported_not_fatal(cur, department):
    csv_text = (
        "name,lat,lon,external_ref\n"
        "First,23.0,72.0,POL-001\n"
        "Duplicate,23.1,72.1,POL-001\n"
        "Third,23.2,72.2,POL-003\n"
    )
    result = import_csv(cur, department, csv_text)
    assert result.inserted == 2
    assert [line for line, _ in result.errors] == [3]
```

- [ ] **Step 2: Run it and watch it fail**

```bash
uv run pytest tests/test_importer.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.registry.importer'`.

- [ ] **Step 3: Write the implementation**

`src/registry/importer.py`:

```python
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
        fps = row.get("fps")
        if fps:
            extras["fps"] = int(fps) if fps.isdigit() else None
        retention = row.get("retention_days")
        if retention:
            extras["retention_days"] = int(retention) if retention.isdigit() else None

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
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
uv run pytest tests/test_importer.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/registry/importer.py tests/test_importer.py
git commit -m "feat: csv bulk import with per-row error reporting"
```

---

### Task 4: GeoJSON feed and coverage gap analysis

**Files:**
- Create: `src/registry/geo.py`
- Test: `tests/test_geo.py`

**Interfaces:**
- Consumes: `create_camera` from Task 2.
- Produces: `cameras_geojson(cur, *, department_id=None) -> dict` returning a GeoJSON FeatureCollection. `coverage_gaps(cur, *, min_lon, min_lat, max_lon, max_lat, cell_m=500, radius_m=300) -> list[dict]` returning one GeoJSON Polygon per uncovered grid cell.

Gap analysis is the requirement that separates a registry from a spreadsheet.
The grid is built in EPSG:3857 because `ST_SquareGrid` measures in the units of
its input SRS, and degrees are not a distance.

- [ ] **Step 1: Write the failing test**

`tests/test_geo.py`:

```python
from src.registry.cameras import create_camera
from src.registry.geo import cameras_geojson, coverage_gaps


def test_geojson_shape_and_properties(cur, department):
    create_camera(cur, department_id=department, name="Sector 18", lat=23.2156, lon=72.6369)
    fc = cameras_geojson(cur)
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 1
    feature = fc["features"][0]
    assert feature["geometry"]["type"] == "Point"
    assert feature["geometry"]["coordinates"][0] == 72.6369  # longitude first
    assert feature["properties"]["name"] == "Sector 18"
    assert feature["properties"]["status"] == "active"


def test_geojson_is_empty_collection_not_null(cur):
    fc = cameras_geojson(cur)
    assert fc["features"] == []


def test_geojson_filters_by_department(cur, department):
    cur.execute("INSERT INTO department (code, name) VALUES ('MUN', 'Municipal') RETURNING id")
    other = cur.fetchone()["id"]
    create_camera(cur, department_id=department, name="Police cam", lat=23.0, lon=72.0)
    create_camera(cur, department_id=other, name="Municipal cam", lat=23.1, lon=72.1)
    fc = cameras_geojson(cur, department_id=other)
    assert [f["properties"]["name"] for f in fc["features"]] == ["Municipal cam"]


def test_empty_area_is_entirely_gaps(cur):
    gaps = coverage_gaps(cur, min_lon=72.60, min_lat=23.20, max_lon=72.61, max_lat=23.21,
                         cell_m=500, radius_m=300)
    assert len(gaps) > 0
    assert gaps[0]["type"] == "Polygon"


def test_a_camera_removes_the_cell_it_covers(cur, department):
    box = dict(min_lon=72.60, min_lat=23.20, max_lon=72.61, max_lat=23.21)
    before = len(coverage_gaps(cur, cell_m=500, radius_m=1000, **box))
    create_camera(cur, department_id=department, name="Centre", lat=23.205, lon=72.605)
    after = len(coverage_gaps(cur, cell_m=500, radius_m=1000, **box))
    assert after < before


def test_inactive_cameras_do_not_count_as_coverage(cur, department):
    box = dict(min_lon=72.60, min_lat=23.20, max_lon=72.61, max_lat=23.21)
    baseline = len(coverage_gaps(cur, cell_m=500, radius_m=1000, **box))
    create_camera(cur, department_id=department, name="Broken", lat=23.205, lon=72.605,
                  status="decommissioned")
    assert len(coverage_gaps(cur, cell_m=500, radius_m=1000, **box)) == baseline
```

- [ ] **Step 2: Run it and watch it fail**

```bash
uv run pytest tests/test_geo.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.registry.geo'`.

- [ ] **Step 3: Write the implementation**

`src/registry/geo.py`:

```python
def cameras_geojson(cur, *, department_id: int | None = None) -> dict:
    """COALESCE keeps the return shape stable when no camera matches; without it
    json_agg returns NULL and the frontend has to special-case it."""
    cur.execute(
        """
        SELECT json_build_object(
          'type', 'FeatureCollection',
          'features', COALESCE(json_agg(
            json_build_object(
              'type', 'Feature',
              'geometry', ST_AsGeoJSON(geom)::json,
              'properties', json_build_object(
                'id', id,
                'name', name,
                'status', status::text,
                'kind', kind::text,
                'vendor', vendor,
                'department_id', department_id,
                'last_seen_at', last_seen_at
              )
            ) ORDER BY id), '[]'::json)
        ) AS fc
        FROM camera
        WHERE (%s::int IS NULL OR department_id = %s)
        """,
        (department_id, department_id),
    )
    return cur.fetchone()["fc"]


def coverage_gaps(cur, *, min_lon: float, min_lat: float, max_lon: float, max_lat: float,
                  cell_m: int = 500, radius_m: int = 300) -> list[dict]:
    """Grid cells whose centre has no active camera within radius_m.

    The grid is generated in EPSG:3857 so cell_m is metres. Distance is measured
    back in 4326 geography, which is accurate on the sphere.
    """
    cur.execute(
        """
        WITH bbox AS (
          SELECT ST_Transform(ST_MakeEnvelope(%(min_lon)s, %(min_lat)s,
                                              %(max_lon)s, %(max_lat)s, 4326), 3857) AS g
        ),
        grid AS (
          SELECT (ST_SquareGrid(%(cell_m)s, (SELECT g FROM bbox))).geom AS cell
        )
        SELECT ST_AsGeoJSON(ST_Transform(cell, 4326))::json AS cell
        FROM grid
        WHERE NOT EXISTS (
          SELECT 1 FROM camera c
          WHERE c.status = 'active'
            AND ST_DWithin(
                  c.geom,
                  ST_Transform(ST_Centroid(cell), 4326)::geography,
                  %(radius_m)s)
        )
        ORDER BY ST_YMin(cell), ST_XMin(cell)
        """,
        {"min_lon": min_lon, "min_lat": min_lat, "max_lon": max_lon, "max_lat": max_lat,
         "cell_m": cell_m, "radius_m": radius_m},
    )
    return [row["cell"] for row in cur.fetchall()]
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
uv run pytest tests/test_geo.py -v
```

Expected: 6 passed. If `ST_SquareGrid` raises "function does not exist", the container is not PostGIS 3.1+; check the image tag in `docker-compose.yml`.

- [ ] **Step 5: Commit**

```bash
git add src/registry/geo.py tests/test_geo.py
git commit -m "feat: geojson camera feed and postgis coverage gap analysis"
```

---

### Task 5: Health probe and history

**Files:**
- Create: `migrations/003_camera_health.sql`
- Create: `src/registry/health.py`, `workers/health_probe.py`
- Test: `tests/test_health.py`

**Interfaces:**
- Consumes: `create_camera`, `cursor()`.
- Produces: `probe(url: str, timeout: float = 3.0) -> tuple[bool, int | None, str | None]` returning (reachable, latency_ms, error). `record_check(cur, camera_id, reachable, latency_ms=None, error=None) -> None`. `latest_health(cur, camera_id) -> HealthCheck | None`. `health_summary(cur) -> dict` with keys `total`, `reachable`, `unreachable`, `unknown`.

A TCP connect to the RTSP port is the cheapest signal that separates a live
camera from a dead one. It does not prove video decodes, which is what the
ingest milestone will check with `ffprobe`. Do not build that here.

- [ ] **Step 1: Write the migration**

`migrations/003_camera_health.sql`:

```sql
CREATE TABLE camera_health (
  id         bigserial PRIMARY KEY,
  camera_id  integer NOT NULL REFERENCES camera(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  reachable  boolean NOT NULL,
  latency_ms integer,
  error      text
);

CREATE INDEX camera_health_recent_idx ON camera_health (camera_id, checked_at DESC);
```

- [ ] **Step 2: Write the failing test**

`tests/test_health.py`:

```python
import socket
import threading

from src.registry.cameras import create_camera, get_camera
from src.registry.health import health_summary, latest_health, probe, record_check


def _listening_port() -> int:
    """A real socket beats mocking: it proves the probe does TCP, not that we
    called a function."""
    server = socket.socket()
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    port = server.getsockname()[1]
    threading.Thread(target=lambda: server.accept(), daemon=True).start()
    return port


def test_probe_reports_reachable_for_an_open_port():
    reachable, latency_ms, error = probe(f"rtsp://127.0.0.1:{_listening_port()}/stream")
    assert reachable is True
    assert latency_ms is not None and latency_ms >= 0
    assert error is None


def test_probe_reports_unreachable_for_a_closed_port():
    reachable, latency_ms, error = probe("rtsp://127.0.0.1:1/stream", timeout=0.5)
    assert reachable is False
    assert latency_ms is None
    assert error


def test_probe_rejects_a_url_with_no_host():
    reachable, _, error = probe("not-a-url")
    assert reachable is False
    assert "host" in error


def test_recording_a_check_updates_last_seen(cur, department):
    camera_id = create_camera(cur, department_id=department, name="A", lat=23.0, lon=72.0)
    record_check(cur, camera_id, reachable=True, latency_ms=12)
    assert latest_health(cur, camera_id).reachable is True
    assert get_camera(cur, camera_id).last_seen_at is not None


def test_failed_check_does_not_update_last_seen(cur, department):
    camera_id = create_camera(cur, department_id=department, name="A", lat=23.0, lon=72.0)
    record_check(cur, camera_id, reachable=False, error="timed out")
    assert latest_health(cur, camera_id).reachable is False
    assert get_camera(cur, camera_id).last_seen_at is None


def test_summary_counts_never_checked_as_unknown(cur, department):
    up = create_camera(cur, department_id=department, name="Up", lat=23.0, lon=72.0)
    down = create_camera(cur, department_id=department, name="Down", lat=23.1, lon=72.1)
    create_camera(cur, department_id=department, name="Never", lat=23.2, lon=72.2)
    record_check(cur, up, reachable=True, latency_ms=5)
    record_check(cur, down, reachable=False, error="refused")

    assert health_summary(cur) == {"total": 3, "reachable": 1, "unreachable": 1, "unknown": 1}
```

- [ ] **Step 3: Run it and watch it fail**

```bash
uv run pytest tests/test_health.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.registry.health'`.

- [ ] **Step 4: Write the implementation**

`src/registry/health.py`:

```python
import socket
import time
from urllib.parse import urlparse

from .models import HealthCheck

DEFAULT_RTSP_PORT = 554


def probe(url: str, timeout: float = 3.0) -> tuple[bool, int | None, str | None]:
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
```

`workers/health_probe.py`:

```python
"""Probe every active camera on a fixed interval. Run from the repo root as a module: uv run python -m workers.health_probe"""
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
```

- [ ] **Step 5: Run the tests and watch them pass**

```bash
uv run pytest tests/test_health.py -v
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add migrations/003_camera_health.sql src/registry/health.py workers/health_probe.py tests/test_health.py
git commit -m "feat: tcp reachability probe, health history, summary counts"
```

---

### Task 6: Accounts, roles, and tokens

**Files:**
- Create: `migrations/004_users.sql`
- Create: `src/registry/auth.py`
- Test: `tests/test_auth.py`

**Interfaces:**
- Consumes: `load_settings()` from Task 1.
- Produces: `hash_password(plain) -> str`, `verify_password(plain, hashed) -> bool`, `issue_token(*, user_id, role, department_id) -> str`, `decode_token(token) -> dict` raising `jwt.PyJWTError` when invalid, `create_user(cur, *, email, password, role, department_id=None) -> int`, `authenticate(cur, email, password) -> dict | None` returning `{"id", "email", "role", "department_id"}`, `may_write(claims, department_id) -> bool`.

Three roles. `viewer` reads everything and writes nothing. `dept_admin` writes
only inside its own department. `state_admin` writes anywhere. Keep the rule in
one function so the API layer cannot drift from it.

- [ ] **Step 1: Write the migration**

`migrations/004_users.sql`:

```sql
CREATE TYPE user_role AS ENUM ('viewer', 'dept_admin', 'state_admin');

CREATE TABLE app_user (
  id            serial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          user_role NOT NULL DEFAULT 'viewer',
  department_id integer REFERENCES department(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Write the failing test**

`tests/test_auth.py`:

```python
import jwt
import pytest

from src.registry.auth import (
    authenticate, create_user, decode_token, hash_password, issue_token,
    may_write, verify_password,
)


def test_password_hash_is_salted_and_verifies():
    a, b = hash_password("correct horse"), hash_password("correct horse")
    assert a != b  # distinct salts
    assert verify_password("correct horse", a)
    assert not verify_password("wrong horse", a)


def test_token_round_trips_claims():
    claims = decode_token(issue_token(user_id=7, role="dept_admin", department_id=3))
    assert claims["sub"] == "7"
    assert claims["role"] == "dept_admin"
    assert claims["dept"] == 3


def test_token_signed_with_another_secret_is_rejected():
    forged = jwt.encode({"sub": "1", "role": "state_admin"}, "not-our-secret", algorithm="HS256")
    with pytest.raises(jwt.PyJWTError):
        decode_token(forged)


def test_authenticate_returns_the_user_on_correct_password(cur, department):
    create_user(cur, email="a@gujarat.gov.in", password="s3cret",
                role="dept_admin", department_id=department)
    user = authenticate(cur, "a@gujarat.gov.in", "s3cret")
    assert user["role"] == "dept_admin"
    assert user["department_id"] == department


def test_authenticate_returns_none_on_bad_password_or_unknown_email(cur):
    create_user(cur, email="b@gujarat.gov.in", password="s3cret", role="viewer")
    assert authenticate(cur, "b@gujarat.gov.in", "wrong") is None
    assert authenticate(cur, "nobody@gujarat.gov.in", "s3cret") is None


@pytest.mark.parametrize(
    "role, own_dept, target_dept, expected",
    [
        ("state_admin", None, 5, True),
        ("dept_admin", 5, 5, True),
        ("dept_admin", 5, 6, False),
        ("viewer", 5, 5, False),
    ],
)
def test_write_permission_rules(role, own_dept, target_dept, expected):
    claims = {"role": role, "dept": own_dept}
    assert may_write(claims, target_dept) is expected
```

- [ ] **Step 3: Run it and watch it fail**

```bash
uv run pytest tests/test_auth.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.registry.auth'`.

- [ ] **Step 4: Write the implementation**

`src/registry/auth.py`:

```python
import datetime

import bcrypt
import jwt

from .config import load_settings


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def issue_token(*, user_id: int, role: str, department_id: int | None) -> str:
    settings = load_settings()
    now = datetime.datetime.now(datetime.UTC)
    return jwt.encode(
        {
            "sub": str(user_id),
            "role": role,
            "dept": department_id,
            "iat": now,
            "exp": now + datetime.timedelta(seconds=settings.jwt_ttl_seconds),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, load_settings().jwt_secret, algorithms=["HS256"])


def create_user(cur, *, email: str, password: str, role: str = "viewer",
                department_id: int | None = None) -> int:
    cur.execute(
        "INSERT INTO app_user (email, password_hash, role, department_id)"
        " VALUES (%s, %s, %s, %s) RETURNING id",
        (email, hash_password(password), role, department_id),
    )
    return cur.fetchone()["id"]


def authenticate(cur, email: str, password: str) -> dict | None:
    cur.execute(
        "SELECT id, email, password_hash, role::text AS role, department_id"
        " FROM app_user WHERE email = %s",
        (email,),
    )
    row = cur.fetchone()
    if not row or not verify_password(password, row["password_hash"]):
        return None
    return {"id": row["id"], "email": row["email"], "role": row["role"],
            "department_id": row["department_id"]}


def may_write(claims: dict, department_id: int | None) -> bool:
    """The single source of truth for write permission. The API layer must not
    reimplement any part of this."""
    role = claims.get("role")
    if role == "state_admin":
        return True
    if role == "dept_admin":
        return department_id is not None and claims.get("dept") == department_id
    return False
```

- [ ] **Step 5: Run the tests and watch them pass**

```bash
uv run pytest tests/test_auth.py -v
```

Expected: 9 passed (the parametrised case counts as 4).

- [ ] **Step 6: Commit**

```bash
git add migrations/004_users.sql src/registry/auth.py tests/test_auth.py
git commit -m "feat: accounts, bcrypt hashing, jwt tokens, role rules"
```

---

### Task 7: HTTP API

**Files:**
- Create: `src/registry/api.py`
- Test: `tests/test_api.py`

**Interfaces:**
- Consumes: everything from Tasks 2 through 6.
- Produces: a FastAPI `app`. Routes: `POST /auth/login`, `GET /departments`, `GET /cameras`, `POST /cameras`, `GET /cameras/{id}`, `POST /cameras/import`, `GET /cameras/{id}/health`, `GET /health/summary`, `GET /geo/cameras.geojson`, `GET /geo/gaps`.

- [ ] **Step 1: Write the failing test**

`tests/test_api.py`:

```python
import pytest
from fastapi.testclient import TestClient

from src.registry.api import app, get_cursor
from src.registry.auth import create_user


@pytest.fixture
def client(cur, department):
    """Override the request-scoped cursor with the test transaction so API calls
    and assertions share one rolled-back transaction."""
    app.dependency_overrides[get_cursor] = lambda: cur
    create_user(cur, email="dept@gujarat.gov.in", password="pw",
                role="dept_admin", department_id=department)
    create_user(cur, email="view@gujarat.gov.in", password="pw", role="viewer")
    yield TestClient(app)
    app.dependency_overrides.clear()


def token(client, email):
    response = client.post("/auth/login", json={"email": email, "password": "pw"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_login_rejects_a_bad_password(client):
    response = client.post("/auth/login",
                           json={"email": "dept@gujarat.gov.in", "password": "nope"})
    assert response.status_code == 401


def test_listing_cameras_requires_a_token(client):
    assert client.get("/cameras").status_code == 401


def test_dept_admin_creates_a_camera_and_reads_it_back(client, department):
    headers = token(client, "dept@gujarat.gov.in")
    created = client.post("/cameras", headers=headers, json={
        "department_id": department, "name": "Sector 18", "lat": 23.2156, "lon": 72.6369,
    })
    assert created.status_code == 201
    camera_id = created.json()["id"]

    fetched = client.get(f"/cameras/{camera_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Sector 18"
    assert fetched.json()["lat"] == pytest.approx(23.2156, abs=1e-6)


def test_viewer_cannot_create_a_camera(client, department):
    response = client.post("/cameras", headers=token(client, "view@gujarat.gov.in"),
                           json={"department_id": department, "name": "X",
                                 "lat": 23.0, "lon": 72.0})
    assert response.status_code == 403


def test_dept_admin_cannot_write_to_another_department(client, cur):
    cur.execute("INSERT INTO department (code, name) VALUES ('HLT', 'Health') RETURNING id")
    other = cur.fetchone()["id"]
    response = client.post("/cameras", headers=token(client, "dept@gujarat.gov.in"),
                           json={"department_id": other, "name": "X", "lat": 23.0, "lon": 72.0})
    assert response.status_code == 403


def test_missing_camera_returns_404(client):
    assert client.get("/cameras/999999", headers=token(client, "view@gujarat.gov.in")).status_code == 404


def test_csv_import_reports_inserted_and_errors(client, department):
    csv_text = "name,lat,lon\nGood,23.0,72.0\nBad,999,72.0\n"
    response = client.post(
        "/cameras/import",
        headers=token(client, "dept@gujarat.gov.in"),
        data={"department_id": str(department)},
        files={"file": ("cams.csv", csv_text, "text/csv")},
    )
    assert response.status_code == 200
    assert response.json()["inserted"] == 1
    assert response.json()["errors"] == [{"line": 3, "message": "coordinates out of range: 999.0, 72.0"}]


def test_geojson_endpoint_returns_a_feature_collection(client, department):
    headers = token(client, "dept@gujarat.gov.in")
    client.post("/cameras", headers=headers, json={
        "department_id": department, "name": "A", "lat": 23.0, "lon": 72.0})
    body = client.get("/geo/cameras.geojson", headers=headers).json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 1


def test_gaps_endpoint_returns_polygons(client):
    response = client.get(
        "/geo/gaps",
        headers=token(client, "view@gujarat.gov.in"),
        params={"min_lon": 72.60, "min_lat": 23.20, "max_lon": 72.61, "max_lat": 23.21,
                "cell_m": 500, "radius_m": 300},
    )
    assert response.status_code == 200
    assert response.json()["cells"][0]["type"] == "Polygon"
```

- [ ] **Step 2: Run it and watch it fail**

```bash
uv run pytest tests/test_api.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'src.registry.api'`.

- [ ] **Step 3: Write the implementation**

`src/registry/api.py`:

```python
import jwt
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from . import cameras as camera_queries
from . import geo, health
from .auth import authenticate, decode_token, issue_token, may_write
from .db import pool
from .importer import import_csv

app = FastAPI(title="Sentinel CCTV Registry")
app.add_middleware(
    CORSMiddleware, allow_origins=["http://localhost:5173"],
    allow_methods=["*"], allow_headers=["*"],
)
bearer = HTTPBearer(auto_error=False)


def get_cursor():
    """Overridden in tests to hand back the rolled-back test transaction."""
    with pool().connection() as conn:
        from psycopg.rows import dict_row
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur


def claims(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="missing bearer token")
    try:
        return decode_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid token")


class LoginBody(BaseModel):
    email: str
    password: str


class CameraBody(BaseModel):
    department_id: int
    name: str = Field(min_length=1)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    external_ref: str | None = None
    address: str | None = None
    kind: str = "ip"
    vendor: str | None = None
    model: str | None = None
    rtsp_url: str | None = None
    resolution: str | None = None
    fps: int | None = None
    storage: str = "unknown"
    retention_days: int | None = None
    status: str = "active"


@app.post("/auth/login")
def login(body: LoginBody, cur=Depends(get_cursor)):
    user = authenticate(cur, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="invalid credentials")
    token = issue_token(user_id=user["id"], role=user["role"],
                        department_id=user["department_id"])
    return {"access_token": token, "token_type": "bearer", "role": user["role"],
            "department_id": user["department_id"]}


@app.get("/departments")
def departments(cur=Depends(get_cursor), _=Depends(claims)):
    cur.execute("SELECT id, code, name FROM department ORDER BY name")
    return cur.fetchall()


@app.get("/cameras")
def list_cameras(department_id: int | None = None, status: str | None = None,
                 limit: int = 100, offset: int = 0,
                 cur=Depends(get_cursor), _=Depends(claims)):
    rows = camera_queries.list_cameras(cur, department_id=department_id, status=status,
                                       limit=min(limit, 500), offset=offset)
    return {"total": camera_queries.count_cameras(cur, department_id=department_id,
                                                  status=status),
            "items": [vars(row) for row in rows]}


@app.post("/cameras", status_code=201)
def create_camera(body: CameraBody, cur=Depends(get_cursor), user=Depends(claims)):
    if not may_write(user, body.department_id):
        raise HTTPException(status_code=403, detail="not permitted for this department")
    return {"id": camera_queries.create_camera(cur, **body.model_dump())}


@app.get("/cameras/{camera_id}")
def get_camera(camera_id: int, cur=Depends(get_cursor), _=Depends(claims)):
    camera = camera_queries.get_camera(cur, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="no such camera")
    return vars(camera)


@app.post("/cameras/import")
def import_cameras(department_id: int = Form(...), file: UploadFile = File(...),
                   cur=Depends(get_cursor), user=Depends(claims)):
    if not may_write(user, department_id):
        raise HTTPException(status_code=403, detail="not permitted for this department")
    try:
        result = import_csv(cur, department_id, file.file.read().decode("utf-8-sig"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"inserted": result.inserted,
            "errors": [{"line": line, "message": message} for line, message in result.errors]}


@app.get("/cameras/{camera_id}/health")
def camera_health(camera_id: int, cur=Depends(get_cursor), _=Depends(claims)):
    check = health.latest_health(cur, camera_id)
    return vars(check) if check else {"camera_id": camera_id, "reachable": None}


@app.get("/health/summary")
def health_totals(cur=Depends(get_cursor), _=Depends(claims)):
    return health.health_summary(cur)


@app.get("/geo/cameras.geojson")
def cameras_geojson(department_id: int | None = None,
                    cur=Depends(get_cursor), _=Depends(claims)):
    return geo.cameras_geojson(cur, department_id=department_id)


@app.get("/geo/gaps")
def gaps(min_lon: float, min_lat: float, max_lon: float, max_lat: float,
         cell_m: int = 500, radius_m: int = 300,
         cur=Depends(get_cursor), _=Depends(claims)):
    return {"cells": geo.coverage_gaps(cur, min_lon=min_lon, min_lat=min_lat,
                                       max_lon=max_lon, max_lat=max_lat,
                                       cell_m=cell_m, radius_m=radius_m)}
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
uv run pytest tests/test_api.py -v
```

Expected: 9 passed.

- [ ] **Step 5: Run the whole suite**

```bash
uv run pytest -v
```

Expected: 41 passed. Nothing from earlier tasks should have broken.

- [ ] **Step 6: Seed a demo account and start the server**

```bash
uv run python -c "
from src.registry.db import cursor
from src.registry.auth import create_user
with cursor() as cur:
    cur.execute(\"INSERT INTO department (code, name) VALUES ('POL','Police') ON CONFLICT (code) DO NOTHING RETURNING id\")
    row = cur.fetchone()
    cur.execute(\"SELECT id FROM department WHERE code='POL'\")
    dept = cur.fetchone()['id']
    create_user(cur, email='admin@gujarat.gov.in', password='sentinel', role='state_admin', department_id=dept)
    print('seeded department', dept)
"
uv run uvicorn src.registry.api:app --reload --port 8000
```

Check `http://localhost:8000/docs` renders every route.

- [ ] **Step 7: Commit**

```bash
git add src/registry/api.py tests/test_api.py
git commit -m "feat: rest api for registry, import, geo, health with rbac"
```

---

### Task 8: Frontend shell, map, and camera table

**Files:**
- Create: `web/package.json`, `web/vite.config.js`, `web/index.html`
- Create: `web/src/main.jsx`, `web/src/api.js`, `web/src/App.jsx`
- Create: `web/src/components/CameraMap.jsx`, `web/src/components/CameraTable.jsx`
- Test: `web/src/api.test.js`

**Interfaces:**
- Consumes: the HTTP API from Task 7.
- Produces: `api.js` exporting `login(email, password) -> {access_token, role, department_id}`, `setToken(t)`, `getToken()`, `request(path, options)`, `fetchDepartments()`, `fetchCameras(params)`, `fetchCamera(id)`, `fetchGeoJSON(params)`, `fetchGaps(bbox)`, `fetchHealthSummary()`, `importCsv(departmentId, file)`.

Leaflet renders to a real DOM node and is painful to assert against, so the
tests cover the API client where the logic actually lives. Map behaviour is
verified by hand in Step 6.

- [ ] **Step 1: Scaffold the app**

```bash
mkdir -p web/src/components
cd web
npm create vite@latest . -- --template react
npm install leaflet react-leaflet
npm install -D vitest jsdom
cd ..
```

Replace the generated `web/package.json` scripts block with:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Write the failing test**

`web/src/api.test.js`:

```javascript
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGaps, login, request, setToken } from './api'

afterEach(() => {
  setToken(null)
  vi.unstubAllGlobals()
})

function stubFetch(body, ok = true, status = 200) {
  const spy = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('api client', () => {
  it('stores the token returned by login', async () => {
    stubFetch({ access_token: 'abc', role: 'viewer', department_id: null })
    const result = await login('a@b.in', 'pw')
    expect(result.access_token).toBe('abc')
  })

  it('sends the bearer header once a token is set', async () => {
    const spy = stubFetch({ items: [] })
    setToken('abc')
    await request('/cameras')
    expect(spy.mock.calls[0][1].headers.Authorization).toBe('Bearer abc')
  })

  it('omits the bearer header when there is no token', async () => {
    const spy = stubFetch({ items: [] })
    await request('/cameras')
    expect(spy.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('throws with the status on a failed response', async () => {
    stubFetch({ detail: 'nope' }, false, 403)
    await expect(request('/cameras')).rejects.toThrow('403')
  })

  it('serialises a bbox into gap query parameters', async () => {
    const spy = stubFetch({ cells: [] })
    await fetchGaps({ minLon: 72.6, minLat: 23.2, maxLon: 72.7, maxLat: 23.3, cellM: 500, radiusM: 300 })
    const url = spy.mock.calls[0][0]
    expect(url).toContain('min_lon=72.6')
    expect(url).toContain('cell_m=500')
    expect(url).toContain('radius_m=300')
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

```bash
cd web && npm test
```

Expected: FAIL, cannot resolve `./api`.

- [ ] **Step 4: Write the implementation**

`web/src/api.js`:

```javascript
const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

let token = null
export const setToken = (t) => { token = t }
export const getToken = () => token

export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body instanceof FormData) delete headers['Content-Type']

  const response = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!response.ok) throw new Error(`${response.status} ${path}`)
  return response.json()
}

export async function login(email, password) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(result.access_token)
  return result
}

const query = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined),
  ).toString()

export const fetchDepartments = () => request('/departments')

export const fetchCameras = ({ departmentId = null, status = null, limit = 200, offset = 0 } = {}) =>
  request(`/cameras?${query({ department_id: departmentId, status, limit, offset })}`)

export const fetchCamera = (id) => request(`/cameras/${id}`)

export const fetchGeoJSON = ({ departmentId = null } = {}) =>
  request(`/geo/cameras.geojson?${query({ department_id: departmentId })}`)

export const fetchGaps = ({ minLon, minLat, maxLon, maxLat, cellM = 500, radiusM = 300 }) =>
  request(`/geo/gaps?${query({
    min_lon: minLon, min_lat: minLat, max_lon: maxLon, max_lat: maxLat,
    cell_m: cellM, radius_m: radiusM,
  })}`)

export const fetchHealthSummary = () => request('/health/summary')

export function importCsv(departmentId, file) {
  const form = new FormData()
  form.append('department_id', String(departmentId))
  form.append('file', file)
  return request('/cameras/import', { method: 'POST', body: form })
}
```

`web/src/components/CameraMap.jsx`:

```jsx
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const STATUS_COLOUR = { active: '#16a34a', inactive: '#f59e0b', decommissioned: '#6b7280' }

export default function CameraMap({ geojson, centre = [23.2156, 72.6369], zoom = 12, onSelect, children }) {
  return (
    <MapContainer center={centre} zoom={zoom} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {(geojson?.features ?? []).map((feature) => {
        const [lon, lat] = feature.geometry.coordinates
        const { id, name, status, vendor } = feature.properties
        return (
          <CircleMarker
            key={id}
            center={[lat, lon]}
            radius={6}
            pathOptions={{ color: STATUS_COLOUR[status] ?? '#6b7280', fillOpacity: 0.85 }}
            eventHandlers={{ click: () => onSelect?.(id) }}
          >
            <Popup>
              <strong>{name}</strong>
              <br />
              {vendor ?? 'unknown vendor'} &middot; {status}
            </Popup>
          </CircleMarker>
        )
      })}
      {children}
    </MapContainer>
  )
}
```

`web/src/components/CameraTable.jsx`:

```jsx
export default function CameraTable({ cameras, onSelect, selectedId }) {
  if (cameras.length === 0) return <p style={{ padding: '1rem' }}>No cameras yet.</p>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr>
          {['Name', 'Vendor', 'Kind', 'Status'].map((h) => (
            <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cameras.map((camera) => (
          <tr
            key={camera.id}
            onClick={() => onSelect?.(camera.id)}
            style={{
              cursor: 'pointer',
              background: camera.id === selectedId ? '#eef2ff' : 'transparent',
            }}
          >
            <td style={{ padding: 6 }}>{camera.name}</td>
            <td style={{ padding: 6 }}>{camera.vendor ?? '—'}</td>
            <td style={{ padding: 6 }}>{camera.kind}</td>
            <td style={{ padding: 6 }}>{camera.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

`web/src/App.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { fetchCameras, fetchGeoJSON, login } from './api'
import CameraMap from './components/CameraMap'
import CameraTable from './components/CameraTable'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('admin@gujarat.gov.in')
  const [password, setPassword] = useState('sentinel')
  const [error, setError] = useState(null)
  const [cameras, setCameras] = useState([])
  const [geojson, setGeojson] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!authed) return
    Promise.all([fetchCameras(), fetchGeoJSON()])
      .then(([list, fc]) => { setCameras(list.items); setGeojson(fc) })
      .catch((e) => setError(e.message))
  }, [authed])

  async function submit(event) {
    event.preventDefault()
    setError(null)
    try {
      await login(email, password)
      setAuthed(true)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!authed) {
    return (
      <form onSubmit={submit} style={{ padding: 24, display: 'grid', gap: 8, maxWidth: 320 }}>
        <h1 style={{ fontSize: 20 }}>Sentinel Registry</h1>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)}
               type="password" placeholder="password" />
        <button type="submit">Sign in</button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </form>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: '100vh' }}>
      <aside style={{ overflowY: 'auto', borderRight: '1px solid #ddd' }}>
        <h1 style={{ fontSize: 18, padding: '12px 8px' }}>Cameras ({cameras.length})</h1>
        {error && <p style={{ color: 'crimson', padding: 8 }}>{error}</p>}
        <CameraTable cameras={cameras} onSelect={setSelectedId} selectedId={selectedId} />
      </aside>
      <main>
        <CameraMap geojson={geojson} onSelect={setSelectedId} />
      </main>
    </div>
  )
}
```

`web/src/main.jsx`:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 5: Run the tests and watch them pass**

```bash
cd web && npm test
```

Expected: 5 passed.

- [ ] **Step 6: Verify the map by hand**

With the API running from Task 7, Step 6:

```bash
cd web && npm run dev
```

Open `http://localhost:5173`, sign in with `admin@gujarat.gov.in` / `sentinel`. Confirm:
the sidebar lists cameras, the map shows a green dot per active camera near
Gandhinagar, and clicking a dot opens a popup with the camera name.

If the map is blank but the sidebar has rows, the usual cause is a missing
`leaflet/dist/leaflet.css` import or a container with no height.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "feat: registry frontend with leaflet map and camera table"
```

---

### Task 9: Health badges, gap overlay, and CSV upload

**Files:**
- Create: `web/src/components/CameraDetail.jsx`, `web/src/components/GapLayer.jsx`
- Modify: `web/src/App.jsx`
- Test: `web/src/gaps.test.js`

**Interfaces:**
- Consumes: `fetchGaps`, `fetchHealthSummary`, `fetchCamera`, `importCsv` from Task 8.
- Produces: `boundsToBbox(bounds) -> {minLon, minLat, maxLon, maxLat}` exported from `GapLayer.jsx`, and a `GapLayer` component rendering one `Polygon` per uncovered cell.

- [ ] **Step 1: Write the failing test**

`web/src/gaps.test.js`:

```javascript
import { describe, expect, it } from 'vitest'
import { boundsToBbox } from './components/GapLayer'

describe('boundsToBbox', () => {
  it('maps leaflet bounds onto the api parameter names', () => {
    const bounds = {
      getWest: () => 72.60, getSouth: () => 23.20,
      getEast: () => 72.70, getNorth: () => 23.30,
    }
    expect(boundsToBbox(bounds)).toEqual({
      minLon: 72.60, minLat: 23.20, maxLon: 72.70, maxLat: 23.30,
    })
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd web && npm test
```

Expected: FAIL, cannot resolve `./components/GapLayer`.

- [ ] **Step 3: Write the implementation**

`web/src/components/GapLayer.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Polygon, useMap, useMapEvents } from 'react-leaflet'
import { fetchGaps } from '../api'

export const boundsToBbox = (bounds) => ({
  minLon: bounds.getWest(),
  minLat: bounds.getSouth(),
  maxLon: bounds.getEast(),
  maxLat: bounds.getNorth(),
})

export default function GapLayer({ enabled, radiusM = 300, cellM = 500 }) {
  const map = useMap()
  const [cells, setCells] = useState([])

  async function reload() {
    if (!enabled) return setCells([])
    try {
      const { cells } = await fetchGaps({ ...boundsToBbox(map.getBounds()), cellM, radiusM })
      setCells(cells)
    } catch {
      setCells([])
    }
  }

  useMapEvents({ moveend: reload, zoomend: reload })
  useEffect(() => { reload() }, [enabled, radiusM, cellM])

  return cells.map((cell, index) => (
    <Polygon
      key={index}
      positions={cell.coordinates[0].map(([lon, lat]) => [lat, lon])}
      pathOptions={{ color: '#dc2626', weight: 1, fillOpacity: 0.18 }}
    />
  ))
}
```

`web/src/components/CameraDetail.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { fetchCamera, request } from '../api'

const LABEL = { true: 'reachable', false: 'unreachable', null: 'never checked' }
const COLOUR = { true: '#16a34a', false: '#dc2626', null: '#6b7280' }

export default function CameraDetail({ cameraId }) {
  const [camera, setCamera] = useState(null)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    if (!cameraId) return
    fetchCamera(cameraId).then(setCamera).catch(() => setCamera(null))
    request(`/cameras/${cameraId}/health`).then(setHealth).catch(() => setHealth(null))
  }, [cameraId])

  if (!cameraId) return null
  if (!camera) return <p style={{ padding: 8 }}>Loading…</p>

  const key = String(health?.reachable ?? null)
  return (
    <div style={{ padding: 8, borderTop: '1px solid #ddd' }}>
      <h2 style={{ fontSize: 16 }}>{camera.name}</h2>
      <p style={{ margin: '4px 0', color: COLOUR[key] }}>{LABEL[key]}
        {health?.latency_ms != null && ` · ${health.latency_ms} ms`}</p>
      <dl style={{ fontSize: 13, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px' }}>
        <dt>Vendor</dt><dd>{camera.vendor ?? '—'}</dd>
        <dt>Kind</dt><dd>{camera.kind}</dd>
        <dt>Retention</dt><dd>{camera.retention_days ?? '—'} days</dd>
        <dt>Coordinates</dt><dd>{camera.lat.toFixed(5)}, {camera.lon.toFixed(5)}</dd>
        <dt>RTSP</dt><dd style={{ wordBreak: 'break-all' }}>{camera.rtsp_url ?? '—'}</dd>
      </dl>
    </div>
  )
}
```

In `web/src/App.jsx`, add the imports and state, render the new pieces, and wire
the upload control. Add to the imports at the top:

```jsx
import { fetchCameras, fetchDepartments, fetchGeoJSON, fetchHealthSummary, importCsv, login } from './api'
import CameraDetail from './components/CameraDetail'
import GapLayer from './components/GapLayer'
```

Add this state next to the existing `useState` calls:

```jsx
const [summary, setSummary] = useState(null)
const [showGaps, setShowGaps] = useState(false)
const [importReport, setImportReport] = useState(null)
const [departmentId, setDepartmentId] = useState(null)
```

Replace the body of `submit` so the login response's department travels with the
session. A `state_admin` has no department of its own, so fall back to the first
one the API lists:

```jsx
  async function submit(event) {
    event.preventDefault()
    setError(null)
    try {
      const session = await login(email, password)
      const departments = await fetchDepartments()
      setDepartmentId(session.department_id ?? departments[0]?.id ?? null)
      setAuthed(true)
    } catch (e) {
      setError(e.message)
    }
  }
```

Extend the existing effect to also load the summary:

```jsx
  useEffect(() => {
    if (!authed) return
    Promise.all([fetchCameras(), fetchGeoJSON(), fetchHealthSummary()])
      .then(([list, fc, totals]) => { setCameras(list.items); setGeojson(fc); setSummary(totals) })
      .catch((e) => setError(e.message))
  }, [authed])
```

Add the upload handler above the `return`:

```jsx
  async function upload(event) {
    const file = event.target.files?.[0]
    if (!file || departmentId === null) return
    try {
      setImportReport(await importCsv(departmentId, file))
      const [list, fc] = await Promise.all([fetchCameras(), fetchGeoJSON()])
      setCameras(list.items)
      setGeojson(fc)
    } catch (e) {
      setError(e.message)
    }
  }
```

Replace the authed `return` block with:

```jsx
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: '100vh' }}>
      <aside style={{ overflowY: 'auto', borderRight: '1px solid #ddd' }}>
        <h1 style={{ fontSize: 18, padding: '12px 8px' }}>Cameras ({cameras.length})</h1>
        {summary && (
          <p style={{ padding: '0 8px', fontSize: 13 }}>
            {summary.reachable} up · {summary.unreachable} down · {summary.unknown} unchecked
          </p>
        )}
        <div style={{ padding: 8, display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showGaps}
                   onChange={(e) => setShowGaps(e.target.checked)} /> Show coverage gaps
          </label>
          <input type="file" accept=".csv" onChange={upload} disabled={departmentId === null} />
          {importReport && (
            <p style={{ fontSize: 13 }}>
              Imported {importReport.inserted}, {importReport.errors.length} rejected
            </p>
          )}
        </div>
        {error && <p style={{ color: 'crimson', padding: 8 }}>{error}</p>}
        <CameraTable cameras={cameras} onSelect={setSelectedId} selectedId={selectedId} />
        <CameraDetail cameraId={selectedId} />
      </aside>
      <main>
        <CameraMap geojson={geojson} onSelect={setSelectedId}>
          <GapLayer enabled={showGaps} />
        </CameraMap>
      </main>
    </div>
  )
```

- [ ] **Step 4: Run the tests and watch them pass**

```bash
cd web && npm test
```

Expected: 6 passed.

- [ ] **Step 5: Verify the full loop by hand**

With the API and the health worker running:

```bash
uv run python -m workers.health_probe &
cd web && npm run dev
```

Confirm: the sidebar shows up/down/unchecked counts; ticking "Show coverage
gaps" paints red squares over areas with no camera within 300 m, and the squares
refresh when the map is panned; uploading a CSV with one bad row reports
"Imported N, 1 rejected" and the new cameras appear on the map.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "feat: health badges, coverage gap overlay, csv upload"
```

---

## Definition of Done

The organisers' Model 1 requirements, each mapped to where it is satisfied:

| Requirement | Satisfied by |
|---|---|
| Camera inventory with metadata | Task 2 |
| Bulk import | Task 3, Task 9 |
| GIS mapping | Task 4, Task 8 |
| Health monitoring | Task 5, Task 9 |
| Gap analysis | Task 4, Task 9 |
| Role-based access | Task 6, Task 7 |

Run `uv run pytest` and `cd web && npm test`. Both suites green, and the manual
checks in Task 8 Step 6 and Task 9 Step 5 pass.

## What This Plan Deliberately Excludes

Live video, ANPR, watchlists, tracking, integrity fingerprinting, the policy
engine, and the agent tier. Each has its own plan. A registry that works is
worth more than four half-built layers, and Model 1 is scored on its own.
