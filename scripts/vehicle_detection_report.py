"""Vehicle detection report for the organiser's camera grid.

Reads a grid camera (by id), a stream URL, or a video file; analyses ~2 frames
per second (the HLD's sampling rate) with a pretrained YOLO model filtered to
vehicle classes, tracked (not just detected) so the same vehicle across many
frames is one count, not one row per frame; and writes:
  <out>/report.csv     one row per (vehicle, frame) sighting, with timestamps
  <out>/summary.json   unique vehicle counts by class -- the number that matters
  <out>/annotated.mp4  the analysed frames with boxes and track ids drawn

Grid camera:  uv run python -m scripts.vehicle_detection_report cam04 --seconds 120
Recording:    uv run python -m scripts.vehicle_detection_report clip.mp4 --start 2026-09-15T10:03:00+05:30

A camera id is read over RTSP using RTSP_EMAIL / RTSP_PASSWORD from .env, so the
password never appears on the command line or in any output.

Known limitations (pretrained COCO model, not fixable without retraining):
- Auto-rickshaws are detected as "car" -- COCO has no auto-rickshaw class.
- Two-wheelers are frequently missed at night regardless of model size or
  resolution; this feed needs a model trained on Indian traffic to fix.
Timestamps are the wall-clock time of capture; a looped/recorded feed's own
on-screen clock overlay is unrelated to when this script actually read it.
"""

import argparse
import csv
import datetime as dt
import os
import re
import sys
import time
from pathlib import Path

from src.registry.grid import load_credentials, rtsp_url as grid_rtsp_url

VEHICLE_CLASSES = {1: "bicycle", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}  # COCO ids
FIELDS = ["timestamp", "video_time_s", "track_id", "vehicle", "confidence", "x1", "y1", "x2", "y2"]
MAX_BACKOFF_S = 30


def rows_for_frame(boxes, *, timestamp: dt.datetime, video_time_s: float) -> list[dict]:
    """boxes: iterable of (class_id, track_id, confidence, (x1, y1, x2, y2)). track_id
    is None on the rare frame the tracker hasn't assigned one yet. Non-vehicles dropped."""
    ts = timestamp.isoformat(timespec="milliseconds")
    return [
        {"timestamp": ts, "video_time_s": round(video_time_s, 2),
         "track_id": int(track_id) if track_id is not None else "",
         "vehicle": VEHICLE_CLASSES[int(cls)], "confidence": round(conf, 3),
         "x1": round(x1), "y1": round(y1), "x2": round(x2), "y2": round(y2)}
        for cls, track_id, conf, (x1, y1, x2, y2) in boxes
        if int(cls) in VEHICLE_CLASSES
    ]


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", help="grid camera id (cam01..cam30), stream URL, or video file")
    p.add_argument("--out", help="output directory (default demo_media/analytics/<source>)")
    p.add_argument("--fps", type=float, default=2.0, help="frames per second to analyse")
    p.add_argument("--seconds", type=float, help="how much video to analyse (required for live sources)")
    p.add_argument("--start", type=dt.datetime.fromisoformat,
                   help="wall-clock time of a recording's first frame (live sources use the clock)")
    p.add_argument("--conf", type=float, default=0.35)
    p.add_argument("--model", default="yolo11n.pt")
    args = p.parse_args()

    is_camera = re.fullmatch(r"cam\d+", args.source) is not None
    live = is_camera or "://" in args.source
    if live and not args.seconds:
        p.error("--seconds is required for a live source; the grid never ends")
    url = args.source
    if is_camera:
        creds = load_credentials()
        if creds is None:
            p.error("RTSP_EMAIL and RTSP_PASSWORD must be set in .env")
        url = grid_rtsp_url(args.source, *creds)

    # UDP across NAT gives corrupt frames that look like model bugs (grid guide, section 3).
    os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
    import cv2
    import torch
    from ultralytics import YOLO

    model = YOLO(args.model)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    out = Path(args.out or f"demo_media/analytics/{Path(args.source).stem}")
    out.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    if not cap.isOpened():
        print(f"could not open {args.source}", file=sys.stderr)  # never echo url: it carries the password
        return 1

    # Wall-clock backstop so a feed that never comes back (or never advances PTS)
    # cannot hang a live run.
    deadline = time.monotonic() + (args.seconds or 0) * 2 + 60
    anchor = args.start or dt.datetime.now().astimezone()
    base = 0.0          # video seconds analysed before the current connection
    first_pts = None
    elapsed, next_sample, backoff = 0.0, 0.0, 2
    writer = size = None
    row_counts: dict[str, int] = {}
    unique_tracks: dict[str, set] = {}
    analysed = 0
    try:
        with open(out / "report.csv", "w", newline="") as f:
            report = csv.DictWriter(f, fieldnames=FIELDS)
            report.writeheader()
            while not (args.seconds and elapsed >= args.seconds):
                if live and time.monotonic() > deadline:
                    print(f"{args.source}: gave up waiting for video", file=sys.stderr)
                    break
                ok, img = cap.read()
                if not ok:
                    if not live:
                        break
                    # Feeds are supervised and restart; back off, never tight-loop (guide, section 3).
                    cap.release()
                    print(f"{args.source} dropped at {elapsed:.1f}s; reconnecting in {backoff}s", file=sys.stderr)
                    time.sleep(backoff)
                    backoff = min(backoff * 2, MAX_BACKOFF_S)
                    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
                    base, first_pts = elapsed, None
                    continue
                backoff = 2

                # Time comes from PTS: CAP_PROP_FPS is unreliable and the join-time GOP
                # arrives faster than real time (guide, section 3).
                pts = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
                if first_pts is None:
                    first_pts = pts
                    if live:
                        # ponytail: the first frame's wall time is "now" to within the
                        # replayed GOP (~1-2 s). Use the grid's clock if it ever exposes one.
                        anchor = dt.datetime.now().astimezone()
                offset = pts - first_pts
                elapsed = base + offset

                # .track() (not .predict()) runs on EVERY frame, not just sampled ones:
                # ByteTrack's motion model needs consecutive frames to hold an id across
                # time -- feeding it only the ~2fps sample lost every moving vehicle's id
                # within one gap (only a stationary bus survived that). Inference itself
                # is cheap (~13ms/frame on this Mac's MPS), so tracking every frame costs
                # nothing worth trading accuracy for.
                result = model.track(img, conf=args.conf, classes=list(VEHICLE_CLASSES),
                                     device=device, persist=True, verbose=False)[0]
                b = result.boxes
                ids = b.id.tolist() if b.id is not None else [None] * len(b)
                rows = rows_for_frame(zip(b.cls.tolist(), ids, b.conf.tolist(), b.xyxy.tolist()),
                                      timestamp=anchor + dt.timedelta(seconds=offset),
                                      video_time_s=elapsed)
                for r in rows:
                    if r["track_id"] != "":
                        unique_tracks.setdefault(r["vehicle"], set()).add(r["track_id"])

                if elapsed < next_sample:
                    continue
                next_sample = elapsed + 1 / args.fps

                report.writerows(rows)
                f.flush()
                for r in rows:
                    row_counts[r["vehicle"]] = row_counts.get(r["vehicle"], 0) + 1

                annotated = result.plot()
                if writer is None:
                    size = (annotated.shape[1], annotated.shape[0])
                    writer = cv2.VideoWriter(str(out / "annotated.mp4"),
                                             cv2.VideoWriter_fourcc(*"mp4v"), args.fps, size)
                if (annotated.shape[1], annotated.shape[0]) != size:
                    annotated = cv2.resize(annotated, size)  # a restarted feed may change resolution
                writer.write(annotated)
                analysed += 1
    except KeyboardInterrupt:
        print("stopped early; report and video keep what was analysed", file=sys.stderr)
    finally:
        cap.release()
        if writer:
            writer.release()

    if analysed == 0:
        print(f"{args.source}: no frames analysed", file=sys.stderr)
        return 1

    unique_counts = {k: len(v) for k, v in unique_tracks.items()}
    import json
    (out / "summary.json").write_text(json.dumps({
        "source": args.source, "analysed_frames": analysed, "duration_s": round(elapsed, 1),
        "unique_vehicles": unique_counts, "detection_rows": row_counts,
        "note": "unique_vehicles counts distinct tracker ids, not detection rows; "
                "a vehicle in view for many frames is still one count here.",
    }, indent=2))
    print(f"{args.source}: analysed {analysed} frames over {elapsed:.0f}s of video on {device}")
    print(f"unique vehicles: {unique_counts or 'none'}  (raw detection rows: {row_counts or 'none'})")
    print(f"wrote {out / 'report.csv'}, {out / 'summary.json'}, and {out / 'annotated.mp4'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
