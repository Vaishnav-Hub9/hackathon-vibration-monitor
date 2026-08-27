import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
  ArrowLeft, Rotate3d, Tag, Crosshair, Activity, Gauge, Thermometer, Waves, Cpu, ShieldAlert,
} from 'lucide-react';
import BearingScene from '@/components/landing/BearingScene';
import { PART_DETAILS } from '@/components/landing/BearingModel';
import { useLandingSensors, type LiveSensor } from '@/hooks/useLandingSensors';

const PART_ORDER = ['Outer Race', 'Inner Race', 'Cage', 'Shaft', 'Ball Element'] as const;

const STATUS_COLOR: Record<string, string> = {
  healthy: '#10B981',
  warning: '#F59E0B',
  critical: '#EA580C',
};

const PART_CHIP: Record<string, { icon: typeof Waves; label: string }> = {
  'Outer Race': { icon: Waves, label: 'BPFO · 157 Hz' },
  'Inner Race': { icon: Waves, label: 'BPFI · 290 Hz' },
  Cage: { icon: Cpu, label: 'Acoustic wear' },
  Shaft: { icon: Gauge, label: '1× / 2× RPM' },
  'Ball Element': { icon: Thermometer, label: 'Per-element node' },
};

function worstSensor(sensors: LiveSensor[]): LiveSensor | undefined {
  return sensors.reduce<LiveSensor | undefined>((w, s) => (!w || s.healthScore < w.healthScore ? s : w), undefined);
}

function StatTile({ label, value, color = '#ffffff' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#0F1629]/80 border border-navy rounded-lg px-3 py-2">
      <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">{label}</div>
      <div className="font-mono-data text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLOR[status] || STATUS_COLOR.healthy;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
      style={{ color, borderColor: `${color}55`, background: `${color}1A` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {status}
    </span>
  );
}

function SpecSheet({ part, sensor, sensors }: { part: string; sensor?: LiveSensor; sensors: LiveSensor[] }) {
  const detail = PART_DETAILS[part];
  const worst = worstSensor(sensors);
  const maxTemp = Math.max(...sensors.map((s) => s.temperature));
  const maxAnom = Math.max(...sensors.map((s) => s.anomalyScore));
  const chip = PART_CHIP[part];

  return (
    <motion.div
      key={part + (sensor?.id ?? '')}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {chip && <chip.icon className="w-4 h-4 text-amber" />}
            <h2 className="font-display text-xl font-bold text-white leading-none">{detail.title}</h2>
          </div>
          <p className="text-[11px] text-amber/80 mt-1">{detail.tagline}</p>
        </div>
        {sensor ? <StatusPill status={sensor.status} /> : part !== 'Ball Element' ? <span className="text-[9px] uppercase tracking-widest text-slate-500 border border-navy px-2 py-1 rounded-full">{chip?.label}</span> : null}
      </div>

      {/* Live telemetry */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-500 mb-2">
          <Activity className="w-3 h-3 text-amber" /> Live telemetry
        </div>
        {sensor ? (
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Health" value={`${sensor.healthScore.toFixed(0)}%`} color={STATUS_COLOR[sensor.status]} />
            <StatTile label="Vib (Z)" value={`${sensor.accel_z.toFixed(2)} g`} color={sensor.accel_z > 3 ? STATUS_COLOR.critical : sensor.accel_z > 1.5 ? STATUS_COLOR.warning : STATUS_COLOR.healthy} />
            <StatTile label="Temp" value={`${sensor.temperature.toFixed(0)} °C`} />
            <StatTile label="Anomaly" value={sensor.anomalyScore.toFixed(2)} color={sensor.anomalyScore > 0.6 ? STATUS_COLOR.critical : STATUS_COLOR.warning} />
            <StatTile label="Acoustic" value={sensor.acousticLevel.toFixed(2)} />
            <StatTile label="RPM" value={sensor.rpm.toLocaleString()} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Fleet health" value={worst ? `${worst.healthScore.toFixed(0)}%` : '—'} color={worst ? STATUS_COLOR[worst.status] : '#fff'} />
            <StatTile label="Max vib" value={worst ? `${worst.accel_z.toFixed(2)} g` : '—'} color={worst && worst.accel_z > 3 ? STATUS_COLOR.critical : worst && worst.accel_z > 1.5 ? STATUS_COLOR.warning : STATUS_COLOR.healthy} />
            <StatTile label="Max temp" value={`${maxTemp.toFixed(0)} °C`} />
            <StatTile label="Max anomaly" value={maxAnom.toFixed(2)} color={maxAnom > 0.6 ? STATUS_COLOR.critical : STATUS_COLOR.warning} />
          </div>
        )}
      </div>

      {/* What it does */}
      <div className="bg-[#0F1629]/60 border border-navy rounded-lg p-3">
        <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">What it does</div>
        <p className="text-xs text-slate-300 leading-relaxed">{detail.what}</p>
      </div>

      {/* Why it matters */}
      <div className="bg-[#0F1629]/60 border border-navy rounded-lg p-3">
        <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"><ShieldAlert className="w-3 h-3 text-amber" /> Why it matters</div>
        <p className="text-xs text-slate-300 leading-relaxed">{detail.why}</p>
      </div>

      {/* Fault signature */}
      <div className="bg-amber/5 border border-amber/25 rounded-lg p-3">
        <div className="text-[9px] uppercase tracking-widest text-amber mb-1">Fault signature</div>
        <p className="text-xs text-amber/90 leading-relaxed">{detail.fault}</p>
      </div>
    </motion.div>
  );
}

export default function BearingExploded() {
  const sensors = useLandingSensors(8);
  // Spin is OFF by default — with the camera dollied in close to a focused
  // part, auto-rotation swings the large rings through the frame and reads as
  // glitchy zooming in/out. Spin only the whole-assembly view.
  const [autoRotate, setAutoRotate] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [rpm, setRpm] = useState(12000);
  const [selected, setSelected] = useState<{ name: string; sensor?: LiveSensor } | null>({ name: 'Outer Race' });

  // A ball is "picked" when the user clicks a ball in the 3D scene.
  const isBall = selected?.sensor != null;
  const focusKey = isBall ? 'Ball Element' : selected?.name ?? null;
  const activeSensor = selected?.sensor;

  const worst = useMemo(() => worstSensor(sensors), [sensors]);
  const fleetStatus = worst ? worst.status : 'healthy';

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
                Bearing <span className="text-amber">Disassembly</span>
              </h1>
              <p className="text-[10px] text-slate-500 truncate">Iron Man mode — click a component to inspect it</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono-data">
            <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> Fleet {fleetStatus.toUpperCase()}</span>
            <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1"><span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" /> {sensors.length} nodes live</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 grid lg:grid-cols-[1fr_360px] min-h-0">
        {/* 3D stage */}
        <div className="relative h-[52vh] lg:h-[calc(100dvh-56px)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.10),transparent_60%)]" />
          <div className="absolute inset-0 grid-bg opacity-25" />

          <BearingScene
            sensors={sensors}
            // Never auto-rotate while a part is focused — the tight camera
            // makes rotation look like the model is glitching/zooming.
            autoRotate={autoRotate && !focusKey}
            exploded
            rpm={rpm}
            showLabels={showLabels}
            selected={selected}
            onSelect={setSelected}
            focusKey={focusKey}
          />

          {/* Controls */}
          <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-2 justify-end max-w-[80%]">
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setAutoRotate((v) => !v)}
              disabled={!!focusKey}
              title={focusKey ? 'Spin pauses while a part is focused' : 'Toggle auto-rotate'}
              className={`flex items-center gap-1.5 text-[11px] font-mono-data px-2.5 py-1.5 rounded-md border backdrop-blur transition-colors ${
                focusKey
                  ? 'bg-[#0F1629]/60 border-navy text-slate-600 cursor-not-allowed'
                  : autoRotate
                    ? 'bg-amber/15 border-amber/40 text-amber'
                    : 'bg-[#0F1629]/85 border-navy text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rotate3d className="w-3.5 h-3.5" /> {focusKey ? 'Spin Paused' : autoRotate ? 'Spin On' : 'Spin Off'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => setShowLabels((v) => !v)}
              title="Toggle part labels"
              className={`flex items-center gap-1.5 text-[11px] font-mono-data px-2.5 py-1.5 rounded-md border backdrop-blur transition-colors ${showLabels ? 'bg-amber/15 border-amber/40 text-amber' : 'bg-[#0F1629]/85 border-navy text-slate-400 hover:text-slate-200'}`}
            >
              <Tag className="w-3.5 h-3.5" /> Labels
            </motion.button>
          </div>

          {/* RPM slider */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-[#0F1629]/90 backdrop-blur border border-navy rounded-lg px-4 py-2 flex items-center gap-3 max-w-[90%]">
            <Gauge className="w-3.5 h-3.5 text-amber shrink-0" />
            <input
              type="range"
              min={2000}
              max={15000}
              step={500}
              value={rpm}
              onChange={(e) => setRpm(Number(e.target.value))}
              className="w-28 sm:w-40 accent-amber"
            />
            <span className="font-mono-data text-[11px] text-amber w-16 text-right">{(rpm / 1000).toFixed(1)}k RPM</span>
          </div>

          {/* Focus hint */}
          <div className="absolute bottom-3 left-3 z-20 hidden md:flex items-center gap-2 text-[10px] font-mono-data text-slate-400 bg-[#0F1629]/80 border border-navy rounded-md px-2.5 py-1.5">
            <Crosshair className="w-3 h-3 text-amber" />
            {selected ? `Focusing: ${selected.sensor ? 'Ball Element · ' + selected.sensor.id : selected.name}` : 'Click any part to focus'}
          </div>
        </div>

        {/* Part rail + spec sheet */}
        <aside className="border-t lg:border-t-0 lg:border-l border-navy bg-[#0A0E1A] overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Part rail */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">Components</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
                {PART_ORDER.map((name) => {
                  const isSel = selected?.name === name;
                  const d = PART_DETAILS[name];
                  const chip = PART_CHIP[name];
                  const Icon = chip?.icon ?? Waves;
                  return (
                    <motion.button
                      key={name}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSelected(name === 'Ball Element' ? { name, sensor: worst } : { name })}
                      className={`text-left px-3 py-2.5 rounded-lg border backdrop-blur transition-all ${
                        isSel
                          ? 'bg-amber/15 border-amber/50 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                          : 'bg-[#0F1629]/70 border-navy hover:border-amber/30 hover:bg-[#0F1629]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[12px] font-bold text-white">
                          <Icon className={`w-3.5 h-3.5 ${isSel ? 'text-amber' : 'text-slate-500'}`} />
                          {d.title}
                        </span>
                        {name === 'Ball Element' && worst ? (
                          <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[worst.status] }} />
                        ) : (
                          <span className={`w-2 h-2 rounded-full ${isSel ? 'bg-amber' : 'bg-slate-700'}`} />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{d.tagline}</div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Spec sheet */}
            <div className="border-t border-navy pt-4">
              <AnimatePresence mode="wait">
                {selected ? (
                  <SpecSheet key={selected.name} part={selected.name} sensor={activeSensor} sensors={sensors} />
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-slate-500">
                    Click a component on the left or a part in the 3D model to inspect it.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
