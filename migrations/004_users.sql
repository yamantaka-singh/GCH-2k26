CREATE TYPE user_role AS ENUM ('viewer', 'dept_admin', 'state_admin');

CREATE TABLE app_user (
  id            serial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          user_role NOT NULL DEFAULT 'viewer',
  department_id integer REFERENCES department(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
