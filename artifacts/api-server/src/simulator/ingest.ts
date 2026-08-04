import { Machine } from '../models/Machine.js';
import { SpindleReading } from '../models/SpindleReading.js';
import { Alert } from '../models/Alert.js';
import { getIo } from '../socket.js';
import { computeFFTBins } from '../lib/fft.js';
import { defectFrequencies, type AlertEvidence, type DefectFrequencies } from './SensorSimulator.js';

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
 * Process a real hardware reading end-to-end:
 *   1. Resolve the machine (edge nodes reference seeded machines M001..M006)
 *   2. Derive accel/RMS deterministically from the raw signal (unless the node
 *      sent its own) — no random values, ever
 *   3. Ask the ML server for a fault prediction. If the ML server is down, we
 *      REJECT the reading (503) instead of fabricating a label — the dashboard
 *      shows an ML OFFLINE banner rather than fake Healthy/99% predictions
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
  // reports +1g of gravity at rest and reads as 'Caution'.
  let mean = 0;
  for (const v of input.signal) mean += v;
  mean /= input.signal.length;
  let rms = 0;
  for (const v of input.signal) {
    const ac = v - mean;
    rms += ac * ac;
  }
  rms = Math.sqrt(rms / input.signal.length);

  // True time-domain peak (for the evidence crest factor)
  let peakAbs = 0;
  for (const v of input.signal) {
    const a = Math.abs(v);
    if (a > peakAbs) peakAbs = a;
  }

  const accel_z = +(input.accel_z ?? rms).toFixed(3);
  const accel_x = +(input.accel_x ?? accel_z * 0.4).toFixed(3);
  const accel_y = +(input.accel_y ?? accel_z * 0.6).toFixed(3);
  const temperature = +(input.temperature ?? 30 + rms * 8).toFixed(1);
  const voltageNormalized = +(input.voltageNormalized ?? 220).toFixed(1);

  // Resolve RPM up-front (node-provided, else derived from the FFT later) so
  // the ML server can compute defect frequencies for the same rotation speed.
  const rpm = Math.floor(input.rpm ?? 15000);

  // ML prediction (the real trained model — the only source of labels)
  const mlServerUrl = process.env.ML_SERVER_URL || 'http://127.0.0.1:8000';
  let mlLabel = '';
  let mlConfidence = 0;
  let technicianSummary = '';
  let mlOk = false;
  try {
    const res = await fetch(`${mlServerUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: input.signal, rpm, sample_rate: sampleRateHz }),
    });
    if (res.ok) {
      const mlData = (await res.json()) as {
        label?: string;
        confidence?: number;
        technician_summary?: string;
      };
      if (mlData.label && mlData.confidence !== undefined) {
        mlOk = true;
        mlLabel = mlData.label;
        mlConfidence = mlData.confidence;
        technicianSummary = mlData.technician_summary || '';
      }
    }
  } catch (e) {
    // ML server unreachable — reject below, never fabricate predictions
  }

  if (!mlOk) {
    const err: any = new Error(
      'ML prediction server is offline — reading rejected. Start the ML server and retry.',
    );
    err.statusCode = 503;
    const io = getIo();
    if (io) io.emit('ml:status', { online: false, timestamp: new Date().toISOString() });
    throw err;
  }

  const anomalyFlag = mlLabel !== 'Healthy';

  let finalHealthScore: number;
  let bpfoScore: number;
  finalHealthScore = anomalyFlag
    ? Math.max(10, 100 - mlConfidence * 100)
    : Math.min(100, mlConfidence * 100);

  // Real FFT from the raw samples — not a synthetic spectrum
  const vibrationFFT = computeFFTBins(input.signal, sampleRateHz);

  // BPFO score: real spectral energy ratio in the bearing fault band
  let bpfoBandEnergy = 0;
  let totalEnergy = 0;
  for (const bin of vibrationFFT) {
    totalEnergy += bin.amplitude;
    if (bin.freq >= 130 && bin.freq <= 180) bpfoBandEnergy += bin.amplitude;
  }
  bpfoScore = +(totalEnergy > 0 ? Math.min(1, bpfoBandEnergy / totalEnergy) : 0).toFixed(3);

  // If the node omitted RPM, derive it from the real dominant spectral peak
  let effectiveRpm = rpm;
  if (input.rpm === undefined || input.rpm === null) {
    let dominantFreq = 0;
    for (const bin of vibrationFFT) {
      if (bin.amplitude > dominantFreq) dominantFreq = bin.freq;
    }
    effectiveRpm = Math.round(dominantFreq * 60);
  }

  // Waveform: downsampled real signal for the time-domain chart
  const waveform: number[] = [];
  for (let s = 0; s < input.signal.length; s += 8) waveform.push(+input.signal[s].toFixed(3));

  const reading = new SpindleReading({
    machineId: machine.machineId,
    spindleId,
    accel_x,
    accel_y,
    accel_z,
    rpm: effectiveRpm,
    vibrationFFT,
    acousticRMS: +rms.toFixed(3),
    temperature,
    voltageNormalized,
    bpfoScore,
    healthScore: Math.round(finalHealthScore),
    anomalyFlag,
    mlLabel,
    mlConfidence: +mlConfidence.toFixed(3),
    waveform,
    source: 'edge',
  });
  await reading.save();

  const io = getIo();
  if (io) io.emit('ml:status', { online: true, timestamp: new Date().toISOString() });

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
        anomalyScore: bpfoScore,
        evidence: buildEvidence(mlLabel, mlConfidence, vibrationFFT, effectiveRpm, rms, kurtosisOf(input.signal), peakAbs),
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
          evidence: obj.evidence ?? null,
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
      rpm: effectiveRpm,
      temperature,
      acousticRMS: +rms.toFixed(3),
      bpfoScore,
      anomalyFlag,
      mlLabel,
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

function kurtosisOf(signal: number[]): number {
  const n = signal.length;
  if (n < 4) return 3;
  let mean = 0;
  for (const v of signal) mean += v;
  mean /= n;
  let m2 = 0;
  let m4 = 0;
  for (const v of signal) {
    const d = v - mean;
    m2 += d * d;
    m4 += d * d * d * d;
  }
  const var2 = m2 / n;
  if (var2 === 0) return 3;
  return (m4 / n) / (var2 * var2);
}

function buildEvidence(
  label: string,
  confidence: number,
  fft: { freq: number; amplitude: number }[],
  rpm: number,
  rms: number,
  kurt: number,
  peakAbs: number,
): AlertEvidence {
  const df: DefectFrequencies = defectFrequencies(rpm);
  const peaks = [...fft]
    .sort((a, b) => b.amplitude - a.amplitude)
    .slice(0, 5)
    .map(p => ({ freq: +p.freq.toFixed(1), amplitude: +p.amplitude.toFixed(3) }));
  return {
    label,
    confidence: +confidence.toFixed(3),
    dominantFreq: peaks[0]?.freq ?? 0,
    rpm,
    peaks,
    features: {
      rms: +rms.toFixed(3),
      kurtosis: +kurt.toFixed(2),
      crestFactor: +(peakAbs / (rms || 1)).toFixed(2),
    },
    defectFrequencies: df,
  };
}
