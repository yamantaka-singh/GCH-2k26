CREATE TYPE integrity_kind AS ENUM (
  'frozen', 'looped', 'histogram_collapse', 'noise_drift', 'timing_jitter'
);

CREATE TABLE integrity_event (
  id        bigserial PRIMARY KEY,
  camera_id integer NOT NULL REFERENCES camera(id) ON DELETE CASCADE,
  kind      integrity_kind NOT NULL,
  score     double precision NOT NULL,
  ts        timestamptz NOT NULL DEFAULT now(),
  evidence  jsonb
);

CREATE INDEX integrity_event_camera_idx ON integrity_event (camera_id, ts DESC);

CREATE TABLE response_profile (
  id                     serial PRIMARY KEY,
  zone                   text NOT NULL,
  name                   text NOT NULL,
  allowed_actions        jsonb NOT NULL DEFAULT '[]',
  max_escalation_seconds integer NOT NULL,
  active                 boolean NOT NULL DEFAULT false,
  UNIQUE (zone, name)
);

-- Only one profile may be live per zone at a time; policy.py resolves "the
-- current profile for this zone" by this constraint rather than a join with
-- an ORDER BY / LIMIT 1 that could silently pick the wrong row.
CREATE UNIQUE INDEX response_profile_active_idx ON response_profile (zone) WHERE active;

-- Presence of a row is the override: a human click deletes it, which is the
-- same "immediately" the spec asks for and needs no extra status column.
CREATE TABLE zone_override (
  zone          text PRIMARY KEY,
  overridden_by text NOT NULL,
  overridden_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id        bigserial PRIMARY KEY,
  ts        timestamptz NOT NULL DEFAULT now(),
  actor     text NOT NULL,
  action    text NOT NULL,
  zone      text NOT NULL,
  params    jsonb NOT NULL DEFAULT '{}',
  prev_hash text,
  hash      text NOT NULL UNIQUE
);

CREATE INDEX audit_log_zone_idx ON audit_log (zone, ts DESC);
