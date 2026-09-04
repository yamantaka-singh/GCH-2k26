from typing import Literal

import jwt
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from . import cameras as camera_queries
from . import geo, health
from .auth import authenticate, decode_token, issue_token, may_write
from .db import pool
from .importer import import_csv

app = FastAPI(title="Sentinel CCTV Registry")
app.add_middleware(
    CORSMiddleware, allow_origins=["http://localhost:5173"],
    allow_methods=["*"], allow_headers=["*"],
)
bearer = HTTPBearer(auto_error=False)


def get_cursor():
    """Overridden in tests to hand back the rolled-back test transaction."""
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur


def claims(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="missing bearer token")
    try:
        return decode_token(credentials.credentials)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid token")


class LoginBody(BaseModel):
    email: str
    password: str


class CameraBody(BaseModel):
    department_id: int
    name: str = Field(min_length=1)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    external_ref: str | None = None
    address: str | None = None
    # Mirrors the camera_kind/storage_kind/camera_status Postgres enums (migration
    # 002). Without this, an invalid value reaches the DB uncaught and 500s;
    # pydantic now rejects it with a 422 before the request is even routed.
    kind: Literal["analog", "ip"] = "ip"
    vendor: str | None = None
    model: str | None = None
    rtsp_url: str | None = None
    resolution: str | None = None
    fps: int | None = None
    storage: Literal["local", "cloud", "unknown"] = "unknown"
    retention_days: int | None = None
    status: Literal["active", "inactive", "decommissioned"] = "active"


class CameraUpdateBody(BaseModel):
    # All optional: a PATCH only touches the fields the client actually sends.
    # exclude_unset (below) is what distinguishes "omitted" from "sent as null".
    name: str | None = Field(default=None, min_length=1)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    external_ref: str | None = None
    address: str | None = None
    kind: Literal["analog", "ip"] | None = None
    vendor: str | None = None
    model: str | None = None
    rtsp_url: str | None = None
    resolution: str | None = None
    fps: int | None = None
    storage: Literal["local", "cloud", "unknown"] | None = None
    retention_days: int | None = None
    status: Literal["active", "inactive", "decommissioned"] | None = None


@app.post("/auth/login")
def login(body: LoginBody, cur=Depends(get_cursor)):
    user = authenticate(cur, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="invalid credentials")
    token = issue_token(user_id=user["id"], role=user["role"],
                        department_id=user["department_id"])
    return {"access_token": token, "token_type": "bearer", "role": user["role"],
            "department_id": user["department_id"]}


@app.get("/departments")
def departments(cur=Depends(get_cursor), _=Depends(claims)):
    cur.execute("SELECT id, code, name FROM department ORDER BY name")
    return cur.fetchall()


@app.get("/cameras")
def list_cameras(department_id: int | None = None, status: str | None = None,
                 limit: int = 100, offset: int = 0,
                 cur=Depends(get_cursor), _=Depends(claims)):
    rows = camera_queries.list_cameras(cur, department_id=department_id, status=status,
                                       limit=min(limit, 500), offset=offset)
    return {"total": camera_queries.count_cameras(cur, department_id=department_id,
                                                  status=status),
            "items": [vars(row) for row in rows]}


@app.post("/cameras", status_code=201)
def create_camera(body: CameraBody, cur=Depends(get_cursor), user=Depends(claims)):
    if not may_write(user, body.department_id):
        raise HTTPException(status_code=403, detail="not permitted for this department")
    return {"id": camera_queries.create_camera(cur, **body.model_dump())}


@app.get("/cameras/{camera_id}")
def get_camera(camera_id: int, cur=Depends(get_cursor), _=Depends(claims)):
    camera = camera_queries.get_camera(cur, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="no such camera")
    return vars(camera)


@app.patch("/cameras/{camera_id}")
def update_camera(camera_id: int, body: CameraUpdateBody,
                  cur=Depends(get_cursor), user=Depends(claims)):
    existing = camera_queries.get_camera(cur, camera_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="no such camera")
    if not may_write(user, existing.department_id):
        raise HTTPException(status_code=403, detail="not permitted for this department")
    fields = body.model_dump(exclude_unset=True)
    if ("lat" in fields) != ("lon" in fields):
        raise HTTPException(status_code=400, detail="lat and lon must be provided together")
    return vars(camera_queries.update_camera(cur, camera_id, **fields))


@app.post("/cameras/import")
def import_cameras(department_id: int = Form(...), file: UploadFile = File(...),
                   cur=Depends(get_cursor), user=Depends(claims)):
    if not may_write(user, department_id):
        raise HTTPException(status_code=403, detail="not permitted for this department")
    try:
        result = import_csv(cur, department_id, file.file.read().decode("utf-8-sig"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"inserted": result.inserted,
            "errors": [{"line": line, "message": message} for line, message in result.errors]}


@app.get("/cameras/{camera_id}/health")
def camera_health(camera_id: int, cur=Depends(get_cursor), _=Depends(claims)):
    check = health.latest_health(cur, camera_id)
    return vars(check) if check else {"camera_id": camera_id, "reachable": None}


@app.get("/health/summary")
def health_totals(cur=Depends(get_cursor), _=Depends(claims)):
    return health.health_summary(cur)


@app.get("/geo/cameras.geojson")
def cameras_geojson(department_id: int | None = None,
                    cur=Depends(get_cursor), _=Depends(claims)):
    return geo.cameras_geojson(cur, department_id=department_id)


@app.get("/geo/gaps")
def gaps(min_lon: float, min_lat: float, max_lon: float, max_lat: float,
         cell_m: int = 500, radius_m: int = 300,
         cur=Depends(get_cursor), _=Depends(claims)):
    try:
        cells = geo.coverage_gaps(cur, min_lon=min_lon, min_lat=min_lat,
                                  max_lon=max_lon, max_lat=max_lat,
                                  cell_m=cell_m, radius_m=radius_m)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"cells": cells}
