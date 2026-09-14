"""Runs vehicle_detection_report against every documented grid camera (cam01..cam30)
and prints which ones are live. Reuses the existing script as a subprocess per camera
-- it already handles reconnect/backoff/no-video, no need to duplicate that here.

    uv run python -m scripts.probe_all_cameras            # 8s per camera
    uv run python -m scripts.probe_all_cameras --seconds 20 --count 10
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

CAMERA_COUNT = 30


def probe(camera_id: str, *, seconds: float, out_root: Path) -> dict:
    out = out_root / camera_id
    result = subprocess.run(
        [sys.executable, "-m", "scripts.vehicle_detection_report", camera_id,
         "--seconds", str(seconds), "--out", str(out)],
        capture_output=True, text=True, timeout=seconds * 3 + 60,
    )
    if result.returncode != 0:
        return {"camera_id": camera_id, "reachable": False,
                "error": result.stderr.strip().splitlines()[-1] if result.stderr.strip() else "failed"}
    summary = json.loads((out / "summary.json").read_text())
    return {"camera_id": camera_id, "reachable": True,
            "unique_vehicles": summary["unique_vehicles"], "duration_s": summary["duration_s"]}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--seconds", type=float, default=8.0, help="video to analyse per camera")
    p.add_argument("--count", type=int, default=CAMERA_COUNT, help="probe cam01..camNN")
    p.add_argument("--out", default="demo_media/analytics")
    args = p.parse_args()

    out_root = Path(args.out)
    results = []
    for i in range(1, args.count + 1):
        cam = f"cam{i:02d}"
        r = probe(cam, seconds=args.seconds, out_root=out_root)
        results.append(r)
        if r["reachable"]:
            print(f"{cam}: OK  {r['unique_vehicles'] or 'no vehicles'}")
        else:
            print(f"{cam}: unreachable ({r['error']})")

    (out_root / "all_cameras_summary.json").write_text(json.dumps(results, indent=2))
    live = [r for r in results if r["reachable"]]
    print(f"\n{len(live)}/{len(results)} cameras reachable; wrote {out_root / 'all_cameras_summary.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
