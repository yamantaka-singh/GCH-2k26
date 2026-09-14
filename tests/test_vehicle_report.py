import datetime as dt

from scripts.vehicle_detection_report import grid_rtsp_url, rows_for_frame


def test_grid_url_percent_encodes_credentials():
    url = grid_rtsp_url("cam04", "alice@example.com", "AB:CD/EF")
    assert url == "rtsp://alice%40example.com:AB%3ACD%2FEF@103.250.160.189:8554/stream/cam04"


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
