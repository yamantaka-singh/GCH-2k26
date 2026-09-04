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
