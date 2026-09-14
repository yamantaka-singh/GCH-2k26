"""Feed integrity: per-frame numpy checks, no model, no training data.

Five signals, each mapped straight from the design spec
(docs/superpowers/specs/2026-09-04-sentinel-design.md#81-feed-integrity-authentication):
frozen (repeated hash), looped (periodic hash), histogram_collapse (lens
covered/sprayed), noise_drift (substituted feed), timing_jitter (transcoding
or MITM). A FeedMonitor holds one camera's rolling state; call observe() per
sampled frame and act on whatever events it returns.
"""

from collections import deque
from dataclasses import dataclass, field

import numpy as np
from psycopg.types.json import Json

HASH_SIZE = 8  # 8x8 -> 64-bit perceptual hash
FROZEN_WINDOW = 3          # consecutive identical hashes -> frozen
FROZEN_HAMMING_MAX = 2     # near-identical still counts (compression noise)
LOOP_WINDOW = 30           # hashes kept for periodicity search
LOOP_MIN_PERIOD = 2
HISTOGRAM_WINDOW = 5
HISTOGRAM_COLLAPSE_DROP = 0.6   # entropy fraction drop vs rolling baseline
NOISE_BASELINE_FRAMES = 10
NOISE_DRIFT_SIGMA = 4.0         # std-devs from onboarding noise baseline
JITTER_WINDOW = 20
JITTER_TOLERANCE = 3.0          # x nominal interval std-dev


def perceptual_hash(frame: np.ndarray) -> int:
    """8x8 average-hash: resize, compare each cell to the mean. Cheap and
    stable under recompression, which is exactly the noise frozen/looped
    detection needs to ignore."""
    gray = frame.mean(axis=2) if frame.ndim == 3 else frame
    small = _resize_nearest(gray, HASH_SIZE, HASH_SIZE)
    bits = small > small.mean()
    return int("".join("1" if b else "0" for b in bits.flatten()), 2)


def _resize_nearest(arr: np.ndarray, h: int, w: int) -> np.ndarray:
    """Nearest-neighbour resize via index sampling. A real resample filter
    (PIL/cv2) buys nothing here -- the hash only needs coarse structure."""
    rows = (np.linspace(0, arr.shape[0] - 1, h)).astype(int)
    cols = (np.linspace(0, arr.shape[1] - 1, w)).astype(int)
    return arr[np.ix_(rows, cols)]


def hamming(a: int, b: int) -> int:
    return bin(a ^ b).count("1")


def _histogram_entropy(frame: np.ndarray) -> float:
    gray = frame.mean(axis=2) if frame.ndim == 3 else frame
    hist, _ = np.histogram(gray, bins=256, range=(0, 255), density=True)
    hist = hist[hist > 0]
    return float(-(hist * np.log2(hist)).sum())


def _noise_residual(frame: np.ndarray) -> np.ndarray:
    """High-frequency residual: frame minus a 3x3 box-blur of itself. Cheap
    stand-in for PRNU without a per-camera fingerprint enrollment step."""
    gray = frame.mean(axis=2) if frame.ndim == 3 else frame
    padded = np.pad(gray, 1, mode="edge")
    blurred = sum(
        padded[i : i + gray.shape[0], j : j + gray.shape[1]]
        for i in range(3)
        for j in range(3)
    ) / 9.0
    return gray - blurred


@dataclass
class IntegrityEvent:
    kind: str
    score: float
    evidence: dict


@dataclass
class FeedMonitor:
    """One instance per camera. Feed it decoded frames in order; it returns
    the events tripped by that frame, if any."""

    camera_id: int
    _hashes: deque = field(default_factory=lambda: deque(maxlen=LOOP_WINDOW))
    _entropies: deque = field(default_factory=lambda: deque(maxlen=HISTOGRAM_WINDOW))
    _timestamps: deque = field(default_factory=lambda: deque(maxlen=JITTER_WINDOW))
    _noise_baseline: list = field(default_factory=list)
    _noise_mean: float | None = None
    _noise_std: float | None = None

    def observe(self, frame: np.ndarray, ts: float) -> list[IntegrityEvent]:
        events = []
        h = perceptual_hash(frame)

        if frozen := self._check_frozen(h):
            events.append(frozen)
        if looped := self._check_loop(h):
            events.append(looped)
        self._hashes.append(h)

        entropy = _histogram_entropy(frame)
        if collapse := self._check_histogram(entropy):
            events.append(collapse)
        self._entropies.append(entropy)

        if drift := self._check_noise_drift(frame):
            events.append(drift)

        self._timestamps.append(ts)
        if jitter := self._check_jitter():
            events.append(jitter)

        return events

    def _check_frozen(self, h: int) -> IntegrityEvent | None:
        if len(self._hashes) < FROZEN_WINDOW:
            return None
        recent = list(self._hashes)[-(FROZEN_WINDOW - 1):] + [h]
        diffs = [hamming(recent[i], recent[i + 1]) for i in range(len(recent) - 1)]
        if all(d <= FROZEN_HAMMING_MAX for d in diffs):
            return IntegrityEvent("frozen", score=1.0 - max(diffs) / 64,
                                   evidence={"window": FROZEN_WINDOW, "max_hamming": max(diffs)})
        return None

    def _check_loop(self, h: int) -> IntegrityEvent | None:
        """Autocorrelation on the hash sequence: a period-k loop makes hashes
        k apart near-identical while adjacent hashes differ."""
        if len(self._hashes) < LOOP_MIN_PERIOD * 3:
            return None
        seq = list(self._hashes) + [h]
        for period in range(LOOP_MIN_PERIOD, len(seq) // 3):
            pairs = [(seq[i], seq[i + period]) for i in range(len(seq) - period)]
            avg_diff = sum(hamming(a, b) for a, b in pairs) / len(pairs)
            if avg_diff <= FROZEN_HAMMING_MAX:
                return IntegrityEvent("looped", score=1.0 - avg_diff / 64,
                                       evidence={"period": period, "avg_hamming": avg_diff})
        return None

    def _check_histogram(self, entropy: float) -> IntegrityEvent | None:
        if len(self._entropies) < HISTOGRAM_WINDOW:
            return None
        baseline = sum(self._entropies) / len(self._entropies)
        if baseline == 0:
            return None
        drop = (baseline - entropy) / baseline
        if drop >= HISTOGRAM_COLLAPSE_DROP:
            return IntegrityEvent("histogram_collapse", score=drop,
                                   evidence={"baseline_entropy": baseline, "entropy": entropy})
        return None

    def _check_noise_drift(self, frame: np.ndarray) -> IntegrityEvent | None:
        residual_std = float(_noise_residual(frame).std())
        if len(self._noise_baseline) < NOISE_BASELINE_FRAMES:
            self._noise_baseline.append(residual_std)
            if len(self._noise_baseline) == NOISE_BASELINE_FRAMES:
                arr = np.array(self._noise_baseline)
                self._noise_mean, self._noise_std = float(arr.mean()), float(arr.std())
            return None
        if not self._noise_std:  # baseline camera with zero variance -- nothing to drift from
            return None
        sigmas = abs(residual_std - self._noise_mean) / self._noise_std
        if sigmas >= NOISE_DRIFT_SIGMA:
            return IntegrityEvent("noise_drift", score=min(sigmas / (NOISE_DRIFT_SIGMA * 2), 1.0),
                                   evidence={"sigmas": sigmas, "residual_std": residual_std})
        return None

    def _check_jitter(self) -> IntegrityEvent | None:
        if len(self._timestamps) < JITTER_WINDOW:
            return None
        intervals = np.diff(np.array(self._timestamps))
        if intervals.size < 2:
            return None
        nominal = float(np.median(intervals))
        if nominal <= 0:
            return None
        std = float(intervals.std())
        if std / nominal >= JITTER_TOLERANCE / 10:  # tolerance expressed as %-of-nominal
            return IntegrityEvent("timing_jitter", score=min(std / nominal, 1.0),
                                   evidence={"nominal_interval": nominal, "stdev": std})
        return None


def persist_event(cur, *, camera_id: int, event: IntegrityEvent) -> int:
    cur.execute(
        """
        INSERT INTO integrity_event (camera_id, kind, score, evidence)
        VALUES (%s, %s, %s, %s)
        RETURNING id
        """,
        (camera_id, event.kind, event.score, Json(event.evidence)),
    )
    return cur.fetchone()["id"]
