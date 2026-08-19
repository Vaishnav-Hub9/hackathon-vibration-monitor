#!/usr/bin/env python3
"""
main.py — SmartBearing Hardware Lab: serial ingestion + ML anomaly pipeline
────────────────────────────────────────────────────────────────────────────
Consumes the JSON stream from hardware/motor_monitor.ino (9600 baud, one line
per second) and turns it into live predictive-maintenance decisions:

    Arduino (tach + DS18B20)
        │  {"rpm": 1440.0, "temperature": 28.5, "motorSpeed": 150}
        ▼
    main.py ── 30 s rolling-window features ──► dual anomaly engine
        │                                         ├─ hard thresholds
        │                                         │   (temp > 60 °C | RPM drop > 30 %)
        │                                         └─ IsolationForest health index
        ▼
    rich console dashboard  ·  predictive_maintenance_log.csv
        ▼ (optional)
    POST /api/hardware/ingest  ──► SmartBearing dashboard "Hardware Lab"

Quick start:
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python main.py                 # auto-detect the serial port
    python main.py --port COM3     # or pin it explicitly (Windows)
    python main.py --demo          # no Arduino? synthesize a realistic stream

On first run with no model.pkl the script records a 30 s calibration baseline
of normal operation, fits an IsolationForest to it, and saves the model — from
then on every sample is scored against that baseline.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
import time
from collections import deque
from datetime import datetime, timezone

import numpy as np

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    serial = None  # type: ignore
    list_ports = None  # type: ignore

try:
    from sklearn.ensemble import IsolationForest
    import joblib
except ImportError:
    IsolationForest = None  # type: ignore
    joblib = None  # type: ignore

try:
    from rich.console import Console
    from rich.live import Live
    from rich.table import Table
    from rich.panel import Panel
    from rich.text import Text
except ImportError:
    Console = None  # type: ignore
    Live = None  # type: ignore
    Table = None  # type: ignore
    Panel = None  # type: ignore
    Text = None  # type: ignore

# ────────────────────────────────── config ──────────────────────────────────

DEFAULT_BAUD = 9600
WINDOW_SECONDS = 30          # rolling statistics window (the spec's 30 s)
CALIBRATION_SECONDS = 30     # baseline length when model.pkl is missing
TEMP_CRITICAL_C = 60.0       # hard safety threshold #1
RPM_DROP_FRACTION = 0.30     # hard safety threshold #2 (sudden > 30 % drop)

MODEL_PATH = os.environ.get("SB_MODEL_PATH", os.path.join(os.path.dirname(__file__), "model.pkl"))
CSV_PATH = os.environ.get("SB_CSV_PATH", os.path.join(os.path.dirname(__file__), "predictive_maintenance_log.csv"))
API_URL = os.environ.get("SB_API_URL", "http://localhost:5001/api/hardware/ingest")
API_TOKEN = os.environ.get("SB_API_TOKEN", "")  # JWT from the dashboard login


# ─────────────────────────── serial port discovery ──────────────────────────

def find_serial_port(preferred: str | None = None) -> str | None:
    """Return the most likely Arduino port, or None if nothing is found."""
    if preferred:
        return preferred
    if list_ports is None:
        return None
    candidates = []
    for port in list_ports.comports():
        desc = (port.description or "").lower()
        if any(k in desc for k in ("arduino", "usb serial", "ch340", "cp210x")):
            candidates.append(port.device)
        elif port.device.lower().startswith(("/dev/ttyacm", "/dev/ttyusb")) or port.device.lower().startswith("com"):
            candidates.append(port.device)
    # Prefer ACM (native USB) over USB-serial bridges, then the last port.
    candidates.sort(key=lambda d: (not d.lower().startswith("/dev/ttyacm"), d))
    return candidates[0] if candidates else None


# ──────────────────────────── line parsing (safe) ───────────────────────────

def parse_line(raw: bytes) -> dict | None:
    """Parse one Arduino JSON line; return None on any corruption.

    Never raises. Corrupt frames (partial writes, electrical noise, a probe
    emitting garbage) are skipped so the pipeline keeps running.
    """
    try:
        text = raw.decode("utf-8", errors="ignore").strip()
        if not text:
            return None
        obj = json.loads(text)  # Arduino emits exactly one object per line
        rpm = float(obj.get("rpm"))
        temp = obj.get("temperature")
        temp = float(temp) if temp is not None else None
        speed = float(obj.get("motorSpeed", 0.0))
        # Reject physically impossible values (a corrupt frame can still be
        # valid JSON, e.g. NaN or 9e999).
        if not math.isfinite(rpm) or rpm < 0 or rpm > 100000:
            return None
        if temp is not None and (not math.isfinite(temp) or temp < -55 or temp > 125):
            return None
        return {"rpm": rpm, "temperature": temp, "motorSpeed": speed}
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


# ──────────────────────── rolling-window feature engine ─────────────────────

class RollingFeatures:
    """Maintain the 30 s sliding window and derive the model features.

    Features (all computed from the actual samples, updated every second):
      rpm_mean, rpm_std, temp_mean, temp_rate_of_change (°C/s slope over the
      window), rpm_temp_ratio.
    """

    def __init__(self, window: int = WINDOW_SECONDS) -> None:
        self.window = window
        self.rpm: deque[float] = deque(maxlen=window)
        self.temp: deque[float] = deque(maxlen=window)
        self.times: deque[float] = deque(maxlen=window)  # monotonic seconds

    def add(self, rpm: float, temp: float | None) -> None:
        self.rpm.append(rpm)
        self.temp.append(temp if temp is not None else float("nan"))
        self.times.append(time.monotonic())

    def features(self) -> dict[str, float] | None:
        if len(self.rpm) < 2:  # need at least a pair of samples for a slope
            return None
        rpm_arr = np.array(self.rpm)
        temp_arr = np.array(self.temp)
        valid_temp = temp_arr[np.isfinite(temp_arr)]
        times = np.array(self.times)

        temp_mean = float(np.mean(valid_temp)) if len(valid_temp) else float("nan")
        temp_roc = float("nan")
        if len(valid_temp) >= 2:
            # Slope of °C vs time over the window via least squares — this is
            # the temperature rate-of-change the spec asks for (°C/s).
            t_span = times[-1] - times[0]
            if t_span > 0 and len(valid_temp) >= 2:
                slope = np.polyfit(times[np.isfinite(temp_arr)], valid_temp, 1)[0]
                temp_roc = float(slope)

        return {
            "rpm_mean": float(np.mean(rpm_arr)),
            "rpm_std": float(np.std(rpm_arr)),
            "temp_mean": temp_mean,
            "temp_rate_of_change": temp_roc,
            "rpm_temp_ratio": float(rpm_arr[-1] / temp_mean) if temp_mean and temp_mean > 0 else 0.0,
        }

    def rpm_drop_fraction(self) -> float:
        """Fractional drop of the latest RPM vs the window mean (0..1)."""
        if len(self.rpm) < 3:
            return 0.0
        mean = float(np.mean(list(self.rpm)[:-1]))  # exclude the newest sample
        if mean <= 0:
            return 0.0
        return max(0.0, (mean - self.rpm[-1]) / mean)


# ─────────────────────────── dual anomaly engine ────────────────────────────

class AnomalyEngine:
    """Hard safety thresholds + IsolationForest health index.

    Verdict levels (matching the spec's dashboard colours):
      HEALTHY          (green)  — health_index >= 0.70
      WARNING/IMBALANCE (orange) — 0.35 <= health_index < 0.70
      BEARING FAULT/SEVERE (red) — health_index < 0.35 OR a hard threshold trip
    """

    def __init__(self) -> None:
        self.model = None
        self.calibrated = False

    def _vector(self, f: dict[str, float]) -> list[float]:
        order = ["rpm_mean", "rpm_std", "temp_mean", "temp_rate_of_change", "rpm_temp_ratio"]
        out = []
        for key in order:
            v = f.get(key)
            out.append(float(v) if v is not None and math.isfinite(float(v)) else 0.0)
        return out

    def score(self, f: dict[str, float]) -> float:
        """Health index 0..1 (1 = perfectly normal). Thresholds-only fallback
        when sklearn is unavailable."""
        if self.model is not None:
            x = np.array([self._vector(f)])
            # decision_function > 0 → inlier. Map to [0, 1] with a soft sigmoid
            # so small deviations stay "healthy" and big ones fall hard.
            d = float(self.model.decision_function(x)[0])
            return float(1.0 / (1.0 + math.exp(-3.0 * d)))
        # Fallback: distance-based proxy so the pipeline still works bare.
        if f["temp_mean"] and math.isfinite(f["temp_mean"]):
            return max(0.0, min(1.0, 1.0 - abs(f["temp_mean"] - 30.0) / 40.0))
        return 0.5

    def verdict(self, f: dict[str, float], temp: float | None, rpm_drop: float) -> tuple[str, str, float]:
        """Return (verdict, colour, health_index). Hard trips win outright."""
        hard_trip = False
        reason = ""
        if temp is not None and temp > TEMP_CRITICAL_C:
            hard_trip = True
            reason = f"TEMP {temp:.1f} °C > {TEMP_CRITICAL_C:.0f} °C"
        elif rpm_drop > RPM_DROP_FRACTION:
            hard_trip = True
            reason = f"RPM DROP {rpm_drop * 100:.0f} % > 30 %"

        health = self.score(f)
        if hard_trip:
            return ("BEARING FAULT / SEVERE", "red", 0.0)
        if health >= 0.70:
            return ("HEALTHY", "green", health)
        if health >= 0.35:
            return ("WARNING / IMBALANCE", "yellow", health)
        return ("BEARING FAULT / SEVERE", "red", health)


# ─────────────────────────── dashboard + logging ────────────────────────────

def write_csv(row: dict) -> None:
    """Append one structured row to predictive_maintenance_log.csv (idempotent
    header write, safe for long runs)."""
    new_file = not os.path.exists(CSV_PATH)
    fieldnames = [
        "timestamp_utc", "rpm", "temperature", "motor_speed",
        "rpm_mean", "rpm_std", "temp_mean", "temp_rate_of_change", "rpm_temp_ratio",
        "health_index", "verdict",
    ]
    with open(CSV_PATH, "a", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        if new_file:
            writer.writeheader()
        writer.writerow({k: row.get(k, "") for k in fieldnames})


def push_to_dashboard(row: dict) -> None:
    """Forward the current sample + features to the SmartBearing API so the
    Hardware Lab page reflects the real rig. Never crashes the loop on a
    network failure — the serial pipeline keeps running regardless."""
    try:
        import math
        import urllib.request

        # json.dumps would emit raw NaN/Infinity for missing-window features
        # (e.g. temp NaN while the probe is offline) — invalid JSON that the
        # API's body parser rejects. Sanitize non-finite floats to null first.
        safe = {
            k: (None if isinstance(v, float) and not math.isfinite(v) else v)
            for k, v in row.items()
        }
        payload = json.dumps(safe).encode("utf-8")
        req = urllib.request.Request(
            API_URL, data=payload, headers={"Content-Type": "application/json"}
        )
        if API_TOKEN:
            req.add_header("Authorization", f"Bearer {API_TOKEN}")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            if resp.status not in (200, 201):
                print(f"[warn] dashboard ingest returned {resp.status}")
    except Exception as exc:  # dashboard offline — log locally, keep going
        print(f"[warn] dashboard ingest failed: {exc}")


def render_table(row: dict) -> Table:
    table = Table(show_header=False, box=None, pad_edge=False)
    table.add_column(style="dim", width=20)
    table.add_column(style="bold white")
    table.add_row("Timestamp", row["timestamp_utc"])
    table.add_row("RPM", f"{row['rpm']:.1f}")
    table.add_row("Temperature", f"{row['temperature'] if row['temperature'] is not None else '—'} °C")
    table.add_row("Motor speed (PWM)", str(row["motor_speed"]))
    table.add_row("rpm_mean (30 s)", f"{row['rpm_mean']:.1f}")
    table.add_row("rpm_std (30 s)", f"{row['rpm_std']:.2f}")
    table.add_row("temp_mean (30 s)", f"{row['temp_mean']:.2f} °C")
    table.add_row("temp rate of change", f"{row['temp_rate_of_change']:+.3f} °C/s")
    table.add_row("rpm/temp ratio", f"{row['rpm_temp_ratio']:.1f}")
    table.add_row("Health index", f"{row['health_index']:.3f}")
    table.add_row("Verdict", Text(row["verdict"], style=f"bold {row['colour']}"))
    return table


# ──────────────────────────────── main loop ─────────────────────────────────

def open_serial(port: str | None, baud: int) -> serial.Serial:
    """Open the Arduino port, retrying forever so the pipeline survives the
    board being unplugged / replugged (the device may also re-enumerate under
    a NEW name, so re-detect every attempt)."""
    while True:
        try:
            found = find_serial_port(port)
            if not found:
                print("[warn] No serial port found — retrying in 3 s (plug in the Arduino)...")
                time.sleep(3)
                continue
            ser = serial.Serial(found, baud, timeout=1.0)
            print(f"[ok] Connected to {found} @ {baud} baud")
            return ser
        except serial.SerialException as exc:
            print(f"[warn] Serial open failed ({exc}) — retrying in 3 s...")
            time.sleep(3)


def main() -> None:
    parser = argparse.ArgumentParser(description="SmartBearing hardware ingestion pipeline")
    parser.add_argument("--port", default=None, help="Serial port (auto-detected if omitted)")
    parser.add_argument("--baud", type=int, default=DEFAULT_BAUD)
    parser.add_argument("--demo", action="store_true",
                        help="No Arduino? synthesize a realistic tach+temp stream")
    parser.add_argument("--no-dashboard", action="store_true",
                        help="Skip forwarding to the SmartBearing dashboard API")
    args = parser.parse_args()

    if serial is None and not args.demo:
        print("[fatal] pyserial not installed — run: pip install -r requirements.txt")
        sys.exit(1)

    # ── serial link (or demo generator) ──
    ser = None
    demo_start = time.monotonic()
    if not args.demo:
        ser = open_serial(args.port, args.baud)

    engine = AnomalyEngine()
    rolling = RollingFeatures()
    calibration_rows: deque[dict] = deque(maxlen=CALIBRATION_SECONDS)
    needs_calibration = not os.path.exists(MODEL_PATH)

    # Load a previously calibrated baseline so restarts keep scoring with the
    # real IsolationForest instead of falling back to the constant proxy.
    if not needs_calibration and joblib is not None:
        try:
            engine.model = joblib.load(MODEL_PATH)
            engine.calibrated = True
            print(f"[ok] Loaded calibrated baseline from {MODEL_PATH}")
        except Exception as exc:
            print(f"[warn] Could not load {MODEL_PATH} ({exc}) — will re-calibrate")

    console = Console()
    live = Live(console=console, refresh_per_second=1, screen=True)

    def demo_sample() -> dict:
        """Deterministic-ish demo stream: gentle healthy drift with an
        occasional slow temperature climb to exercise the anomaly engine."""
        t = time.monotonic() - demo_start
        cycle = int(t) % 300
        # Slow thermal ramp every 5 minutes, then recovery (simulates a load cycle)
        ramp = 28.0 + 2.0 * math.sin(2 * math.pi * cycle / 300.0)
        rpm = 1440.0 + 12.0 * math.sin(2 * math.pi * cycle / 60.0) + (8.0 * ((int(t) * 7919) % 100) - 400.0) / 100.0
        return {"rpm": max(0.0, rpm), "temperature": round(ramp, 2), "motorSpeed": 150.0}

    try:
        with live:
            while True:
                # ── acquire one sample ──
                if args.demo:
                    sample = demo_sample()
                    time.sleep(1.0)
                else:
                    try:
                        line = ser.readline()  # type: ignore[union-attr]
                    except serial.SerialException:
                        # Board unplugged / USB dropped — close, reconnect
                        # (re-detecting the port, its name can change), keep
                        # the model + feature window intact.
                        print("[warn] Serial connection lost — reconnecting...")
                        ser.close()  # type: ignore[union-attr]
                        ser = open_serial(args.port, args.baud)
                        continue
                    sample = parse_line(line)
                    if sample is None:
                        continue  # skip corrupt/empty frames, keep streaming

                rpm = sample["rpm"]
                temp = sample["temperature"]
                rolling.add(rpm, temp)
                feat = rolling.features()
                if feat is None:
                    continue  # still filling the window

                # ── auto-calibration: fit the baseline model once ──
                if needs_calibration:
                    calibration_rows.append(feat)
                    if len(calibration_rows) < CALIBRATION_SECONDS:
                        console.print(
                            f"[dim] Calibrating baseline… {len(calibration_rows)}/{CALIBRATION_SECONDS} s "
                            f"(run the rig at a known-normal state)",
                            end="\r",
                        )
                        continue
                    if IsolationForest is not None and joblib is not None:
                        X = np.array([engine._vector(f) for f in calibration_rows])
                        model = IsolationForest(
                            n_estimators=100, contamination=0.05, random_state=42
                        ).fit(X)
                        joblib.dump(model, MODEL_PATH)
                        engine.model = model
                        engine.calibrated = True
                        print(f"\n[ok] Calibration complete → saved {MODEL_PATH}")
                    needs_calibration = False
                    continue

                # ── dual anomaly engine ──
                verdict, colour, health = engine.verdict(
                    feat, temp, rolling.rpm_drop_fraction()
                )

                row = {
                    "timestamp_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "rpm": round(rpm, 1),
                    "temperature": temp,
                    "motor_speed": sample["motorSpeed"],
                    "rpm_mean": round(feat["rpm_mean"], 1),
                    "rpm_std": round(feat["rpm_std"], 2),
                    "temp_mean": round(feat["temp_mean"], 2),
                    "temp_rate_of_change": round(feat["temp_rate_of_change"], 4),
                    "rpm_temp_ratio": round(feat["rpm_temp_ratio"], 1),
                    "health_index": round(health, 3),
                    "verdict": verdict,
                    "colour": colour,
                }

                write_csv(row)
                if not args.no_dashboard:
                    push_to_dashboard(row)

                live.update(render_table(row))
    except KeyboardInterrupt:
        print("\n[bye] Stopped. Log so far →", CSV_PATH)


if __name__ == "__main__":
    main()
