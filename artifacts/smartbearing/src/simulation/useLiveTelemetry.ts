/**
 * useLiveTelemetry — polls the PhysicsEngine singleton at 60 fps and
 * returns the latest motor / thermal / tachometer / tempSensor state.
 *
 * Used by non-R3F components (SimControls, ThermalPanel, header bar)
 * that need live data but aren't inside the Canvas useFrame loop.
 */
import { useEffect, useRef, useState } from 'react';
import { engine } from './engineRef';
import type { MotorState, ThermalState, TachometerState, TemperatureSensorState } from './types';

const EMPTY_MOTOR: MotorState = {
  omega: 0, theta: 0, vEff: 0, direction: 0, dutyCycle: 0,
  backEmf: 0, current: 0, torque: 0, rpm: 0,
};
const EMPTY_THERMAL: ThermalState = {
  bearingTemp: 25, motorTemp: 30, ambientTemp: 25, dissipationRate: 0, frictionLoss: 0,
};
const EMPTY_TACH: TachometerState = {
  cumulativeAngle: 0, slotCount: 20, slotAngle: 2 * Math.PI / 20,
  interruptPulse: false, pulseCount: 0, lastInterruptTime: 0,
};
const EMPTY_TEMP_SENSOR: TemperatureSensorState = {
  temperature: 25, busState: 'idle', commandByte: 0,
  scratchpad: new Uint8Array(9), pullupDetected: true, pinLevel: 0,
};

export function useLiveTelemetry() {
  const [snap, setSnap] = useState(() => {
    const f = engine.snapshot(performance.now());
    return { motor: f.motor, thermal: f.thermal, tachometer: f.tachometer, tempSensor: f.tempSensor };
  });

  useEffect(() => {
    let rafId: number;
    let lastUpdate = 0;
    const loop = (now: number) => {
      if (now - lastUpdate >= 16) {
        lastUpdate = now;
        const f = engine.snapshot(now);
        setSnap({ motor: f.motor, thermal: f.thermal, tachometer: f.tachometer, tempSensor: f.tempSensor });
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return snap;
}

/**
 * Mechanical twin telemetry types.
 */
export interface MechanicalTelemetry {
  spindleRPM: number;
  spindleAngle: number;
  bearingTemp: number;
  bearingWear: number;
  shaftWobble: number;
  motorCurrent: number;
  motorTorque: number;
  isRunning: boolean;
  frictionPower: number;    // mW
  dissipationPower: number; // mW
  ambientTemp: number;      // °C
  supplyVoltage: number;    // V
  bearingFriction: number;  // μ
}

/**
 * useMechanicalTelemetry — polls the engine at 60fps using a ref-based
 * approach to avoid stale closures and ensure always-fresh values.
 * Returns a ref with a forceUpdate trigger for React re-renders.
 */
const _emptyMech: MechanicalTelemetry = {
  spindleRPM: 0, spindleAngle: 0, bearingTemp: 25, bearingWear: 0,
  shaftWobble: 0, motorCurrent: 0, motorTorque: 0, isRunning: false,
  frictionPower: 0, dissipationPower: 0, ambientTemp: 25,
  supplyVoltage: 12, bearingFriction: 0.002,
};

export function useMechanicalTelemetry(): MechanicalTelemetry {
  const [tick, setTick] = useState(0);
  const snapRef = useRef<MechanicalTelemetry>(_emptyMech);

  useEffect(() => {
    let rafId: number;
    let lastRender = 0;
    const loop = (now: number) => {
      snapRef.current = engine.getMechanicalSnapshot();
      if (now - lastRender >= 50) {
        lastRender = now;
        setTick((t) => t + 1);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    // Fallback: setInterval ensures updates when RAF is throttled
    const intervalId = setInterval(() => {
      snapRef.current = engine.getMechanicalSnapshot();
      setTick((t) => t + 1);
    }, 50);
    return () => { cancelAnimationFrame(rafId); clearInterval(intervalId); };
  }, []);

  return snapRef.current;
}
