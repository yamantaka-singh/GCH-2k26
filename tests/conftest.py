import os
import subprocess

import pytest
from psycopg.rows import dict_row

os.environ.setdefault(
    "DATABASE_URL", "postgresql://sentinel:sentinel@localhost:55432/registry_test"
)
os.environ.setdefault("JWT_SECRET", "test-secret")

from src.registry.db import pool  # noqa: E402  (import after env is set)


@pytest.fixture(scope="session", autouse=True)
def migrated():
    subprocess.run(["uv", "run", "python", "-m", "scripts.migrate"], check=True)


@pytest.fixture
def cur():
    """Every test runs inside a transaction that is rolled back, so tests never see
    each other's rows and no truncation is needed."""
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as c:
            yield c
        conn.rollback()


@pytest.fixture
def department(cur):
    cur.execute(
        "INSERT INTO department (code, name) VALUES ('POL', 'Police') RETURNING id"
    )
    return cur.fetchone()["id"]
