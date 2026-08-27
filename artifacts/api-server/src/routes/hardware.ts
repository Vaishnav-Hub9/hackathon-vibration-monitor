import { Router, Request, Response } from "express";
import { getIo } from "../socket.js";
import { logger } from "../lib/logger.js";
import { Machine } from "../models/Machine.js";
import { SpindleReading } from "../models/SpindleReading.js";
import { Alert } from "../models/Alert.js";
import { User } from "../models/User.js";
import { getPreventionTips } from "../lib/prevention.js";
import { notifyMailAlert } from "../lib/mail.js";
import { notifyWhatsAppAlert, isWhatsAppConfigured } from "../lib/whatsapp.js";
import { hardwareSimulator } from "../simulator/HardwareSimulator.js";
import { authenticateJWT, requireRoles } from "../middleware/auth.js";

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
  source: "arduino" | "simulator" | "manual";
  timestamp: string;
}

const RING_SIZE = 300; // ~5 minutes at 1 Hz
const ring: HardwareReading[] = [];
let lastIngestAt = 0;
let ingestCount = 0;

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const temperatureSafe = (v: unknown): boolean =>
  typeof v === "number" && Number.isFinite(v);

/** Optional shared-secret check for machine-originated ingests. When the
 *  HARDWARE_INGEST_KEY env var is set, both /ingest and /manual require it
 *  in the `x-ingest-key` header. Unset = open (dev/demo mode). */
function requireIngestKey(req: Request): string | null {
  const expected = process.env.HARDWARE_INGEST_KEY;
  if (!expected) return null; // not configured — allow (dev/demo)
  if (req.header("x-ingest-key") === expected) return null;
  return "invalid or missing x-ingest-key header";
}

/** Heuristic verdict for readings that arrive without ML features
 *  (manual entries, or a bare Arduino frame with only rpm/temp). */
function heuristicVerdict(rpm: number, temperature: number | null) {
  if (temperature !== null && temperature > 75)
    return { verdict: "SEVERE", colour: "red", health_index: 0.25 };
  if (temperature !== null && temperature > 60)
    return { verdict: "BEARING FAULT", colour: "yellow", health_index: 0.5 };
  if (rpm <= 0)
    return { verdict: "STALLED", colour: "yellow", health_index: 0.4 };
  return { verdict: "HEALTHY", colour: "green", health_index: 0.9 };
}

/** Normalise an ingest payload and broadcast it — used by both the HTTP route
 *  and the HardwareSimulator so every sample flows through one code path. */
export function ingestHardwareReading(raw: any, source: "arduino" | "simulator" | "manual"): HardwareReading {
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
  // Separate event so the Dashboard can track manual submissions in real-time
  // (LiveReadingsChart and the new Manual Input card both listen for this).
  if (source === "manual" && io) {
    io.emit("hardware:manual", {
      rpm: reading.rpm,
      temperature: reading.temperature,
      verdict: reading.verdict,
      health_index: reading.health_index,
      colour: reading.colour,
      timestamp: reading.timestamp,
    });
  }

  // Real readings (physical rig or operator entry) flow into the FULL pipeline:
  // persisted → dashboard sensor feed → alerts → email + WhatsApp notifications.
  if (source !== "simulator") {
    void persistAndPropagate(reading).catch((err) =>
      logger.warn({ err: err?.message }, "hardware pipeline step failed"),
    );
  }
  return reading;
}

// ─────────────────────────────────────────────────────────────────────────────
// persistAndPropagate — mirrors the smartphone-ingest pipeline so hardware
// readings appear everywhere the dashboard looks:
//   SpindleReading (machine history / FFT / RUL charts)
//   → `sensor:update` to machine + fleet rooms (live feed widgets)
//   → threshold alert with dedup/escalation (Alerts page, notification bell)
//   → email + WhatsApp notifications (Settings → Notifications recipients)
//   → `fleet:summary` refresh (dashboard KPIs)
// ─────────────────────────────────────────────────────────────────────────────
const RIG_MACHINE_ID = process.env.HARDWARE_MACHINE_ID || "M001";
const RIG_SPINDLE_ID = process.env.HARDWARE_SPINDLE_ID || "RIG01";

function severityFromColour(colour: string): "critical" | "warning" | null {
  if (colour === "red") return "critical";
  if (colour === "yellow") return "warning";
  return null;
}

async function persistAndPropagate(reading: HardwareReading): Promise<void> {
  const machineId = RIG_MACHINE_ID;
  const nodeId = RIG_SPINDLE_ID;

  // Vibration proxy from health index (the rig has no accelerometer): a
  // healthy frame sits near 0 g, a failing one climbs toward ~2 g.
  const vibrationRMS = +((1 - reading.health_index) * 2).toFixed(3);
  const healthScore = Math.round(reading.health_index * 100);
  const severity = severityFromColour(reading.colour);
  const timestamp = new Date(reading.timestamp);

  // 1. Persist so machine history / analytics / RUL include the rig.
  const persisted = new SpindleReading({
    machineId,
    spindleId: nodeId,
    timestamp,
    accel_x: 0,
    accel_y: 0,
    accel_z: vibrationRMS,
    rpm: reading.rpm,
    vibrationFFT: [],
    acousticRMS: +(vibrationRMS * 0.4).toFixed(3),
    temperature: reading.temperature ?? 30,
    voltageNormalized: 220,
    bpfoScore: 0,
    healthScore,
    anomalyFlag: severity !== null,
    mlLabel: reading.verdict,
    mlConfidence: reading.health_index,
    source: "edge",
  });
  await persisted.save();

  const io = getIo();

  // 2. Dashboard live feed — superset payload consumed by useLiveSensors and
  //    useRealSensors unchanged.
  if (io) {
    const payload = {
      machineId,
      nodeId,
      spindleId: nodeId,
      healthScore,
      vibrationRMS,
      accel_x: 0,
      accel_y: 0,
      accel_z: vibrationRMS,
      rpm: reading.rpm,
      temperature: reading.temperature ?? 30,
      voltage: 220,
      acousticLevel: +(vibrationRMS * 0.4).toFixed(3),
      acousticRMS: +(vibrationRMS * 0.4).toFixed(3),
      bpfoScore: 0,
      anomalyScore: 1 - reading.health_index,
      anomalyFlag: severity !== null,
      status: severity === "critical" ? "critical" : severity === "warning" ? "warning" : "healthy",
      mlLabel: reading.verdict,
      mlConfidence: reading.health_index,
      timestamp: reading.timestamp,
      // True provenance so the dashboard can badge LIVE (rig) vs MANUAL entries
      source: reading.source === "manual" ? "manual" : "arduino",
    };
    io.to(`machine:${machineId}`).emit("sensor:update", payload);
    io.to("fleet").emit("sensor:update", payload);
  }

  // 3. Threshold alert with dedup/escalation (same policy as smartphone path).
  let alertMessage: string | null = null;
  if (severity) {
    const existing = await Alert.findOne({ machineId, spindleId: nodeId, status: "active" }).lean();
    if (!(existing && existing.severity === severity)) {
      if (existing) {
        await Alert.updateOne(
          { _id: existing._id },
          { $set: { status: "resolved", resolvedAt: new Date() } },
        );
      }
      const machine = await Machine.findOne({ machineId }).lean();
      alertMessage = `${reading.verdict} detected on the physical Arduino rig — RPM ${reading.rpm.toFixed(0)}` +
        (reading.temperature !== null ? `, temperature ${reading.temperature.toFixed(1)}°C` : "") +
        ` (health index ${(reading.health_index * 100).toFixed(0)}%).`;
      const newAlert = new Alert({
        machineId,
        spindleId: nodeId,
        severity,
        type: severity.toUpperCase(),
        message: alertMessage,
        anomalyScore: 1 - reading.health_index,
        evidence: {
          label: reading.verdict,
          confidence: reading.health_index,
          dominantFreq: reading.rpm / 60,
          rpm: reading.rpm,
          peaks: [],
          features: { rms: vibrationRMS, kurtosis: 0, crestFactor: 0 },
        },
      });
      await newAlert.save();

      const machineName = machine?.name ?? machineId;
      void notifyMailAlert({
        machineId,
        machineName,
        severity,
        message: alertMessage,
        anomalyScore: 1 - reading.health_index,
        estimatedTimeToFailure: severity === "critical" ? "6-18 hours" : "3-7 days",
        detectedAt: newAlert.detectedAt,
      });

      if (isWhatsAppConfigured()) {
        void (async () => {
          try {
            const recipient = await User.findOne({ alertWhatsapp: { $ne: "" } }).select("alertWhatsapp");
            await notifyWhatsAppAlert({
              to: recipient?.alertWhatsapp,
              machineId,
              machineName,
              severity,
              message: alertMessage!,
            });
          } catch {
            /* never block ingestion on delivery */
          }
        })();
      }

      if (io) {
        const obj = newAlert.toObject();
        io.emit("alert:new", {
          id: obj._id.toString(),
          nodeId,
          machineId,
          machineName,
          type: severity.toUpperCase(),
          message: obj.message,
          anomalyScore: obj.anomalyScore ?? null,
          evidence: obj.evidence ?? null,
          timestamp: obj.detectedAt.toISOString().replace("T", " ").substring(0, 19),
          status: obj.status,
          estimatedTimeToFailure: severity === "critical" ? "6-18 hours" : "3-7 days",
          source: "arduino",
        });
      }
    }
  }

  // 3b. Keep the Machine document in sync so the Machine Status cards on the
  //     Fleet Dashboard reflect the rig's condition without a page reload.
  const machineStatus = severity === "critical" ? "critical" : severity === "warning" ? "warning" : "healthy";
  await Machine.updateOne({ machineId }, { $set: { status: machineStatus } });

  // 4. Fleet KPI refresh — full payload (the dashboard merges it over its
  //    initial summary, so every field the UI reads must be present).
  if (io) {
    const [totalMachines, criticalCount, alertsToday, latestReadings] = await Promise.all([
      Machine.countDocuments(),
      Machine.countDocuments({ status: "critical" }),
      Alert.countDocuments({ detectedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      SpindleReading.aggregate<{ healthScore: number }>([
        { $sort: { timestamp: -1 } },
        { $limit: 2000 },
        { $group: { _id: { machineId: "$machineId", spindleId: "$spindleId" }, healthScore: { $first: "$healthScore" } } },
      ]),
    ]);
    const avgHealthScore =
      latestReadings.length > 0
        ? Math.round(latestReadings.reduce((acc, r) => acc + r.healthScore, 0) / latestReadings.length)
        : 100;
    io.to("fleet").emit("fleet:summary", { totalMachines, criticalCount, alertsToday, avgHealthScore, sensorUptime: 99.5 });
  }
}

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/hardware/ingest — called by hardware/main.py once per second.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/ingest", (req: Request, res: Response): void => {
  try {
    const keyError = requireIngestKey(req);
    if (keyError) {
      res.status(401).json({ success: false, error: keyError });
      return;
    }
    const body = req.body ?? {};
    if (typeof body.rpm !== "number" && typeof body.rpm_mean !== "number") {
      res.status(400).json({ success: false, error: "rpm (or rpm_mean) is required" });
      return;
    }
    // Bare Arduino frames (rpm/temp/motorSpeed only) still get sensible
    // derived window stats so every panel on the Hardware Lab has a value.
    const rpm = num(body.rpm, num(body.rpm_mean));
    if (!Number.isFinite(body.rpm_mean)) {
      body.rpm_mean = rpm;
      body.rpm_temp_ratio = temperatureSafe(body.temperature)
        ? rpm / (body.temperature as number)
        : rpm / 30;
      const hv = heuristicVerdict(rpm, temperatureSafe(body.temperature) ? (body.temperature as number) : null);
      body.verdict = body.verdict || hv.verdict;
      body.colour = body.colour || hv.colour;
      body.health_index = Number.isFinite(body.health_index) ? body.health_index : hv.health_index;
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
// POST /api/hardware/manual — operator-entered gauge readings (tachometer /
// thermometer read by hand when the serial bridge isn't running). Flows through
// the exact same normalise → broadcast path as Arduino frames.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/manual", authenticateJWT, requireRoles('maintenance_engineer', 'admin', 'factory_manager', 'worker', 'operator'), (req: Request, res: Response): void => {
  try {
    const keyError = requireIngestKey(req);
    if (keyError) {
      res.status(401).json({ success: false, error: keyError });
      return;
    }
    const body = req.body ?? {};
    if (typeof body.rpm !== "number") {
      res.status(400).json({ success: false, error: "rpm is required" });
      return;
    }
    const temperature = temperatureSafe(body.temperature) ? (body.temperature as number) : null;
    const hv = heuristicVerdict(num(body.rpm), temperature);
    const reading = ingestHardwareReading(
      {
        ...body,
        temperature,
        motorSpeed: num(body.motorSpeed),
        rpm_mean: num(body.rpm),
        rpm_temp_ratio: temperature ? num(body.rpm) / temperature : num(body.rpm) / 30,
        ...hv,
      },
      "manual",
    );
    logger.info({ rpm: reading.rpm, temperature: reading.temperature }, "Manual hardware reading ingested");
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
router.post("/simulator/stop", authenticateJWT, requireRoles('maintenance_engineer', 'admin'), (_req: Request, res: Response): void => {
  hardwareSimulator.stop();
  res.json({ success: true, data: { running: false } });
});

router.post("/simulator/start", authenticateJWT, requireRoles('maintenance_engineer', 'admin'), (_req: Request, res: Response): void => {
  hardwareSimulator.start();
  res.json({ success: true, data: { running: true } });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/hardware/stream — recent ring buffer + live status (for page mount).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/stream", authenticateJWT, (_req: Request, res: Response): void => {
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
