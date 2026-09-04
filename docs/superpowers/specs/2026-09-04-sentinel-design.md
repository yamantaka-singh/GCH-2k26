# Sentinel Hackathon — System Design

**Event:** Gujarat Police Innovation Hackathon 2026 (sentinel.gujarat.gov.in)
**Track:** Model 5 (Hybrid / Novel), built on mandatory Model 1 + a Model 2 slice
**Category:** 1 (student / research)
**Team:** 2 people
**Date:** 2026-09-04

## 1. Goal

A CCTV integration platform that satisfies the organiser's mandatory registry
requirement and their live test case, plus two modules derived from our
provisional patent (cognitive state estimation via multi-modal fusion,
policy-bound closed-loop autonomy, authentication as a derivative byproduct)
that no competing team is likely to build.

## 2. Hard constraints

- All components open source. Stated requirement of the organisers.
- Two developers. Anything needing a third person is out of scope.
- Must run the organiser's ~50 simulated live feeds (5 departments) end to end.
- Model 1 (Centralised CCTV Registry & GIS Foundation) is mandatory in every
  submission regardless of which model we pick.

## 3. Scope

### Built

| Layer | Contents |
|---|---|
| Registry + GIS (Model 1) | camera inventory, bulk import, map, health probe, gap analysis, RBAC |
| Ingest + analytics (Model 2 slice) | 50 feeds, live wall, ANPR, watchlist, cross-camera movement history, GIS alerts |
| Trust & Policy layer (the Model 5 novelty) | feed-integrity authentication, policy-bound response with hash-chained audit log |
| Agent tier | inventory mapping, natural-language query, scene captioning, incident reports |

### Paper only (HLD, not code)

Federated edge learning, scale-out to 80,000 cameras, Kafka event bus, DeepStream
multi-stream batching, tiered storage, face recognition, VAHAN/SARTHI/eGujCop
live integration, HA and DR.

Reason: two people. Every one of these is defensible in a design document and
indefensible as a half-working demo.

## 4. Architecture

Two tiers, split on a single rule: **per-frame work is deterministic, per-event
work may use a model.**

```
                    ┌──────────────────────────────────────────┐
   50 RTSP feeds ──▶│ mediamtx  (RTSP in, HLS/WebRTC out)      │──▶ live wall
                    └──────────────────────────────────────────┘
                                   │ (frame sampler, 2 fps)
                                   ▼
        ┌──────────────────── FAST TIER (per frame, no LLM) ────────────────────┐
        │  LPDNet ─▶ LPRNet          plate detect + read                        │
        │  integrity.py              frozen / looped / tampered / substituted   │
        │  policy.py                 rules engine + hash-chained audit          │
        └───────────────────────────────────────────────────────────────────────┘
                                   │ writes rows
                                   ▼
                    ┌──────────────────────────────────────────┐
                    │  Postgres 16 + PostGIS                   │
                    │  cameras · plate_sighting · watchlist    │
                    │  integrity_event · audit_log · alerts    │
                    └──────────────────────────────────────────┘
                          │ LISTEN/NOTIFY          │ on demand
                          ▼                        ▼
                  React + Leaflet UI     ┌─────────────────────────────┐
                                         │ SLOW TIER (per event, LLM)  │
                                         │ agents/*/AGENT.md + runner  │
                                         └─────────────────────────────┘
```

### Why this shape

- **mediamtx** does all streaming. We write no streaming code and the video wall
  is `<video>` tags pointed at HLS URLs.
- **Cross-camera tracking is a SQL join on the plate string**, not visual re-ID.
  Camera A reads `GJ01AB1234` at 10:03, camera C reads it at 10:07; that is the
  track. Cheaper than re-ID and more accurate.
- **Postgres is the whole data layer.** PostGIS for geo, `LISTEN/NOTIFY` for
  realtime, ordinary tables for events. Kafka and Redis are cost with no benefit
  at 50 cameras; they appear in the HLD as the scale answer.
- **2 fps sampling.** Plate reading does not need 25 fps. Cuts inference 12x.

## 5. Latency budget

The organiser scores real-time alerting, so the budget is a design constraint,
not a hope.

| Stage | Budget | Mechanism |
|---|---|---|
| RTSP → sampled frame | 200 ms | mediamtx + ffmpeg, 2 fps |
| Plate detect (LPDNet) | 25 ms | TensorRT FP16, batch 8 |
| Plate read (LPRNet) | 15 ms | TensorRT FP16 |
| Integrity fingerprint | 5 ms | numpy on the same decoded frame |
| DB insert + watchlist match | 20 ms | indexed lookup on `plate` |
| Policy evaluation | 10 ms | in-process rules, no I/O |
| NOTIFY → browser | 100 ms | Postgres NOTIFY over websocket |
| **Sighting to on-screen alert** | **< 400 ms** | |

The agent tier is explicitly outside this budget. It runs on flagged events at
seconds-scale latency and never blocks an alert.

## 6. Where AI is used, and where it is not

| Task | Approach | Why |
|---|---|---|
| Plate detect + read | LPDNet + LPRNet (NVIDIA NGC pretrained) | 100 inferences/sec. Deterministic, TensorRT, no API. |
| Feed integrity | numpy statistics | Frame-hash repetition, histogram collapse, noise-residual drift. No model needed. |
| Cross-camera tracking | SQL | It is a `GROUP BY plate ORDER BY ts`. |
| Watchlist match | SQL index lookup | String equality. |
| Policy evaluation | Python rules table | Must be auditable and explainable to a court. A model here is a liability. |
| Gap analysis | PostGIS | `ST_DWithin` over a grid. |
| Department spreadsheet → schema | **Agent** | 26 departments, 26 formats, unbounded messiness. |
| Natural-language query | **Agent** | Compiles to SQL against our own schema. |
| Scene caption on flagged clips | **Agent (VLM)** | Runs only on anomalies. Covers "analytics beyond ANPR". |
| Incident report draft | **Agent** | Prose generation from structured rows. |

## 7. Agent tier: markdown files and a thin runner

No framework. An agent is a directory:

```
agents/
  runner.py              # ~60 lines: load prompt, fill vars, call endpoint, validate
  inventory_mapper/
    AGENT.md             # system prompt
    schema.json          # JSON Schema the output must satisfy
  nl_query/
    AGENT.md
    schema.json
  scene_caption/
    AGENT.md
    schema.json
  incident_report/
    AGENT.md
    schema.json
```

`runner.py` reads `AGENT.md`, substitutes `{{variables}}`, calls the hosted
NVIDIA endpoint, parses JSON, validates against `schema.json`, retries once on
schema failure, raises otherwise. Prompts are reviewable in a diff and editable
without touching Python. No LangChain, no CrewAI, no agent framework.

## 8. Novelty modules

### 8.1 Feed Integrity Authentication

Derived from the patent's claim that identity verification falls out of the same
stream being monitored for state. Applied to cameras rather than operators.

Each camera accumulates a fingerprint from frames already decoded for ANPR:

| Signal | Detects |
|---|---|
| Repeated perceptual frame hash | frozen feed |
| Periodicity in the hash sequence | looped / replayed feed |
| Sudden histogram collapse | lens covered or sprayed |
| Sensor-noise residual drift | substituted or injected feed |
| Frame-timing jitter | transcoding or man-in-the-middle |

Cost: roughly 200 lines of numpy, 5 ms per frame, zero training data.

### 8.2 Policy-Bound Response with hash-chained audit

Derived from the patent's Embodiment D (mission profiling, manual override,
time-out logic, cryptographic audit logging).

A per-zone **Response Profile** (`Normal`, `Festival`, `Curfew`) declares what
the system may do without a human. On a watchlist hit under `Festival`, it may
raise recording quality on neighbouring cameras, compose a video wall, and push a
geo-fenced alert. Anything beyond the profile requires a human click.

Every autonomous action appends a row whose `prev_hash` is the SHA-256 of the
previous row, making the log tamper-evident. Escalations carry a hard expiry so
nothing stays elevated indefinitely. A manual override kills all autonomy for a
zone immediately.

This answers the accountability question a government buyer asks before the
technical one.

## 9. Data model

```sql
cameras(id, dept, name, geom geography(Point,4326), kind, vendor, model,
        rtsp_url, retention_days, storage_kind, status, last_seen_at)
plate_sighting(id, camera_id, plate, confidence, ts, crop_uri)
watchlist(id, plate, reason, severity, added_by, active)
integrity_event(id, camera_id, kind, score, ts, evidence)
alert(id, kind, camera_id, plate, ts, severity, acknowledged_by)
response_profile(id, zone, name, allowed_actions jsonb, max_escalation_seconds)
audit_log(id, ts, actor, action, params jsonb, prev_hash, hash)
users(id, email, role, dept)      -- role: viewer | dept_admin | state_admin
```

Indexes: `plate_sighting(plate, ts)`, `plate_sighting(camera_id, ts)`,
`cameras USING GIST(geom)`, `watchlist(plate) WHERE active`.

## 10. Tech stack

Python 3.12, FastAPI, Postgres 16 + PostGIS, mediamtx, TensorRT, React + Vite +
Leaflet, Docker Compose. Detector on a rented L4/A10 VM during build sessions and
the demo; agent tier on hosted NVIDIA endpoints.

## 11. Milestones

| # | Milestone | Owner | Days |
|---|---|---|---|
| M0 | Register, claim dataset, repo + compose skeleton | both | 0.5 |
| M1 | ANPR spike on real footage, measure read rate | A | 1 |
| M2 | Registry + GIS (this plan) | B | 4 |
| M3 | Ingest, mediamtx, 50 feeds, live wall | A | 2 |
| M4 | ANPR worker, plate_sighting, watchlist match | A | 3 |
| M5 | Track view, movement history, alert feed | B | 2 |
| M6 | Feed Integrity module | A | 2 |
| M7 | Policy engine + hash-chained audit + viewer | A+B | 3 |
| M7.5 | Agent tier | both | 2 |
| M8 | HLD, deck, two demo videos | both | 3 |

Person A owns CV and backend workers. Person B owns platform, GIS, and UI.

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Plate read rate on real footage is poor | Kills the test case | M1 is a gate. Run it before writing pipeline code. |
| Organiser feeds differ from documented RTSP | Blocks M3 | Claim the dataset at registration, probe immediately. |
| GPU cost overrun | Budget | VM runs only during build sessions and the demo. |
| Scope creep into Phase-2 features | Nothing finishes | Section 3's "paper only" list is binding. |

## 13. Open items

- Real Phase-1 submission deadline (registration closes 7 Sep; submission date to
  be confirmed with the organisers).
- Whether the organiser's dataset ships plate ground truth for measuring M1.
