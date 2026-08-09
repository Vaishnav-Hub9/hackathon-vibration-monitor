import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Rotate3d, Boxes, Activity } from 'lucide-react';
import BearingVisualizer3D, { type FaultType, FAULT_LABELS, FAULT_COLORS } from '@/components/digitaltwin/BearingVisualizer3D';
import FFTPlot from '@/components/digitaltwin/FFTPlot';
import ControlsOverlay from '@/components/digitaltwin/ControlsOverlay';

export default function DigitalTwin() {
  const [rpm, setRpm] = useState(12000);
  const [fault, setFault] = useState<FaultType>('outer');
  const [severity, setSeverity] = useState(55);

  return (
    <div className="min-h-[100dvh] bg-navy text-slate-200 font-sans overflow-x-hidden flex flex-col">
      {/* Top bar */}
      <header className="relative z-30 shrink-0 border-b border-navy bg-[#070B14]/95 backdrop-blur-md">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-[11px] font-mono-data text-slate-400 hover:text-amber border border-navy bg-[#0F1629]/70 rounded-md px-2.5 py-1.5 transition-colors shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </Link>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-white text-sm sm:text-base truncate">
                Digital Twin <span className="text-amber">Laboratory</span>
              </h1>
              <p className="text-[10px] text-slate-500 truncate">Physics-driven fault simulator · validated against real ML training geometry</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono-data">
            <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1">
              <Boxes className="w-3 h-3 text-amber" /> {9} rolling elements
            </span>
            <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1">
              <Activity className="w-3 h-3" style={{ color: FAULT_COLORS[fault] }} /> {FAULT_LABELS[fault]}
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 grid lg:grid-cols-[1fr_390px] min-h-0">
        {/* 3D stage */}
        <div className="relative h-[52vh] lg:h-[calc(100dvh-56px)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.10),transparent_60%)]" />
          <div className="absolute inset-0 grid-bg opacity-25" />
          <BearingVisualizer3D rpm={rpm} fault={fault} severity={severity} />

          {/* Stage hint */}
          <div className="absolute bottom-3 left-3 z-20 hidden md:flex items-center gap-2 text-[10px] font-mono-data text-slate-400 bg-[#0F1629]/80 border border-navy rounded-md px-2.5 py-1.5">
            <Rotate3d className="w-3 h-3 text-amber" /> Drag to orbit · scroll to zoom
          </div>

          {/* Live verdict chip */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#0F1629]/85 backdrop-blur border border-navy rounded-md px-3 py-1.5">
            <span className="relative flex w-2 h-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                style={{ background: FAULT_COLORS[fault] }}
              />
              <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: FAULT_COLORS[fault] }} />
            </span>
            <span className="text-[10px] font-mono-data uppercase tracking-widest text-slate-300">
              {fault === 'healthy' ? 'RUNNING NOMINAL' : `${FAULT_LABELS[fault].toUpperCase()} · ${severity}% SEVERITY`}
            </span>
          </div>
        </div>

        {/* Side panel */}
        <aside className="border-t lg:border-t-0 lg:border-l border-navy bg-[#0A0E1A] overflow-y-auto">
          <div className="p-4 space-y-4">
            <ControlsOverlay rpm={rpm} setRpm={setRpm} fault={fault} setFault={setFault} severity={severity} setSeverity={setSeverity} />

            {/* FFT panel */}
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#00F0FF]" />
                  <h3 className="font-display text-sm font-bold text-white">Live FFT Spectrum</h3>
                </div>
                <span className="text-[9px] font-mono-data uppercase tracking-widest text-slate-500">Real-time</span>
              </div>
              <FFTPlot rpm={rpm} fault={fault} severity={severity} />
            </div>

            <div className="text-[10px] font-mono-data leading-relaxed text-slate-500 bg-[#0A0E1A]/70 border border-navy rounded-lg px-3 py-2.5">
              <span className="text-amber">▸</span> Flash rate & impact pulses are synced to the exact BPFO/BPFI/BSF/FTF
              frequencies computed from bearing geometry × live RPM — the same math the ML model was trained on.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
