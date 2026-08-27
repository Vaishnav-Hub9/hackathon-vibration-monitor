/**
 * Simulation types — shared between the Web Worker physics engine and
 * the main-thread React Three Fiber scene.
 */

/** Pin state for one digital or analog pin */
export interface PinState {
  /** Digital level (0 = LOW, 1 = HIGH) */
  digital: 0 | 1;
  /** Analog value 0–1023 (ADC) */
  analog: number;
  /** Whether this pin is configured as output */
  output: boolean;
}

/** Complete snapshot of the virtual MCU I/O register state */
export interface MCUState {
  /** Port D pins: D0–D7 (bits 0–7) */
  portD: number;
  /** Port B pins: D8–D13 (bits 0–5 mapped to physical D pins) */
  portB: number;
  /** Individual pin states for high-resolution access */
  pins: Record<number, PinState>;
  /** Timer1 OCR1A value (PWM duty on D9) */
  timer1OCR1A: number;
  /** Program counter (for debug) */
  pc: number;
  /** CPU cycle count */
  cycleCount: number;
  /** Serial output buffer (TX line) */
  serialBuffer: string;
  /** Global interrupt flag */
  interruptsEnabled: boolean;
}

/** Physics state for the DC motor + L298N driver */
export interface MotorState {
  /** Current angular velocity (rad/s) */
  omega: number;
  /** Current angular position (rad, wraps) */
  theta: number;
  /** Effective voltage applied to motor terminals */
  vEff: number;
  /** Motor direction: +1 forward, -1 reverse, 0 brake */
  direction: 1 | -1 | 0;
  /** PWM duty cycle 0–1 */
  dutyCycle: number;
  /** Back-EMF voltage */
  backEmf: number;
  /** Armature current (A) */
  current: number;
  /** Motor torque (N·m) */
  torque: number;
  /** Calculated RPM (derived from omega) */
  rpm: number;
}

/** L298N H-bridge state */
export interface HBridgeState {
  /** IN1 pin state */
  in1: 0 | 1;
  /** IN2 pin state */
  in2: 0 | 1;
  /** ENA (enable A) from PWM */
  ena: number;
  /** Motor direction derived from IN1/IN2 */
  direction: 1 | -1 | 0;
}

/** IR tachometer state */
export interface TachometerState {
  /** Current cumulative rotation angle (rad) */
  cumulativeAngle: number;
  /** Number of slot divisions on the encoder disk */
  slotCount: number;
  /** Angular distance per slot (rad) */
  slotAngle: number;
  /** Whether the interrupt was triggered this tick */
  interruptPulse: boolean;
  /** Number of pulses since last reset */
  pulseCount: number;
  /** Timestamp of last interrupt (ms) */
  lastInterruptTime: number;
}

/** DS18B20 OneWire temperature sensor state */
export interface TemperatureSensorState {
  /** Current simulated temperature (°C) */
  temperature: number;
  /** OneWire bus state machine state */
  busState: 'idle' | 'reset' | 'presence' | 'command' | 'reading' | 'writing';
  /** Current command byte */
  commandByte: number;
  /** Scratchpad data (9 bytes) */
  scratchpad: Uint8Array;
  /** Whether the pull-up resistor is detected */
  pullupDetected: boolean;
  /** Pin D5 logic level for OneWire communication */
  pinLevel: 0 | 1;
}

/** Thermal model state for the bearing assembly */
export interface ThermalState {
  /** Current bearing housing temperature (°C) */
  bearingTemp: number;
  /** Motor winding temperature (°C) */
  motorTemp: number;
  /** Ambient room temperature (°C) */
  ambientTemp: number;
  /** Heat dissipation rate (W) */
  dissipationRate: number;
  /** Friction power loss (W) */
  frictionLoss: number;
}

/** Complete telemetry frame sent from the simulation engine to the renderer */
export interface TelemetryFrame {
  timestamp: number;
  mcu: MCUState;
  motor: MotorState;
  hbridge: HBridgeState;
  tachometer: TachometerState;
  tempSensor: TemperatureSensorState;
  thermal: ThermalState;
  /** Virtual serial output (9600 baud JSON frames) */
  serialOutput: string;
}

/** User-adjustable simulation parameters */
export interface SimParams {
  /** Motor supply voltage (V) */
  supplyVoltage: number;
  /** Motor load torque (N·m) */
  loadTorque: number;
  /** Ambient temperature (°C) */
  ambientTemp: number;
  /** Whether the simulation is paused */
  paused: boolean;
  /** Simulation time step (s) — default 1/60 */
  timeStep: number;
  /** Encoder slot count */
  encoderSlots: number;
  /** Manual motor speed override (0 = automatic from PWM) */
  manualRPM: number;
}

export const DEFAULT_SIM_PARAMS: SimParams = {
  supplyVoltage: 12,
  loadTorque: 0.02,
  ambientTemp: 25,
  paused: false,
  timeStep: 1 / 60,
  encoderSlots: 20,
  manualRPM: 0,
};

/** Mechanical twin simulation parameters */
export interface MechanicalParams {
  spindleRunning: boolean;
  spindleRPM: number;
  spindleLoad: number;
  bearingFriction: number;
  supplyVoltage: number;
  ambientTemp: number;
}

export const DEFAULT_MECHANICAL_PARAMS: MechanicalParams = {
  spindleRunning: true,
  spindleRPM: 3000,
  spindleLoad: 0.01,
  bearingFriction: 0.002,
  supplyVoltage: 12,
  ambientTemp: 25,
};

/** DC motor physical constants (6205-class small DC motor) */
export const MOTOR_CONSTANTS = {
  /** Rotor + shaft moment of inertia (kg·m²) */
  J: 1.2e-5,
  /** Viscous damping coefficient (N·m·s/rad) */
  b: 3.0e-6,
  /** Motor torque constant (N·m/A) */
  Kt: 0.042,
  /** Back-EMF constant (V·s/rad) */
  Ke: 0.042,
  /** Armature winding resistance (Ω) */
  Ra: 2.5,
  /** No-load speed at 12V (RPM) — for reference only */
  noLoadRPM: 15000,
  /** Maximum stalling torque (N·m) */
  maxTorque: 0.12,
};

/** Bearing thermal constants */
export const THERMAL_CONSTANTS = {
  /** Heat capacity of bearing assembly (J/°C) */
  C: 45.0,
  /** Mechanical friction loss factor */
  frictionFactor: 0.15,
  /** Convective heat transfer coefficient (W/m²·°C) */
  h: 12.0,
  /** Exposed surface area (m²) */
  A: 0.0032,
};
