from .models import Camera

# Enum columns are cast to text so the dataclass holds plain strings.
# ST_Y is latitude and ST_X is longitude; the cast to geometry is what exposes them.
COLUMNS = """
    id, department_id, name, external_ref, address, kind::text AS kind,
    vendor, model, rtsp_url, resolution, fps, storage::text AS storage,
    retention_days, status::text AS status, last_seen_at,
    ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lon
"""

# Shared by list_cameras and count_cameras so a new predicate cannot be added to
# one and forgotten in the other. Expects (department_id, department_id, status, status).
FILTER = """
    WHERE (%s::int IS NULL OR department_id = %s)
      AND (%s::text IS NULL OR status::text = %s)
"""


def create_camera(
    cur, *, department_id: int, name: str, lat: float, lon: float,
    external_ref: str | None = None, address: str | None = None, kind: str = "ip",
    vendor: str | None = None, model: str | None = None, rtsp_url: str | None = None,
    resolution: str | None = None, fps: int | None = None, storage: str = "unknown",
    retention_days: int | None = None, status: str = "active",
) -> int:
    cur.execute(
        """
        INSERT INTO camera (department_id, name, geom, external_ref, address, kind,
                            vendor, model, rtsp_url, resolution, fps, storage,
                            retention_days, status)
        VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (department_id, name, lon, lat, external_ref, address, kind, vendor, model,
         rtsp_url, resolution, fps, storage, retention_days, status),
    )
    return cur.fetchone()["id"]


def get_camera(cur, camera_id: int) -> Camera | None:
    cur.execute(f"SELECT {COLUMNS} FROM camera WHERE id = %s", (camera_id,))
    row = cur.fetchone()
    return Camera(**row) if row else None


def list_cameras(cur, *, department_id: int | None = None, status: str | None = None,
                 limit: int = 100, offset: int = 0) -> list[Camera]:
    cur.execute(
        f"SELECT {COLUMNS} FROM camera {FILTER} ORDER BY id LIMIT %s OFFSET %s",
        (department_id, department_id, status, status, limit, offset),
    )
    return [Camera(**row) for row in cur.fetchall()]


def count_cameras(cur, *, department_id: int | None = None, status: str | None = None) -> int:
    cur.execute(
        f"SELECT count(*) AS n FROM camera {FILTER}",
        (department_id, department_id, status, status),
    )
    return cur.fetchone()["n"]
