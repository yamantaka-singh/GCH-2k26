CREATE TABLE watchlist (
  id         serial PRIMARY KEY,
  plate      text NOT NULL,
  reason     text NOT NULL,
  severity   text NOT NULL DEFAULT 'medium',
  added_by   text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX watchlist_active_plate_idx ON watchlist (plate) WHERE active;

CREATE TABLE plate_sighting (
  id         bigserial PRIMARY KEY,
  camera_id  integer NOT NULL REFERENCES camera(id) ON DELETE CASCADE,
  plate      text NOT NULL,
  confidence double precision NOT NULL,
  ts         timestamptz NOT NULL DEFAULT now(),
  crop_uri   text
);

CREATE INDEX plate_sighting_plate_idx  ON plate_sighting (plate, ts);
CREATE INDEX plate_sighting_camera_idx ON plate_sighting (camera_id, ts);
