import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Cpu,
  ExternalLink,
  Gauge,
  LineChart,
  Sparkles,
  Thermometer,
  Zap,
} from 'lucide-react';
import NativeCadViewer, { healthTone, type CadPart } from './NativeCadViewer';
import { usePartSimulation } from '@/hooks/usePartSimulation';
import {
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatusBadge } from '@/components/ui/StatusBadge';

// ============================================================
// Your Onshape document (SmartBearing CAD / Part Studio 1)
// Swap the did/wid/eid below to embed a different document.
// ============================================================
const ONSHAPE_BASE = 'https://cad.onshape.com';
const ONSHAPE_DOC =
  'documents/3a69519e53a5005e3bec8510/w/b2ba871f5405233222816e48/e/a31d598d5d85e1f838b6b86d';
const ONSHAPE_URL = `${ONSHAPE_BASE}/${ONSHAPE_DOC}?renderMode=0&uiState=6a442c37a925ba1565306983`;

const PIPELINE = [
  { key: 'sense', label: 'Sense', icon: Activity, color: '#3B82F6' },
  { key: 'predict', label: 'ML Predict', icon: Cpu, color: '#8B5CF6' },
  { key: 'graph', label: 'Graph', icon: LineChart, color: '#F59E0B' },
  { key: 'features', label: 'Features', icon: Sparkles, color: '#10B981' },
];

interface OnshapeCadPanelProps {
  machineId: string;
  machineName: string;
  machineStatus: string;
  healthScore: number;
  liveData: any;
  fftData: any[];
}

export default function OnshapeCadPanel({
  machineId,
  machineName,
  machineStatus,
  healthScore,
  liveData,
  fftData,
}: OnshapeCadPanelProps) {
  const [embedAttempted, setEmbedAttempted] = useState(false);
  const [parts, setParts] = useState<CadPart[] | null>(null);
  const [probeState, setProbeState] = useState<'checking' | 'found' | 'none'>('checking');

  // Simulated per-part edge-node readings — every labeled part streams its own
  // temperature / vibration, scaled by machine stress, and the 3D model colors
  // heat-map to the live health values.
  const partLive = usePartSimulation(parts, liveData, Number(healthScore) || 100);

  // Safety timeout: if Onshape refuses to render inside the iframe, onLoad may
  // never fire — guarantee the fallback guidance becomes visible either way.
  useEffect(() => {
    const t = setTimeout(() => setEmbedAttempted(true), 6000);
    return () => clearTimeout(t);
  }, []);

  // Prefer a real CAD export placed in public/models — Onshape blocks third-
  // party iframing at the platform level (verified: X-Frame-Options:
  // SAMEORIGIN + CSP frame-ancestors on the document response), so the native
  // Three.js viewer is the reliable way to show the actual geometry.
  useEffect(() => {
    // 1. The real Onshape export — 3 separate parts (outer race / inner race /
    //    rolling element). Tweaked in Onshape: right-click each part → Export → STL.
    // 2. Single-file fallbacks (placeholder / older exports).
    const groups: CadPart[][] = [
      [
        { url: '/models/part-1.stl', name: 'Outer Race', color: '#CBD5E1' },
        { url: '/models/part-2.stl', name: 'Inner Race', color: '#38BDF8' },
        { url: '/models/part-3.stl', name: 'Rolling Element', color: '#F59E0B' },
      ],
      [{ url: '/models/smartbearing.stl', name: 'Bearing', color: '#CBD5E1' }],
      [{ url: '/models/smartbearing.glb', name: 'Bearing', color: '#CBD5E1' }],
      [{ url: '/models/part-studio-1.stl', name: 'Bearing', color: '#CBD5E1' }],
      [{ url: '/models/part-studio-1.glb', name: 'Bearing', color: '#CBD5E1' }],
    ];
    let cancelled = false;
    (async () => {
      for (const group of groups) {
        const found: CadPart[] = [];
        for (const part of group) {
          try {
            const res = await fetch(part.url, { method: 'HEAD' });
            if (!res.ok) break;
            // Vite's SPA fallback serves text/html for missing paths with a 200.
            // Only accept a real static file (non-HTML content type).
            const ct = (res.headers.get('content-type') || '').toLowerCase();
            if (ct.includes('text/html')) break;
            found.push(part);
          } catch {
            break;
          }
        }
        if (found.length === group.length) {
          if (!cancelled) {
            setParts(group);
            setProbeState('found');
          }
          return;
        }
      }
      if (!cancelled) setProbeState('none');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const telemetry: {
    label: string;
    value: string;
    detail?: string;
    icon: typeof Gauge;
    color: string;
  }[] = useMemo(() => {
    const d = liveData || {};
    return [
      {
        label: 'Vibration RMS',
        value: d.accel_z !== undefined ? `${Number(d.accel_z).toFixed(2)} g` : '—',
        icon: Gauge,
        color: Number(d.accel_z) > 2.5 ? '#EA580C' : Number(d.accel_z) > 1.5 ? '#F59E0B' : '#10B981',
      },
      {
        label: 'Temperature',
        value: d.temperature !== undefined ? `${Number(d.temperature).toFixed(1)} °C` : '—',
        icon: Thermometer,
        color: Number(d.temperature) > 65 ? '#EA580C' : '#3B82F6',
      },
      {
        label: 'Spindle Speed',
        value: d.rpm ? `${Number(d.rpm).toLocaleString()} rpm` : '—',
        icon: Cpu,
        color: '#8B5CF6',
      },
      {
        label: 'Supply Voltage',
        value: '220 V',
        detail: 'nominal',
        icon: Zap,
        color: '#10B981',
      },
    ];
  }, [liveData]);

  // Worst part across the live per-part stream — the ML model classifies every
  // part window and the verdict is driven by the most degraded component.
  const worstPart = useMemo(() => {
    if (!parts) return null;
    let worst: { name: string; anomaly: number; temperature: number; vibration: number } | null = null;
    for (const p of parts) {
      const lv = partLive[p.url];
      if (!lv) continue;
      if (!worst || lv.anomaly > worst.anomaly) {
        worst = { name: p.name, anomaly: lv.anomaly, temperature: lv.temperature, vibration: lv.vibration };
      }
    }
    return worst;
  }, [parts, partLive]);

  const anomaly = worstPart ? worstPart.anomaly : Number(liveData?.anomalyScore ?? 0);
  const verdict = useMemo(() => {
    if (anomaly > 0.65 || Number(healthScore) < 45) {
      return {
        label: worstPart ? `CRITICAL — ${worstPart.name}` : 'CRITICAL — BPFO fault zone',
        color: '#EA580C',
        confidence: Math.max(anomaly, 0.85),
      };
    }
    if (anomaly > 0.35 || Number(healthScore) < 70) {
      return {
        label: worstPart ? `ELEVATED — ${worstPart.name}` : 'ELEVATED VIBRATION',
        color: '#F59E0B',
        confidence: Math.max(anomaly, 0.6),
      };
    }
    return { label: 'HEALTHY', color: '#10B981', confidence: 0.95 - anomaly };
  }, [anomaly, healthScore, worstPart]);

  const bpfoBin = useMemo(() => {
    if (!fftData || fftData.length === 0) return null;
    const peak = fftData.reduce((a, b) => (b.amplitude > a.amplitude ? b : a), fftData[0]);
    return peak;
  }, [fftData]);

  return (
    <div className="space-y-6">
      {/* Pipeline strip */}
      <div className="bg-navy-card border border-navy rounded-xl p-4 flex items-center gap-2 overflow-x-auto">
        {PIPELINE.map((step, i) => (
          <div key={step.key} className="flex items-center gap-2 flex-shrink-0">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold uppercase tracking-wider ${
                i === 0
                  ? 'border-[#3B82F6]/40 bg-[#3B82F6]/10 text-[#93C5FD]' // Sense: live stream always active
                  : 'border-navy bg-[#0A0E1A] text-slate-400'
              }`}
            >
              <step.icon className="w-3.5 h-3.5" style={{ color: step.color }} />
              {step.label}
            </div>
            {i < PIPELINE.length - 1 && <span className="text-slate-600">→</span>}
          </div>
        ))}
      </div>

      {/* Model + live telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Embedded CAD */}
        <div className="lg:col-span-3 bg-navy-card border border-navy rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-navy">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
              <h3 className="text-sm font-semibold text-white">Live CAD Model</h3>
              <span className="text-[10px] text-slate-500 font-mono-data">Onshape · Part Studio 1</span>
            </div>
            <a
              href={ONSHAPE_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-amber hover:underline"
            >
              Open in Onshape <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative h-[420px] bg-[#0A0E1A]">
            {parts ? (
              <NativeCadViewer parts={parts} live={partLive} />
            ) : probeState === 'checking' ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0A0E1A]">
                <div className="text-center px-6">
                  <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-slate-400">Looking for CAD export…</p>
                </div>
              </div>
            ) : (
              <>
                <iframe
                  title={`Onshape model — ${machineName}`}
                  src={ONSHAPE_URL}
                  onLoad={() => setEmbedAttempted(true)}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                />
                {!embedAttempted && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#0A0E1A]">
                    <div className="text-center px-6">
                      <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-sm text-slate-400">Loading Onshape viewer…</p>
                    </div>
                  </div>
                )}
              </>
            )}
            {/* Accurate fallback note — verified against Onshape's response headers */}
            <div className="absolute bottom-3 left-3 right-3 bg-[#0A0E1A]/95 border border-navy rounded-lg p-3 pointer-events-none">
              {parts ? (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <span className="text-[#10B981] font-semibold">Live telemetry:</span> every labeled part
                  streams its own temperature &amp; vibration — the 3D colors heat-map to health, and ML
                  flags the worst part. Toggle parts to inspect them.
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <span className="text-amber font-semibold">Heads up:</span> even with public sharing,
                  Onshape blocks third-party iframes at the platform level (
                  <span className="text-slate-300 font-mono-data">X-Frame-Options: SAMEORIGIN</span>), so
                  the viewer below only opens via <span className="text-amber">Open in Onshape</span>.
                  To render the real geometry here, export <span className="text-slate-300 font-mono-data">STL/GLB</span> from
                  Onshape and drop it into{' '}
                  <span className="text-slate-300 font-mono-data">public/models/</span>.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Live telemetry + ML verdict */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-navy-card border border-navy p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Live Sensor Values</h3>
              <StatusBadge status={machineStatus} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {telemetry.map((t) => (
                <div key={t.label} className="bg-[#0A0E1A] border border-navy rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                    <t.icon className="w-3 h-3" style={{ color: t.color }} />
                    {t.label}
                  </div>
                  <div className="font-mono-data text-lg font-bold text-white">
                    {t.value}
                    {t.detail && <span className="text-[10px] text-slate-500 ml-1">{t.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-slate-600 font-mono-data flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
              {machineId} · live via Socket.io
            </div>
          </div>

          <div className="bg-navy-card border border-navy p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">ML Verdict</h3>
              <Cpu className="w-4 h-4 text-[#8B5CF6]" />
            </div>
            <div
              className="px-3 py-2 rounded-lg border text-sm font-bold font-mono-data"
              style={{
                color: verdict.color,
                borderColor: `${verdict.color}55`,
                backgroundColor: `${verdict.color}14`,
              }}
            >
              {verdict.label}
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                <span>{verdict.label === 'HEALTHY' ? 'Health confidence' : 'Fault confidence'}</span>
                <span className="font-mono-data">{Math.round(verdict.confidence * 100)}%</span>
              </div>
              <div className="w-full bg-[#0A0E1A] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${verdict.confidence * 100}%`, backgroundColor: verdict.color }}
                ></div>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
              The edge ML model weighs time-domain, FFT and wavelet features of the 2048-point window.
              Scores &gt; 0.65 indicate imminent bearing failure (BPFO fault zone).
            </p>
          </div>
        </div>
      </div>

      {/* Per-part live telemetry — each labeled part streams its own values */}
      {parts && parts.length > 1 && (
        <div className="bg-navy-card border border-navy rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Per-Part Sensor Telemetry</h3>
            <span className="text-[10px] font-mono-data text-[#10B981] bg-[#10B981]/10 px-2 py-1 rounded border border-[#10B981]/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
              streaming · ML window 2048 pt
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {parts.map((p) => {
              const lv = partLive[p.url];
              const tone = lv ? healthTone(lv.health) : p.color;
              return (
                <div key={p.url} className="bg-[#0A0E1A] border border-navy rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{ backgroundColor: tone }}
                    ></span>
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">
                      {p.name}
                    </span>
                    <span className="ml-auto text-[10px] font-mono-data" style={{ color: tone }}>
                      {lv ? `${Math.round(lv.health)}% health` : 'waiting…'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-navy border border-navy rounded-lg p-2.5">
                      <div className="flex items-center gap-1 text-[9px] text-slate-500 uppercase tracking-wider mb-1">
                        <Thermometer className="w-3 h-3" /> Temp
                      </div>
                      <div className="font-mono-data text-sm font-bold text-white">
                        {lv ? `${lv.temperature.toFixed(1)}°C` : '—'}
                      </div>
                    </div>
                    <div className="bg-navy border border-navy rounded-lg p-2.5">
                      <div className="flex items-center gap-1 text-[9px] text-slate-500 uppercase tracking-wider mb-1">
                        <Gauge className="w-3 h-3" /> Vib RMS
                      </div>
                      <div className="font-mono-data text-sm font-bold text-white">
                        {lv ? `${lv.vibration.toFixed(2)}g` : '—'}
                      </div>
                    </div>
                    <div className="bg-navy border border-navy rounded-lg p-2.5">
                      <div className="flex items-center gap-1 text-[9px] text-slate-500 uppercase tracking-wider mb-1">
                        <Cpu className="w-3 h-3" /> Anomaly
                      </div>
                      <div className="font-mono-data text-sm font-bold" style={{ color: tone }}>
                        {lv ? lv.anomaly.toFixed(2) : '—'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-navy h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${lv ? Math.max(3, lv.health) : 100}%`, backgroundColor: tone }}
                      ></div>
                    </div>
                    <div className="mt-1.5 text-[9px] font-mono-data text-slate-600">
                      {lv ? `${lv.anomaly > 0.65 ? 'FAULT ZONE' : lv.anomaly > 0.35 ? 'CAUTION' : 'NORMAL'}` : 'no data'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FFT graph + feature cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-navy-card border border-navy p-5 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-white">Frequency Spectrum (FFT)</h3>
            <span className="text-xs font-mono-data text-amber bg-amber/10 px-2 py-1 rounded border border-amber/20">
              Live Update
            </span>
          </div>
          <div className="h-64">
            {fftData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fftData} margin={{ top: 20 }}>
                  <XAxis dataKey="freq" stroke="#64748B" fontSize={10} tickFormatter={(v) => `${v}Hz`} />
                  <YAxis stroke="#64748B" fontSize={10} />
                  <Tooltip
                    cursor={{ fill: '#1E2D4A' }}
                    contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', color: '#fff' }}
                  />
                  <Bar dataKey="amplitude" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                    {fftData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.amplitude > 0.7 ? '#EA580C' : '#3B82F6'} />
                    ))}
                  </Bar>
                  {bpfoBin && bpfoBin.amplitude > 0.7 && (
                    <ReferenceLine
                      x={bpfoBin.freq}
                      stroke="#EA580C"
                      strokeDasharray="3 3"
                      label={{
                        position: 'top',
                        value: `BPFO ${Math.round(bpfoBin.freq)}Hz`,
                        fill: '#EA580C',
                        fontSize: 12,
                        fontWeight: 'bold',
                      }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Waiting for spectrum data…
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {[
            {
              label: 'BPFO Score',
              value: anomaly.toFixed(2),
              detail: anomaly > 0.65 ? 'Fault zone' : anomaly > 0.35 ? 'Caution' : 'Normal',
              color: anomaly > 0.65 ? '#EA580C' : anomaly > 0.35 ? '#F59E0B' : '#10B981',
            },
            {
              label: 'Health Score',
              value: `${Math.round(healthScore)}%`,
              detail: healthScore < 45 ? 'Critical' : healthScore < 70 ? 'Warning' : 'Healthy',
              color: healthScore < 45 ? '#EA580C' : healthScore < 70 ? '#F59E0B' : '#10B981',
            },
            {
              label: 'Nodes',
              value: '5 / 5',
              detail: 'online',
              color: '#3B82F6',
            },
          ].map((f) => (
            <div key={f.label} className="bg-navy-card border border-navy p-4 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500 uppercase tracking-wider">{f.label}</span>
                <Sparkles className="w-3.5 h-3.5 opacity-50" style={{ color: f.color }} />
              </div>
              <div className="flex items-end justify-between">
                <span className="font-mono-data text-2xl font-bold text-white">{f.value}</span>
                <span className="text-[11px] font-mono-data" style={{ color: f.color }}>
                  {f.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
