import pytest

from src.registry.cameras import count_cameras, create_camera, get_camera, list_cameras


def test_create_and_read_back_preserves_coordinates(cur, department):
    camera_id = create_camera(
        cur, department_id=department, name="Sector 18 Junction",
        lat=23.2156, lon=72.6369, vendor="Hikvision", kind="ip",
    )
    camera = get_camera(cur, camera_id)
    assert camera.name == "Sector 18 Junction"
    assert camera.vendor == "Hikvision"
    assert camera.lat == pytest.approx(23.2156, abs=1e-6)
    assert camera.lon == pytest.approx(72.6369, abs=1e-6)


def test_get_camera_returns_none_when_absent(cur):
    assert get_camera(cur, 999999) is None


def test_list_filters_by_department_and_status(cur, department):
    cur.execute("INSERT INTO department (code, name) VALUES ('GSRTC', 'Transport') RETURNING id")
    other = cur.fetchone()["id"]
    create_camera(cur, department_id=department, name="A", lat=23.0, lon=72.0)
    create_camera(cur, department_id=department, name="B", lat=23.1, lon=72.1, status="inactive")
    create_camera(cur, department_id=other, name="C", lat=23.2, lon=72.2)

    assert [c.name for c in list_cameras(cur, department_id=department)] == ["A", "B"]
    assert [c.name for c in list_cameras(cur, status="active")] == ["A", "C"]
    assert count_cameras(cur, department_id=department) == 2


def test_list_paginates(cur, department):
    for i in range(5):
        create_camera(cur, department_id=department, name=f"C{i}", lat=23.0, lon=72.0)
    page = list_cameras(cur, limit=2, offset=2)
    assert [c.name for c in page] == ["C2", "C3"]
