import { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, RotateCcw, Waves, Thermometer, Activity, Cpu, Send, CheckCircle2, Loader2 } from 'lucide-react';
import WorkflowSimulation from '@/components/workflow/WorkflowSimulation';

const STAGES = [
  { id: 0, name: 'Acoustic Capture', desc: 'Sine-wave particles → mic array', icon: Waves, start: 0 },
  { id: 1, name: 'Thermal Sensing', desc: 'Heat-gradient rings → temp node', icon: Thermometer, start: 20 },
  { id: 2, name: 'Electrical + Spindle Vibration', desc: 'Voltage pulses + vibration rings', icon: Activity, start: 40 },
  { id: 3, name: 'ML Model Inference', desc: 'Data streams → neural network', icon: Cpu, start: 60 },
  { id: 4, name: 'Dashboard Dispatch', desc: 'JSON payload → dashboard state', icon: Send, start: 80 },
];

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function Workflow() {
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    setRunning(true);
    // ~9s full sweep at 60fps ≈ +0.19/frame via 16ms interval
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 0.19);
        if (next >= 100 && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setRunning(false);
        }
        return next;
      });
    }, 16);
  };

  const reset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
    setProgress(0);
  };

  // Auto-navigate to /dashboard once the pipeline completes
  useEffect(() => {
    if (progress < 100) return;
    const t = setTimeout(() => setLocation('/dashboard'), 1800);
    return () => clearTimeout(t);
  }, [progress, setLocation]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const rpm = Math.round(14400 * easeInOut(clamp01(progress / 20)));
  const rms = (2.84 * easeInOut(clamp01(progress / 40))).toFixed(2);
  const temp = (27 + 38 * easeInOut(clamp01(progress / 50))).toFixed(0);
  const conf = (97.4 * easeInOut(clamp01((progress - 60) / 40))).toFixed(1);
  const currentStage = STAGES.reduce((acc, s) => (progress >= s.start ? s : acc), STAGES[0]);

  return (
    <div className="min-h-[100dvh] bg-navy text-slate-200 font-sans overflow-x-hidden flex flex-col relative">
      {/* 3D backdrop */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,240,255,0.08),transparent_60%)]" />
        <div className="absolute inset-0 grid-bg opacity-20" />
        <WorkflowSimulation progress={progress} />
      </div>

      {/* Top bar */}
      <header className="relative z-30 shrink-0 border-b border-navy bg-[#070B14]/85 backdrop-blur-md">
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
                Telemetry <span className="text-amber">Pipeline</span>
              </h1>
              <p className="text-[10px] text-slate-500 truncate">Sense → Predict → Alert — the full data journey in one scene</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono-data">
            <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" /> Pipeline {running ? 'ACTIVE' : 'STANDBY'}
            </span>
          </div>
        </div>
      </header>

      {/* Glassmorphic control card */}
      <div className="relative z-20 flex-1 flex items-end justify-center p-4 sm:p-6 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="glass relative pointer-events-auto w-full max-w-3xl rounded-2xl p-5 shadow-[0_16px_60px_rgba(0,0,0,0.6)]"
        >
          {/* Stage checklist */}
          <div className="flex items-center justify-between gap-2 mb-4 overflow-x-auto pb-1">
            {STAGES.map((s) => {
              const done = progress >= s.start + 19;
              const active = progress >= s.start && progress < s.start + 19;
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center gap-2 shrink-0">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-mono-data transition-all ${
                      done
                        ? 'border-[#10B981]/50 bg-[#10B981]/10 text-[#10B981]'
                        : active
                          ? 'border-amber/50 bg-amber/10 text-amber shadow-[0_0_14px_rgba(245,158,11,0.25)]'
                          : 'border-navy bg-[#0A0E1A]/60 text-slate-500'
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                    <span className="font-bold uppercase tracking-wider">{s.id + 1}</span>
                  </div>
                  {s.id < STAGES.length - 1 && <div className={`h-px w-4 ${progress >= s.start + 19 ? 'bg-[#10B981]/50' : 'bg-navy'}`} />}
                </div>
              );
            })}
          </div>

          {/* Active stage label */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <currentStage.icon className="w-4 h-4 text-amber" />
              <span className="text-xs font-semibold text-white">{currentStage.name}</span>
              <span className="text-[10px] text-slate-500 hidden sm:inline">{currentStage.desc}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={Math.floor(progress / 20)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="text-[10px] font-mono-data uppercase tracking-widest text-amber"
              >
                Stage {currentStage.id + 1} / 5
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Progress bar */}
          <div className="relative h-2.5 bg-[#0A0E1A] rounded-full overflow-hidden border border-navy mb-5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] via-amber to-[#EA580C] shadow-[0_0_16px_rgba(245,158,11,0.6)]"
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'linear', duration: 0.05 }}
            />
          </div>

          {/* Telemetry counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Spindle RPM', value: rpm.toLocaleString(), unit: 'RPM', color: '#00F0FF' },
              { label: 'RMS Acceleration', value: rms, unit: 'g', color: '#F59E0B' },
              { label: 'Housing Temp', value: temp, unit: '°C', color: '#EA580C' },
              { label: 'ML Confidence', value: conf, unit: '%', color: '#10B981' },
            ].map((m) => (
              <div key={m.label} className="bg-[#0A0E1A]/70 border border-navy rounded-xl px-3 py-2.5 text-center">
                <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">{m.label}</div>
                <div className="font-mono-data text-lg font-bold leading-none" style={{ color: m.color }}>
                  {m.value}
                  <span className="text-[10px] text-slate-500 ml-1">{m.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            {!running ? (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onClick={start}
                className="shimmer flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-[#00F0FF] via-amber to-[#EA580C] text-navy shadow-[0_0_30px_rgba(0,240,255,0.35)]"
              >
                {progress >= 100 ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {progress >= 100 ? 'Replay Simulation' : 'Start Simulation'}
              </motion.button>
            ) : (
              <div className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm bg-[#0A0E1A]/80 border border-amber/40 text-amber">
                <Loader2 className="w-4 h-4 animate-spin" /> Running…
              </div>
            )}
            {progress > 0 && progress < 100 && (
              <button
                onClick={reset}
                className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-semibold border border-navy text-slate-400 hover:text-white hover:border-amber/40 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
          </div>

          {/* Completion overlay */}
          <AnimatePresence>
            {progress >= 100 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 rounded-2xl bg-[#0A0E1A]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3"
              >
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="w-14 h-14 rounded-full bg-[#10B981]/15 border border-[#10B981]/50 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-7 h-7 text-[#10B981]" />
                </motion.div>
                <div className="font-display font-bold text-white text-lg">Payload Dispatched</div>
                <div className="text-xs text-slate-400 font-mono-data">Routing to live dashboard…</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
