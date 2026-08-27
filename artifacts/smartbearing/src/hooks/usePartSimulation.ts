import { useEffect, useRef, useState } from 'react';
import type { CadPart, PartLive } from '@/components/dashboard/NativeCadViewer';

// Baseline operating points per bearing part. Values drift around these and
// scale up with machine stress (low health score / high live vibration) so the
// simulation feels driven by the real telemetry stream.
const PART_PROFILES: Record<string, { tempBase: number; vibBase: number; drift: number }> = {
  'Outer Race': { tempBase: 66, vibBase: 1.05, drift: 0.55 },
  'Inner Race': { tempBase: 61, vibBase: 0.75, drift: 0.5 },
  'Rolling Element': { tempBase: 63, vibBase: 0.9, drift: 0.55 },
  Bearing: { tempBase: 62, vibBase: 0.85, drift: 0.5 },
};

const DEFAULT_PROFILE = { tempBase: 62, vibBase: 0.85, drift: 0.5 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Streams simulated per-part sensor readings (temperature, vibration RMS,
 * health %, anomaly score) every ~1.4s. Each part drifts around its baseline,
 * scaled by machine stress, and the seed values blend in the live machine
 * telemetry so the numbers look consistent with the rest of the dashboard.
 */
export function usePartSimulation(parts: CadPart[] | null, liveData: any, healthScore: number) {
  const [live, setLive] = useState<Record<string, PartLive>>({});
  const ctxRef = useRef({ liveData, healthScore });
  ctxRef.current = { liveData, healthScore };

  useEffect(() => {
    if (!parts || parts.length === 0) {
      setLive({});
      return;
    }

    const stress = () => clamp(1 - (ctxRef.current.healthScore ?? 100) / 100, 0, 1);

    const seedPart = (p: CadPart): PartLive => {
      const prof = PART_PROFILES[p.name] ?? DEFAULT_PROFILE;
      const machineTemp = Number(ctxRef.current.liveData?.temperature) || 0;
      const machineVib = Number(ctxRef.current.liveData?.accel_z) || 0;
      // Blend baseline with the live machine anchor so parts track the socket stream.
      const temp = machineTemp > 0 ? (prof.tempBase + prof.drift * 2 + machineTemp) / 2 : prof.tempBase + prof.drift * 2;
      const vibration = machineVib > 0 ? (prof.vibBase + machineVib) / 2 : prof.vibBase;
      const health = clamp(100 - Math.max(0, temp - 52) * 2.2 - Math.max(0, vibration - 0.5) * 14, 2, 100);
      return { temperature: temp, vibration, health, anomaly: clamp((100 - health) / 100, 0, 1) };
    };

    const seed: Record<string, PartLive> = {};
    for (const p of parts) seed[p.url] = seedPart(p);
    setLive(seed);

    const t = setInterval(() => {
      setLive((prev) => {
        const s = stress();
        const next: Record<string, PartLive> = {};
        for (const p of parts) {
          const prof = PART_PROFILES[p.name] ?? DEFAULT_PROFILE;
          const cur = prev[p.url] ?? seed[p.url];
          const targetTemp = prof.tempBase + s * 14;
          const targetVib = prof.vibBase + s * 1.3;
          const temperature = clamp(
            cur.temperature + (targetTemp - cur.temperature) * 0.25 + (Math.random() - 0.5) * prof.drift * 2,
            35,
            120,
          );
          const vibration = clamp(
            cur.vibration + (targetVib - cur.vibration) * 0.25 + (Math.random() - 0.5) * 0.16,
            0.2,
            8,
          );
          const health = clamp(
            100 - Math.max(0, temperature - 52) * 2.2 - Math.max(0, vibration - 0.5) * 14,
            2,
            100,
          );
          next[p.url] = { temperature, vibration, health, anomaly: clamp((100 - health) / 100, 0, 1) };
        }
        return next;
      });
    }, 1400);

    return () => clearInterval(t);
  }, [parts]);

  return live;
}
