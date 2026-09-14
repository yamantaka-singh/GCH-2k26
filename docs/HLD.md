# Sentinel: High-Level Design

**Submission:** Gujarat Police Innovation Hackathon 2026, Model 5 (hybrid) built on the mandatory Model 1
**Team:** Mrityunjay Singh, Yashasvi Dabas (Category 1)
**Version:** 15 September 2026
**Related:** [design spec](superpowers/specs/2026-09-04-sentinel-design.md), [Model 1 implementation plan](superpowers/plans/2026-09-04-registry-gis.md), [README](../README.md)

This document replaces the design spec's choice of TensorRT LPDNet/LPRNet for plate recognition with Argus (§5.1, §13). Every component carries one of three labels:

| Label | Meaning |
|---|---|
| **Built** | In this repository and covered by tests (60 pytest, 6 vitest) |
| **Validated** | Exercised against the organisers' live camera grid on 14-15 September 2026 |
| **Designed** | Specified here, not yet implemented |

## 1. Summary

Sentinel joins up CCTV from separately run department systems without moving their video. Cameras and recorders stay with the departments. Edge nodes pull the streams, read plates, check feed health, and send only structured events (a sighting row is under a kilobyte) to a central PostGIS database. That database holds the camera registry, vehicle movement history, watchlist matches, and a tamper-evident audit log.

Plate reading uses Argus, an ANPR engine written for Indian plates: YOLO11 vehicle detection, RapidOCR text recognition, and a rule engine that knows state codes and plate layouts. Argus was built for weighbridges, and §5.1 lists the changes that adapt it to junction cameras with many vehicles per frame.

The registry and GIS layer is built. Stream ingest from the live grid is validated. Plate recognition, tracking, alerts, and the Model 5 modules are designed. §10 reports what testing on the live grid found, including that none of the 30 camera feeds sampled so far has shown a legible plate.

## 2. Requirements and constraints

**Functional, from the problem statement.** Model 1: camera registry, bulk import, GIS mapping, health monitoring, coverage gap analysis, role-based access. Test case: onboard about 50 heterogeneous feeds, monitor them centrally, read plates, track a designated vehicle across locations, check sightings against a watchlist, raise real-time alerts on a map, and search movement history.

**Non-functional.** Scale to about 80,000 cameras spread over roughly 1,000 km. Use open-source components only. Leave departments in control of their cameras, recorders, and retention (7 to 15 days today). Deliver alerts in real time.

**Constraints.** A two-person team. Streams are pull-only, with no camera-control (PTZ) interface exposed (§10.2). Camera clocks and on-screen timestamps cannot be trusted (§10.2).

## 3. Architecture

```
DEPARTMENT NETWORKS (26 systems)
  cameras and recorders; video and 7-15 day retention stay here
        │
        │  RTSP over TCP, inside a tunnel
        ▼
EDGE NODE, one per site or cluster                     [Designed]
  frame sampler      PTS clock, reconnect backoff, OSD masks
  ANPR workers       Argus fork, 2 fps on ANPR-capable cameras
  temporal voting    one sighting per vehicle pass
  integrity checks   frozen, looped, clock skew, covered lens
  buffer             store-and-forward if the uplink drops
        │
        │  events under 1 KB each, over Kafka
        ▼
CENTRAL
  PostgreSQL 16 + PostGIS
    registry, departments, health history              [Built]
    sightings, watchlist, alerts, audit log            [Designed]
  tracking and alert service                           [Designed]
  REST API, operator console, health probe             [Built]
        │
        │  websocket
        ▼
OPERATORS (browser)
```

One rule decides where work runs: anything that scales with pixels runs at the edge, and anything that scales with events runs centrally. Video never crosses the uplink, which is what makes the bandwidth figures in §9.1 workable.

## 4. Integration approach

### 4.1 Onboarding (Built)

Departments load cameras through CSV bulk import, where each row inserts in its own savepoint so one bad row is reported by line number without blocking the rest. Each camera carries its department, a `geography(Point, 4326)` location with a GiST index, vendor, stream details, retention, and status. Role-based access scopes every write to the caller's department.

Three registry fields are designed for ingest: `anpr_capable` (whether the camera's framing can yield readable plates), `osd_mask` (polygons covering on-screen overlays), and `stream_ref` (a reference to the stream credential in a secrets manager, never the credential itself).

### 4.2 Stream ingest (Validated; production hardening Designed)

The organisers' grid serves streams over RTSP from gortsplib, the library underneath MediaMTX. Each ingest rule below comes from the organisers' integrator guide, from what we observed on the grid, or both.

| Rule | Source |
|---|---|
| Force RTSP over TCP | Guide: UDP produces corrupt frames across NAT |
| Space session opens at least 2 s apart per account | Observed: back-to-back opens failed from the third; spaced opens connected 30 of 30 |
| Reconnect with exponential backoff from 2 s up to 30 s | Guide |
| Timestamp frames from PTS anchored to an NTP-synced ingest clock, never from camera overlays or arrival time | Guide, plus camera clock errors observed on the grid |
| Re-anchor the clock when PTS jumps backwards | Guide: feeds loop and cut abruptly at the loop point |
| Log join-time decoder warnings; reconnect on sustained decode-error bursts | Guide, plus decode degradation observed after roughly 45-60 s |
| Decode through GStreamer or FFmpeg with error concealment, not raw OpenCV read loops | Observed |
| Read the camera list from the organisers' catalogue | Guide |

Frame time is `observed_at = t0_ingest + (pts - pts0)`, where `t0_ingest` and `pts0` are recorded when the session starts and reset whenever PTS moves backwards.

### 4.3 Frame sampling (Designed)

ANPR-capable cameras are sampled at 2 frames per second whatever their source frame rate; plates do not need more. Other cameras are sampled at one frame every 5 seconds for vehicle counts and integrity checks only. Both rates are starting values.

## 5. Analytics

### 5.1 ANPR service (Designed): Argus with a CCTV patch set

[Argus](https://github.com/dheereshag/argus) runs in two stages. YOLO11n detects vehicles and people, RapidOCR reads text from the vehicle crop, and a rule engine turns that text into a validated Indian plate.

We chose it over our own prototype because its rule engine already fixes the failure our prototype hit. The prototype applied OCR character corrections to the whole string, so a valid state code `BR` came out as `8R`. Argus corrects characters by position: letters in the state and series fields, digits in the number fields. It also validates state codes, strips the HSRP `IND` band, reassembles two-line plates, and handles Bharat-series plates.

A weighbridge frame should hold one vehicle and nobody on foot, and Argus enforces both. Junction footage breaks both assumptions, so the fork changes six things:

| # | Change | Kind | Reason |
|---|---|---|---|
| 1 | Set `MAX_ALLOWED_HUMANS=None`, `MAX_ALLOWED_VEHICLES=None`, `MIN_ALLOWED_VEHICLES=0` | Config | The defaults reject any frame with a pedestrian or more than one vehicle. Every frame we pulled from the grid had both. |
| 2 | Add COCO class 3, `motorcycle`, to the vehicle classes | One-line code change | Argus detects `car`, `bus`, and `truck` only. Two-wheelers were the most common vehicles in the grid frames. |
| 3 | Run OCR on every qualifying vehicle crop instead of only the largest | Code, detector and pipeline | Argus selects one primary vehicle per image. |
| 4 | Add a flag that disables the full-frame OCR fallback | Code | In our tests, full-frame OCR on busy frames read on-screen overlays and an unrelated poster as plate-shaped text. |
| 5 | Set `MIN_VEHICLE_BOX_AREA_RATIO` per camera class | Config | The 1% default skips distant vehicles, whose plates are unreadable anyway. |
| 6 | Call `recognize_plate_image(bytes)` as a library inside the ANPR worker | Integration | Argus's HTTP endpoint takes one multipart upload per image, which is wasted work at 2 fps across thousands of cameras. |

Argus's CLAHE contrast correction, two-line plate clustering, positional corrections, state-code validation, and input size limits stay as they are. CLAHE matters here because every frame sampled from the grid so far was shot at night.

Our own code wraps the fork with OSD masking before inference, temporal voting (§5.2), the sighting writer, and the watchlist lookup. Keeping those outside the fork keeps the patch small, and changes 2 and 3 are general enough to offer back to Argus.

Auto-rickshaws are not a COCO class and may be detected as `car`, as `motorcycle`, or not at all. The pilot measures their recall, and the detector gets fine-tuned if it is poor.

### 5.2 Temporal voting (Designed)

A vehicle crossing a camera's view yields several reads at 2 fps. Reads from the same camera within 2 seconds whose plates differ by at most one character collapse into one sighting. The most frequent string wins, ties go to the highest confidence, and the vote count is stored with the sighting. A frame that truncates a plate, as several did in our prototype test, is outvoted by neighbouring frames that read it whole. The window and the one-character threshold are starting values to tune on pilot data.

### 5.3 Cross-camera tracking (Designed)

A vehicle's route is its sightings in time order, joined to camera locations:

```sql
SELECT s.observed_at, c.name, ST_AsGeoJSON(c.geom)
FROM plate_sighting s
JOIN camera c ON c.id = s.camera_id
WHERE s.plate = $1 AND s.observed_at BETWEEN $2 AND $3
ORDER BY s.observed_at;
```

There is no visual re-identification model. Each pair of consecutive sightings is checked with PostGIS: the implied speed is `ST_Distance(a.geom, b.geom)` divided by the time between them. A pair above a configurable ceiling means either a misread or two vehicles carrying the same number, so it goes to a review queue instead of being dropped, because a cloned plate is something an operator needs to see.

### 5.4 Feed integrity (Designed, Model 5)

These checks reuse frames the edge node has already decoded.

| Check | Signal | Seen on the grid |
|---|---|---|
| Frozen feed | Repeated perceptual hash | Not yet |
| Looped or replayed feed | Periodic hash sequence; overlay date days away from the ingest clock | Yes. Every overlay date we read was from June or August 2026 during a September capture. The grid serves looped recordings by design; in production the same signal means a replayed or stale feed. |
| Clock skew | Overlay time against the ingest clock | Yes. One camera's overlay read 14:51 on a night scene. |
| Covered lens | Histogram collapse | Not yet |
| Substituted stream | Drift in sensor-noise residual | Not yet |

ANPR masks the overlay bands, so the clock checks run a separate OCR pass on those bands about once a minute per camera.

## 6. Alert workflow (Designed)

1. The edge node publishes a sighting to Kafka and the central service writes it.
2. The service looks up the normalised plate in the watchlist with an indexed exact match on active entries.
3. On a match it inserts an alert and fires Postgres `NOTIFY`. The console receives it over a websocket and shows a map pin with the vehicle's trail from §5.3.
4. The zone's response profile decides which actions run automatically, such as adding neighbouring cameras to the video wall or notifying the nearest unit. Anything outside the profile waits for an operator.
5. The operator acknowledges or escalates. Every automatic and manual action appends to a hash-chained audit log, where `hash_n = SHA-256(hash_{n-1} || record_n)`, so an edited or deleted record breaks the chain.
6. Escalations expire after a set window unless an operator renews them.

A watchlist match alerts on the first read above the confidence threshold rather than waiting for the vote in §5.2 to close, and the alert updates when it does. The latency target is under 1 second from frame to operator screen, to be measured in the pilot.

## 7. Data model

**Built**

| Table | Holds |
|---|---|
| `department`, `camera` | Registry; `camera.geom` is `geography(Point, 4326)` with a GiST index |
| `camera_health` | Reachability history from the health probe |
| `app_user` | Accounts and roles |

**Designed**

| Table | Holds |
|---|---|
| `plate_sighting` | `camera_id`, `plate`, `confidence`, `vote_count`, `observed_at`, `crop_uri`; partitioned by day; indexed on `(plate, observed_at)` |
| `watchlist` | `plate`, `reason`, `severity`, `active`, `added_by` |
| `alert` | `sighting_id`, `watchlist_id`, `status`, `acknowledged_by` |
| `integrity_event` | `camera_id`, `kind`, `score`, `observed_at`, `evidence_uri` |
| `response_profile` | `zone`, `allowed_actions` (jsonb), `max_escalation_seconds` |
| `audit_log` | `actor`, `action`, `params` (jsonb), `prev_hash`, `hash` |
| `camera`, new columns | `anpr_capable`, `osd_mask` (jsonb), `stream_ref` |

## 8. Security

**Built**

- Three roles, with one function (`may_write`) deciding every write and scoping it to the caller's department.
- bcrypt password hashing. Passwords longer than bcrypt's 72-byte limit are rejected instead of raising a server error.
- JWT signed with HS256. The service refuses to start if the signing secret is shorter than 32 bytes, per RFC 7518 §3.2.
- Validation of enums and coordinates at the API boundary. Coverage-gap requests are costed before they run and capped at 10,000 grid cells.

**Designed**

- **Transport.** The grid's RTSP runs over plain TCP to a public address, so media and session traffic travel unencrypted. Production ingest runs over RTSPS or a WireGuard or IPsec tunnel between each edge node and its department network.
- **Credentials.** Stream credentials live in a secrets manager and the registry stores only a reference. URLs that contain credentials are never logged; our prototype ingest script already never prints them.
- **Least privilege.** ANPR workers have no database access. The sighting writer can insert into `plate_sighting` and nothing else.
- **Audit.** The hash-chained log in §6.
- **Data minimisation.** Plate crops are kept only for sightings linked to an alert. Other sightings keep text and metadata, with retention set by state policy and the Digital Personal Data Protection Act, 2023, to be confirmed with legal counsel.

## 9. Scalability to about 80,000 cameras

These are planning figures. Every input is stated so it can be swapped for a measurement.

### 9.1 Bandwidth

| Input | Value | Basis |
|---|---|---|
| Cameras | 80,000 | Problem statement |
| Average stream bitrate | 2 Mbps | Assumption: 1080p, mixed H.264 and H.265 |
| Uplink needed if video were centralised | 160 Gbps | 80,000 × 2 Mbps |
| Uplink needed with edge processing | Kilobits per second per camera | Events under 1 KB each; video stays with the department |

### 9.2 Compute

ANPR load in frames per second is `N_anpr × 2`, and the GPUs needed are `(N_anpr × 2) / T`. Here `N_anpr` is the number of ANPR-capable cameras and `T` is the frames per second one GPU processes end to end, detection plus OCR on the vehicles in each frame.

Neither input is known yet. `N_anpr` depends on finding plate-capable cameras (§10.2), and `T` has not been measured. For an illustrative `N_anpr` of 8,000, a tenth of all cameras:

| T, frames/s per GPU | GPUs needed |
|---|---|
| 100 | 160 |
| 250 | 64 |
| 500 | 32 |

Measuring `T` on the target GPU is the first pilot task. Counting and integrity checks on all 80,000 cameras at one frame every 5 seconds add 16,000 detection-only frames per second. GPUs sit at edge nodes where a site is large enough to use one, and are pooled at district-level regional nodes where it is not.

### 9.3 Storage tiers

| Tier | Data | Store | Retention |
|---|---|---|---|
| Source | Video | Department recorders | Unchanged, 7 to 15 days |
| Hot | Registry, sightings, alerts, audit log | PostgreSQL 16 + PostGIS, daily partitions | 90 days online, set by policy |
| Warm | Plate crops for alerts, integrity evidence | Object storage | Per case policy |
| Cold | Expired partitions, archived audit log | Compressed object storage | Per policy |

Daily sighting rows equal `N_anpr × vehicle passes per camera per day`. At 8,000 cameras and an illustrative 5,000 passes each, that is 40 million rows, about 20 GB a day at 0.5 KB per row.

### 9.4 Load balancing and horizontal scaling

- Cameras are assigned to ingest workers by consistent hashing on `camera_id`. When a worker fails its cameras move to the others, with session opens still paced per account (§4.2).
- ANPR worker pools scale on queue lag.
- Kafka topics are partitioned by `camera_id`, which keeps each camera's events in order for voting. A single sandbox node uses Postgres `NOTIFY` instead of Kafka.
- The API tier is stateless behind a load balancer, with read replicas serving tracking queries.

### 9.5 High availability and disaster recovery

- PostgreSQL runs with a synchronous standby in a second data centre and WAL archived to object storage. The targets are a recovery point objective near zero and a recovery time objective under 15 minutes; neither is measured.
- Edge nodes buffer events on local disk when the uplink fails and replay them with their original timestamps on reconnect.
- Ingest and ANPR workers hold no state beyond that buffer, so any node can be rebuilt from the registry.

### 9.6 Monitoring

Per camera: reachability (Built), frames ingested per second, decode-error rate, reconnect count, PTS gaps, integrity events. Per pipeline: queue lag, ANPR p95 latency, GPU utilisation, and the ratio of reads to voted sightings. Operations staff are paged for a camera down, a frozen or looped feed, clock skew, or queue lag over threshold.

### 9.7 Phased rollout

| Phase | Scope | Exit criterion |
|---|---|---|
| 0, Built | Registry, GIS, gap analysis, health probe, role-based access | Done: 66 tests pass; 30 grid cameras connected over RTSP |
| 1, Sandbox | About 50 feeds on one node: ingest, Argus ANPR, voting, tracking, alerts | Test case passes on organiser feeds |
| 2, Pilot | One city | `T` measured; plate read rate measured on plate-capable cameras; voting and plausibility thresholds tuned |
| 3, Statewide | Edge and regional rollout, one department at a time | Onboarding runbook per department; monitoring green |

## 10. Validation to date

### 10.1 Prototype ANPR test on photos

We ran RapidOCR on CPU with a plate regex over 47 mobile-phone photos of Indian plates from the Dataclusterlabs sample set (CC-BY-NC-ND-4.0, used for evaluation). The set ships without ground truth, so results were classified by hand: about 29 clean reads, about 6 truncated reads or false positives, and 12 with no read. These are close-up photos, an easier case than CCTV.

### 10.2 Organisers' live camera grid, 30 cameras

| Finding | Evidence |
|---|---|
| Streams are reachable | 30 of 30 cameras connected over RTSP on TCP |
| Session opens need pacing | Back-to-back session opens failed from the third onward. Bare TCP connects and single sessions always succeeded, and spacing opens 2 s apart connected all 30. The mechanism is unconfirmed; a per-account session limit or slow session teardown are both consistent with it. |
| No camera control | The server identifies as gortsplib, and RTSP `OPTIONS` lists only `DESCRIBE, ANNOUNCE, SETUP, PLAY, RECORD, PAUSE, GET_PARAMETER, TEARDOWN`. The documented ports expose no PTZ interface. |
| No legible plates so far | One frame from each of the 30 cameras, plus extended sampling of the four cameras labelled RLVD, showed wide night-time views of junctions and bridges. No plate was readable by eye or by OCR. |
| OCR works on these frames | On-screen camera names and timestamps read correctly |
| Camera clocks are unreliable | Overlay dates from June and August 2026 during a September capture; one overlay showed 14:51 on a night scene |
| Raw decoding degrades | One OpenCV session reading continuously logged repeated H.264 decode errors and stopped returning frames after roughly 45 to 60 seconds |

Only sequential session opens were tested. The sandbox test case needs about 50 concurrent streams, which is the second risk in §11.

## 11. Risks and open questions

| Risk | Impact | Mitigation and next step |
|---|---|---|
| Overview cameras show no legible plates | The ANPR test case fails on this camera class | Ask the organisers for plate-capture streams; RLVD installations commonly pair an overview camera with a dedicated plate camera. Mark cameras `anpr_capable` in the registry. Deliver vehicle counts and integrity checks on overview cameras from the same detector. |
| Concurrent session limit is unknown | About 50 simultaneous feeds may be refused | Test concurrent opens at 2, 5, 10, 25, and 50, and ask the organisers for the per-account limit |
| Argus has no LICENSE file | We cannot ship the fork | Ask the author to add the MIT license their README badge names. If that does not happen, implement the same pipeline ourselves. |
| AGPL-3.0 terms of the `ultralytics` package | Source must be offered for a modified network service | Publish the fork and keep ANPR a separate service; confirm with counsel or buy an Ultralytics enterprise license |
| Night-time accuracy unmeasured | Lower read rate at night | Rely on Argus's CLAHE; measure day against night in the pilot |
| Auto-rickshaws are not a COCO class | Missed vehicles | Measure recall in the pilot; fine-tune the detector if needed |
| The grid may not be the competition dataset | These findings may not carry over | Confirm with the organisers |

Questions for the organisers:

1. Are plate-capture streams available, such as the plate channel of the RLVD installations?
2. What is the per-account limit on concurrent RTSP sessions?
3. Is the grid we were given the competition dataset?
4. Is any camera-control (PTZ) interface available?
5. Can ingest run over RTSPS or a VPN tunnel?

## 12. Licensing

| Component | License | Obligation |
|---|---|---|
| Sentinel (this repository) | Apache-2.0 | Attribution |
| Argus | None in the repository; the README badge names MIT | Author adds a LICENSE file before we ship |
| `ultralytics` (Argus's YOLO11 detector) | AGPL-3.0 | Offer source for the modified network service; check Ultralytics' terms for the pretrained weights |
| `rapidocr` | Apache-2.0 | Attribution |
| ONNX Runtime | MIT | Attribution |

## 13. Trade-offs and what we would revisit

| Decision | Chosen | Alternative | Revisit when |
|---|---|---|---|
| ANPR engine | Argus: YOLO11 and RapidOCR with Indian plate rules; runs on CPU during development | TensorRT LPDNet/LPRNet, from the design spec | Per-GPU throughput `T` becomes the main statewide cost |
| Tracking | Plate-string join with a speed plausibility check | Visual re-identification | Plate reads prove too sparse on the real camera mix |
| Event transport | Postgres `NOTIFY` on the sandbox node, Kafka from the pilot on | Postgres alone at every scale | Not applicable; one database cannot take statewide event volume |
| Video | Stays with departments | Central recording | Investigations need retention longer than department policy |
| Stream access | Pull over RTSP | Departments push streams | A department cannot expose RTSP |
