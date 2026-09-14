import datetime as dt

import numpy as np

from scripts.vehicle_detection_report import draw_hud, rows_for_frame


def test_rows_keep_vehicles_only_with_given_timestamp():
    ts = dt.datetime(2026, 9, 15, 10, 3, 12, 500000, tzinfo=dt.timezone.utc)
    boxes = [
        (2.0, 41, 0.91, (10.2, 20.7, 110.0, 90.4)),  # car, tracked
        (0.0, 9, 0.99, (0, 0, 5, 5)),                # person: dropped
        (7.0, None, 0.55, (1, 2, 3, 4)),             # truck, no track id yet
    ]
    rows = rows_for_frame(boxes, timestamp=ts, video_time_s=12.5)
    assert [r["vehicle"] for r in rows] == ["car", "truck"]
    assert rows[0]["timestamp"] == "2026-09-15T10:03:12.500+00:00"
    assert (rows[0]["x1"], rows[0]["y2"]) == (10, 90)
    assert rows[0]["track_id"] == 41
    assert rows[1]["track_id"] == ""


def test_draw_hud_actually_draws_something():
    frame = np.full((200, 400, 3), 128, dtype=np.uint8)
    ts = dt.datetime(2026, 9, 15, 10, 3, 12, tzinfo=dt.timezone.utc)
    draw_hud(frame, timestamp=ts, counts={"car": 3, "bus": 1})
    assert not np.array_equal(frame, np.full((200, 400, 3), 128, dtype=np.uint8))


def test_draw_hud_handles_no_vehicles_yet():
    frame = np.full((200, 400, 3), 128, dtype=np.uint8)
    ts = dt.datetime(2026, 9, 15, 10, 3, 12, tzinfo=dt.timezone.utc)
    draw_hud(frame, timestamp=ts, counts={})  # must not crash before the first vehicle appears
