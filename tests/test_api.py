import pytest
from fastapi.testclient import TestClient

from src.registry.api import app, get_cursor
from src.registry.auth import create_user


@pytest.fixture
def client(cur, department):
    """Override the request-scoped cursor with the test transaction so API calls
    and assertions share one rolled-back transaction."""
    app.dependency_overrides[get_cursor] = lambda: cur
    create_user(cur, email="dept@gujarat.gov.in", password="pw",
                role="dept_admin", department_id=department)
    create_user(cur, email="view@gujarat.gov.in", password="pw", role="viewer")
    yield TestClient(app)
    app.dependency_overrides.clear()


def token(client, email):
    response = client.post("/auth/login", json={"email": email, "password": "pw"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_login_rejects_a_bad_password(client):
    response = client.post("/auth/login",
                           json={"email": "dept@gujarat.gov.in", "password": "nope"})
    assert response.status_code == 401


def test_listing_cameras_requires_a_token(client):
    assert client.get("/cameras").status_code == 401


def test_dept_admin_creates_a_camera_and_reads_it_back(client, department):
    headers = token(client, "dept@gujarat.gov.in")
    created = client.post("/cameras", headers=headers, json={
        "department_id": department, "name": "Sector 18", "lat": 23.2156, "lon": 72.6369,
    })
    assert created.status_code == 201
    camera_id = created.json()["id"]

    fetched = client.get(f"/cameras/{camera_id}", headers=headers)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Sector 18"
    assert fetched.json()["lat"] == pytest.approx(23.2156, abs=1e-6)


def test_viewer_cannot_create_a_camera(client, department):
    response = client.post("/cameras", headers=token(client, "view@gujarat.gov.in"),
                           json={"department_id": department, "name": "X",
                                 "lat": 23.0, "lon": 72.0})
    assert response.status_code == 403


def test_dept_admin_cannot_write_to_another_department(client, cur):
    cur.execute("INSERT INTO department (code, name) VALUES ('HLT', 'Health') RETURNING id")
    other = cur.fetchone()["id"]
    response = client.post("/cameras", headers=token(client, "dept@gujarat.gov.in"),
                           json={"department_id": other, "name": "X", "lat": 23.0, "lon": 72.0})
    assert response.status_code == 403


def test_missing_camera_returns_404(client):
    assert client.get("/cameras/999999",
                      headers=token(client, "view@gujarat.gov.in")).status_code == 404


def test_csv_import_reports_inserted_and_errors(client, department):
    csv_text = "name,lat,lon\nGood,23.0,72.0\nBad,999,72.0\n"
    response = client.post(
        "/cameras/import",
        headers=token(client, "dept@gujarat.gov.in"),
        data={"department_id": str(department)},
        files={"file": ("cams.csv", csv_text, "text/csv")},
    )
    assert response.status_code == 200
    assert response.json()["inserted"] == 1
    assert response.json()["errors"] == [
        {"line": 3, "message": "coordinates out of range: 999.0, 72.0"}
    ]


def test_geojson_endpoint_returns_a_feature_collection(client, department):
    headers = token(client, "dept@gujarat.gov.in")
    client.post("/cameras", headers=headers, json={
        "department_id": department, "name": "A", "lat": 23.0, "lon": 72.0})
    body = client.get("/geo/cameras.geojson", headers=headers).json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) == 1


def test_gaps_endpoint_returns_polygons(client):
    response = client.get(
        "/geo/gaps",
        headers=token(client, "view@gujarat.gov.in"),
        params={"min_lon": 72.60, "min_lat": 23.20, "max_lon": 72.61, "max_lat": 23.21,
                "cell_m": 500, "radius_m": 300},
    )
    assert response.status_code == 200
    assert response.json()["cells"][0]["type"] == "Polygon"
