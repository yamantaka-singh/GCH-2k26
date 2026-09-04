CREATE TABLE camera_health (
  id         bigserial PRIMARY KEY,
  camera_id  integer NOT NULL REFERENCES camera(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  reachable  boolean NOT NULL,
  latency_ms integer,
  error      text
);

CREATE INDEX camera_health_recent_idx ON camera_health (camera_id, checked_at DESC);
