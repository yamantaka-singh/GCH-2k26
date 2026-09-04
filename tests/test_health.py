import socket
import threading

from src.registry.cameras import create_camera, get_camera
from src.registry.db import cursor
from workers.health_probe import sweep
from src.registry.health import health_summary, latest_health, probe, record_check


def _listening_port() -> int:
    """A real socket beats mocking: it proves the probe does TCP, not that we
    called a function."""
    server = socket.socket()
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    port = server.getsockname()[1]
    threading.Thread(target=lambda: server.accept(), daemon=True).start()
    return port


def test_probe_reports_reachable_for_an_open_port():
    reachable, latency_ms, error = probe(f"rtsp://127.0.0.1:{_listening_port()}/stream")
    assert reachable is True
    assert latency_ms is not None and latency_ms >= 0
    assert error is None


def test_probe_reports_unreachable_for_a_closed_port():
    reachable, latency_ms, error = probe("rtsp://127.0.0.1:1/stream", timeout=0.5)
    assert reachable is False
    assert latency_ms is None
    assert error


def test_probe_rejects_a_url_with_no_host():
    reachable, _, error = probe("not-a-url")
    assert reachable is False
    assert "host" in error


def test_recording_a_check_updates_last_seen(cur, department):
    camera_id = create_camera(cur, department_id=department, name="A", lat=23.0, lon=72.0)
    record_check(cur, camera_id, reachable=True, latency_ms=12)
    assert latest_health(cur, camera_id).reachable is True
    assert get_camera(cur, camera_id).last_seen_at is not None


def test_failed_check_does_not_update_last_seen(cur, department):
    camera_id = create_camera(cur, department_id=department, name="A", lat=23.0, lon=72.0)
    record_check(cur, camera_id, reachable=False, error="timed out")
    assert latest_health(cur, camera_id).reachable is False
    assert get_camera(cur, camera_id).last_seen_at is None


def test_summary_counts_never_checked_as_unknown(cur, department):
    up = create_camera(cur, department_id=department, name="Up", lat=23.0, lon=72.0)
    down = create_camera(cur, department_id=department, name="Down", lat=23.1, lon=72.1)
    create_camera(cur, department_id=department, name="Never", lat=23.2, lon=72.2)
    record_check(cur, up, reachable=True, latency_ms=5)
    record_check(cur, down, reachable=False, error="refused")

    assert health_summary(cur) == {"total": 3, "reachable": 1, "unreachable": 1, "unknown": 1}


def test_sweep_probes_active_cameras_with_a_url_and_skips_the_rest():
    """sweep() opens its own connection via cursor(), separate from the cur
    fixture's rolled-back transaction, so it needs real committed rows -- and
    must clean them up itself rather than relying on rollback."""
    open_port = _listening_port()
    with cursor() as cur:
        cur.execute(
            "INSERT INTO department (code, name) VALUES ('SWEEP_T', 'sweep test')"
            " ON CONFLICT (code) DO NOTHING"
        )
        cur.execute("SELECT id FROM department WHERE code = 'SWEEP_T'")
        dept_id = cur.fetchone()["id"]
        reachable_id = create_camera(cur, department_id=dept_id, name="reachable",
                                     lat=23.0, lon=72.0,
                                     rtsp_url=f"rtsp://127.0.0.1:{open_port}/x")
        unreachable_id = create_camera(cur, department_id=dept_id, name="unreachable",
                                       lat=23.1, lon=72.1, rtsp_url="rtsp://127.0.0.1:1/x")
        no_url_id = create_camera(cur, department_id=dept_id, name="no-url",
                                  lat=23.2, lon=72.2)

    try:
        assert sweep() == 2  # the no-url camera is never a target

        with cursor() as cur:
            assert latest_health(cur, reachable_id).reachable is True
            assert latest_health(cur, unreachable_id).reachable is False
            assert latest_health(cur, no_url_id) is None
    finally:
        with cursor() as cur:
            cur.execute(
                "DELETE FROM camera_health WHERE camera_id = ANY(%s)",
                ([reachable_id, unreachable_id, no_url_id],),
            )
            cur.execute("DELETE FROM camera WHERE department_id = %s", (dept_id,))
            cur.execute("DELETE FROM department WHERE id = %s", (dept_id,))
