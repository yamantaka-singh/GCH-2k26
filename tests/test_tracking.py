from src.registry.tracking import movement_history, record_sighting, watchlist_match


def _camera(cur, department_id, name):
    cur.execute(
        "INSERT INTO camera (department_id, name, geom) "
        "VALUES (%s, %s, ST_SetSRID(ST_MakePoint(72.5, 23.0), 4326)::geography) "
        "RETURNING id",
        (department_id, name),
    )
    return cur.fetchone()["id"]


def test_movement_history_orders_sightings_across_cameras(cur, department):
    cam_a = _camera(cur, department, "Cam A")
    cam_c = _camera(cur, department, "Cam C")

    record_sighting(cur, camera_id=cam_c, plate="gj01ab1234", confidence=0.9)
    cur.execute("UPDATE plate_sighting SET ts = ts - interval '4 minutes' WHERE camera_id = %s", (cam_c,))
    record_sighting(cur, camera_id=cam_a, plate="GJ01AB1234", confidence=0.95)

    history = movement_history(cur, plate="gj01ab1234")
    assert [row["camera_id"] for row in history] == [cam_c, cam_a]


def test_movement_history_excludes_other_plates(cur, department):
    cam = _camera(cur, department, "Cam")
    record_sighting(cur, camera_id=cam, plate="GJ01AB1234", confidence=0.9)
    record_sighting(cur, camera_id=cam, plate="GJ05CD5678", confidence=0.9)

    history = movement_history(cur, plate="GJ01AB1234")
    assert len(history) == 1


def test_watchlist_match_is_case_insensitive_and_active_only(cur):
    cur.execute(
        "INSERT INTO watchlist (plate, reason, added_by, active) VALUES (%s, %s, %s, true)",
        ("GJ01AB1234", "stolen vehicle", "state_admin"),
    )
    cur.execute(
        "INSERT INTO watchlist (plate, reason, added_by, active) VALUES (%s, %s, %s, false)",
        ("GJ05CD5678", "resolved case", "state_admin"),
    )

    match = watchlist_match(cur, plate="gj01ab1234")
    assert match is not None
    assert match["reason"] == "stolen vehicle"

    assert watchlist_match(cur, plate="GJ05CD5678") is None
    assert watchlist_match(cur, plate="GJ99ZZ0000") is None
