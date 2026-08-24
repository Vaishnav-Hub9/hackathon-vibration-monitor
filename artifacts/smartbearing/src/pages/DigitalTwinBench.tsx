/**
 * DigitalTwinBench — the full-page SmartBearing 3D Digital Twin.
 *
 * Two-view architecture:
 *   View 1: "Circuit Prototype & Diagnostic View"
 *     — Circuit schematic, 3D bench scene, thermal panel, serial monitor, wiring diagram
 *   View 2: "3D Mechanical Digital Twin View"
 *     — Cotton spindle, drive shaft, ball bearing block, mechanical controls
 *
 * Architecture:
 *   Layer 1: MCU Emulation (pin states) — via PhysicsEngine singleton
 *   Layer 2: Physics Engine (motor ODE, tach, thermal, mechanical) — engine.tick() at 60 Hz
 *   Layer 3: Zustand Store — UI state + user parameters only
 *   Layer 4: React Three Fiber + UI panels — 60 FPS via useFrame + useLiveTelemetry
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft, Layers, Terminal, Flame, Cable,
  Maximize2, Minimize2, Box, Cpu, Settings, Disc3, Gauge,
} from 'lucide-react';
import { engine } from '@/simulation/engineRef';
import { useDigitalTwinStore, type ActiveView, type CircuitTabId, type MechanicalTabId } from '@/simulation/store';
import { useLiveTelemetry } from '@/simulation/useLiveTelemetry';
import BenchScene from '@/components/digitaltwin-bench/BenchScene';
import MechanicalScene from '@/components/digitaltwin-bench/MechanicalScene';
import SimControls from '@/components/digitaltwin-bench/SimControls';
import MechanicalControls from '@/components/digitaltwin-bench/MechanicalControls';
import SerialMonitor from '@/components/digitaltwin-bench/SerialMonitor';
import ThermalPanel from '@/components/digitaltwin-bench/ThermalPanel';
import MechanicalTelemetry from '@/components/digitaltwin-bench/MechanicalTelemetry';
import MechBearingPanel from '@/components/digitaltwin-bench/MechBearingPanel';
import MechThermalPanel from '@/components/digitaltwin-bench/MechThermalPanel';
import WiringDiagram from '@/components/digitaltwin-bench/WiringDiagram';
import ComponentInspector from '@/components/digitaltwin-bench/ComponentInspector';

// ── Tab definitions ──

const CIRCUIT_TABS: { id: CircuitTabId; label: string; icon: typeof Layers }[] = [
  { id: 'thermal', label: 'Thermal', icon: Flame },
  { id: 'serial', label: 'Serial', icon: Terminal },
  { id: 'wiring', label: 'Wiring', icon: Cable },
];

const MECH_TABS: { id: MechanicalTabId; label: string; icon: typeof Layers }[] = [
  { id: 'telemetry', label: 'Telemetry', icon: Gauge },
  { id: 'bearing', label: 'Bearing', icon: Disc3 },
  { id: 'thermal', label: 'Thermal', icon: Flame },
];



// ── Circuit Prototype View ──

function CircuitPrototypeView({ expanded, setExpanded }: { expanded: boolean; setExpanded: (v: boolean) => void }) {
  const circuitTab = useDigitalTwinStore((s) => s.circuitTab);
  const setCircuitTab = useDigitalTwinStore((s) => s.setCircuitTab);
  const paused = useDigitalTwinStore((s) => s.params.paused);
  const { motor } = useLiveTelemetry();

  return (
    <>
      {/* Tab bar */}
      <div className="relative z-20 shrink-0 border-b border-navy bg-[#070B14]/80 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 flex items-center gap-1">
          {CIRCUIT_TABS.map((tab) => {
            const active = circuitTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCircuitTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition border-b-2 ${
                  active
                    ? 'text-amber border-amber'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}

          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition"
          >
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 grid lg:grid-cols-[1fr_400px] min-h-0">
        {/* 3D stage */}
        <div className={`relative ${expanded ? 'h-[80vh]' : 'h-[52vh] lg:h-[calc(100dvh-112px)]'}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.08),transparent_60%)]" />
          <div className="absolute inset-0 grid-bg opacity-20" />

          <BenchScene />
          <ComponentInspector />

          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 text-[10px] font-mono-data text-slate-400 bg-[#0F1629]/80 border border-navy rounded-md px-2.5 py-1.5">
            <Box className="w-3 h-3 text-amber" /> Drag to orbit · Scroll to zoom
          </div>

          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#0F1629]/85 backdrop-blur border border-navy rounded-md px-3 py-1.5">
            <span className="relative flex w-2 h-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${paused ? '' : 'animate-ping'}`}
                style={{ background: paused ? '#6B7280' : '#10B981' }}
              />
              <span
                className="relative inline-flex rounded-full w-2 h-2"
                style={{ background: paused ? '#6B7280' : '#10B981' }}
              />
            </span>
            <span className="text-[10px] font-mono-data uppercase tracking-widest text-slate-300">
              {paused ? 'PAUSED' : 'ACTIVE'}
            </span>
          </div>
        </div>

        {/* Side panel */}
        <aside className="border-t lg:border-t-0 lg:border-l border-navy bg-[#0A0E1A] overflow-y-auto">
          <div className="p-4 space-y-4">
            {circuitTab === 'thermal' && <ThermalPanel />}
            {circuitTab === 'serial' && <SerialMonitor />}
            {circuitTab === 'wiring' && <WiringDiagram />}
            <SimControls />
          </div>
        </aside>
      </div>
    </>
  );
}

// ── Mechanical Digital Twin View ──

function MechanicalTwinView({ expanded, setExpanded }: { expanded: boolean; setExpanded: (v: boolean) => void }) {
  const mechTab = useDigitalTwinStore((s) => s.mechTab);
  const setMechTab = useDigitalTwinStore((s) => s.setMechTab);
  const mechParams = useDigitalTwinStore((s) => s.mechParams);
  const { spindleRPM, bearingTemp, isRunning } = useMechanicalTelemetryLive();

  return (
    <>
      {/* Tab bar */}
      <div className="relative z-20 shrink-0 border-b border-navy bg-[#070B14]/80 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 flex items-center gap-1">
          {MECH_TABS.map((tab) => {
            const active = mechTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMechTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition border-b-2 ${
                  active
                    ? 'text-amber border-amber'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}

          <button
            onClick={() => setExpanded(!expanded)}
            className="ml-auto p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition"
          >
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 grid lg:grid-cols-[1fr_400px] min-h-0">
        {/* 3D stage */}
        <div className={`relative ${expanded ? 'h-[80vh]' : 'h-[52vh] lg:h-[calc(100dvh-112px)]'}`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.08),transparent_60%)]" />
          <div className="absolute inset-0 grid-bg opacity-20" />

          <MechanicalScene />

          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 text-[10px] font-mono-data text-slate-400 bg-[#0F1629]/80 border border-navy rounded-md px-2.5 py-1.5">
            <Box className="w-3 h-3 text-amber" /> Drag to orbit · Scroll to zoom
          </div>

          {/* Live status overlay */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#0F1629]/85 backdrop-blur border border-navy rounded-md px-3 py-1.5">
            <span className="relative flex w-2 h-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${isRunning ? 'animate-ping' : ''}`}
                style={{ background: isRunning ? '#10B981' : '#6B7280' }}
              />
              <span
                className="relative inline-flex rounded-full w-2 h-2"
                style={{ background: isRunning ? '#10B981' : '#6B7280' }}
              />
            </span>
            <span className="text-[10px] font-mono-data uppercase tracking-widest text-slate-300">
              {isRunning ? 'SPINDLE RUNNING' : 'SPINDLE STOPPED'}
            </span>
          </div>

          {/* RPM badge */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-[#0F1629]/85 backdrop-blur border border-navy rounded-md px-3 py-1.5">
            <span className="font-mono-data text-sm font-bold text-amber">
              {Math.round(spindleRPM)} RPM
            </span>
            <span className="text-[9px] text-slate-500">|</span>
            <span className="font-mono-data text-sm font-bold" style={{ color: bearingTemp > 60 ? '#EA580C' : '#3B82F6' }}>
              {bearingTemp.toFixed(1)}°C
            </span>
          </div>
        </div>

        {/* Side panel */}
        <aside className="border-t lg:border-t-0 lg:border-l border-navy bg-[#0A0E1A] overflow-y-auto">
          <div className="p-4 space-y-4">
            {mechTab === 'telemetry' && <MechanicalTelemetry />}
            {mechTab === 'bearing' && <MechBearingPanel />}
            {mechTab === 'thermal' && <MechThermalPanel />}
            <MechanicalControls />
          </div>
        </aside>
      </div>
    </>
  );
}

// ── Live telemetry for the header (mechanical view) ──

function useMechanicalTelemetryLive() {
  const [data, setData] = useState({ spindleRPM: 0, bearingTemp: 25, isRunning: false });

  useEffect(() => {
    let rafId: number;
    let lastUpdate = 0;
    const loop = (now: number) => {
      if (now - lastUpdate >= 50) {
        lastUpdate = now;
        setData(engine.getMechanicalSnapshot());
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    // Fallback: setInterval ensures updates even when RAF is throttled
    const intervalId = setInterval(() => {
      setData(engine.getMechanicalSnapshot());
    }, 50);
    return () => { cancelAnimationFrame(rafId); clearInterval(intervalId); };
  }, []);

  return data;
}

// ── Main Page ──

export default function DigitalTwinBench() {
  const rafRef = useRef<number>(0);
  const activeView = useDigitalTwinStore((s) => s.activeView);
  const setActiveView = useDigitalTwinStore((s) => s.setActiveView);
  const appendSerialRef = useRef(useDigitalTwinStore.getState().appendSerial);
  appendSerialRef.current = useDigitalTwinStore.getState().appendSerial;
  const [expanded, setExpanded] = useState(false);
  const { motor, thermal } = useLiveTelemetry();
  const [liveLatest, setLiveLatest] = useState<any>(null);
  const [isRigLive, setIsRigLive] = useState(false);
  const lastSerialRef = useRef('');

  // ── Live hardware stream ──
  useEffect(() => {
    import('@/lib/socket').then(({ getSocket }) => {
      const socket = getSocket();
      const onHardwareUpdate = (data: any) => {
        if (data?.source === 'arduino' && typeof data.rpm === 'number') {
          setLiveLatest(data);
          setIsRigLive(true);
          engine.applyLiveReading(data.rpm, data.temperature, data.motorSpeed);
        }
      };
      socket.on('hardware:update', onHardwareUpdate);
      return () => { socket.off('hardware:update', onHardwareUpdate); };
    });
  }, []);

  // ── Physics loop — RAF + setInterval fallback for reliability ──
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      const store = useDigitalTwinStore.getState();
      engine.setParams(store.params);
      engine.tick(performance.now());
      // Check for serial output
      const snap = engine.snapshot(performance.now());
      if (snap.serialOutput && snap.serialOutput !== lastSerialRef.current) {
        lastSerialRef.current = snap.serialOutput;
        const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
        appendSerialRef.current(`[${ts}] ${snap.serialOutput}`);
      }
    };
    // Primary: RAF at display refresh rate
    const rafLoop = () => {
      if (!running) return;
      tick();
      rafRef.current = requestAnimationFrame(rafLoop);
    };
    rafRef.current = requestAnimationFrame(rafLoop);
    // Fallback: setInterval at 60Hz in case RAF is throttled (headless, background tab)
    const intervalId = setInterval(tick, 16);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      clearInterval(intervalId);
    };
  }, []);

  // ── Header data ──
  const mechSnap = useMechanicalTelemetryLive();

  return (
    <div className="min-h-[100dvh] bg-navy text-slate-200 font-sans overflow-x-hidden flex flex-col">
      {/* ── Top bar ── */}
      <header className="relative z-30 shrink-0 border-b border-navy bg-[#070B14]/95 backdrop-blur-md">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-[11px] font-mono-data text-slate-400 hover:text-amber border border-navy bg-[#0F1629]/70 rounded-md px-2.5 py-1.5 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-white text-sm sm:text-base truncate">
                SmartBearing <span className="text-amber">3D Digital Twin</span>
              </h1>
              <p className="text-[10px] text-slate-500 truncate">
                {activeView === 'circuit'
                  ? 'Circuit prototype · AVR8js MCU emulation · Physics engine'
                  : 'Mechanical assembly · Spindle · Shaft · Ball bearing'
                }
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono-data">
            {activeView === 'circuit' ? (
              <>
                <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isRigLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber'}`} />
                  {isRigLive ? 'LIVE RIG' : 'SIM'}
                </span>
                <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1 text-amber">
                  {Math.round(motor.rpm)} RPM
                </span>
                <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1" style={{ color: thermal.bearingTemp > 60 ? '#EA580C' : '#3B82F6' }}>
                  {thermal.bearingTemp.toFixed(1)}°C
                </span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${mechSnap.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {mechSnap.isRunning ? 'RUNNING' : 'STOPPED'}
                </span>
                <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1 text-amber">
                  {Math.round(mechSnap.spindleRPM)} RPM
                </span>
                <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1" style={{ color: mechSnap.bearingTemp > 60 ? '#EA580C' : '#3B82F6' }}>
                  {mechSnap.bearingTemp.toFixed(1)}°C
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── View switcher ── */}
      <div className="relative z-20 shrink-0 border-b border-navy bg-[#0A0E1A]/80 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 flex items-center gap-1">
          <button
            onClick={() => setActiveView('circuit')}
            className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition border-b-2 ${
              activeView === 'circuit'
                ? 'text-amber border-amber'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Circuit Prototype & Diagnostic
          </button>
          <button
            onClick={() => setActiveView('mechanical')}
            className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition border-b-2 ${
              activeView === 'mechanical'
                ? 'text-amber border-amber'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            3D Mechanical Digital Twin
          </button>
        </div>
      </div>

      {/* ── Active view ── */}
      {activeView === 'circuit' ? (
        <CircuitPrototypeView expanded={expanded} setExpanded={setExpanded} />
      ) : (
        <MechanicalTwinView expanded={expanded} setExpanded={setExpanded} />
      )}
    </div>
  );
}
