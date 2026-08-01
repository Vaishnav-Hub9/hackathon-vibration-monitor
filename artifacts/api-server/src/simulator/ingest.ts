import { Machine } from '../models/Machine.js';
import { SpindleReading } from '../models/SpindleReading.js';
import { Alert } from '../models/Alert.js';
import { getIo } from '../socket.js';
import { computeFFTBins } from '../lib/fft.js';

export interface EdgeReadingInput {
  machineId: string;
  spindleId?: string;
  signal: number[];
  temperature?: number;
  rpm?: number;
  voltageNormalized?: number;
  sampleRateHz?: number;
  accel_x?: number;
  accel_y?: number;
  accel_z?: number;
}

export interface EdgeReadingResult {
  reading: any;
  label: string;
  confidence: number;
  technicianSummary: string;
}

/**
 * Process a real hardware reading end-to-end, mirroring the sensor simulator:
 *   1. Resolve the machine (edge nodes reference seeded machines M001..M006)
 *   2. Derive accel/RMS from the raw signal (unless the node sent its own)
 *   3. Ask the ML server for a fault prediction (silent fallback if down)
 *   4. Compute a REAL FFT from the signal for the dashboard spectrum
 *   5. Persist a SpindleReading marked source='edge'
 *   6. Create alerts + broadcast over Socket.io exactly like the simulator
 */
export async function processEdgeReading(
  input: EdgeReadingInput,
): Promise<EdgeReadingResult> {
  const machine = await Machine.findOne({ machineId: input.machineId }).lean();
  if (!machine) {
    const err: any = new Error(
      `Machine ${input.machineId} not found. Register it first or use a seeded id (M001-M006).`,
    );
    err.statusCode = 404;
    throw err;
  }

  const spindleId = input.spindleId || 'SN001';
  const sampleRateHz = input.sampleRateHz || 1000;

  // Root-mean-square of the AC-coupled signal (mean removed) → g-level used
  // for accel fields. Without this, a vertically-mounted MEMS accelerometer
  // reports +1g of gravity at rest and reads as 'Caution' — same DC/gravity
  // issue the FFT helper removes.
  let mean = 0;
  for (const v of input.signal) mean += v;
  mean /= input.signal.length;
  let rms = 0;
  for (const v of input.signal) {
    const ac = v - mean;
    rms += ac * ac;
  }
  rms = Math.sqrt(rms / input.signal.length);

  const accel_z = +(input.accel_z ?? rms).toFixed(3);
  const accel_x = +(input.accel_x ?? accel_z * 0.4).toFixed(3);
  const accel_y = +(input.accel_y ?? accel_z * 0.6).toFixed(3);
  const temperature = +(input.temperature ?? 35 + Math.random() * 10).toFixed(1);
  const rpm = Math.floor(input.rpm ?? 15000);
  const voltageNormalized = +(input.voltageNormalized ?? 220).toFixed(1);

  // ML prediction (same contract as the simulator)
  let mlLabel = 'Healthy';
  let mlConfidence = 0.99;
  let technicianSummary = '';
  let mlAvailable = false;
  try {
    const res = await fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: input.signal }),
    });
    if (res.ok) {
      const mlData = (await res.json()) as {
        label?: string;
        confidence?: number;
        technician_summary?: string;
      };
      if (mlData.label) {
        mlAvailable = true;
        mlLabel = mlData.label;
        mlConfidence = mlData.confidence ?? mlConfidence;
        technicianSummary = mlData.technician_summary || '';
      }
    }
  } catch (e) {
    // Silent fallback if the ML server is not running
  }

  const anomalyFlag = mlAvailable ? mlLabel !== 'Healthy' : rms > 1.5;

  let finalHealthScore: number;
  let bpfoScore: number;
  if (mlAvailable) {
    finalHealthScore = anomalyFlag
      ? Math.max(10, 100 - mlConfidence * 100)
      : Math.min(100, mlConfidence * 100);
    bpfoScore = +(anomalyFlag ? mlConfidence : 0.1 + Math.random() * 0.2).toFixed(3);
  } else {
    // ML server offline: RMS-based heuristic so real hardware still drives the
    // dashboard and alerts. Thresholds match the simulator's status bands
    // (healthy 0.3-0.8g, warning 1.2-1.7g, critical 2.0-3.5g).
    if (rms > 2.5) {
      mlLabel = 'High vibration';
      mlConfidence = 0.9;
      finalHealthScore = Math.round(25 + Math.random() * 15);
      bpfoScore = +(0.7 + Math.random() * 0.2).toFixed(3);
    } else if (rms > 1.5) {
      mlLabel = 'Elevated vibration';
      mlConfidence = 0.8;
      finalHealthScore = Math.round(45 + Math.random() * 15);
      bpfoScore = +(0.45 + Math.random() * 0.15).toFixed(3);
    } else if (rms > 0.9) {
      mlLabel = 'Caution';
      mlConfidence = 0.7;
      finalHealthScore = Math.round(70 + Math.random() * 10);
      bpfoScore = +(0.3 + Math.random() * 0.1).toFixed(3);
    } else {
      finalHealthScore = Math.round(90 + Math.random() * 10);
      bpfoScore = +(0.1 + Math.random() * 0.1).toFixed(3);
    }
    technicianSummary =
      rms > 1.5
        ? `Edge-node heuristic: vibration RMS ${rms.toFixed(2)}g exceeds safe threshold. Schedule manual inspection.`
        : '';
  }

  // Real FFT from the raw samples — not a synthetic spectrum
  const vibrationFFT = computeFFTBins(input.signal, sampleRateHz);

  const reading = new SpindleReading({
    machineId: machine.machineId,
    spindleId,
    accel_x,
    accel_y,
    accel_z,
    rpm,
    vibrationFFT,
    acousticRMS: +rms.toFixed(3),
    temperature,
    voltageNormalized,
    bpfoScore,
    healthScore: Math.round(finalHealthScore),
    anomalyFlag,
    source: 'edge',
  });
  await reading.save();

  const io = getIo();

  // Alert creation — mirrors the simulator's threshold logic
  if (finalHealthScore < 70) {
    const severity = finalHealthScore < 40 ? 'critical' : 'warning';
    const existingAlert = await Alert.findOne({
      machineId: machine.machineId,
      spindleId,
      status: 'active',
    });

    if (!existingAlert || existingAlert.severity !== severity) {
      if (existingAlert) {
        existingAlert.status = 'resolved';
        existingAlert.resolvedAt = new Date();
        await existingAlert.save();
      }

      const newAlert = new Alert({
        machineId: machine.machineId,
        spindleId,
        severity,
        type: severity.toUpperCase(),
        message: anomalyFlag
          ? `${mlLabel} detected with ${(mlConfidence * 100).toFixed(1)}% confidence.`
          : 'Vibration elevated. Monitor closely.',
        technicianSummary,
      });
      await newAlert.save();

      if (io) {
        const obj = newAlert.toObject();
        io.emit('alert:new', {
          id: obj._id.toString(),
          nodeId: spindleId,
          machineId: machine.machineId,
          machineName: machine.name,
          type: severity.toUpperCase(),
          message: obj.message,
          technicianSummary: obj.technicianSummary,
          anomalyScore: bpfoScore,
          timestamp: obj.detectedAt.toISOString().replace('T', ' ').substring(0, 19),
          status: obj.status,
          estimatedTimeToFailure: severity === 'critical' ? '6-18 hours' : '3-7 days',
        });
      }
    }
  }

  // Live sensor feed broadcast — identical payload shape to the simulator
  if (io) {
    io.to(`machine:${machine.machineId}`).emit('sensor:update', {
      machineId: machine.machineId,
      spindleId,
      healthScore: Math.round(finalHealthScore),
      accel_x,
      accel_y,
      accel_z,
      rpm,
      temperature,
      bpfoScore,
      anomalyFlag,
      timestamp: reading.timestamp.toISOString(),
    });
  }

  return {
    reading,
    label: mlLabel,
    confidence: mlConfidence,
    technicianSummary,
  };
}
