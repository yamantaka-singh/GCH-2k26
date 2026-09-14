"""Access to the organiser's camera grid (cctv.corp8.cloud), per its
integrator guide: RTSP and WHEP authenticate via credentials embedded in the
URL, on the grid's public IP rather than the CDN host (a CDN can't proxy
RTSP/WebRTC's TCP/UDP media). The email's @ must be percent-encoded as %40.
"""

import os
import re
from urllib.parse import quote

from dotenv import load_dotenv

RTSP_HOST = "103.250.160.189:8554"
WHEP_HOST = "103.250.160.189:8889"
_GRID_CAMERA_ID = re.compile(r"^cam\d+$", re.IGNORECASE)


def grid_camera_id(external_ref: str | None) -> str | None:
    """The registry's external_ref for a real grid camera (e.g. "cam01");
    None for anything else (imported test/demo rows, no live feed to show)."""
    if external_ref and _GRID_CAMERA_ID.match(external_ref):
        return external_ref.lower()
    return None


def load_credentials() -> tuple[str, str] | None:
    load_dotenv()
    email, password = os.environ.get("RTSP_EMAIL"), os.environ.get("RTSP_PASSWORD")
    return (email, password) if email and password else None


def rtsp_url(camera_id: str, email: str, password: str) -> str:
    return f"rtsp://{quote(email, safe='')}:{quote(password, safe='')}@{RTSP_HOST}/stream/{camera_id}"


def whep_url(camera_id: str, email: str, password: str) -> str:
    """Documented by the grid as the low-latency browser-preview endpoint --
    a native WebRTC client POSTs an SDP offer here and gets an answer back."""
    return f"http://{quote(email, safe='')}:{quote(password, safe='')}@{WHEP_HOST}/stream/{camera_id}/whep"
