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
