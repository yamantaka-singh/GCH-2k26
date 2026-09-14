import numpy as np
import pytest

from src.registry.integrity import (
    FeedMonitor,
    HISTOGRAM_WINDOW,
    JITTER_WINDOW,
    LOOP_MIN_PERIOD,
    NOISE_BASELINE_FRAMES,
    perceptual_hash,
    persist_event,
)


def _noisy_frame(rng, base=128, noise=15, size=(64, 64)):
    return np.clip(rng.normal(base, noise, size), 0, 255)


def test_identical_frames_trip_frozen():
    rng = np.random.default_rng(0)
    monitor = FeedMonitor(camera_id=1)
    frame = _noisy_frame(rng)
    events = []
    for i in range(5):
        events += monitor.observe(frame, ts=float(i))
    assert any(e.kind == "frozen" for e in events)


def test_varied_frames_do_not_trip_frozen():
    rng = np.random.default_rng(1)
    monitor = FeedMonitor(camera_id=1)
    events = []
    for i in range(5):
        events += monitor.observe(_noisy_frame(rng), ts=float(i))
    assert not any(e.kind == "frozen" for e in events)


def test_looped_sequence_trips_looped():
    rng = np.random.default_rng(2)
    loop = [_noisy_frame(rng) for _ in range(LOOP_MIN_PERIOD + 1)]
    monitor = FeedMonitor(camera_id=1)
    events = []
    for i in range(20):
        events += monitor.observe(loop[i % len(loop)], ts=float(i))
    assert any(e.kind == "looped" for e in events)


def test_histogram_collapse_on_sudden_flat_frame():
    rng = np.random.default_rng(3)
    monitor = FeedMonitor(camera_id=1)
    events = []
    for i in range(HISTOGRAM_WINDOW):
        events += monitor.observe(_noisy_frame(rng), ts=float(i))
    flat = np.full((64, 64), 10.0)  # lens sprayed: near-uniform frame
    events += monitor.observe(flat, ts=float(HISTOGRAM_WINDOW))
    assert any(e.kind == "histogram_collapse" for e in events)


def test_noise_drift_after_baseline_established():
    rng = np.random.default_rng(4)
    monitor = FeedMonitor(camera_id=1)
    for i in range(NOISE_BASELINE_FRAMES):
        monitor.observe(_noisy_frame(rng, noise=2), ts=float(i))
    injected = _noisy_frame(rng, noise=60)  # substituted feed: much noisier
    events = monitor.observe(injected, ts=float(NOISE_BASELINE_FRAMES))
    assert any(e.kind == "noise_drift" for e in events)


def test_timing_jitter_on_irregular_intervals():
    rng = np.random.default_rng(5)
    monitor = FeedMonitor(camera_id=1)
    events = []
    t = 0.0
    for i in range(JITTER_WINDOW + 1):
        t += 0.5 if i % 2 == 0 else 5.0  # wildly irregular vs a steady 2fps feed
        events += monitor.observe(_noisy_frame(rng), ts=t)
    assert any(e.kind == "timing_jitter" for e in events)


def test_perceptual_hash_is_64_bit():
    rng = np.random.default_rng(6)
    h = perceptual_hash(_noisy_frame(rng))
    assert 0 <= h < 2**64


def test_persist_event_writes_row(cur, department):
    cur.execute(
        "INSERT INTO camera (department_id, name, geom) "
        "VALUES (%s, 'Cam', ST_SetSRID(ST_MakePoint(72.5, 23.0), 4326)::geography) "
        "RETURNING id",
        (department,),
    )
    camera_id = cur.fetchone()["id"]
    from src.registry.integrity import IntegrityEvent

    event_id = persist_event(
        cur, camera_id=camera_id,
        event=IntegrityEvent("frozen", score=0.9, evidence={"window": 3}),
    )
    cur.execute("SELECT kind, score FROM integrity_event WHERE id = %s", (event_id,))
    row = cur.fetchone()
    assert row["kind"] == "frozen"
    assert row["score"] == pytest.approx(0.9)
