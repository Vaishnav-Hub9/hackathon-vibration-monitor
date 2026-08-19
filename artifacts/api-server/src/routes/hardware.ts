import { Router, Request, Response } from "express";
import { getIo } from "../socket.js";
import { logger } from "../lib/logger.js";
import { hardwareSimulator } from "../simulator/HardwareSimulator.js";

// ─────────────────────────────────────────────────────────────────────────────
// HARDWARE LAB — Arduino rig ingestion
//
// The physical rig (hardware/main.py, fed by the Arduino over serial) posts
// one sample per second here. The sample is normalised, pushed over Socket.io
// to the Hardware Lab page as `hardware:update`, and kept in a rolling ring
// buffer so the page can also fetch recent history on mount. When no Arduino
// is attached the HardwareSimulator feeds the exact same path, so the page's
// code path is identical for real hardware and demo mode.
// ─────────────────────────────────────────────────────────────────────────────

export interface HardwareReading {
  rpm: number;
  temperature: number | null;
  motorSpeed: number;
  rpm_mean: number;
  rpm_std: number;
  temp_mean: number;
  temp_rate_of_change: number;
  rpm_temp_ratio: number;
  health_index: number;
  verdict: string;
  colour: string;
  source: "arduino" | "simulator";
  timestamp: string;
}

const RING_SIZE = 300; // ~5 minutes at 1 Hz
const ring: HardwareReading[] = [];
let lastIngestAt = 0;
let ingestCount = 0;

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/** Normalise an ingest payload and broadcast it — used by both the HTTP route
 *  and the HardwareSimulator so every sample flows through one code path. */
export function ingestHardwareReading(raw: any, source: "arduino" | "simulator"): HardwareReading {
  const temp = raw.temperature;
  const temperature: number | null =
    typeof temp === "number" && Number.isFinite(temp) ? temp : null;

  const reading: HardwareReading = {
    rpm: Math.max(0, num(raw.rpm)),
    temperature,
    motorSpeed: Math.max(0, Math.min(255, num(raw.motorSpeed, raw.motor_speed))),
    rpm_mean: num(raw.rpm_mean),
    rpm_std: num(raw.rpm_std),
    temp_mean: num(raw.temp_mean),
    temp_rate_of_change: num(raw.temp_rate_of_change),
    rpm_temp_ratio: num(raw.rpm_temp_ratio),
    health_index: Math.max(0, Math.min(1, num(raw.health_index, 0.5))),
    verdict:
      typeof raw.verdict === "string" && raw.verdict.length > 0
        ? raw.verdict
        : "HEALTHY",
    colour: typeof raw.colour === "string" ? raw.colour : "green",
    source,
    timestamp: new Date().toISOString(),
  };

  ring.push(reading);
  if (ring.length > RING_SIZE) ring.shift();
  ingestCount += 1;
  lastIngestAt = Date.now();

  const io = getIo();
  // Broadcast globally (1 msg/s, same pattern as alert:new / ml:status) —
  // every dashboard client on the Hardware Lab page receives it.
  if (io) io.emit("hardware:update", reading);
  return reading;
}

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hardware/ingest — called by hardware/main.py once per second.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ingest", (req: Request, res: Response): void => {
  try {
    const body = req.body ?? {};
    if (typeof body.rpm !== "number" && typeof body.rpm_mean !== "number") {
      res.status(400).json({ success: false, error: "rpm (or rpm_mean) is required" });
      return;
    }
    const reading = ingestHardwareReading(body, "arduino");
    logger.info(
      { rpm: reading.rpm, temperature: reading.temperature, verdict: reading.verdict },
      "Hardware sample ingested",
    );
    res.json({ success: true, data: reading });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hardware/simulator/stop|start — when the physical rig is attached,
// stop the built-in demo stream so the page shows ONLY real Arduino readings
// (no alternating source, no mixed chart). Start re-enables demo mode.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/simulator/stop", (_req: Request, res: Response): void => {
  hardwareSimulator.stop();
  res.json({ success: true, data: { running: false } });
});

router.post("/simulator/start", (_req: Request, res: Response): void => {
  hardwareSimulator.start();
  res.json({ success: true, data: { running: true } });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/hardware/stream — recent ring buffer + live status (for page mount).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/stream", (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      readings: ring,
      latest: ring.length > 0 ? ring[ring.length - 1] : null,
      ingestCount,
      lastIngestAt,
      // Real-time liveness: frames arrive at 1 Hz, so >3.5 s of silence
      // means the rig (or its serial link) genuinely went down.
      online: Date.now() - lastIngestAt < 3_500,
    },
  });
});

export default router;
