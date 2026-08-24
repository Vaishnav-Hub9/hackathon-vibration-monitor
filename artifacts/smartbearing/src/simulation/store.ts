/**
 * Zustand store — UI state and user-controlled parameters only.
 *
 * High-frequency telemetry (motor RPM, temperature, tachometer) is NOT
 * stored here — 3D components read it directly from the PhysicsEngine
 * singleton via useFrame hooks to avoid infinite re-render loops.
 */
import { create } from 'zustand';
import type { SimParams, MechanicalParams } from './types';
import { DEFAULT_SIM_PARAMS, DEFAULT_MECHANICAL_PARAMS } from './types';

export interface PinDef {
  id: string;
  label: string;
  pin: number;
  component: string;
  color: string;
}

export const WIRING_PINS: PinDef[] = [
  { id: 'd9-pwm', label: 'D9 (PWM/ENA)', pin: 9, component: 'Arduino → L298N', color: '#F59E0B' },
  { id: 'd10-in1', label: 'D10 (IN1)', pin: 10, component: 'Arduino → L298N', color: '#10B981' },
  { id: 'd11-in2', label: 'D11 (IN2)', pin: 11, component: 'Arduino → L298N', color: '#3B82F6' },
  { id: 'd2-int0', label: 'D2 (INT0)', pin: 2, component: 'Arduino ← Tachometer', color: '#A855F7' },
  { id: 'd5-1wire', label: 'D5 (OneWire)', pin: 5, component: 'Arduino ↔ DS18B20', color: '#EF4444' },
  { id: '12v-pos', label: '12V+', pin: -1, component: 'Supply → L298N', color: '#F97316' },
  { id: 'gnd', label: 'GND', pin: 0, component: 'Common Ground', color: '#6B7280' },
  { id: '5v', label: '5V', pin: -2, component: 'Arduino → DS18B20', color: '#EC4899' },
];

/** Top-level view selector */
export type ActiveView = 'circuit' | 'mechanical';

/** Tab IDs for the circuit prototype diagnostic view */
export type CircuitTabId = 'thermal' | 'serial' | 'wiring';

/** Tab IDs for the mechanical digital twin view */
export type MechanicalTabId = 'telemetry' | 'bearing' | 'thermal';



export interface DigitalTwinState {
  // ── View management ──
  activeView: ActiveView;

  // ── Circuit view params (original) ──
  params: SimParams;

  // ── Mechanical view params ──
  mechParams: MechanicalParams;

  // ── Serial log (append-only, infrequent) ──
  serialLog: string[];

  // ── UI state ──
  circuitTab: CircuitTabId;
  mechTab: MechanicalTabId;
  selectedComponent: string | null;
  showHeatmap: boolean;
  showWireLabels: boolean;
  showPinAnnotations: boolean;
  showMechLabels: boolean;
  simulationSpeed: number;

  // ── Actions ──
  setActiveView: (view: ActiveView) => void;
  setParams: (params: Partial<SimParams>) => void;
  setMechParams: (params: Partial<MechanicalParams>) => void;
  setCircuitTab: (tab: CircuitTabId) => void;
  setMechTab: (tab: MechanicalTabId) => void;
  setSelectedComponent: (id: string | null) => void;
  toggleHeatmap: () => void;
  toggleWireLabels: () => void;
  togglePinAnnotations: () => void;
  toggleMechLabels: () => void;
  setSimulationSpeed: (speed: number) => void;
  appendSerial: (line: string) => void;
  clearSerialLog: () => void;
  reset: () => void;
}

const MAX_SERIAL_LOG = 200;

export const useDigitalTwinStore = create<DigitalTwinState>((set) => ({
  activeView: 'circuit',
  params: { ...DEFAULT_SIM_PARAMS },
  mechParams: { ...DEFAULT_MECHANICAL_PARAMS },
  serialLog: [],
  circuitTab: 'thermal',
  mechTab: 'telemetry',
  selectedComponent: null,
  showHeatmap: true,
  showWireLabels: true,
  showPinAnnotations: false,
  showMechLabels: true,
  simulationSpeed: 1,

  setActiveView: (view) => set({ activeView: view }),
  setParams: (params) => set((s) => ({ params: { ...s.params, ...params } })),
  setMechParams: (params) => set((s) => ({ mechParams: { ...s.mechParams, ...params } })),
  setCircuitTab: (tab) => set({ circuitTab: tab }),
  setMechTab: (tab) => set({ mechTab: tab }),
  setSelectedComponent: (id) => set({ selectedComponent: id }),
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  toggleWireLabels: () => set((s) => ({ showWireLabels: !s.showWireLabels })),
  togglePinAnnotations: () => set((s) => ({ showPinAnnotations: !s.showPinAnnotations })),
  toggleMechLabels: () => set((s) => ({ showMechLabels: !s.showMechLabels })),
  setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),

  appendSerial: (line) => set((s) => {
    const log = [...s.serialLog, line];
    return { serialLog: log.length > MAX_SERIAL_LOG ? log.slice(-MAX_SERIAL_LOG) : log };
  }),

  clearSerialLog: () => set({ serialLog: [] }),

  reset: () => set({
    params: { ...DEFAULT_SIM_PARAMS },
    mechParams: { ...DEFAULT_MECHANICAL_PARAMS },
    serialLog: [],
  }),
}));
