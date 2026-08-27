import { ingestHardwareReading } from "../routes/hardware.js";

// ─────────────────────────────────────────────────────────────────────────────
// HardwareSimulator — synthesises the Arduino rig's tachometer + DS18B20
// stream when no physical hardware is attached, so the Hardware Lab page is
// always live. It feeds the EXACT same ingest path as hardware/main.py
// (ingestHardwareReading), which is why the page's "source" chip is honest:
// every sample is labelled simulator vs arduino.
//
// The stream models a real DC motor rig: RPM wobbles around 1440 (a 4-pole
// ~50 Hz motor at ~24 rev/s), temperature drifts slowly with the load cycle,
// and every few minutes a mild thermal episode pushes the verdict into
// WARNING so the anomaly engine visibly reacts — then recovers.
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW = 30; // matching main.py's 30 s rolling window
const TEMP_CRITICAL_C = 60.0;
const RPM_DROP_FRACTION = 0.3;

class HardwareSimulator {
  private intervalId: NodeJS.Timeout | null = null;
  private startedAt = 0;

  // 30 s rolling windows
  private rpmWindow: number[] = [];
  private tempWindow: number[] = [];

  public start(): void {
    if (this.intervalId) return;
    this.startedAt = Date.now();
    this.intervalId = setInterval(() => this.tick(), 1000);
    console.log("Hardware simulator started (Arduino rig demo stream)");
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("Hardware simulator stopped");
    }
  }

  private sample(): { rpm: number; temperature: number } {
    const t = (Date.now() - this.startedAt) / 1000;
    const cycle = Math.floor(t) % 420; // 7-minute load cycle

    // RPM: 1440 nominal + slow load wobble + small sensor noise.
    const rpm = 1440 + 18 * Math.sin((2 * Math.PI * cycle) / 120) + (Math.random() - 0.5) * 6;

    // Temperature: baseline 28 °C, rises a few degrees as the load cycle
    // progresses, plus jitter. Episodes where it climbs into the mid-40s are
    // the "early warning" moments the anomaly engine should flag.
    const loadPhase = (cycle / 420) * Math.PI; // 0 → π over the cycle
    let temperature = 28 + 4.5 * Math.sin(loadPhase) + (Math.random() - 0.5) * 0.6;

    // Every ~4th cycle runs hotter (bearing friction demo): push toward 48 °C.
    if (Math.floor(t / 420) % 4 === 3) {
      temperature += 12 * Math.sin(loadPhase);
    }
    return { rpm, temperature: Math.round(temperature * 100) / 100 };
  }

  private features(): {
    rpm_mean: number;
    rpm_std: number;
    temp_mean: number;
    temp_rate_of_change: number;
    rpm_temp_ratio: number;
  } {
    const n = this.rpmWindow.length;
    const rpmMean = this.rpmWindow.reduce((a, b) => a + b, 0) / Math.max(1, n);
    const rpmStd = Math.sqrt(
      this.rpmWindow.reduce((a, b) => a + (b - rpmMean) ** 2, 0) / Math.max(1, n),
    );
    const tempMean = this.tempWindow.length
      ? this.tempWindow.reduce((a, b) => a + b, 0) / this.tempWindow.length
      : 0;

    // °C/s slope over the window via least squares (same as main.py).
    let tempRoc = 0;
    if (this.tempWindow.length >= 2) {
      const m = this.tempWindow.length;
      const xMean = (m - 1) / 2;
      const yMean = tempMean;
      let numSum = 0;
      let denSum = 0;
      for (let i = 0; i < m; i++) {
        numSum += (i - xMean) * (this.tempWindow[i] - yMean);
        denSum += (i - xMean) ** 2;
      }
      tempRoc = denSum > 0 ? numSum / denSum : 0; // per-sample step = 1 s
    }

    return {
      rpm_mean: +rpmMean.toFixed(1),
      rpm_std: +rpmStd.toFixed(2),
      temp_mean: +tempMean.toFixed(2),
      temp_rate_of_change: +tempRoc.toFixed(4),
      rpm_temp_ratio: tempMean > 0 ? +(rpmMean / tempMean).toFixed(1) : 0,
    };
  }

  private verdict(
    temp: number,
    features: { rpm_mean: number; rpm_std: number; temp_mean: number },
  ): { verdict: string; colour: string; health_index: number } {
    // Hard safety thresholds (mirror main.py).
    if (temp > TEMP_CRITICAL_C) {
      return { verdict: "BEARING FAULT / SEVERE", colour: "red", health_index: 0 };
    }
    const latestRpm = this.rpmWindow[this.rpmWindow.length - 1] ?? 0;
    const rpmDrop = features.rpm_mean > 0 ? (features.rpm_mean - latestRpm) / features.rpm_mean : 0;
    if (rpmDrop > RPM_DROP_FRACTION) {
      return { verdict: "BEARING FAULT / SEVERE", colour: "red", health_index: 0 };
    }

    // Proximity-based health proxy (IsolationForest runs in main.py on the rig;
    // the simulator mirrors it with a simple distance-to-nominal model).
    const tempDistance = Math.abs(features.temp_mean - 30) / 20; // 0 at 30 °C
    const jitter = features.rpm_std > 12 ? 0.25 : 0; // abnormal wobble penalty
    const health = Math.max(0, Math.min(1, 1 - tempDistance - jitter));

    if (health >= 0.7) return { verdict: "HEALTHY", colour: "green", health_index: +health.toFixed(3) };
    if (health >= 0.35) return { verdict: "WARNING / IMBALANCE", colour: "yellow", health_index: +health.toFixed(3) };
    return { verdict: "BEARING FAULT / SEVERE", colour: "red", health_index: +health.toFixed(3) };
  }

  private tick(): void {
    const { rpm, temperature } = this.sample();
    this.rpmWindow.push(rpm);
    this.tempWindow.push(temperature);
    if (this.rpmWindow.length > WINDOW) this.rpmWindow.shift();
    if (this.tempWindow.length > WINDOW) this.tempWindow.shift();

    const features = this.features();
    const { verdict, colour, health_index } = this.verdict(temperature, features);

    ingestHardwareReading(
      {
        rpm,
        temperature,
        motorSpeed: 150,
        rpm_mean: features.rpm_mean,
        rpm_std: features.rpm_std,
        temp_mean: features.temp_mean,
        temp_rate_of_change: features.temp_rate_of_change,
        rpm_temp_ratio: features.rpm_temp_ratio,
        health_index,
        verdict,
        colour,
      },
      "simulator",
    );
  }
}

export const hardwareSimulator = new HardwareSimulator();
