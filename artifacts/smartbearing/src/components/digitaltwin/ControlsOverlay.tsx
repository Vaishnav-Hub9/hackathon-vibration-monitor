import { motion } from 'framer-motion';
import { Gauge, Waves, CircleDot, Circle, Disc3, Wind, MoveDiagonal, Activity, HeartPulse } from 'lucide-react';
import type { FaultType } from '@/components/digitaltwin/BearingVisualizer3D';
import { FAULT_LABELS, FAULT_COLORS, faultFrequencyHz } from '@/components/digitaltwin/BearingVisualizer3D';
import { computeDefectFrequencies, DEFAULT_BEARING } from '@/lib/defectFrequencies';

const FAULT_ICONS: Record<FaultType, typeof Waves> = {
  healthy: HeartPulse,
  outer: CircleDot,
  inner: Circle,
  ball: Disc3,
  imbalance: Wind,
  misalignment: MoveDiagonal,
};

interface ControlsOverlayProps {
  rpm: number;
  setRpm: (v: number) => void;
  fault: FaultType;
  setFault: (f: FaultType) => void;
  severity: number;
  setSeverity: (v: number) => void;
}

export default function ControlsOverlay({ rpm, setRpm, fault, setFault, severity, setSeverity }: ControlsOverlayProps) {
  const df = computeDefectFrequencies(rpm, DEFAULT_BEARING);
  const faultOptions = Object.keys(FAULT_LABELS) as FaultType[];

  return (
    <div className="glass rounded-xl p-4 space-y-5 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-amber" />
          <h3 className="font-display text-sm font-bold text-white">Digital Twin Controls</h3>
        </div>
        <span className="text-[9px] font-mono-data uppercase tracking-widest text-slate-500">Parametric 6205</span>
      </div>

      {/* RPM */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Spindle RPM</label>
          <span className="font-mono-data text-sm font-bold text-amber">{rpm.toLocaleString()}</span>
        </div>
        <input
          type="range"
          min={0}
          max={15000}
          step={250}
          value={rpm}
          onChange={(e) => setRpm(Number(e.target.value))}
          className="w-full accent-amber"
        />
        <div className="flex justify-between text-[9px] font-mono-data text-slate-500 mt-0.5">
          <span>0</span>
          <span>7.5k</span>
          <span>15k</span>
        </div>
      </div>

      {/* Fault selector */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">Fault Mode</label>
        <div className="grid grid-cols-2 gap-1.5">
          {faultOptions.map((f) => {
            const Icon = FAULT_ICONS[f];
            const selected = fault === f;
            return (
              <motion.button
                key={f}
                whileTap={{ scale: 0.95 }}
                onClick={() => setFault(f)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all ${
                  selected
                    ? 'bg-amber/15 border-amber/50 shadow-[0_0_16px_rgba(245,158,11,0.18)]'
                    : 'bg-[#0A0E1A]/70 border-navy hover:border-amber/30 hover:bg-[#0F1629]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${selected ? '' : 'text-slate-500'}`} style={{ color: FAULT_COLORS[f] }} />
                <span className={`text-[11px] font-semibold truncate ${selected ? 'text-white' : 'text-slate-400'}`}>
                  {FAULT_LABELS[f]}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Severity */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Fault Severity</label>
          <span className="font-mono-data text-sm font-bold" style={{ color: severity > 66 ? '#EA580C' : severity > 33 ? '#F59E0B' : '#10B981' }}>
            {severity}%
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={severity}
          disabled={fault === 'healthy'}
          onChange={(e) => setSeverity(Number(e.target.value))}
          className={`w-full accent-amber ${fault === 'healthy' ? 'opacity-40 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Active signature */}
      <div className="bg-[#0A0E1A]/70 border border-navy rounded-lg px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`w-3.5 h-3.5 ${fault === 'healthy' ? 'text-[#10B981]' : 'text-[#EA580C]'}`} />
          <span className="text-[10px] font-mono-data uppercase tracking-widest text-slate-400">
            {fault === 'healthy' ? 'No signature' : `${FAULT_LABELS[fault]} signature`}
          </span>
        </div>
        <span className="font-mono-data text-xs font-bold" style={{ color: fault === 'healthy' ? '#10B981' : '#EA580C' }}>
          {fault === 'healthy' ? '—' : `${faultFrequencyHz(rpm, fault).toFixed(0)} Hz`}
        </span>
      </div>

      {/* Formula strip */}
      <div className="text-[9px] font-mono-data leading-relaxed text-slate-500 border-t border-navy/60 pt-3">
        <div>BPFO = (N/2)·fᵣ·(1−d/D) = <span className="text-[#EA580C]">{df.bpfo.toFixed(1)} Hz</span></div>
        <div>BPFI = (N/2)·fᵣ·(1+d/D) = <span className="text-[#F59E0B]">{df.bpfi.toFixed(1)} Hz</span></div>
        <div>BSF = (D/2d)·fᵣ·(1−(d/D)²) = <span className="text-[#A855F7]">{df.bsf.toFixed(1)} Hz</span></div>
        <div>FTF = (fᵣ/2)·(1−d/D) = <span className="text-[#3B82F6]">{df.ftf.toFixed(1)} Hz</span></div>
      </div>
    </div>
  );
}
