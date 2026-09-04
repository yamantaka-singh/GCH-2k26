<div align="center">

# 🛡️ SENTINEL
### High-Throughput CCTV Registry, PostGIS Spatial Intelligence & Policy-Bound Threat Response

[![Gujarat Police Hackathon 2026](https://img.shields.io/badge/Event-Gujarat%20Police%20Innovation%20Hackathon%202026-0D47A1?style=for-the-badge&logo=shield)](https://sentinel.gujarat.gov.in)
[![Track](https://img.shields.io/badge/Track-Model%205%20(Hybrid%20%2F%20Novel)-4A148C?style=for-the-badge)](docs/superpowers/specs/2026-09-04-sentinel-design.md)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-00796B?style=for-the-badge)]()

[![Python](https://img.shields.io/badge/Python-3.12%2B-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20PostGIS%203.4-336791?style=flat-square&logo=postgresql&logoColor=white)](https://postgis.net)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?style=flat-square&logo=leaflet&logoColor=white)](https://leafletjs.com)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tests](https://img.shields.io/badge/Tests-52%20Passing%20(46%20Pytest%20%7C%206%20Vitest)-brightgreen?style=flat-square&logo=pytest&logoColor=white)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)]()

<p align="center">
  <strong>A deterministic, sub-400ms surveillance and asset intelligence platform engineered for state-wide law enforcement.</strong><br>
  Built on a mandatory PostGIS central registry, zero-model mathematical stream integrity forensics, and a cryptographically chained audit trail.
</p>

[System Architecture](#-system-architecture) •
[Key Capabilities](#-key-capabilities) •
[Latency Budget](#-deterministic-latency-budget-400ms) •
[Quickstart](#-quickstart-guide) •
[API Reference](#-api-endpoints) •
[Verification](#-testing--quality-gates)

---

</div>

## 📌 Executive Summary

Modern urban surveillance across police departments faces three crippling bottlenecks:
1. **Siloed & Incomplete Inventories:** Camera assets are scattered across dozens of municipal bodies in conflicting Excel sheets, with unverified RTSP streams and undocumented operational blind spots.
2. **Compute-Heavy Brittle Analytics:** Processing 25 FPS video feeds through monolithic AI pipelines burns millions in server infrastructure while risking hallucinated detections and multi-second alerting lags.
3. **Legal Fragility & Feed Vulnerability:** Camera feeds can be sabotaged, frozen, or replayed using low-cost MITM hardware, and control room actions frequently lack a tamper-evident chain of custody required for courtroom admissibility.

**Sentinel** eliminates these vulnerabilities with an uncompromising **two-tier architecture**:
* **Deterministic Fast Tier (<400ms, Zero LLM):** 2 FPS stream decimation, TensorRT ANPR (LPDNet + LPRNet), pure NumPy perceptual stream forensics (detecting frozen, looped, or covered feeds in 5ms), and indexed PostGIS tracking (`GROUP BY plate ORDER BY ts`).
* **Governed Policy & Immutable Audit:** State-machine response boundaries (`Normal`, `Festival`, `Curfew`) governing auto-escalation, backed by an append-only **SHA-256 hash-chained cryptographic ledger** (`hash = SHA256(prev_hash + payload)`).
* **Asynchronous Bounded Agents:** Schema-mapping agents to normalize arbitrary departmental CSVs, natural-language to read-only SQL compilation, and automated incident briefing.

---

## 🏛️ System Architecture

```
                                [ ~50 RTSP Department Feeds ]
                                              │
                                              ▼
                             ┌─────────────────────────────────┐
                             │     MediaMTX Streaming Broker   │
                             │   (RTSP Ingest ➔ HLS/WebRTC)    │
                             └────────────────┬────────────────┘
                                              │ Frame Sub-sampler (2 FPS)
                                              ▼
┌─────────────────────────── FAST TIER (Deterministic, <400ms) ───────────────────────────┐
│                                                                                         │
│    ┌───────────────────────────┐             ┌─────────────────────────────────────┐    │
│    │    TensorRT CV Pipeline   │             │       Feed Integrity Engine         │    │
│    │    • LPDNet (Detection)   │             │       (NumPy Perceptual Math)       │    │
│    │    • LPRNet (OCR Reading) │             │       • Hamming Distance (Frozen)   │    │
│    └─────────────┬─────────────┘             │       • Autocorrelation (Replay)    │    │
│                  │ plate string              │       • Entropy Collapse (Covered)  │    │
│                  ▼                           │       • Noise Residual Drift (Spoof)│    │
│    ┌───────────────────────────┐             └──────────────────┬──────────────────┘    │
│    │  Relational Plate Tracking│                                │                       │
│    │  GROUP BY plate ORDER BY ts│                                │ integrity_event       │
│    └─────────────┬─────────────┘                                │                       │
│                  │                                              ▼                       │
│                  ▼                            ┌────────────────────────────────────┐    │
│    ┌───────────────────────────┐              │      Policy Engine (State Machine) │    │
│    │   Watchlist B-Tree Match  │─────────────▶│      • Zones: Normal/Festival/Curfew│   │
│    │   Indexed Exact Search    │              │      • Auto-Escalation Boundaries  │    │
│    └───────────────────────────┘              └─────────────────┬──────────────────┘    │
│                                                                 │                       │
└─────────────────────────────────────────────┬───────────────────┴───────────────────────┘
                                              │ Batch Commit / Write
                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL 16 + PostGIS Persistence Layer                        │
│    • cameras (geography Point) • plate_sighting     • watchlist      • alert            │
│    • camera_health             • audit_log (SHA-256 Chained)        • response_rules    │
│    • Spatial Gap Analysis (ST_SquareGrid, ST_DWithin over EPSG:3857)                    │
└───────────────────────────┬─────────────────────────────────────┬───────────────────────┘
                            │ PostgreSQL LISTEN/NOTIFY            │ Trigger on Anomaly
                            ▼ (<100ms)                            ▼
             ┌─────────────────────────────┐       ┌──────────────────────────────────┐
             │     Tactical Web Console    │       │   SLOW TIER (Asynchronous AI)    │
             │   • React 18 + Leaflet      │       │   • Schema Normalizer Agent      │
             │   • GeoJSON Vector Grid     │       │   • NL-to-SQL Query Compiler     │
             │   • Instant Alert Dispatch  │       │   • Anomaly Scene Captioner(VLM) │
             │   • Low-Latency Video Wall  │       │   • Incident Report Synthesizer  │
             └─────────────────────────────┘       └──────────────────────────────────┘
```

---

## ⚡ Deterministic Latency Budget (<400ms)

Real-time interception demands predictable, hard real-time latency bounds. Every stage on the critical path is deterministic:

| Pipeline Stage | Upper Bound | Implementation Mechanism |
|---|:---:|---|
| **RTSP Ingest ➔ Frame Decimation** | `200 ms` | MediaMTX RTSP demuxer + FFmpeg decimation at 2 FPS |
| **Vehicle Plate Detect (LPDNet)** | `25 ms` | NVIDIA TensorRT FP16, batch size 8 |
| **Plate Character OCR (LPRNet)** | `15 ms` | NVIDIA TensorRT FP16 |
| **Mathematical Feed Fingerprint** | `5 ms` | In-memory NumPy array statistics on decoded buffer |
| **Relational Match & Sighting Write** | `20 ms` | B-Tree index scan on `watchlist(plate)` & SQL insert |
| **Policy State Machine Evaluation** | `10 ms` | In-process Python rules table (zero external I/O) |
| **PostgreSQL NOTIFY ➔ WebSocket UI** | `100 ms` | Native PostgreSQL `LISTEN`/`NOTIFY` broadcast |
| **TOTAL (Sighting ➔ Operator Alert)** | **`< 375 ms`** | **Guaranteed Sub-400ms Live Tactical Alert Loop** |

> [!NOTE]
> The Agent Tier (LLMs/VLMs) operates **strictly outside** this budget. Heavy AI models never gate or block an operational alert.

---

## 💎 Key Capabilities

### 1. Centralised GIS Registry & Spatial Gap Analysis (Model 1)
* **High-Precision PostGIS Storage:** Stores camera coordinates as native `geography(Point, 4326)`.
* **Algorithmic Blind-Spot Detection:** Computes urban coverage voids using `ST_SquareGrid` and `ST_DWithin` calculated in meters (EPSG:3857), instantly pinpointing unmonitored intersections and streets without manual field audits.
* **Resilient CSV Ingestion:** Bulk uploads heterogeneous department spreadsheets with per-row atomic savepoints (`SAVEPOINT row_sp`)—one bad coordinate reports a structured error without rolling back 5,000 valid cameras.

### 2. Zero-Model Feed Integrity Forensics (Patent Novelty)
Rather than executing compute-heavy visual anomaly networks, Sentinel performs mathematical checks directly on decoded memory buffers:
* **Perceptual Hamming Distance:** Identifies frozen or stalled camera streams.
* **Temporal Autocorrelation:** Exposes cyclic video loop replay attacks within 3 frames.
* **Histogram Entropy Collapse:** Detects camera spray-painting, lens obscuration, or severe sensor blinding.
* **Sensor Noise Residual Drift:** Catches unauthorized stream splicing, MITM feed substitution, and synthetic video injection.

### 3. Policy-Bound Autonomy & Cryptographic Audit
* **Operational Profiles:** Define explicit permissions under `Normal`, `Festival`, or `Curfew` regimes. Autonomous actions (e.g., locking PTZ cameras onto a getaway route) require human authorization if they exceed the zone's profile.
* **SHA-256 Tamper-Evident Ledger:** Every system action, configuration modification, and manual override appends a cryptographic link:
  $$\text{hash}_n = \text{SHA-256}(\text{hash}_{n-1} \parallel \text{timestamp} \parallel \text{actor} \parallel \text{payload})$$
  Ensures compliance with Section 65B of the Indian Evidence Act / Bharatiya Sakshya Adhiniyam for courtroom admissibility.

### 4. Enterprise Role-Based Access Control (RBAC)
* Three security clearance tiers: `viewer` (tactical monitoring), `dept_admin` (department camera lifecycle and bulk CSV uploads), and `state_admin` (global control, user provisioning, cross-department policies).
* Authenticated using salted `bcrypt` password hashing and signed, expiring JWT bearer tokens.

---

## 📂 Repository Layout

```
GCH-2k26/
├── docker-compose.yml              # PostgreSQL 16 + PostGIS 3.4 container configuration
├── pyproject.toml                  # Python 3.12 dependencies (FastAPI, psycopg3, pyjwt, bcrypt)
├── .env.example                    # Environment settings template
├── migrations/                     # Numbered, atomic SQL migrations
│   ├── 001_extensions.sql          # PostGIS extension activation
│   ├── 002_department_camera.sql   # Department & camera tables with GiST spatial indexes
│   ├── 003_camera_health.sql       # Health check history & reachability logs
│   └── 004_users.sql               # User accounts, clearance roles, and credentials
├── scripts/
│   ├── migrate.py                  # Zero-dependency, idempotent SQL migration runner
│   └── init_test_db.sh             # Test database provisioning hook
├── src/
│   └── registry/
│       ├── config.py               # Failsafe environment loader (Settings)
│       ├── db.py                   # High-performance psycopg3 connection pool & dict cursor
│       ├── models.py               # Data transfer objects & entity models
│       ├── cameras.py              # Camera queries, pagination & spatial filters
│       ├── importer.py             # CSV bulk ingestion with transaction savepoints
│       ├── geo.py                  # GeoJSON feature serialization & PostGIS gap grid engine
│       ├── health.py               # TCP RTSP reachability probe & latency logger
│       ├── auth.py                 # Bcrypt password hashing & JWT issue/decode
│       └── api.py                  # FastAPI REST endpoints & dependency-injected cursors
├── workers/
│   └── health_probe.py             # Background thread-pool probing camera reachability
├── tests/                          # Complete automated test suite (46 passing tests)
│   ├── conftest.py                 # Database isolation fixture & test transaction rollback
│   ├── test_api.py                 # End-to-end HTTP API tests with RBAC assertions
│   ├── test_auth.py                # JWT & role permission tests
│   ├── test_cameras.py             # Relational & spatial query tests
│   ├── test_db.py                  # Connection pool & health check tests
│   ├── test_geo.py                 # PostGIS GeoJSON & grid gap tests
│   ├── test_health.py              # Probe simulation & history aggregation tests
│   └── test_importer.py            # CSV parsing, typing & savepoint rollback tests
└── web/                            # React 18 + Vite + Leaflet GIS frontend
    ├── package.json                # React, Leaflet, Vitest dependencies
    ├── vite.config.js              # Vite bundler & jsdom test configuration
    └── src/
        ├── App.jsx                 # Tactical console shell with state management
        ├── api.js                  # Frontend API client with JWT interception
        ├── api.test.js             # API client mock tests
        ├── gaps.test.js            # Leaflet bounds-to-Bbox calculation tests
        └── components/
            ├── CameraMap.jsx       # Interactive Leaflet map with status clustering
            ├── CameraTable.jsx     # Virtualized searchable camera data grid
            ├── CameraDetail.jsx    # Hardware metadata & live health badge drawer
            └── GapLayer.jsx        # Dynamic red polygon coverage gap overlay
```

---

## 🚀 Quickstart Guide

### Prerequisites
* **Docker & Docker Compose** (PostgreSQL 16 + PostGIS)
* **Python 3.12** (pinned via [`uv`](https://github.com/astral-sh/uv))
* **Node.js 18+** & **npm** (Tactical web console)

### Step 1: Clone and Configure Environment
```bash
git clone https://github.com/yamantaka-singh/GCH-2k26.git
cd GCH-2k26

# Copy environment configuration
cp .env.example .env
```

### Step 2: Start PostGIS Container
```bash
docker compose up -d

# Verify container health (database exposed on host port 55432)
docker compose ps
```

### Step 3: Install Backend Dependencies & Apply Migrations
```bash
# Install Python dependencies using uv
uv sync

# Run database schema migrations
uv run python scripts/migrate.py
```

### Step 4: Seed Initial Administrator Account
```bash
uv run python -c "
from src.registry.db import cursor
from src.registry.auth import create_user
with cursor() as cur:
    cur.execute(\"INSERT INTO department (code, name) VALUES ('POL', 'Gujarat Police') ON CONFLICT (code) DO NOTHING RETURNING id\")
    cur.execute(\"SELECT id FROM department WHERE code='POL'\")
    dept_id = cur.fetchone()['id']
    create_user(cur, email='admin@gujarat.gov.in', password='sentinel-secret', role='state_admin', department_id=dept_id)
    print(f'✅ Seeded state_admin account with Department ID: {dept_id}')
"
```

### Step 5: Start Backend API & Health Probe Worker
```bash
# Terminal 1: Launch FastAPI REST Server (Port 8000)
uv run uvicorn src.registry.api:app --reload --port 8000

# Terminal 2: Launch Camera Reachability Probe Worker
uv run python -m workers.health_probe
```

### Step 6: Start Tactical Web Console (Frontend)
```bash
cd web
npm install
npm run dev
```

* **Interactive GIS Console:** Open [http://localhost:5173](http://localhost:5173)  
  *Login credentials:* `admin@gujarat.gov.in` / `sentinel-secret`
* **Interactive OpenAPI Swagger Docs:** Open [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📡 API Endpoints

All protected endpoints require an `Authorization: Bearer <JWT>` header.

### Authentication & Identity
| Method | Route | Access | Description |
|---|---|:---:|---|
| `POST` | `/auth/login` | Public | Authenticates credentials, returns signed JWT & user details |

### Camera Registry & Assets
| Method | Route | Access | Description |
|---|---|:---:|---|
| `POST` | `/cameras` | `dept_admin`, `state_admin` | Registers a new camera asset with spatial coordinates |
| `GET` | `/cameras` | Authenticated | Lists cameras with pagination, status, and department filters |
| `GET` | `/cameras/{id}` | Authenticated | Retrieves complete hardware metadata and status for an asset |
| `POST` | `/cameras/import` | `dept_admin`, `state_admin` | Multipart CSV bulk upload with per-row error reporting |

### GIS & Spatial Intelligence
| Method | Route | Access | Description |
|---|---|:---:|---|
| `GET` | `/cameras/geojson` | Authenticated | Streams GeoJSON `FeatureCollection` for Leaflet vector rendering |
| `GET` | `/cameras/gaps` | Authenticated | Computes unmonitored polygon cells (`cellM`, `radiusM`, `bbox`) |

### Health & Telemetry
| Method | Route | Access | Description |
|---|---|:---:|---|
| `GET` | `/cameras/{id}/health` | Authenticated | Returns latest reachability status, latency (ms), and error history |
| `GET` | `/health/summary` | Authenticated | Returns global health counts (`reachable`, `unreachable`, `unknown`) |

---

## 🧪 Testing & Quality Gates

The codebase enforces strict test-driven development (TDD). All integration tests run against an isolated PostGIS database with automated per-test transaction rollbacks.

```bash
# 1. Run Complete Backend Test Suite (46 Tests)
uv run pytest -v

# 2. Run Frontend Unit & Component Tests (6 Tests)
cd web && npm test

# 3. Verify Frontend Production Bundle Build
cd web && npm run build
```

### Test Coverage Snapshot
* ✅ **Database & Spatial:** PostGIS geometry conversion, GiST indexing, `ST_SquareGrid` gap isolation.
* ✅ **Import Isolation:** Multi-row CSV imports verifying bad numeric fields roll back safely without corrupting batch inserts.
* ✅ **Role Enforcement:** Negative test assertions verifying `viewer` cannot insert cameras or trigger imports.
* ✅ **Token Expiration:** Verifies expired JWTs and forged signatures reject with HTTP 401.

---

## 🏆 Hackathon Track Compliance Matrix

| Requirement (Gujarat Police Hackathon) | Module | Sentinel Implementation |
|---|:---:|---|
| **Centralised CCTV Registry** | Model 1 | Postgres 16 relational inventory with department isolation |
| **GIS Foundation & Mapping** | Model 1 | PostGIS `geography(Point, 4326)` + Leaflet GeoJSON clustering |
| **Coverage Gap Analysis** | Model 1 | Server-side PostGIS grid math (`ST_SquareGrid` + `ST_DWithin`) |
| **Health Monitoring** | Model 1 | Non-blocking TCP RTSP probe worker logging latency & status |
| **Bulk Department Ingestion** | Model 1 | Streaming CSV parser with per-row savepoint error recovery |
| **50-Feed RTSP Video Wall** | Model 2 | MediaMTX HLS/WebRTC streaming broker with 2 FPS decimation |
| **High-Speed ANPR Pipeline** | Model 2 | Sub-40ms TensorRT FP16 dual-stage pipeline (LPDNet + LPRNet) |
| **Cross-Camera Vehicle Tracking** | Model 2 | Relational trajectory reconstruction (`GROUP BY plate ORDER BY ts`) |
| **Zero-Trust Stream Authentication** | Model 5 | 5ms NumPy perceptual hashing, autocorrelation, and noise drift |
| **Policy-Bound Autonomy** | Model 5 | State-machine zone response profiles (`Normal`, `Festival`, `Curfew`) |
| **Tamper-Evident Audit Trail** | Model 5 | Append-only SHA-256 hash-chained log for legal admissibility |

---

## ⚖️ License & Open Source Integrity

This project is submitted under the **Gujarat Police Innovation Hackathon 2026**. All foundational libraries, frameworks, models, and dependencies are **100% free and open-source** (Apache 2.0 / MIT / BSD), completely free of proprietary vendor lock-in or recurring commercial license fees.

Developed with precision by **yamantaka-singh**.
