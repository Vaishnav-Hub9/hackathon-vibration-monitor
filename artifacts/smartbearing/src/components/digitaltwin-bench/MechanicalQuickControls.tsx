import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Gauge, RotateCcw, SlidersHorizontal, Thermometer, X, Zap } from 'lucide-react';
import { useDigitalTwinStore } from '@/simulation/store';
import { useMechanicalTelemetry } from '@/simulation/useLiveTelemetry';

interface MechanicalQuickControlsProps {
  onClose: () => void;
}

const DEMO_PRESETS = [
  { label: 'Nominal', rpm: 3000, load: 0.01, friction: 0.002, ambient: 25 },
  { label: 'Production', rpm: 9000, load: 0.03, friction: 0.003, ambient: 28 },
  { label: 'Stress test', rpm: 14000, load: 0.08, friction: 0.008, ambient: 32 },
];

function QuickSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
  icon: typeof Gauge;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-bold">
          <Icon className="w-3 h-3 text-amber" />
          {label}
        </label>
        <span className="font-mono-data text-[11px] font-bold text-amber">{display}</span>
      </div>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-amber"
      />
    </div>
  );
}

export default function MechanicalQuickControls({ onClose }: MechanicalQuickControlsProps) {
  const mechParams = useDigitalTwinStore((state) => state.mechParams);
  const setMechParams = useDigitalTwinStore((state) => state.setMechParams);
  const reset = useDigitalTwinStore((state) => state.reset);
  const snap = useMechanicalTelemetry();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const applyPreset = (preset: (typeof DEMO_PRESETS)[number]) => {
    setMechParams({
      spindleRunning: true,
      spindleRPM: preset.rpm,
      spindleLoad: preset.load,
      bearingFriction: preset.friction,
      ambientTemp: preset.ambient,
    });
  };

  return (
    <motion.div
      role="dialog"
      aria-label="Live spindle controls"
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      className="absolute top-14 left-3 z-40 w-[min(342px,calc(100%-1.5rem))] max-h-[calc(100%-5rem)] overflow-y-auto rounded-2xl border border-amber/25 bg-[#0A0E1A]/95 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 rounded-lg border border-amber/25 bg-amber/10 p-2 text-amber">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Live twin controls</h3>
            <p className="text-[10px] leading-relaxed text-slate-500">Tune the spindle while the model is running.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close live twin controls"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-navy bg-[#0F1629]/80 p-2">
          <div className="text-[8px] uppercase tracking-widest text-slate-500">Live RPM</div>
          <div className="mt-1 font-mono-data text-xs font-bold text-amber">{Math.round(snap.spindleRPM).toLocaleString()}</div>
        </div>
        <div className="rounded-lg border border-navy bg-[#0F1629]/80 p-2">
          <div className="text-[8px] uppercase tracking-widest text-slate-500">Bearing</div>
          <div className="mt-1 font-mono-data text-xs font-bold text-sky-400">{snap.bearingTemp.toFixed(1)} C</div>
        </div>
        <div className="rounded-lg border border-navy bg-[#0F1629]/80 p-2">
          <div className="text-[8px] uppercase tracking-widest text-slate-500">Wear</div>
          <div className="mt-1 font-mono-data text-xs font-bold text-emerald-400">{(snap.bearingWear * 100).toFixed(1)}%</div>
        </div>
      </div>

      <button
        onClick={() => setMechParams({ spindleRunning: !mechParams.spindleRunning })}
        className={`mb-4 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest transition ${
          mechParams.spindleRunning
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
            : 'border-amber/30 bg-amber/10 text-amber hover:bg-amber/15'
        }`}
      >
        <Activity className="w-3.5 h-3.5" />
        {mechParams.spindleRunning ? 'Stop spindle' : 'Start spindle'}
      </button>

      <div className="mb-4 space-y-4">
        <QuickSlider
          label="Spindle speed"
          value={mechParams.spindleRPM}
          min={0}
          max={15000}
          step={100}
          display={`${mechParams.spindleRPM.toLocaleString()} RPM`}
          onChange={(value) => setMechParams({ spindleRPM: value })}
          icon={Gauge}
        />
        <QuickSlider
          label="Spindle load"
          value={mechParams.spindleLoad}
          min={0}
          max={0.1}
          step={0.001}
          display={`${(mechParams.spindleLoad * 1000).toFixed(1)} mN-m`}
          onChange={(value) => setMechParams({ spindleLoad: value })}
          icon={Activity}
        />
        <QuickSlider
          label="Bearing friction"
          value={mechParams.bearingFriction}
          min={0}
          max={0.01}
          step={0.0001}
          display={mechParams.bearingFriction.toFixed(4)}
          onChange={(value) => setMechParams({ bearingFriction: value })}
          icon={RotateCcw}
        />
        <QuickSlider
          label="Ambient temperature"
          value={mechParams.ambientTemp}
          min={10}
          max={45}
          step={1}
          display={`${mechParams.ambientTemp} C`}
          onChange={(value) => setMechParams({ ambientTemp: value })}
          icon={Thermometer}
        />
      </div>

      <div className="border-t border-navy pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
          <Zap className="w-3 h-3 text-amber" /> Demo presets
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {DEMO_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className="rounded-lg border border-navy bg-[#0F1629]/70 px-2 py-2 text-[9px] font-bold text-slate-400 transition hover:border-amber/40 hover:bg-amber/10 hover:text-amber"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => reset()}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-navy px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 transition hover:border-slate-500 hover:text-white"
        >
          <RotateCcw className="w-3 h-3" /> Reset model
        </button>
      </div>
    </motion.div>
  );
}
