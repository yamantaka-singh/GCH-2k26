# Sentinel — CCTV Registry & GIS Foundation

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20PostGIS%203.4-336791?style=flat-square&logo=postgresql&logoColor=white)](https://postgis.net)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com)
[![Tests](https://img.shields.io/badge/Tests-66%20Passing%20(60%20Pytest%20%7C%206%20Vitest)-brightgreen?style=flat-square&logo=pytest&logoColor=white)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](LICENSE)

A centralised camera registry with PostGIS-backed mapping, coverage gap analysis, CSV bulk import, health monitoring, and role-based access. Built for the [Gujarat Police Innovation Hackathon 2026](https://sentinel.gujarat.gov.in), where "Model 1" (a state-wide CCTV registry and GIS foundation) is a mandatory component of every submission track.

**What this repository contains, and what it doesn't:** every feature described below is implemented, tested, and runnable with the Quickstart steps. It does not stream video, run any computer vision, or make autonomous decisions. Those are a separate, larger proposal. See [Roadmap](#roadmap-not-implemented) for what that would take and why it's out of scope here.

- [Architecture](#architecture)
- [What's built](#whats-built)
- [Repository layout](#repository-layout)
- [Quickstart](#quickstart)
- [API reference](#api-reference)
- [Testing](#testing)
- [Roadmap (not implemented)](#roadmap-not-implemented)
- [License](#license)

---

## Architecture

```
                    ┌────────────────────────┐
  Browser ─────────▶│  React + Leaflet (web/) │
                    └───────────┬────────────┘
                                │ REST + JWT
                                ▼
                    ┌────────────────────────┐
                    │   FastAPI (src/registry) │
                    │   auth · cameras · geo   │
                    │   health · import        │
                    └───────────┬────────────┘
                                │ psycopg3
                                ▼
                    ┌────────────────────────┐
                    │  PostgreSQL 16 + PostGIS │
                    │  camera · department     │
                    │  camera_health · app_user │
                    └────────────────────────┘
                                ▲
                                │ TCP probe, every 60s
                    ┌────────────────────────┐
                    │ workers/health_probe.py │
                    └────────────────────────┘
```

A single FastAPI service backed by Postgres/PostGIS, a React frontend that talks to it over REST, and a background worker that probes each camera's RTSP port on a timer. No message queue, no streaming layer, no GPU. None of the pieces below need one.

## What's built

**Camera registry.** Create, list, fetch, and partially update cameras (department, vendor, coordinates, RTSP URL, retention policy, status). Decommissioning a camera is a status update (`status: "decommissioned"`), not a delete: health and sighting history stays attached to the row. Coordinates are stored as `geography(Point, 4326)` with a GiST index (`src/registry/cameras.py`, `migrations/002_department_camera.sql`).

**CSV bulk import.** Each row inserts inside its own savepoint, so one malformed row (bad coordinates, a non-numeric `fps`, a duplicate `external_ref`) is reported by line number and skipped, while every valid row in the same file still commits (`src/registry/importer.py`).

**Coverage gap analysis.** Given a bounding box, computes a grid over it in PostGIS (`ST_SquareGrid`, `ST_DWithin`, EPSG:3857) and returns every cell with no active camera within a given radius, as GeoJSON polygons the frontend overlays on the map (`src/registry/geo.py`). A cost check runs before the grid is built and refuses requests needing more than 10,000 cells, so an unbounded bounding box returns a fast, clear error instead of hanging.

**Health monitoring.** A background worker attempts a TCP connection to each active camera's RTSP port every 60 seconds and records reachability, latency, and error history. This confirms the port answers, not that the video decodes (`workers/health_probe.py`, `src/registry/health.py`).

**Role-based access.** Three roles (`viewer`, `dept_admin`, `state_admin`), with one function, `may_write()`, deciding every write permission in the system. Passwords are bcrypt-hashed; sessions are JWTs signed with a secret that must be at least 32 bytes, enforced at startup per RFC 7518 (`src/registry/auth.py`).

**Web console.** Sign in, view cameras on a Leaflet map and in a table, click through to per-camera health and metadata, toggle the coverage gap overlay, and upload a CSV (`web/src/`).

## Repository layout

```
GCH-2k26/
├── docker-compose.yml              # Postgres 16 + PostGIS 3.4, host port 55432
├── pyproject.toml                  # Python 3.12 deps: fastapi, psycopg3, pyjwt, bcrypt
├── .env.example                    # DATABASE_URL, JWT_SECRET
├── migrations/                     # Numbered SQL, applied in order by scripts/migrate.py
│   ├── 001_extensions.sql          # postgis
│   ├── 002_department_camera.sql   # department, camera (geography point + GiST)
│   ├── 003_camera_health.sql       # camera_health
│   └── 004_users.sql               # app_user, user_role enum
├── scripts/
│   ├── migrate.py                  # applies unapplied migrations, tracks in schema_migration
│   └── init_test_db.sh             # creates the registry_test database on first boot
├── src/registry/
│   ├── config.py                   # env → Settings; fails at boot on a missing/weak secret
│   ├── db.py                       # psycopg3 pool
│   ├── models.py                   # Camera, HealthCheck dataclasses
│   ├── cameras.py                  # create/get/list/count queries
│   ├── importer.py                 # CSV import, one savepoint per row
│   ├── geo.py                      # GeoJSON feed, gap-grid query, the 10,000-cell cap
│   ├── health.py                   # TCP probe, health history, summary counts
│   ├── auth.py                     # bcrypt, JWT, may_write()
│   └── api.py                      # the 11 routes
├── workers/
│   └── health_probe.py             # probes every active camera on a loop
├── tests/                          # 60 pytest tests, against real Postgres/PostGIS
└── web/                            # React 18 + Vite + Leaflet
    └── src/
        ├── App.jsx                 # login, layout, state
        ├── api.js                  # fetch wrapper + JWT header
        └── components/
            ├── CameraMap.jsx       # one CircleMarker per camera, coloured by status
            ├── CameraTable.jsx     # list ordered by id, click a row to select it; no search or virtualization
            ├── CameraDetail.jsx    # metadata + latest health for the selected camera
            └── GapLayer.jsx        # renders the gap polygons, shows the API's error if the area is too large
```

## Quickstart

Needs Docker, Python 3.12 (pinned via [uv](https://github.com/astral-sh/uv)), and Node 18+.

**1. Clone and configure**
```bash
git clone https://github.com/yamantaka-singh/GCH-2k26.git
cd GCH-2k26
cp .env.example .env
```

**2. Start Postgres**
```bash
docker compose up -d --wait
```

**3. Install and migrate**
```bash
uv sync
uv run python -m scripts.migrate
```

**4. Seed an admin account**
```bash
uv run python -c "
from src.registry.db import cursor
from src.registry.auth import create_user
with cursor() as cur:
    cur.execute(\"INSERT INTO department (code, name) VALUES ('POL', 'Police') ON CONFLICT (code) DO NOTHING\")
    cur.execute(\"SELECT id FROM department WHERE code='POL'\")
    dept_id = cur.fetchone()['id']
    create_user(cur, email='admin@gujarat.gov.in', password='sentinel', role='state_admin', department_id=dept_id)
    print(f'seeded state_admin, department {dept_id}')
"
```

**5. Run the API and the health worker**
```bash
uv run uvicorn src.registry.api:app --reload --port 8000    # terminal 1
uv run python -m workers.health_probe                        # terminal 2
```

**6. Run the frontend**
```bash
cd web
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173) and sign in with `admin@gujarat.gov.in` / `sentinel`; the form is pre-filled with these values. The API's interactive docs are at [localhost:8000/docs](http://localhost:8000/docs).

## API reference

All routes except `/auth/login` require `Authorization: Bearer <JWT>`.

| Method | Route | Access | Description |
|---|---|:---:|---|
| `POST` | `/auth/login` | Public | Returns a signed JWT for a valid email/password |
| `GET` | `/departments` | Authenticated | Lists departments |
| `GET` | `/cameras` | Authenticated | Lists cameras, filterable by department and status, paginated |
| `POST` | `/cameras` | `dept_admin`, `state_admin` | Creates a camera |
| `GET` | `/cameras/{id}` | Authenticated | Fetches one camera |
| `PATCH` | `/cameras/{id}` | `dept_admin`, `state_admin` | Updates only the fields sent; provide `lat` and `lon` together or not at all |
| `POST` | `/cameras/import` | `dept_admin`, `state_admin` | Multipart CSV upload, returns inserted count and per-row errors |
| `GET` | `/cameras/{id}/health` | Authenticated | Latest reachability check for one camera |
| `GET` | `/health/summary` | Authenticated | Counts of reachable / unreachable / unchecked across all cameras |
| `GET` | `/geo/cameras.geojson` | Authenticated | Cameras as a GeoJSON `FeatureCollection` |
| `GET` | `/geo/gaps` | Authenticated | Coverage gap polygons for a bounding box (`min_lon`, `min_lat`, `max_lon`, `max_lat`, `cell_m`, `radius_m`) |

## Testing

```bash
uv run pytest -v          # 60 tests, real Postgres/PostGIS, per-test transaction rollback
cd web && npm test        # 6 tests
cd web && npm run build   # production bundle
```

What's covered: PostGIS geometry round-trips and the gap-grid math against real coordinates, not mocks; CSV import isolation (one bad row doesn't block the others); every `may_write()` role combination; JWT round-trip, forged-signature rejection, and expiry; camera creation and update rejecting an invalid `kind`/`status`/`storage` value with a 422 before it reaches the database; a real bound TCP socket for the health probe, not a mock, including a full `sweep()` run against committed rows.

## Roadmap (not implemented)

This registry is the mandatory "Model 1" foundation. A separate design proposal, [`docs/superpowers/specs/2026-09-04-sentinel-design.md`](docs/superpowers/specs/2026-09-04-sentinel-design.md), describes what a "Model 5" hybrid submission would add on top of it: live RTSP ingest and ANPR (LPDNet/LPRNet on TensorRT), a feed-integrity check that flags frozen or substituted camera streams from frame statistics alone, a policy engine that gates what the system may do autonomously per zone with a hash-chained audit log, and a small set of LLM-backed tools (CSV schema mapping, natural-language search, incident report drafting) kept off the real-time path. None of it exists in this codebase yet. The implementation plan for this registry ([`docs/superpowers/plans/2026-09-04-registry-gis.md`](docs/superpowers/plans/2026-09-04-registry-gis.md)) treats the rest as follow-on work, each with its own plan, once this one is reviewed.

## License

Apache License 2.0. See [LICENSE](LICENSE).

Copyright 2026 Mrityunjay Singh, Yashasvi Dabas.
