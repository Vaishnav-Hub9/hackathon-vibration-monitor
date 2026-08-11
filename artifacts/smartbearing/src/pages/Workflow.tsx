import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, RotateCcw, Waves, Thermometer, Activity, Cpu, Send, CheckCircle2, Loader2, FlaskConical } from 'lucide-react';
import WorkflowSimulation, { type LiveIntensity, type SimMode } from '@/components/workflow/WorkflowSimulation';
import TestBench from '@/components/workflow/TestBench';

const STAGES = [
  { id: 0, name: 'Acoustic Capture', desc: 'Sine-wave particles → mic array', icon: Waves, start: 0 },
  { id: 1, name: 'Thermal Sensing', desc: 'Heat-gradient rings → temp node', icon: Thermometer, start: 20 },
  { id: 2, name: 'Electrical + Spindle Vibration', desc: 'Voltage pulses + vibration rings', icon: Activity, start: 40 },
  { id: 3, name: 'ML Model Inference', desc: 'Data streams → neural network', icon: Cpu, start: 60 },
  { id: 4, name: 'Dashboard Dispatch', desc: 'JSON payload → dashboard state', icon: Send, start: 80 },
];

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Default bench state — the 3D stage reflects the Manual Test Bench's current
// values even before the user touches anything (live mode).
const DEFAULT_BENCH: LiveIntensity = { on: true, acoustic: 0.4, rms: 1.2, severity: 0.65, temperature: 42 };

export default function Workflow() {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<SimMode>('live');
  const [bench, setBench] = useState<LiveIntensity>(DEFAULT_BENCH);
  // Completion overlay is auto-dismissed so the panel never blocks the user.
  const [doneVisible, setDoneVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Sweep tick — pure with respect to React: no setState calls inside updaters,
  // all bookkeeping happens here in the interval callback. This guarantees the
  // sweep always terminates cleanly and the page stays fully interactive after.
  const tick = () => {
    const next = Math.min(100, progressRef.current + 0.19);
    progressRef.current = next;
    setProgress(next);
    if (next >= 100) {
      stopTimer();
      setRunning(false);
      setMode('live');
      setDoneVisible(true);
      if (dismissRef.current) clearTimeout(dismissRef.current);
      dismissRef.current = setTimeout(() => setDoneVisible(false), 2600);
    }
  };

  const start = () => {
    stopTimer();
    if (dismissRef.current) {
      clearTimeout(dismissRef.current);
      dismissRef.current = null;
    }
    progressRef.current = 0;
    setProgress(0);
    setRunning(true);
    setMode('sweep');
    setDoneVisible(false);
    // ~9s full sweep at 60fps ≈ +0.19/frame via 16ms interval
    timerRef.current = setInterval(tick, 16);
  };

  const reset = () => {
    stopTimer();
    progressRef.current = 0;
    setProgress(0);
    setRunning(false);
    setMode('live');
    setDoneVisible(false);
  };

  useEffect(
    () => () => {
      stopTimer();
      if (dismissRef.current) clearTimeout(dismissRef.current);
    },
    [],
  );

  const rpm = Math.round(14400 * easeInOut(clamp01(progress / 20)));
  const rms = (2.84 * easeInOut(clamp01(progress / 40))).toFixed(2);
  const temp = (27 + 38 * easeInOut(clamp01(progress / 50))).toFixed(0);
  const conf = (97.4 * easeInOut(clamp01((progress - 60) / 40))).toFixed(1);
  const currentStage = STAGES.reduce((acc, s) => (progress >= s.start ? s : acc), STAGES[0]);

  return (
    <div className="min-h-[100dvh] bg-navy text-slate-200 font-sans overflow-x-hidden flex flex-col">
      {/* Top bar */}
      <header className="relative z-30 shrink-0 border-b border-navy bg-[#070B14]/85 backdrop-blur-md">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
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
              <p className="text-[10px] text-slate-500 truncate">Automated simulation · manual ML test bench · live dashboard reactions</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono-data">
            <span className="flex items-center gap-1.5 border border-navy bg-[#0F1629]/70 rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              {running ? 'PIPELINE ACTIVE' : mode === 'sweep' ? 'SWEEPING…' : 'LIVE BENCH'}
            </span>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 border border-[#00F0FF]/30 text-[#00F0FF] bg-[#00F0FF]/5 rounded-full px-2.5 py-1 hover:bg-[#00F0FF]/10 transition-colors"
            >
              <Send className="w-3 h-3" /> Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Body: 3D stage (left) + Manual Test Bench (right) */}
      <div className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_400px] min-h-0 p-4 sm:p-5 gap-4 max-w-[1700px] mx-auto w-full">
        {/* ── 3D stage panel ── */}
        <section className="glass relative rounded-2xl overflow-hidden flex flex-col min-h-0">
          {/* The completion overlay lives INSIDE this stage container so it can
              never cover the Run/Replay controls below. */}
          <div className="relative flex-1 min-h-[46vh] lg:min-h-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,240,255,0.08),transparent_60%)]" />
            <div className="absolute inset-0 grid-bg opacity-20" />
            <WorkflowSimulation progress={progress} mode={mode} live={bench} />

            {/* Stage checklist overlay */}
            <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-1.5 overflow-x-auto pb-1">
              {STAGES.map((s) => {
                const done = progress >= s.start + 19;
                const active = progress >= s.start && progress < s.start + 19;
                const Icon = s.icon;
                return (
                  <div key={s.id} className="flex items-center gap-1.5 shrink-0">
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full border text-[9px] font-mono-data transition-all backdrop-blur ${
                        done
                          ? 'border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981]'
                          : active
                            ? 'border-amber/50 bg-amber/15 text-amber shadow-[0_0_14px_rgba(245,158,11,0.25)]'
                            : 'border-navy bg-[#0A0E1A]/70 text-slate-500'
                      }`}
                    >
                      {done ? <CheckCircle2 className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                      <span className="hidden md:inline">{s.name}</span>
                      <span className="md:hidden font-bold">{s.id + 1}</span>
                    </div>
                    {s.id < STAGES.length - 1 && (
                      <div className={`h-px w-3 shrink-0 ${progress >= s.start + 19 ? 'bg-[#10B981]/50' : 'bg-navy'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bench live tag */}
            {!running && mode === 'live' && (
              <div className="absolute top-3 right-3 z-20 hidden sm:flex items-center gap-1.5 bg-[#0F1629]/85 backdrop-blur border border-amber/30 rounded-md px-2.5 py-1.5">
                <FlaskConical className="w-3 h-3 text-amber" />
                <span className="text-[9px] font-mono-data uppercase tracking-widest text-slate-300">
                  Stage animating to bench intensity
                </span>
              </div>
            )}

            {/* Active stage tag */}
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 bg-[#0F1629]/85 backdrop-blur border border-navy rounded-md px-3 py-1.5">
              <currentStage.icon className="w-3.5 h-3.5 text-amber" />
              <span className="text-[10px] font-mono-data uppercase tracking-widest text-slate-300">
                {progress >= 100 && !doneVisible ? 'Live · bench intensity' : `Stage ${currentStage.id + 1} / 5 · ${currentStage.name}`}
              </span>
            </div>

            {/* Completion overlay — covers only the 3D stage, auto-dismisses */}
            <AnimatePresence>
              {progress >= 100 && doneVisible && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.5 } }}
                  className="absolute inset-0 z-30 rounded-2xl bg-[#0A0E1A]/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none"
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
                  <div className="text-xs text-slate-400 font-mono-data">Live on the dashboard · stage returns to bench intensity</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls + telemetry bar */}
          <div className="shrink-0 border-t border-navy bg-[#070B14]/90 backdrop-blur px-4 py-3 space-y-3">
            {/* Progress bar */}
            <div className="relative h-2 bg-[#0A0E1A] rounded-full overflow-hidden border border-navy">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] via-amber to-[#EA580C] shadow-[0_0_16px_rgba(245,158,11,0.6)]"
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'linear', duration: 0.05 }}
              />
            </div>

            {/* Telemetry + controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid grid-cols-4 gap-2 flex-1 min-w-[280px]">
                {[
                  { label: 'Spindle RPM', value: rpm.toLocaleString(), unit: 'RPM', color: '#00F0FF' },
                  { label: 'RMS Accel', value: rms, unit: 'g', color: '#F59E0B' },
                  { label: 'Housing Temp', value: temp, unit: '°C', color: '#EA580C' },
                  { label: 'ML Confidence', value: conf, unit: '%', color: '#10B981' },
                ].map((m) => (
                  <div key={m.label} className="bg-[#0A0E1A]/70 border border-navy rounded-lg px-2 py-1.5 text-center">
                    <div className="text-[8px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">{m.label}</div>
                    <div className="font-mono-data text-sm font-bold leading-none" style={{ color: m.color }}>
                      {m.value}
                      <span className="text-[9px] text-slate-500 ml-0.5">{m.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!running ? (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={start}
                    className="shimmer flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#00F0FF] via-amber to-[#EA580C] text-navy shadow-[0_0_30px_rgba(0,240,255,0.35)]"
                  >
                    {progress >= 100 ? <RotateCcw className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {progress >= 100 ? 'Replay' : 'Run Auto-Sim'}
                  </motion.button>
                ) : (
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-[#0A0E1A]/80 border border-amber/40 text-amber">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running…
                  </div>
                )}
                {progress > 0 && progress < 100 && (
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border border-navy text-slate-400 hover:text-white hover:border-amber/40 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Manual Test Bench ── */}
        <TestBench onBenchChange={setBench} onRunStart={start} />
      </div>
    </div>
  );
}
