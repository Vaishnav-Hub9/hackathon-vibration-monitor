/**
 * Core physics simulation engine — computes motor dynamics, tachometer
 * pulses, temperature sensor readings, and thermal balance in real-time.
 *
 * Also manages the mechanical digital twin simulation (spindle, shaft,
 * ball bearing) with its own physics sub-model.
 *
 * Runs on the main thread at 60 Hz (one tick per animation frame).
 */
import {
  type MCUState,
  type MotorState,
  type HBridgeState,
  type TachometerState,
  type TemperatureSensorState,
  type ThermalState,
  type TelemetryFrame,
  type SimParams,
  type MechanicalParams,
  DEFAULT_SIM_PARAMS,
  DEFAULT_MECHANICAL_PARAMS,
  MOTOR_CONSTANTS,
  THERMAL_CONSTANTS,
} from './types';
import type { MechanicalTelemetry } from './useLiveTelemetry';
import { useDigitalTwinStore } from './store';

// ── H-Bridge Logic State Matrix ─────────────────────────────────────────────

function decodeHBridge(in1: 0 | 1, in2: 0 | 1): 1 | -1 | 0 {
  if (in1 === 1 && in2 === 0) return 1;
  if (in1 === 0 && in2 === 1) return -1;
  return 0;
}

// ── Runge-Kutta 4th-order ODE solver for motor dynamics ─────────────────────

function motorODE(omega: number, vEff: number, loadTorque: number): number {
  const { J, b, Kt, Ke, Ra } = MOTOR_CONSTANTS;
  const current = (vEff - Ke * omega) / Ra;
  const electromagneticTorque = Kt * current;
  const dOmegaDt = (electromagneticTorque - b * omega - loadTorque) / J;
  return dOmegaDt;
}

function rungeKutta4(
  omega: number, vEff: number, loadTorque: number, dt: number,
): number {
  const k1 = motorODE(omega, vEff, loadTorque);
  const k2 = motorODE(omega + (dt / 2) * k1, vEff, loadTorque);
  const k3 = motorODE(omega + (dt / 2) * k2, vEff, loadTorque);
  const k4 = motorODE(omega + dt * k3, vEff, loadTorque);
  return omega + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

// ── OneWire DS18B20 Bit-level Protocol Simulation ───────────────────────────

function updateScratchpad(temp: number): Uint8Array {
  const scratchpad = new Uint8Array(9);
  const raw = Math.round(temp * 16);
  scratchpad[0] = raw & 0xff;
  scratchpad[1] = (raw >> 8) & 0x0f;
  scratchpad[2] = 0x4B;
  scratchpad[3] = 0x16;
  scratchpad[4] = 0x7F;
  scratchpad[7] = 0x10;
  scratchpad[8] = 0x00;
  return scratchpad;
}

// ── Mechanical Twin Constants ────────────────────────────────────────────────

/** Cotton spindle physical model */
const SPINDLE = {
  /** Rotor + spindle moment of inertia (kg·m²) */
  J: 2.5e-5,
  /** Viscous damping (N·m·s/rad) */
  b: 1.0e-5,
  /** Motor torque constant (N·m/A) */
  Kt: 0.042,
  /** Back-EMF constant (V·s/rad) */
  Ke: 0.042,
  /** Armature resistance (Ω) */
  Ra: 2.5,
  /** Max no-load RPM */
  maxRPM: 15000,
};

/** Ball bearing model */
const BEARING = {
  /** Number of rolling elements (balls) */
  ballCount: 9,
  /** Ball diameter (mm) → scaled to scene units */
  ballDiameter: 0.08,
  /** Pitch radius (mm) → scaled */
  pitchRadius: 0.22,
  /** Outer race radius */
  outerRadius: 0.32,
  /** Inner race radius */
  innerRadius: 0.14,
  /** Thermal mass (J/°C) */
  thermalMass: 8.0,
  /** Convective coefficient (W/m²·°C) */
  hConv: 15.0,
  /** Exposed area (m²) */
  area: 0.001,
  /** Wear rate per million revolutions */
  wearRate: 0.0001,
};

// ── PhysicsEngine class ─────────────────────────────────────────────────────

export class PhysicsEngine {
  private params: SimParams = { ...DEFAULT_SIM_PARAMS };
  private mechParams: MechanicalParams = { ...DEFAULT_MECHANICAL_PARAMS };

  // ── Circuit twin state ──
  private omega = 0;
  private theta = 0;
  private motorDir: 1 | -1 | 0 = 0;
  private in1: 0 | 1 = 0;
  private in2: 0 | 1 = 0;
  private ena = 0;
  private encoderPulses = 0;
  private lastPulseTime = 0;
  private sensorTemp = 25;
  private oneWireBusState: TemperatureSensorState['busState'] = 'idle';
  private oneWireCmdByte = 0;
  private bearingTemp = 25;
  private motorTemp = 30;
  private liveRPM = 0;
  private liveTemp: number | null = null;
  private liveMotorSpeed = 0;
  private hasLiveData = false;
  private lastLiveAt = 0;
  private serialBuffer = '';
  private simTime = 0;
  private lastFrameTime = 0;
  private lastFrame: TelemetryFrame | null = null;
  private mcuState: MCUState = this.defaultMCUState();

  // ── Mechanical twin state ──
  private mechOmega = 0;           // angular velocity (rad/s)
  private mechTheta = 0;           // cumulative angle (rad)
  private mechBearingTemp = 25;    // bearing temperature (°C)
  private mechBearingWear = 0;     // cumulative wear (0–1)
  private mechShaftWobble = 0;     // shaft wobble amplitude (0–1)
  private mechFrictionPower = 0;   // friction power (mW) for UI readout
  private mechSimTime = 0;

  private defaultMCUState(): MCUState {
    const pins: Record<number, { digital: 0 | 1; analog: number; output: boolean }> = {};
    for (let i = 0; i <= 13; i++) {
      pins[i] = { digital: 0, analog: 0, output: false };
    }
    return {
      portD: 0, portB: 0, pins, timer1OCR1A: 0,
      pc: 0, cycleCount: 0, serialBuffer: '', interruptsEnabled: true,
    };
  }

  // ── Public API ──

  applyLiveReading(rpm: number, temperature: number | null, motorSpeed: number): void {
    this.liveRPM = rpm;
    this.liveTemp = temperature;
    this.liveMotorSpeed = motorSpeed;
    this.hasLiveData = true;
    this.lastLiveAt = Date.now();
  }

  isLive(): boolean {
    return this.hasLiveData && Date.now() - this.lastLiveAt < 3500;
  }

  setParams(params: Partial<SimParams>): void {
    Object.assign(this.params, params);
  }

  getParams(): SimParams {
    return { ...this.params };
  }

  setMechParams(params: Partial<MechanicalParams>): void {
    Object.assign(this.mechParams, params);
  }

  getMechParams(): MechanicalParams {
    return { ...this.mechParams };
  }

  /** Reset all mechanical twin state to defaults (for testing) */
  resetMechanical(): void {
    this.mechOmega = 0;
    this.mechTheta = 0;
    this.mechBearingTemp = 25;
    this.mechBearingWear = 0;
    this.mechShaftWobble = 0;
    this.mechFrictionPower = 0;
    this.mechSimTime = 0;
  }

  updateMCU(state: Partial<MCUState>): void {
    if (state.pins) {
      if (state.pins[9] !== undefined) {
        this.ena = state.timer1OCR1A ?? state.pins[9].digital * 255;
      }
      if (state.pins[10] !== undefined) {
        this.in1 = state.pins[10].digital;
      }
      if (state.pins[11] !== undefined) {
        this.in2 = state.pins[11].digital;
      }
      if (state.pins[5] !== undefined) {
        this.processOneWire(state.pins[5].digital);
      }
    }
    if (state.timer1OCR1A !== undefined) {
      this.ena = state.timer1OCR1A;
    }
    Object.assign(this.mcuState, state);
  }

  /**
   * Main simulation tick — called at 60 Hz from the animation loop.
   * Advances both the circuit twin and the mechanical twin.
   */
  tick(timestamp: number): TelemetryFrame {
    const dt = this.params.timeStep;

    if (this.params.paused) {
      return this.buildFrame(timestamp);
    }

    this.simTime += dt;
    this.tickMechanical(dt);

    // ── 1. H-Bridge decode ──
    const direction = decodeHBridge(this.in1, this.in2);
    this.motorDir = direction;

    // ── 2. Effective terminal voltage ──
    const dutyCycle = this.ena / 255;
    const vEff = dutyCycle * this.params.supplyVoltage * direction;

    // ── 3. DC Motor dynamics ──
    const liveOmega = this.isLive() ? (this.liveRPM * 2 * Math.PI) / 60 : 0;
    const manualOmega = this.params.manualRPM > 0
      ? (this.params.manualRPM * 2 * Math.PI) / 60
      : 0;

    if (this.isLive()) {
      this.omega += (liveOmega - this.omega) * 0.15;
    } else if (this.params.manualRPM > 0) {
      // Manual RPM: use supply voltage to drive the ODE, so load torque
      // and supply voltage affect thermal/current readouts realistically.
      // Force direction = 1 (forward) and 100% effective duty.
      const manualVEff = this.params.supplyVoltage; // full supply, forward
      this.omega = rungeKutta4(this.omega, manualVEff, this.params.loadTorque, dt);
    } else {
      this.omega = rungeKutta4(this.omega, vEff, this.params.loadTorque, dt);
    }

    const hasInput = this.isLive() || this.params.manualRPM > 0 || direction !== 0;
    if (!hasInput) {
      this.omega = 0;
      this.encoderPulses = 0;
    }

    this.omega = Math.max(-MOTOR_CONSTANTS.noLoadRPM * (2 * Math.PI / 60), Math.min(
      MOTOR_CONSTANTS.noLoadRPM * (2 * Math.PI / 60), this.omega,
    ));

    this.theta += this.omega * dt;
    this.theta = this.theta % (2 * Math.PI * 100);

    const rpm = Math.abs((this.omega * 60) / (2 * Math.PI));
    const backEmf = MOTOR_CONSTANTS.Ke * Math.abs(this.omega);
    // Use the effective voltage that actually drives the ODE
    const effectiveVEff = this.isLive()
      ? (this.liveRPM * 2 * Math.PI / 60) > 0 ? this.params.supplyVoltage : 0
      : this.params.manualRPM > 0
        ? this.params.supplyVoltage
        : vEff;
    const current = Math.abs(effectiveVEff - backEmf) / MOTOR_CONSTANTS.Ra;
    const torque = MOTOR_CONSTANTS.Kt * current;
    const effectiveDuty = this.params.manualRPM > 0 ? 1 : dutyCycle;
    const effectiveDir = this.params.manualRPM > 0 ? 1 : direction;

    const motorState: MotorState = {
      omega: this.omega, theta: this.theta, vEff: effectiveVEff,
      direction: effectiveDir, dutyCycle: effectiveDuty,
      backEmf, current, torque, rpm,
    };

    // ── 4. Tachometer ──
    const slotAngle = (2 * Math.PI) / this.params.encoderSlots;
    const prevPulses = this.encoderPulses;
    const expectedPulses = Math.floor(this.theta / slotAngle);
    this.encoderPulses = Math.max(0, expectedPulses);
    const interruptPulse = this.encoderPulses > prevPulses && this.omega > 0;

    if (interruptPulse) {
      this.lastPulseTime = timestamp;
    }

    const tachometerState: TachometerState = {
      cumulativeAngle: this.theta % (2 * Math.PI * this.params.encoderSlots),
      slotCount: this.params.encoderSlots, slotAngle,
      interruptPulse, pulseCount: this.encoderPulses,
      lastInterruptTime: this.lastPulseTime,
    };

    // ── 5. Thermal model ──
    const frictionPower = MOTOR_CONSTANTS.b * this.omega * this.omega;
    this.bearingTemp = this.updateTemperature(this.bearingTemp, frictionPower, dt);
    const electricalLoss = current * current * MOTOR_CONSTANTS.Ra;
    this.motorTemp = this.updateTemperature(this.motorTemp, frictionPower + electricalLoss * 0.3, dt);

    this.bearingTemp = Math.max(this.params.ambientTemp, Math.min(120, this.bearingTemp));
    this.motorTemp = Math.max(this.params.ambientTemp, Math.min(120, this.motorTemp));

    if (this.isLive() && this.liveTemp !== null) {
      this.sensorTemp = this.liveTemp;
      this.bearingTemp = this.liveTemp - 2.5;
    } else {
      this.sensorTemp = this.bearingTemp + 2.5;
    }

    const thermalState: ThermalState = {
      bearingTemp: this.bearingTemp, motorTemp: this.motorTemp,
      ambientTemp: this.params.ambientTemp,
      dissipationRate: THERMAL_CONSTANTS.h * THERMAL_CONSTANTS.A * (this.bearingTemp - this.params.ambientTemp),
      frictionLoss: frictionPower,
    };

    // ── 6. DS18B20 ──
    const tempSensorState: TemperatureSensorState = {
      temperature: this.sensorTemp, busState: this.oneWireBusState,
      commandByte: this.oneWireCmdByte,
      scratchpad: updateScratchpad(this.sensorTemp),
      pullupDetected: true, pinLevel: this.mcuState.pins[5]?.digital ?? 0,
    };

    // ── 7. Serial output ──
    if (Math.floor(this.simTime) > Math.floor(this.simTime - dt)) {
      const frame = {
        rpm: Math.round(rpm),
        temp_c: +this.sensorTemp.toFixed(2),
        pwm_duty: Math.round(this.ena),
        status: rpm > 0 ? 'NOMINAL' : 'IDLE',
      };
      this.serialBuffer = JSON.stringify(frame);
    }

    const frame = {
      timestamp, mcu: { ...this.mcuState }, motor: motorState,
      hbridge: { in1: this.in1, in2: this.in2, ena: this.ena, direction },
      tachometer: tachometerState, tempSensor: tempSensorState,
      thermal: thermalState, serialOutput: this.serialBuffer,
    };
    this.lastFrame = frame;
    return frame;
  }

  /**
   * Mechanical digital twin tick — advances spindle, shaft, and bearing physics.
   * Called from tick() every frame. Reads directly from the Zustand store
   * to avoid subscription timing gaps — guaranteed fresh params every frame.
   */
  private tickMechanical(dt: number): void {
    // Read directly from the store — no subscription lag
    const mp = useDigitalTwinStore.getState().mechParams;
    this.mechParams = mp;

    if (!mp.spindleRunning) {
      // Exponential brake to zero
      this.mechOmega *= 0.90;
      if (this.mechOmega < 1) this.mechOmega = 0;
    } else {
      // Direct ramp toward target RPM — fast, responsive, no ODE fighting
      const targetOmega = (mp.spindleRPM * 2 * Math.PI) / 60;
      const rampRate = 0.15; // reaches 95% in ~0.2s
      this.mechOmega += (targetOmega - this.mechOmega) * rampRate;
    }

    // Clamp
    const maxOmega = (SPINDLE.maxRPM * 2 * Math.PI) / 60;
    this.mechOmega = Math.max(0, Math.min(maxOmega, this.mechOmega));

    // Accumulate angle
    this.mechTheta += this.mechOmega * dt;
    this.mechTheta %= (2 * Math.PI * 10000);

    // Bearing temperature: friction heating + convective cooling
    // Friction power = friction_torque × omega = (μ × N × r) × ω
    const mechRPM = (this.mechOmega * 60) / (2 * Math.PI);
    const normalForce = 50; // N (axial preload on bearing)
    const contactRadius = 0.01; // m (ball-race contact)
    const frictionTorque = mp.bearingFriction * normalForce * contactRadius;
    const frictionPower = frictionTorque * this.mechOmega; // W
    // Amplify heating for visible demo response — bearing temp should climb
    // noticeably within seconds at high speed/friction
    const heating = (frictionPower * 12.0) / BEARING.thermalMass;
    const cooling = BEARING.hConv * BEARING.area * (this.mechBearingTemp - (mp.ambientTemp ?? 25)) / BEARING.thermalMass;
    this.mechBearingTemp += (heating - cooling) * dt;
    this.mechBearingTemp = Math.max(20, Math.min(150, this.mechBearingTemp));

    // Bearing wear: accumulates based on revolutions, load, speed, and friction
    // Tuned for visible demo response:
    //   defaults (3k RPM, 10 mN·m, μ=0.002): ~0.8%/s → 100% in ~2 min
    //   max (15k RPM, 100 mN·m, μ=0.01): ~12%/s → 100% in ~8s
    if (mp.spindleRunning) {
      const loadFactor = Math.min(1, mp.spindleLoad / 0.02);   // normalized to 0–1 at 20 mN·m
      const speedFactor = mechRPM / SPINDLE.maxRPM;             // normalized 0–1
      const frictionMultiplier = 1 + mp.bearingFriction * 1000;  // μ amplifies wear heavily
      const wearIncrement = 0.015 * loadFactor * speedFactor * frictionMultiplier * dt;
      this.mechBearingWear += wearIncrement;
      this.mechBearingWear = Math.min(1, this.mechBearingWear);
    }

    // Shaft wobble: increases with speed and wear, has natural resonance
    const speedWobble = Math.sin(this.mechTheta * 7.3) * (mechRPM / SPINDLE.maxRPM) * 0.15;
    const wearWobble = this.mechBearingWear * Math.sin(this.mechTheta * 13.7) * 0.3;
    const resonanceBoost = (mechRPM > 4000 && mechRPM < 6000) ? 0.2 : 0; // resonance zone
    this.mechShaftWobble = Math.abs(speedWobble + wearWobble) * (1 + resonanceBoost);
    this.mechShaftWobble = Math.min(1, this.mechShaftWobble);

    // Expose live friction power for panels
    this.mechFrictionPower = frictionPower * 1000; // mW

    this.mechSimTime += dt;
  }

  /** Motor ODE for the mechanical twin */
  private mechMotorODE(omega: number, vEff: number, loadTorque: number): number {
    const { J, b, Kt, Ke, Ra } = SPINDLE;
    const current = (vEff - Ke * omega) / Ra;
    const torque = Kt * current;
    return (torque - b * omega - loadTorque) / J;
  }

  /**
   * Returns the current mechanical twin state as a snapshot.
   * Used by useMechanicalTelemetry for non-R3F UI components.
   */
  getMechanicalSnapshot(): MechanicalTelemetry {
    const rpm = (this.mechOmega * 60) / (2 * Math.PI);
    const mp2 = useDigitalTwinStore.getState().mechParams;
    const running = mp2.spindleRunning && this.mechOmega > 5;
    // Motor current: only when running and motor is producing torque
    const current = running ? Math.max(0, (mp2.supplyVoltage - SPINDLE.Ke * this.mechOmega) / SPINDLE.Ra) : 0;
    const torque = running ? SPINDLE.Kt * current : 0;
    // Dissipation power for thermal panels
    const bearingFrictionTorque = mp2.bearingFriction * this.mechOmega * 50;
    const ambient = this.params.ambientTemp;
    const dissipation = BEARING.hConv * BEARING.area * (this.mechBearingTemp - ambient);

    return {
      spindleRPM: rpm,
      spindleAngle: this.mechTheta,
      bearingTemp: this.mechBearingTemp,
      bearingWear: this.mechBearingWear,
      shaftWobble: this.mechShaftWobble,
      motorCurrent: Math.max(0, current),
      motorTorque: torque,
      isRunning: running,
      frictionPower: this.mechFrictionPower,     // mW
      dissipationPower: dissipation * 1000,       // mW
      ambientTemp: ambient,
      supplyVoltage: mp2.supplyVoltage,
      bearingFriction: mp2.bearingFriction,
    };
  }

  private updateTemperature(currentTemp: number, powerInput: number, dt: number): number {
    const { C, h, A } = THERMAL_CONSTANTS;
    const dTdt = (powerInput - h * A * (currentTemp - this.params.ambientTemp)) / C;
    return currentTemp + dTdt * dt;
  }

  snapshot(timestamp: number): TelemetryFrame {
    return this.lastFrame ?? this.buildFrame(timestamp);
  }

  private processOneWire(pinLevel: 0 | 1): void {
    switch (this.oneWireBusState) {
      case 'idle':
        if (pinLevel === 0) this.oneWireBusState = 'reset';
        break;
      case 'reset':
        if (pinLevel === 1) {
          this.oneWireBusState = 'presence';
          setTimeout(() => {
            if (this.oneWireBusState === 'presence') this.oneWireBusState = 'command';
          }, 100);
        }
        break;
      case 'command':
        this.oneWireCmdByte = 0xBE;
        this.oneWireBusState = 'reading';
        break;
      case 'reading':
        this.oneWireBusState = 'idle';
        break;
    }
  }

  private buildFrame(timestamp: number): TelemetryFrame {
    return {
      timestamp,
      mcu: { ...this.mcuState },
      motor: {
        omega: this.omega, theta: this.theta, vEff: 0,
        direction: 0, dutyCycle: 0, backEmf: 0,
        current: 0, torque: 0,
        rpm: Math.abs((this.omega * 60) / (2 * Math.PI)),
      },
      hbridge: { in1: 0, in2: 0, ena: 0, direction: 0 },
      tachometer: {
        cumulativeAngle: this.theta % (2 * Math.PI * this.params.encoderSlots),
        slotCount: this.params.encoderSlots,
        slotAngle: (2 * Math.PI) / this.params.encoderSlots,
        interruptPulse: false, pulseCount: this.encoderPulses,
        lastInterruptTime: this.lastPulseTime,
      },
      tempSensor: {
        temperature: this.sensorTemp, busState: 'idle',
        commandByte: 0, scratchpad: updateScratchpad(this.sensorTemp),
        pullupDetected: true, pinLevel: 0,
      },
      thermal: {
        bearingTemp: this.bearingTemp, motorTemp: this.motorTemp,
        ambientTemp: this.params.ambientTemp,
        dissipationRate: 0, frictionLoss: 0,
      },
      serialOutput: this.serialBuffer,
    };
  }
}
