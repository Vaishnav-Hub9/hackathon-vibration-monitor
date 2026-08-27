import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Play, Loader2, Mic, Activity, Zap, Cpu, CheckCircle2, Send, FlaskConical } from 'lucide-react';
import { api, machinesApi } from '@/lib/api';
import { sensorNodes } from '@/data/mockData';
import type { LiveIntensity } from '@/components/workflow/WorkflowSimulation';

/* ────────────────────────────────────────────────────────────────────────────
   Manual Test Bench — hand-tune acoustic / vibration / electrical readings,
   synthesize a 2048-point vibration window using the SAME recipe the ML model
   was trained on (artifacts/api-server/src/ml/train_model.py), and push it
   through the real inference relay (POST /api/sensor-readings → /predict).
   The verdict then lands on the dashboard live via Socket.io — perfect for
   demoing and testing each fault class without a physical node.
   ──────────────────────────────────────────────────────────────────────────── */

const N_SAMPLES = 2048;
const SAMPLE_RATE = 4000; // the model's training sample rate — stay in-domain

// 6205-class bearing geometry — must match features.py DEFAULT_GEOMETRY
const GEOMETRY = { balls: 9, pitchDiameter: 39.04, ballDiameter: 7.94, contactAngle: 0 };

const FAULT_TYPES = ['Healthy', 'Imbalance', 'Misalignment', 'Ball', 'Inner Race', 'Outer Race'] as const;
type FaultType = (typeof FAULT_TYPES)[number];

const FAULT_COLORS: Record<string, string> = {
  Healthy: '#10B981',
  Imbalance: '#F59E0B',
  Misalignment: '#8B5CF6',
  Ball: '#EC4899',
  'Inner Race': '#06B6D4',
  'Outer Race': '#EF4444',
};

interface MachineOption {
  machineId: string;
  name: string;
  status?: string;
  faultProfile?: string;
}

function defectFrequencies(rpm: number) {
  const fr = rpm / 60;
  const ratio = GEOMETRY.ballDiameter / GEOMETRY.pitchDiameter;
  const bpfo = (GEOMETRY.balls / 2) * fr * (1 - ratio);
  const bpfi = (GEOMETRY.balls / 2) * fr * (1 + ratio);
  const bsf = (GEOMETRY.pitchDiameter / (2 * GEOMETRY.ballDiameter)) * fr * (1 - ratio * ratio);
  const ftf = (fr / 2) * (1 - ratio);
  return { fr, bpfo, bpfi, bsf, ftf };
}

// Box–Muller Gaussian (matches np.random.normal(0, 0.05, N) in training)
function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Synthesize one 2048-sample window for a fault class — an exact TypeScript
 * mirror of train_model.py's synthesize(): broadband noise floor + small 1x
 * fundamental, then the class's characteristic spectral signature. Finally the
 * whole window is rescaled to the requested RMS (g) so the reported vibration
 * level matches the slider while band-energy ratios (what the model keys on)
 * stay untouched.
 */
function synthesizeSignal(fault: FaultType, rpm: number, severity: number, targetRms: number): number[] {
  const df = defectFrequencies(rpm);
  const sig = Array.from({ length: N_SAMPLES }, () => gauss() * 0.05);

  const tone = (freq: number, amp: number) => {
    const phase = Math.random() * 2 * Math.PI;
    for (let i = 0; i < N_SAMPLES; i++) {
      sig[i] += amp * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE + phase);
    }
  };

  // Every machine has a small 1x fundamental (the rotor's heartbeat)
  tone(df.fr, 0.35 * severity);

  if (fault === 'Imbalance') {
    tone(df.fr, 1.6 * severity);
    tone(2 * df.fr, 0.15 * severity);
  } else if (fault === 'Misalignment') {
    tone(df.fr, 0.5 * severity);
    tone(2 * df.fr, 1.8 * severity);
    tone(4 * df.fr, 0.3 * severity);
  } else if (fault === 'Outer Race') {
    [1, 2, 3].forEach((h) => tone(df.bpfo * h, (1.3 / h) * severity));
    tone(df.fr, 0.2 * severity);
  } else if (fault === 'Inner Race') {
    [1, 2, 3].forEach((h) => tone(df.bpfi * h, (1.3 / h) * severity));
    tone(df.fr, 0.25 * severity);
  } else if (fault === 'Ball') {
    [1, 2, 3].forEach((h) => tone(df.bsf * h, (1.3 / h) * severity));
    tone(df.fr, 0.2 * severity);
  }

  // Rescale to the requested RMS level (keeps spectral shape / band ratios)
  const rms = Math.sqrt(sig.reduce((acc, v) => acc + v * v, 0) / N_SAMPLES) || 1e-9;
  const gain = targetRms / rms;
  return sig.map((v) => v * gain);
}

interface Verdict {
  mlLabel: string;
  mlConfidence: number;
  technicianSummary: string | null;
  alertCreated: boolean;
  healthScore: number;
  probabilities: Record<string, number> | null;
  defectFrequencies: { fr: number; bpfo: number; bpfi: number; bsf: number; ftf: number } | null;
}

interface TestBenchProps {
  /** Mirror the current slider values up to the 3D stage so its particles /
   *  heat-waves / pulses animate with the tuned intensity. */
  onBenchChange?: (live: LiveIntensity) => void;
  /** Called when a manual run is launched — the page sweeps the pipeline. */
  onRunStart?: () => void;
}

export default function TestBench({ onBenchChange, onRunStart }: TestBenchProps) {
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [machineId, setMachineId] = useState('M001');

  const [acousticLevel, setAcousticLevel] = useState(0.4);
  const [rms, setRms] = useState(1.2);
  const [fault, setFault] = useState<FaultType>('Outer Race');
  const [severity, setSeverity] = useState(65);
  const [rpm, setRpm] = useState(15000);
  const [voltage, setVoltage] = useState(230);
  const [temperature, setTemperature] = useState(42);

  const [running, setRunning] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Push the current bench intensity to the 3D stage on every slider change.
  useEffect(() => {
    onBenchChange?.({
      on: true,
      acoustic: acousticLevel,
      rms,
      severity: severity / 100,
      temperature,
    });
  }, [acousticLevel, rms, severity, temperature, onBenchChange]);

  useEffect(() => {
    machinesApi
      .getAll()
      .then((res) => {
        const data = Array.isArray(res.data?.data) ? res.data.data : [];
        if (data.length > 0) {
          setMachines(
            data.map((m: any) => ({
              machineId: m.machineId ?? m.id,
              name: m.name ?? m.machineId,
              status: m.status,
              faultProfile: m.faultProfile,
            })),
          );
          setMachineId((cur) => (data.some((m: any) => (m.machineId ?? m.id) === cur) ? cur : (data[0].machineId ?? data[0].id)));
        }
      })
      .catch(() => {
        // Seeded fallback if the API is unreachable
        setMachines(
          Array.from({ length: 6 }, (_, i) => ({
            machineId: `M00${i + 1}`,
            name: i === 4 ? 'Winding Machine #1' : `Ring Frame #${i + 1}`,
          })),
        );
      });
  }, []);

  // The machine's default edge node (matches the dashboard feed's seeded nodes).
  // Machines without a seeded node get a distinct bench node id so their
  // readings appear as their own feed entry instead of hijacking SN001.
  const nodeId = useMemo(() => {
    const node = sensorNodes.find((s) => s.machineId === machineId);
    return node?.id ?? `SN-TB-${machineId}`;
  }, [machineId]);

  const df = useMemo(() => defectFrequencies(rpm), [rpm]);

  const anomalyScore = useMemo(() => {
    if (fault === 'Healthy') return 0.05;
    return Math.min(0.95, 0.25 + 0.7 * (severity / 100));
  }, [fault, severity]);

  const status = useMemo(() => {
    if (fault === 'Healthy') return 'healthy';
    if (severity >= 60) return 'critical';
    if (severity >= 30) return 'warning';
    return 'healthy';
  }, [fault, severity]);

  const runTest = async () => {
    setRunning(true);
    setError(null);
    setVerdict(null);
    onRunStart?.(); // sweep the 3D pipeline with the current bench intensity
    try {
      // Severity in the same band the model trained on (0.7–1.3)
      const sev = 0.3 + 1.2 * (severity / 100);
      const signal = synthesizeSignal(fault, rpm, sev, rms);
      const healthScore = Math.max(5, Math.min(100, Math.round(100 - anomalyScore * 100)));

      const res = await api.post('/sensor-readings', {
        machineId,
        nodeId,
        vibrationRMS: +rms.toFixed(2),
        acousticLevel: +acousticLevel.toFixed(2),
        bpfoScore: anomalyScore,
        anomalyScore,
        healthScore,
        status,
        temperature,
        voltage,
        rpm,
        sampleRate: SAMPLE_RATE,
        signal,
        capturedBy: 'test-bench',
        captureMethod: 'synthesized-vibration',
        timestamp: new Date().toISOString(),
      });

      const d = res.data;
      setVerdict({
        mlLabel: d.mlLabel ?? '—',
        mlConfidence: d.mlConfidence ?? 0,
        technicianSummary: d.technicianSummary,
        alertCreated: d.alertCreated,
        healthScore: d.healthScore,
        probabilities: d.probabilities ?? null,
        defectFrequencies: d.defectFrequencies ?? null,
      });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Request failed');
    } finally {
      setRunning(false);
    }
  };

  const vColor = verdict ? FAULT_COLORS[verdict.mlLabel] ?? '#64748B' : undefined;
  const classes = FAULT_TYPES;

  return (
    <aside className="glass rounded-2xl flex flex-col overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-navy bg-[#0F1629]/60">
        <div className="w-7 h-7 rounded-lg bg-amber/15 border border-amber/40 flex items-center justify-center shrink-0">
          <FlaskConical className="w-3.5 h-3.5 text-amber" />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold text-white leading-tight">Manual Test Bench</h2>
          <p className="text-[9px] text-slate-500 font-mono-data truncate">Synthesize readings → real ML model → live dashboard</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Target */}
        <section className="bg-[#0A0E1A]/70 border border-navy rounded-xl p-3">
          <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">Target machine</div>
          <select
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            className="w-full bg-[#0F1629] border border-navy rounded-lg px-2.5 py-2 text-xs text-white focus:border-amber/50 outline-none"
          >
            {machines.map((m) => (
              <option key={m.machineId} value={m.machineId}>
                {m.machineId} · {m.name}
                {m.status === 'critical' ? ' ⚠' : ''}
              </option>
            ))}
          </select>
          <div className="mt-2 text-[9px] font-mono-data text-slate-500">
            Node <span className="text-[#00F0FF]">{nodeId}</span> · sample rate{' '}
            <span className="text-[#00F0FF]">{(SAMPLE_RATE / 1000).toFixed(1)} kHz</span> (model training rate)
          </div>
        </section>

        {/* Acoustic */}
        <section className="bg-[#0A0E1A]/70 border border-navy rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Acoustic</span>
            </div>
            <span className="text-[10px] font-mono-data text-[#00F0FF]">{acousticLevel.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={acousticLevel}
            onChange={(e) => setAcousticLevel(+e.target.value)}
            className="w-full accent-[#00F0FF]"
          />
          <div className="flex justify-between text-[8px] font-mono-data text-slate-600 mt-0.5">
            <span>quiet</span>
            <span>loud</span>
          </div>
        </section>

        {/* Vibration */}
        <section className="bg-[#0A0E1A]/70 border border-navy rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber" />
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Vibration</span>
            </div>
            <span className="text-[10px] font-mono-data text-amber">{rms.toFixed(2)} g RMS</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.1}
            value={rms}
            onChange={(e) => setRms(+e.target.value)}
            className="w-full accent-amber"
          />

          {/* Fault class chips */}
          <div>
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Fault signature</div>
            <div className="flex flex-wrap gap-1.5">
              {classes.map((c) => (
                <button
                  key={c}
                  onClick={() => setFault(c)}
                  className={`px-2 py-1 rounded-md text-[9px] font-mono-data font-bold border transition-all ${
                    fault === c
                      ? 'border-transparent text-[#0A0E1A] shadow-[0_0_10px_rgba(0,0,0,0.3)]'
                      : 'border-navy text-slate-400 hover:text-white'
                  }`}
                  style={fault === c ? { background: FAULT_COLORS[c] } : undefined}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Severity</span>
              <span className="text-[10px] font-mono-data text-slate-300">{severity}%</span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={severity}
              onChange={(e) => setSeverity(+e.target.value)}
              className="w-full accent-[#EA580C]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Spindle RPM</span>
              <span className="text-[10px] font-mono-data text-slate-300">{rpm.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={9000}
              max={16500}
              step={250}
              value={rpm}
              onChange={(e) => setRpm(+e.target.value)}
              className="w-full accent-[#00F0FF]"
            />
            <div className="mt-1.5 text-[8px] font-mono-data text-slate-600 leading-relaxed">
              BPFO {df.bpfo.toFixed(0)} · BPFI {df.bpfi.toFixed(0)} · BSF {df.bsf.toFixed(0)} · FTF {df.ftf.toFixed(0)} Hz
            </div>
          </div>
        </section>

        {/* Electrical */}
        <section className="bg-[#0A0E1A]/70 border border-navy rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Electrical</span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-slate-500 font-bold">Supply voltage</span>
              <span className="text-[10px] font-mono-data text-[#8B5CF6]">{voltage} V</span>
            </div>
            <input
              type="range"
              min={180}
              max={440}
              step={1}
              value={voltage}
              onChange={(e) => setVoltage(+e.target.value)}
              className="w-full accent-[#8B5CF6]"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-slate-500 font-bold">Housing temperature</span>
              <span className="text-[10px] font-mono-data text-[#EA580C]">{temperature} °C</span>
            </div>
            <input
              type="range"
              min={20}
              max={85}
              step={1}
              value={temperature}
              onChange={(e) => setTemperature(+e.target.value)}
              className="w-full accent-[#EA580C]"
            />
          </div>
        </section>

        {/* Run */}
        <button
          onClick={runTest}
          disabled={running}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm shimmer bg-gradient-to-r from-[#00F0FF] via-amber to-[#EA580C] text-navy shadow-[0_0_24px_rgba(0,240,255,0.25)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Running ML inference…' : 'Synthesize & Run ML Test'}
        </button>

        {error && (
          <div className="text-[10px] font-mono-data text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            ✕ {error}
          </div>
        )}

        {/* Verdict */}
        {verdict && (
          <section className="border border-[#10B981]/30 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-[#10B981]/10 border-b border-[#10B981]/20">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="text-[9px] uppercase tracking-widest text-[#10B981] font-bold">ML Verdict</span>
              </div>
              <span className="flex items-center gap-1 text-[9px] font-mono-data text-[#10B981]">
                <CheckCircle2 className="w-3 h-3" /> dispatched to dashboard
              </span>
            </div>

            <div className="p-3 space-y-3 bg-[#0A0E1A]/70">
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-bold" style={{ color: vColor }}>
                  {verdict.mlLabel}
                </span>
                <span className="text-[10px] font-mono-data text-slate-400">
                  health {verdict.healthScore} · {verdict.alertCreated ? 'alert raised' : 'alert deduped'}
                </span>
              </div>

              {/* Confidence bar */}
              <div>
                <div className="flex justify-between text-[9px] font-mono-data text-slate-500 mb-1">
                  <span>confidence</span>
                  <span style={{ color: vColor }}>{(verdict.mlConfidence * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-[#0F1629] rounded-full overflow-hidden border border-navy">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.round(verdict.mlConfidence * 100)}%`, background: vColor }}
                  />
                </div>
              </div>

              {/* Per-class probabilities */}
              {verdict.probabilities && (
                <div className="space-y-1">
                  {classes.map((c) => {
                    const p = (verdict.probabilities?.[c] ?? 0) * 100;
                    const isTop = c === verdict.mlLabel;
                    return (
                      <div key={c} className="flex items-center gap-2">
                        <span className={`w-20 text-[8px] font-mono-data shrink-0 ${isTop ? 'text-white font-bold' : 'text-slate-500'}`}>
                          {c}
                        </span>
                        <div className="flex-1 h-1.5 bg-[#0F1629] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.max(0.5, p)}%`, background: FAULT_COLORS[c] }}
                          />
                        </div>
                        <span className="w-9 text-right text-[8px] font-mono-data text-slate-500">{p.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Defect frequencies */}
              {verdict.defectFrequencies && (
                <div className="grid grid-cols-4 gap-1 text-center">
                  {[
                    ['1×', verdict.defectFrequencies.fr],
                    ['BPFO', verdict.defectFrequencies.bpfo],
                    ['BPFI', verdict.defectFrequencies.bpfi],
                    ['BSF', verdict.defectFrequencies.bsf],
                  ].map(([k, v]) => (
                    <div key={k as string} className="bg-[#0F1629] border border-navy rounded-md py-1">
                      <div className="text-[7px] text-slate-500 font-mono-data">{k}</div>
                      <div className="text-[9px] text-[#00F0FF] font-mono-data font-bold">{Math.round(v as number)} Hz</div>
                    </div>
                  ))}
                </div>
              )}

              {verdict.technicianSummary && (
                <div className="text-[10px] leading-relaxed text-slate-300 bg-[#0F1629]/80 border border-navy rounded-lg px-2.5 py-2">
                  🧠 {verdict.technicianSummary}
                </div>
              )}

              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-1.5 w-full text-[10px] font-bold text-[#00F0FF] border border-[#00F0FF]/30 rounded-lg py-2 hover:bg-[#00F0FF]/10 transition-colors"
              >
                <Send className="w-3 h-3" /> View live on dashboard
              </Link>
            </div>
          </section>
        )}

        <p className="text-[8px] font-mono-data text-slate-600 leading-relaxed">
          The ML verdict is computed from the synthesized vibration window (band-energy ratios at 1×/2× RPM &amp; BPFO/BPFI/BSF/FTF).
          Acoustic &amp; electrical values ride along in the reading payload and are stored / displayed on the dashboard.
          Alerts dedupe per machine+node — switch machine to raise a fresh alert.
        </p>
      </div>
    </aside>
  );
}
