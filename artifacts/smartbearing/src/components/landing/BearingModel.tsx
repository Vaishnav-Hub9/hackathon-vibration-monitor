import { Component, type ReactNode, useState, lazy, Suspense, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Rotate3d, Layers, Tag, Activity } from 'lucide-react';
import { useLandingSensors } from '@/hooks/useLandingSensors';
import type { LiveSensor } from '@/hooks/useLandingSensors';

const BearingScene = lazy(() => import('./BearingScene'));

function checkWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!ctx;
  } catch {
    return false;
  }
}

export function CSSBearingFallback() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 420 }}>
      <style>{`
        @keyframes bearingRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bearingRotateRev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes ballOrbit { from { transform: rotate(0deg) translateX(88px) rotate(0deg); } to { transform: rotate(360deg) translateX(88px) rotate(-360deg); } }
        @keyframes amberGlow { 0%,100% { box-shadow: 0 0 30px rgba(245,158,11,0.25), 0 0 60px rgba(245,158,11,0.08); } 50% { box-shadow: 0 0 50px rgba(245,158,11,0.45), 0 0 100px rgba(245,158,11,0.15); } }
      `}</style>
      <div style={{ position: 'relative', width: 240, height: 240, animation: 'amberGlow 3s ease-in-out infinite' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '18px solid #4B5563', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)', animation: 'bearingRotate 10s linear infinite', background: 'conic-gradient(from 0deg, #374151, #6B7280, #374151, #6B7280, #374151)' }} />
        <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', border: '3px solid #F59E0B', opacity: 0.8, animation: 'bearingRotateRev 7s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 58, borderRadius: '50%', border: '14px solid #374151', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.7)', background: 'conic-gradient(from 0deg, #374151, #4B5563, #374151, #4B5563, #374151)', animation: 'bearingRotate 5s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 95, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #1E2D4A, #0A0E1A)', border: '1px solid #1E2D4A' }} />
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: 18, height: 18, marginTop: -9, marginLeft: -9, animation: `ballOrbit 5.5s linear infinite`, animationDelay: `${-(i / 8) * 5.5}s` }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #E5E7EB, #6B7280)', boxShadow: '0 2px 6px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.2)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

class BearingErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <CSSBearingFallback />;
    return this.props.children;
  }
}

const PART_DETAILS: Record<string, { title: string; what: string; why: string }> = {
  'Outer Race': {
    title: 'Outer Race',
    what: 'The static outer ring. Its raceway is the track the balls roll against, and it transfers the bearing load into the machine housing.',
    why: 'Outer-race defects produce the BPFO fault frequency — the single strongest predictor of imminent bearing failure.',
  },
  'Inner Race': {
    title: 'Inner Race',
    what: 'The rotating inner ring, press-fit onto the shaft. It spins at shaft speed and drives the ball train around the raceway.',
    why: 'Tracked for the BPFI signature. A spall here rotates through the load zone once every revolution — a tell-tale periodic impact.',
  },
  Cage: {
    title: 'Cage',
    what: 'The retainer that keeps the balls evenly spaced so they never touch each other, preserving rolling geometry and preventing skidding.',
    why: 'Cage wear shows up first as acoustic noise — a leading indicator of lubrication loss or misalignment before raceway damage.',
  },
  Shaft: {
    title: 'Shaft',
    what: 'The rotating shaft that delivers torque into the bearing, spinning the inner race and the load zone around the raceway.',
    why: 'Imbalance, misalignment and runout all translate directly into vibration — the rotor is coupled 1:1 to the monitored bearing.',
  },
  'Ball Element': {
    title: 'Ball Element',
    what: 'A spherical rolling element carrying the radial load between inner and outer raceways with minimal rolling resistance.',
    why: 'Each ball is a live sensor node — vibration, temperature and anomaly score are streamed per element to catch the exact failing ball.',
  },
};

function TelemetryPanel({ selected, sensors, exploded }: { selected: { name: string; sensor?: LiveSensor } | null; sensors: LiveSensor[]; exploded: boolean }) {
  const s = selected?.sensor ? sensors.find((x) => x.id === selected.sensor?.id) ?? selected.sensor : undefined;
  const detail = selected && !selected.sensor ? PART_DETAILS[selected.name] : undefined;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selected ? selected.name : 'empty'}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="absolute bottom-3 left-3 z-20 bg-[#0F1629]/90 backdrop-blur border border-navy rounded-lg px-3 py-2.5 max-w-[230px] pointer-events-none"
      >
        {selected ? (
          selected.sensor && s ? (
            <>
              <div className="text-[10px] text-slate-400 font-mono-data uppercase tracking-wider mb-0.5">Ball Element · Live</div>
              <div className="space-y-0.5 font-mono-data text-[11px]">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Health</span>
                  <span className="text-white font-bold">{s.healthScore}%</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Vib (z)</span>
                  <span style={{ color: s.accel_z > 3 ? '#EA580C' : s.accel_z > 1.5 ? '#F59E0B' : '#10B981' }} className="font-bold">{s.accel_z.toFixed(2)}g</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Temp</span>
                  <span className="text-white font-bold">{s.temperature.toFixed(0)}°C</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Anomaly</span>
                  <span style={{ color: s.anomalyScore > 0.6 ? '#EA580C' : '#F59E0B' }} className="font-bold">{s.anomalyScore.toFixed(2)}</span>
                </div>
              </div>
            </>
          ) : detail ? (
            <>
              <div className="text-[10px] text-slate-400 font-mono-data uppercase tracking-wider mb-1">
                {exploded ? 'Disassembled' : 'Component'} · {detail.title}
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">{detail.what}</p>
              <p className="mt-1.5 pt-1.5 border-t border-navy text-[10.5px] text-amber/90 leading-relaxed">
                <span className="font-bold">Why it matters — </span>{detail.why}
              </p>
            </>
          ) : null
        ) : (
          <div className="text-[10px] text-slate-400 font-mono-data">
            {exploded
              ? 'Components separated — click any part to inspect it in detail'
              : 'Press Explode to break the bearing apart like Iron Man\u2019s suit'}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default function BearingModel({ className = '' }: { className?: string }) {
  const [webGLAvailable] = useState(() => checkWebGL());
  const [autoRotate, setAutoRotate] = useState(true);
  const [exploded, setExploded] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [rpm, setRpm] = useState(12000);
  const [selected, setSelected] = useState<{ name: string; sensor?: LiveSensor } | null>(null);
  const sensors = useLandingSensors(8);

  const worst = useMemo(() => {
    const c = sensors.find((s) => s.status === 'critical');
    if (c) return c;
    return sensors.find((s) => s.status === 'warning') || sensors[0];
  }, [sensors]);

  const panelProps = { sensors, autoRotate, exploded, rpm, showLabels, selected, onSelect: setSelected };

  return (
    <div className={`relative ${className}`}>
      {/* Ambient glow + grid backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.10),transparent_60%)]" />
      <div className="absolute inset-0 grid-bg opacity-25" />

      <div className="relative h-[480px] sm:h-[520px] lg:h-[580px]">
        {!webGLAvailable ? (
          <CSSBearingFallback />
        ) : (
          <BearingErrorBoundary>
            <Suspense fallback={<CSSBearingFallback />}>
              <BearingScene {...panelProps} />
            </Suspense>
          </BearingErrorBoundary>
        )}
      </div>

      {/* Live badge */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#0F1629]/85 backdrop-blur border border-navy rounded-full px-3 py-1.5">
        <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
        <span className="text-[10px] font-mono-data text-slate-300 tracking-wider uppercase">Live · {sensors.length} sensor nodes</span>
      </div>

      {/* Control panel */}
      <div className="absolute top-3 right-3 z-20 flex flex-wrap gap-2 justify-end max-w-[70%]">
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setAutoRotate((v) => !v)}
          title="Toggle auto-rotate"
          className={`flex items-center gap-1.5 text-[11px] font-mono-data px-2.5 py-1.5 rounded-md border backdrop-blur transition-colors ${autoRotate ? 'bg-amber/15 border-amber/40 text-amber' : 'bg-[#0F1629]/85 border-navy text-slate-400 hover:text-slate-200'}`}
        >
          <Rotate3d className="w-3.5 h-3.5" /> {autoRotate ? 'Spin On' : 'Spin Off'}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => setExploded((v) => !v)}
          title="Exploded view"
          className={`flex items-center gap-1.5 text-[11px] font-mono-data px-2.5 py-1.5 rounded-md border backdrop-blur transition-colors ${exploded ? 'bg-amber/15 border-amber/40 text-amber' : 'bg-[#0F1629]/85 border-navy text-slate-400 hover:text-slate-200'}`}
        >
          <Layers className="w-3.5 h-3.5" /> {exploded ? 'Assembled' : 'Explode'}
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
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-[#0F1629]/90 backdrop-blur border border-navy rounded-lg px-4 py-2 flex items-center gap-3">
        <Activity className="w-3.5 h-3.5 text-amber" />
        <input
          type="range"
          min={2000}
          max={15000}
          step={500}
          value={rpm}
          onChange={(e) => setRpm(Number(e.target.value))}
          className="w-28 sm:w-36 accent-amber"
        />
        <span className="font-mono-data text-[11px] text-amber w-16 text-right">{(rpm / 1000).toFixed(1)}k RPM</span>
      </div>

      {/* Component chips — quick part selection when exploded */}
      {exploded && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex flex-wrap justify-center gap-1.5 max-w-[92%] sm:max-w-[calc(100%-340px)]">
          {Object.values(PART_DETAILS)
            .filter((d) => d.title !== 'Ball Element')
            .map((d) => {
              const isSel = selected?.name === d.title;
              return (
                <motion.button
                  key={d.title}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setSelected(isSel ? null : { name: d.title })}
                  className={`px-2.5 py-1.5 rounded-md border text-[10px] font-mono-data backdrop-blur transition-colors ${
                    isSel
                      ? 'bg-amber/15 border-amber/50 text-amber'
                      : 'bg-[#0F1629]/85 border-navy text-slate-300 hover:border-amber/40 hover:text-white'
                  }`}
                >
                  {d.title}
                </motion.button>
              );
            })}
        </div>
      )}

      <TelemetryPanel selected={selected} sensors={sensors} exploded={exploded} />

      {/* Fleet health strip */}
      <div className="absolute top-16 left-3 z-20 hidden sm:flex items-center gap-2 bg-[#0F1629]/85 backdrop-blur border border-navy rounded-lg px-3 py-2">
        <RefreshCw className="w-3.5 h-3.5 text-amber animate-spin" style={{ animationDuration: '4s' }} />
        <div className="font-mono-data text-[11px]">
          <span className="text-slate-400">Fleet risk: </span>
          <span className={worst && worst.status === 'critical' ? 'text-[#EA580C] font-bold' : worst && worst.status === 'warning' ? 'text-[#F59E0B] font-bold' : 'text-[#10B981] font-bold'}>
            {worst ? `${worst.healthScore}%` : '—'}
          </span>
          <span className="text-slate-500 ml-1.5">{worst ? worst.status.toUpperCase() : ''}</span>
        </div>
      </div>
    </div>
  );
}
