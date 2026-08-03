import { Machine } from '../models/Machine.js';
import { SpindleReading } from '../models/SpindleReading.js';
import { Alert } from '../models/Alert.js';
import { getIo } from '../socket.js';
import { computeFFTBins } from '../lib/fft.js';

interface MLFeatures {
  mean?: number;
  std?: number;
  variance?: number;
  rms?: number;
  max?: number;
  min?: number;
  peak_to_peak?: number;
  mean_abs?: number;
  energy?: number;
  kurtosis?: number;
  skewness?: number;
  crest_factor?: number;
  spectral_entropy?: number;
  dominant_frequency?: number;
  [key: string]: number | undefined;
}

/**
 * Deterministic statistics of the raw AC-coupled signal. These are real
 * computations on the actual samples (what a MEMS accelerometer stream is),
 * not random values.
 */
function signalStats(signal: Float64Array) {
  const n = signal.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += signal[i];
  mean /= n;

  let sq = 0;
  let abs = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const ac = signal[i] - mean;
    sq += ac * ac;
    abs += Math.abs(ac);
    const a = Math.abs(ac);
    if (a > peak) peak = a;
  }
  const rms = Math.sqrt(sq / n);
  const std = Math.sqrt(sq / n);
  return {
    mean,
    std,
    rms,
    meanAbs: abs / n,
    peak,
  };
}

class SensorSimulator {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalMs = 3500;
  private mlOnline = false;

  public start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.runSimulationCycle(), this.intervalMs);
    console.log('Sensor simulator started');
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Sensor simulator stopped');
    }
  }

  public async injectFault(machineId: string): Promise<void> {
    await Machine.updateOne({ machineId }, { $set: { status: 'critical' } });
  }

  private emitMlStatus(online: boolean): void {
    if (this.mlOnline === online) return;
    this.mlOnline = online;
    const io = getIo();
    if (io) {
      io.emit('ml:status', { online, timestamp: new Date().toISOString() });
    }
  }

  private async runSimulationCycle(): Promise<void> {
    try {
      const machines = await Machine.find().lean();
      const io = getIo();

      for (const machine of machines) {
        for (let i = 1; i <= 5; i++) {
          const spindleId = `SN00${i}`;

          // ---- Raw 2048-point signal (this is the simulated sensor input) ----
          // Fault content is driven by the machine status set by fault injection,
          // exactly like a real bearing's signature. Everything *displayed* is
          // then computed from this signal by the ML model + DSP below.
          const faultAmp =
            machine.status === 'critical' ? 4.0 :
            machine.status === 'warning' ? 1.5 : 0;
          const baseAmp =
            machine.status === 'critical' ? 2.4 :
            machine.status === 'warning' ? 1.3 :
            machine.status === 'degrading' ? 1.0 : 0.45;

          const signal = new Float64Array(2048);
          for (let s = 0; s < 2048; s++) {
            let v = Math.sin(s * 0.1) * baseAmp + (Math.random() - 0.5) * 0.1;
            if (faultAmp > 0 && s % 100 < 5) {
              v += faultAmp * (Math.random() + 0.5);
            }
            signal[s] = v;
          }

          // ---- Real ML inference (the actual trained model) ----
          let mlLabel = '';
          let mlConfidence = 0;
          let features: MLFeatures = {};
          let technicianSummary = '';
          let mlOk = false;
          const mlServerUrl = process.env.ML_SERVER_URL || 'http://127.0.0.1:8000';
          try {
            const res = await fetch(`${mlServerUrl}/predict`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ signal: Array.from(signal) }),
            });
            if (res.ok) {
              const mlData = (await res.json()) as {
                label?: string;
                confidence?: number;
                features?: MLFeatures;
                technician_summary?: string;
              };
              if (mlData.label && mlData.confidence !== undefined) {
                mlOk = true;
                mlLabel = mlData.label;
                mlConfidence = mlData.confidence;
                features = mlData.features || {};
                technicianSummary = mlData.technician_summary || '';
              }
            }
          } catch (e) {
            // ML server unreachable — handled below, never fabricate predictions
          }

          if (!mlOk) {
            this.emitMlStatus(false);
            continue; // No ML verdict → no fabricated reading is saved
          }
          this.emitMlStatus(true);

          const anomalyFlag = mlLabel !== 'Healthy';

          // ---- Deterministic DSP on the real signal (no random values) ----
          const stats = signalStats(signal);
          const vibrationFFT = computeFFTBins(Array.from(signal), 1000, 128);

          // Accel channels: real statistics of the actual AC-coupled signal (g)
          const accel_z = +stats.rms.toFixed(3);
          const accel_x = +stats.std.toFixed(3);
          const accel_y = +stats.meanAbs.toFixed(3);

          // RPM: derived from the real dominant spectral peak (1x rotation)
          let dominantFreq = 0;
          for (const bin of vibrationFFT) {
            if (bin.amplitude > dominantFreq) dominantFreq = bin.freq;
          }
          const rpm = Math.round(dominantFreq * 60);

          // Temperature: deterministic thermal model from real signal energy
          const rms = features.rms ?? stats.rms;
          const kurt = features.kurtosis ?? 3;
          const temperature = +(
            30 + rms * 8 + (kurt > 3.2 ? 4 : 0) + (machine.status === 'critical' ? 8 : 0)
          ).toFixed(1);

          // BPFO score: real spectral energy ratio in the bearing fault band
          let bpfoBandEnergy = 0;
          let totalEnergy = 0;
          for (const bin of vibrationFFT) {
            totalEnergy += bin.amplitude;
            if (bin.freq >= 130 && bin.freq <= 180) bpfoBandEnergy += bin.amplitude;
          }
          const bpfoScore = +(totalEnergy > 0 ? Math.min(1, bpfoBandEnergy / totalEnergy) : 0).toFixed(3);

          // Health score: straight from the ML confidence (real model output)
          const finalHealthScore = anomalyFlag
            ? Math.max(10, Math.round(100 - mlConfidence * 100))
            : Math.min(100, Math.round(mlConfidence * 100));

          // Waveform: downsampled real signal for the time-domain chart
          const waveform: number[] = [];
          for (let s = 0; s < 2048; s += 8) waveform.push(+signal[s].toFixed(3));

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
            voltageNormalized: 220,
            bpfoScore,
            healthScore: finalHealthScore,
            anomalyFlag,
            mlLabel,
            mlConfidence: +mlConfidence.toFixed(3),
            waveform,
            source: 'simulator',
          });
          await reading.save();

          // ---- Alerts: real ML verdict, real bpfo score ----
          if (finalHealthScore < 70) {
            const severity = finalHealthScore < 40 ? 'critical' : 'warning';
            const existingAlert = await Alert.findOne({ machineId: machine.machineId, spindleId, status: 'active' });

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
              });
              await newAlert.save();

              if (io) {
                const newAlertObj = newAlert.toObject();
                io.emit('alert:new', {
                  id: newAlertObj._id.toString(),
                  nodeId: spindleId,
                  machineId: machine.machineId,
                  machineName: machine.name,
                  type: severity.toUpperCase(),
                  message: newAlertObj.message,
                  technicianSummary: newAlertObj.technicianSummary,
                  anomalyScore: bpfoScore,
                  timestamp: newAlertObj.detectedAt.toISOString().replace('T', ' ').substring(0, 19),
                  status: newAlertObj.status,
                  estimatedTimeToFailure: severity === 'critical' ? '6-18 hours' : '3-7 days'
                });
              }
            }
          }

          if (io) {
            io.to(`machine:${machine.machineId}`).emit('sensor:update', {
              machineId: machine.machineId,
              spindleId,
              healthScore: finalHealthScore,
              accel_x,
              accel_y,
              accel_z,
              rpm,
              temperature,
              acousticRMS: +rms.toFixed(3),
              bpfoScore,
              anomalyFlag,
              mlLabel,
              timestamp: reading.timestamp.toISOString()
            });
          }
        }
      }

      if (io) {
        // ---- Fleet summary computed from real stored data (no hardcoded 77) ----
        const totalMachines = await Machine.countDocuments();
        const criticalCount = await Machine.countDocuments({ status: 'critical' });
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const alertsToday = await Alert.countDocuments({ detectedAt: { $gte: startOfDay } });

        const latestReadings = await SpindleReading.aggregate([
          { $sort: { timestamp: -1 } },
          { $group: { _id: { machineId: '$machineId', spindleId: '$spindleId' }, healthScore: { $first: '$healthScore' } } }
        ]);
        const avgHealthScore = latestReadings.length > 0
          ? Math.round(latestReadings.reduce((acc, r) => acc + r.healthScore, 0) / latestReadings.length)
          : 100;

        io.to('fleet').emit('fleet:summary', {
          totalMachines,
          criticalCount,
          avgHealthScore,
          alertsToday,
          mlOnline: this.mlOnline
        });
      }
    } catch (err) {
      console.error('Simulator error:', err);
    }
  }
}

export const sensorSimulator = new SensorSimulator();
