import { Router, Request, Response } from "express";
import { getIo } from "../socket.js";
import { logger } from "../lib/logger.js";
import { SpindleReading } from "../models/SpindleReading.js";
import { Alert } from "../models/Alert.js";
import { Machine } from "../models/Machine.js";
import { augmentFromDataset } from "../lib/datasetAugmentation.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// In-memory stores (phone capture is a demo channel; replace with MongoDB
// collections if this becomes a production ingest path).
// ─────────────────────────────────────────────────────────────────────────────
interface SensorReading {
  nodeId: string;
  machineId: string;
  vibrationRMS: number;
  acousticLevel: number;
  bpfoScore: number;
  anomalyScore: number;
  healthScore: number;
  temperature: number; // dataset-augmented
  voltage: number; // dataset-augmented
  status: string;
  estimatedTimeToFailure: string;
  fftSnapshot?: number[];
  signal?: number[]; // raw 2048-pt time-domain window for ML inference
  rpm?: number;
  sampleRate?: number;
  mlLabel?: string;
  mlConfidence?: number;
  technicianSummary?: string;
  timestamp: string;
  capturedBy: string;
  captureMethod: string;
  receivedAt: string;
}

const readings: SensorReading[] = [];

interface CalibrationBaseline {
  bpfoFloor: number;
  acousticFloor: number;
  capturedAt: string;
}

// Per-machine noise floor, captured once with the machine OFF. Future
// readings are normalised against this baseline before anomaly scoring.
const calibrationStore: Record<string, CalibrationBaseline> = {};

// ─────────────────────────────────────────────────────────────────────────────
// CALIBRATION — noise-floor baseline per machine (capture on a STOPPED machine)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/calibrate/:machineId", (req: Request, res: Response): void => {
  const machineId = String(req.params.machineId);
  const { bpfoBaseline, acousticBaseline } = req.body ?? {};
  if (
    typeof bpfoBaseline !== "number" ||
    !Number.isFinite(bpfoBaseline) ||
    typeof acousticBaseline !== "number" ||
    !Number.isFinite(acousticBaseline)
  ) {
    res.status(400).json({
      success: false,
      error: "bpfoBaseline and acousticBaseline must be finite numbers",
    });
    return;
  }
  calibrationStore[machineId] = {
    bpfoFloor: bpfoBaseline,
    acousticFloor: acousticBaseline,
    capturedAt: new Date().toISOString(),
  };
  logger.info({ machineId, bpfoBaseline, acousticBaseline }, "Calibration baseline saved");
  res.json({ success: true });
});

router.get("/calibrate/:machineId", (req: Request, res: Response): void => {
  const baseline = calibrationStore[String(req.params.machineId)];
  if (!baseline) {
    res.status(404).json({ success: false, error: "No baseline recorded for this machine yet" });
    return;
  }
  res.json({ success: true, data: baseline });
});

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP ALERT (acknowledgement endpoint)
// Actual WhatsApp delivery is simulated in the dashboard frontend
// (components/dashboard/WhatsAppAlert.tsx); this endpoint confirms the
// smartphone capture PWA's alert request so the send flow completes.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/whatsapp-alert", (req: Request, res: Response): void => {
  const { machineId, vibrationRMS, anomalyScore, estimatedTimeToFailure, bpfoScore } = req.body ?? {};
  logger.info(
    { machineId, vibrationRMS, anomalyScore, estimatedTimeToFailure, bpfoScore },
    "WhatsApp alert triggered by smartphone capture",
  );
  res.json({ success: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ML INFERENCE RELAY
// /predict expects a 2048-point TIME-DOMAIN signal (it computes its own FFT +
// features), so the PWA captures a raw mic window and this route forwards it.
// The ML server is laptop-local (127.0.0.1), so the backend relays rather than
// the phone calling it directly. On any failure the reading still ingests
// with the heuristic score — ML is an enhancement, never a blocker.
// ─────────────────────────────────────────────────────────────────────────────
interface MlVerdict {
  mlLabel?: string;
  mlConfidence?: number;
  technicianSummary?: string;
}

async function runMlInference(signal: number[], rpm: number, sampleRate: number): Promise<MlVerdict> {
  const mlServerUrl = process.env.ML_SERVER_URL || "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${mlServerUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal, rpm, sample_rate: sampleRate }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "ML server returned non-OK for smartphone signal");
      return {};
    }
    const ml = (await res.json()) as {
      label?: string;
      confidence?: number;
      technician_summary?: string;
    };
    if (
      typeof ml.label === "string" &&
      typeof ml.confidence === "number" &&
      Number.isFinite(ml.confidence)
    ) {
      return {
        mlLabel: ml.label,
        mlConfidence: ml.confidence,
        technicianSummary: ml.technician_summary,
      };
    }
    return {};
  } catch (err: any) {
    logger.warn(
      { err: err?.message },
      "ML inference unavailable for smartphone reading — heuristic score only",
    );
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sensor-readings
// Receives a reading from the smartphone capture PWA and pushes it live to
// the dashboard over Socket.io — the existing dashboard UI needs no changes.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body ?? {};
    const machineId = body.machineId;
    if (typeof machineId !== "string" || machineId.length === 0) {
      res.status(400).json({ success: false, error: "machineId is required" });
      return;
    }
    const nodeId = typeof body.nodeId === "string" && body.nodeId.length > 0 ? body.nodeId : "SN001";

    const num = (v: unknown, fallback = 0): number =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;

    const vibrationRMS = Math.max(0, num(body.vibrationRMS));
    const acousticLevel = Math.max(0, num(body.acousticLevel));
    const bpfoScore = Math.max(0, Math.min(1, num(body.bpfoScore)));
    const anomalyScore = Math.max(0, Math.min(1, num(body.anomalyScore)));

    let healthScore = num(body.healthScore);
    if (healthScore <= 0) healthScore = Math.max(5, Math.min(100, Math.round(100 - anomalyScore * 100)));
    healthScore = Math.max(5, Math.min(100, Math.round(healthScore)));

    const status =
      typeof body.status === "string" && ["healthy", "warning", "critical"].includes(body.status)
        ? body.status
        : anomalyScore > 0.6
          ? "critical"
          : anomalyScore > 0.3
            ? "warning"
            : "healthy";

    // Phone can't measure temperature/voltage — dataset-augmented by health stage.
    // Prefer the PWA's values when provided, fall back to the CWRU mapping.
    const { temperature: fallbackTemp, voltage: fallbackVoltage } = augmentFromDataset(healthScore);
    const temperature = num(body.temperature, fallbackTemp);
    const voltage = num(body.voltage, fallbackVoltage);

    const timestamp =
      typeof body.timestamp === "string" && body.timestamp.length > 0
        ? body.timestamp
        : new Date().toISOString();

    const fftSnapshot = Array.isArray(body.fftSnapshot)
      ? (body.fftSnapshot as unknown[]).filter((v): v is number => typeof v === "number" && Number.isFinite(v)).slice(0, 40)
      : [];

    // Raw 2048-pt time-domain window from the phone mic → real ML verdict.
    const rawSignal: unknown = body.signal;
    let signal: number[] | undefined;
    let mlVerdict: MlVerdict = {};
    if (rawSignal !== undefined) {
      if (
        !Array.isArray(rawSignal) ||
        rawSignal.length !== 2048 ||
        !rawSignal.every((v): v is number => typeof v === "number" && Number.isFinite(v))
      ) {
        res.status(400).json({
          success: false,
          error: "signal must be an array of exactly 2048 finite numbers",
        });
        return;
      }
      signal = rawSignal as number[];
      mlVerdict = await runMlInference(signal, num(body.rpm, 14400), num(body.sampleRate, 44100));
    }
    const { mlLabel, mlConfidence, technicianSummary } = mlVerdict;

    const reading: SensorReading = {
      nodeId,
      machineId,
      vibrationRMS,
      acousticLevel,
      bpfoScore,
      anomalyScore,
      healthScore,
      temperature,
      voltage,
      status,
      estimatedTimeToFailure:
        typeof body.estimatedTimeToFailure === "string" ? body.estimatedTimeToFailure : "> 30 days",
      fftSnapshot,
      signal,
      rpm: num(body.rpm, 14400),
      sampleRate: num(body.sampleRate, 44100),
      mlLabel,
      mlConfidence,
      technicianSummary,
      timestamp,
      capturedBy: body.capturedBy ?? "smartphone",
      captureMethod: body.captureMethod ?? "audio+accelerometer",
      receivedAt: new Date().toISOString(),
    };

    // 1. Store reading (rolling in-memory window)
    readings.unshift(reading);
    if (readings.length > 1000) readings.pop();

    // 2. Persist as a SpindleReading so machine history / FFT / RUL charts and
    //    the fleet summary (all read from MongoDB) reflect the phone capture.
    const vibrationFFT = fftSnapshot.map((amp, i) => ({ freq: (i + 1) * 50, amplitude: amp }));
    const persisted = new SpindleReading({
      machineId,
      spindleId: nodeId,
      timestamp: new Date(timestamp),
      accel_x: 0,
      accel_y: 0,
      accel_z: +vibrationRMS.toFixed(3),
      rpm: 0,
      vibrationFFT,
      acousticRMS: +acousticLevel.toFixed(3),
      temperature,
      voltageNormalized: voltage,
      bpfoScore,
      healthScore,
      anomalyFlag: status !== "healthy",
      mlLabel: mlLabel ?? undefined,
      mlConfidence: mlConfidence !== undefined ? +mlConfidence.toFixed(3) : undefined,
      source: "edge",
    });
    await persisted.save();

    // 3. Emit to dashboard via Socket.io — superset payload so both the legacy
    //    useLiveSensors hook (spindleId/accel_z) and the new useRealSensors
    //    hook (nodeId/vibrationRMS) can consume it unchanged.
    const io = getIo();
    if (io) {
      const payload = {
        machineId,
        nodeId,
        spindleId: nodeId,
        healthScore,
        vibrationRMS,
        accel_x: 0,
        accel_y: 0,
        accel_z: +vibrationRMS.toFixed(3),
        rpm: 0,
        temperature,
        voltage,
        acousticLevel,
        acousticRMS: +acousticLevel.toFixed(3),
        bpfoScore,
        anomalyScore,
        anomalyFlag: status !== "healthy",
        status,
        mlLabel: mlLabel ?? null,
        mlConfidence: mlConfidence ?? null,
        timestamp,
        source: "smartphone",
      };
      io.to(`machine:${machineId}`).emit("sensor:update", payload);
      io.to("fleet").emit("sensor:update", payload);
    }

    // 4. Generate alert if threshold crossed (dedup: same machine+node already
    //    active at this severity → skip; escalated severity → resolve + recreate)
    let alertCreated = false;
    if (status === "critical" || status === "warning") {
      const severity = status === "critical" ? "critical" : "warning";
      const existing = await Alert.findOne({ machineId, spindleId: nodeId, status: "active" }).lean();
      if (existing && existing.severity === severity) {
        alertCreated = false;
      } else {
        if (existing) {
          await Alert.updateOne(
            { _id: existing._id },
            { $set: { status: "resolved", resolvedAt: new Date() } },
          );
        }
        const machine = await Machine.findOne({ machineId }).lean();
        const mlFault = !!mlLabel && mlLabel !== "Healthy";
        const newAlert = new Alert({
          machineId,
          spindleId: nodeId,
          severity,
          type: severity.toUpperCase(),
          message: mlFault
            ? `${mlLabel} detected via smartphone with ${((mlConfidence ?? 0) * 100).toFixed(1)}% confidence.`
            : severity === "critical"
              ? `BPFO frequency spike detected via smartphone (score: ${bpfoScore.toFixed(2)}). Bearing failure imminent.`
              : `Vibration RMS elevated to ${vibrationRMS.toFixed(2)}g (smartphone capture). Monitor closely.`,
          ...(mlFault && technicianSummary ? { technicianSummary } : {}),
          anomalyScore,
        });
        await newAlert.save();

        if (io) {
          const obj = newAlert.toObject();
          io.emit("alert:new", {
            id: obj._id.toString(),
            nodeId,
            machineId,
            machineName: machine?.name ?? machineId,
            type: severity.toUpperCase(),
            message: obj.message,
            anomalyScore,
            timestamp: obj.detectedAt.toISOString().replace("T", " ").substring(0, 19),
            status: obj.status,
            estimatedTimeToFailure: severity === "critical" ? "6-18 hours" : "3-7 days",
            source: "smartphone",
          });
        }
        alertCreated = true;
      }
    }

    // 5. Compute fleet summary and broadcast (mirrors the simulator's payload)
    if (io) {
      io.to("fleet").emit("fleet:summary", await computeFleetSummary());
    }

    logger.info(
      { machineId, nodeId, healthScore, status, mlLabel, source: "smartphone" },
      "Sensor reading ingested from smartphone capture",
    );

    res.json({
      success: true,
      healthScore,
      alertCreated,
      mlLabel: mlLabel ?? null,
      mlConfidence: mlConfidence ?? null,
      technicianSummary: technicianSummary ?? null,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to ingest smartphone sensor reading");
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sensor-readings/:machineId — last 100 smartphone readings
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:machineId", (req: Request, res: Response): void => {
  const machineReadings = readings
    .filter((r) => r.machineId === req.params.machineId)
    .slice(0, 100);
  res.json({ success: true, data: machineReadings });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sensor-readings/:machineId/fft — latest FFT for the FFT chart
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:machineId/fft", async (req: Request, res: Response): Promise<void> => {
  try {
    const latest = readings.find((r) => r.machineId === req.params.machineId);
    if (latest && latest.fftSnapshot && latest.fftSnapshot.length > 0) {
      const fftData = latest.fftSnapshot.map((amp: number, i: number) => ({
        freq: (i + 1) * 50,
        amplitude: amp,
      }));
      res.json({ success: true, data: fftData });
      return;
    }
    // Fall back to the persisted reading (e.g. after a server restart)
    const persisted = await SpindleReading.findOne({ machineId: req.params.machineId })
      .sort({ timestamp: -1 })
      .lean();
    if (!persisted || !persisted.vibrationFFT || persisted.vibrationFFT.length === 0) {
      res.json({ success: false, error: "No FFT data yet" });
      return;
    }
    res.json({ success: true, data: persisted.vibrationFFT });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Fleet summary computed from real stored data (same shape as the simulator)
// ─────────────────────────────────────────────────────────────────────────────
async function computeFleetSummary() {
  const totalMachines = await Machine.countDocuments();
  const criticalCount = await Machine.countDocuments({ status: "critical" });
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const alertsToday = await Alert.countDocuments({ detectedAt: { $gte: startOfDay } });

  const latestReadings = await SpindleReading.aggregate<{ healthScore: number }>([
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: { machineId: "$machineId", spindleId: "$spindleId" },
        healthScore: { $first: "$healthScore" },
      },
    },
  ]);
  const avgHealthScore =
    latestReadings.length > 0
      ? Math.round(latestReadings.reduce((acc, r) => acc + r.healthScore, 0) / latestReadings.length)
      : 100;

  return { totalMachines, criticalCount, avgHealthScore, alertsToday };
}

export default router;
