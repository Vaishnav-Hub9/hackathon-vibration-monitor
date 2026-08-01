import { useState, useEffect, useMemo } from 'react';
import { useLiveSensors, type LiveSensor } from '@/hooks/useLiveSensors';

export type { LiveSensor };

/**
 * Landing-page sensor stream.
 * Tries the real backend + socket first. If no data arrives (backend offline),
 * it falls back to a self-updating simulation so the 3D bearing model,
 * FFT overlay and telemetry panels stay fully alive during demos.
 */

const LOCATIONS = [
  'Main Drive Bearing',
  'Section 2 Bearing',
  'Section 4 Bearing',
  'Fan Bearing',
  'Guide Roller',
  'Tension Pulley',
  'Crimp Roller',
  'Doffer Bearing',
];

const STATUS_FROM_SCORE = (score: number): 'healthy' | 'warning' | 'critical' =>
  score < 50 ? 'critical' : score < 80 ? 'warning' : 'healthy';

function makeSensor(i: number): LiveSensor {
  // Sensors 2 and 5 degrade aggressively so the demo shows warning/critical states.
  const base = i === 2 ? 55 : i === 5 ? 45 : 88;
  const accelZ = i === 2 ? 1.9 : i === 5 ? 3.2 : 0.4;
  const temp = i === 2 ? 58 : i === 5 ? 73 : 38;
  return {
    id: `SP-${String(i + 1).padStart(3, '0')}`,
    machineId: 'M001',
    location: LOCATIONS[i % LOCATIONS.length],
    healthScore: base,
    accel_x: 0.2,
    accel_y: 0.25,
    accel_z: accelZ,
    rpm: 14200 + Math.round(Math.random() * 800),
    temperature: temp,
    anomalyScore: i === 2 ? 0.32 : i === 5 ? 0.72 : 0.05,
    acousticLevel: i === 2 ? 0.6 : i === 5 ? 1.4 : 0.3,
    status: STATUS_FROM_SCORE(base),
    vibDelta: 0,
    tempDelta: 0,
  };
}

function tickSensor(s: LiveSensor, idx: number): LiveSensor {
  const degrading = idx === 2 || idx === 5;
  const healthDrift = degrading ? -(Math.random() * 0.9) : (Math.random() - 0.5) * 0.6;
  const health = Math.min(99, Math.max(28, s.healthScore + healthDrift));
  const targetAccel = degrading ? 1.6 + (idx === 5 ? 2.0 : 0.6) : 0.4;
  const accel = Math.max(0.1, s.accel_z + (targetAccel - s.accel_z) * 0.12 + (Math.random() - 0.5) * 0.18);
  const targetTemp = degrading ? (idx === 5 ? 76 : 62) : 39;
  const temp = s.temperature + (targetTemp - s.temperature) * 0.08 + (Math.random() - 0.5) * 1.2;
  return {
    ...s,
    healthScore: +health.toFixed(1),
    accel_x: +(s.accel_x * 0.7 + (Math.random() - 0.5) * 0.2).toFixed(3),
    accel_y: +(s.accel_y * 0.7 + (Math.random() - 0.5) * 0.2).toFixed(3),
    accel_z: +accel.toFixed(3),
    rpm: Math.round(Math.min(16000, Math.max(8000, s.rpm + (Math.random() - 0.5) * 300))),
    temperature: +temp.toFixed(1),
    anomalyScore: +Math.min(0.95, Math.max(0.02, s.anomalyScore + (Math.random() - 0.5) * 0.06)).toFixed(2),
    acousticLevel: +(0.2 + (accel / 4) * 1.2).toFixed(2),
    status: STATUS_FROM_SCORE(health),
    vibDelta: +(s.accel_z > 0 ? accel - s.accel_z : 0).toFixed(3),
    tempDelta: +(temp - s.temperature).toFixed(1),
  };
}

export function useLandingSensors(count = 8): LiveSensor[] {
  const real = useLiveSensors();
  const [sim, setSim] = useState<LiveSensor[]>(() =>
    Array.from({ length: count }, (_, i) => makeSensor(i))
  );
  const [useReal, setUseReal] = useState(false);

  useEffect(() => {
    if (real.length > 0) setUseReal(true);
  }, [real]);

  useEffect(() => {
    if (useReal) return;
    const t = setInterval(() => {
      setSim((prev) => prev.map((s, i) => tickSensor(s, i)));
    }, 900);
    return () => clearInterval(t);
  }, [useReal]);

  const active = useMemo(() => {
    const base = useReal && real.length > 0 ? real.slice(0, count) : sim;
    if (base.length < count) {
      const padded = [...base];
      for (let i = base.length; i < count; i++) padded.push(makeSensor(i));
      return padded;
    }
    return base;
  }, [useReal, real, sim, count]);
  return active;
}
