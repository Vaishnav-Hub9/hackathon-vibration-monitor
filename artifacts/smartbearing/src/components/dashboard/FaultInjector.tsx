import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bug,
  FlaskConical,
  Loader2,
  Shield,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { simulatorApi } from '@/lib/api';

interface FaultOption {
  key: string;
  label: string;
  color: string;
  desc: string;
  icon: LucideIcon;
}

// The exact fault classes the trained ML model knows (verified against
// label_encoder.pkl + smartline_final.pkl — 6 classes). Injecting one of
// these makes the simulator generate the matching vibration signature — which
// the REAL model then classifies back into this same label.
const FAULT_OPTIONS: FaultOption[] = [
  {
    key: 'Healthy',
    label: 'Healthy',
    color: '#10B981',
    desc: 'Clean baseline — no defect',
    icon: Shield,
  },
  {
    key: 'Imbalance',
    label: 'Imbalance',
    color: '#38BDF8',
    desc: 'Mass imbalance — 1× RPM peak',
    icon: Bug,
  },
  {
    key: 'Misalignment',
    label: 'Misalignment',
    color: '#22D3EE',
    desc: 'Shaft misalignment — 2× RPM peak',
    icon: Bug,
  },
  {
    key: 'Ball',
    label: 'Ball / Roller',
    color: '#8B5CF6',
    desc: 'Defect on a rolling element (BSF)',
    icon: Activity,
  },
  {
    key: 'Inner Race',
    label: 'Inner Race',
    color: '#F59E0B',
    desc: 'Spalling on the inner ring (BPFI)',
    icon: Bug,
  },
  {
    key: 'Outer Race',
    label: 'Outer Race',
    color: '#EA580C',
    desc: 'Spalling on the outer ring (BPFO)',
    icon: Bug,
  },
];

interface FaultInjectorProps {
  machineId: string;
  mlLabel?: string;
  mlConfidence?: number;
  onInjected?: (faultType: string) => void;
}

/**
 * Demo panel: inject a bearing fault through the REAL trained ML model. The
 * backend writes the fault to the machine, the simulator generates the
 * matching 2048-point vibration signature, and the model classifies it — the
 * CAD viewer then highlights the exact faulty part (pulsing red + FAULT chip).
 */
export default function FaultInjector({
  machineId,
  mlLabel,
  mlConfidence,
  onInjected,
}: FaultInjectorProps) {
  const [injecting, setInjecting] = useState<string | null>(null);
  const [lastInjected, setLastInjected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inject = async (opt: FaultOption) => {
    setInjecting(opt.key);
    setError(null);
    try {
      await simulatorApi.injectFault(machineId, opt.key);
      setLastInjected(opt.key);
      onInjected?.(opt.key);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to inject fault');
    } finally {
      setInjecting(null);
    }
  };

  const modelSeesFault = !!mlLabel && mlLabel !== 'Healthy';
  const confirmed =
    lastInjected && lastInjected !== 'Healthy' && mlLabel === lastInjected;

  return (
    <div className="bg-navy-card border border-navy rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-[#8B5CF6]" />
          <h3 className="text-sm font-semibold text-white">Fault Injector — Live Demo</h3>
        </div>
        <span className="text-[10px] font-mono-data text-slate-500 uppercase tracking-wider">
          real ML model · 6 fault classes · verified signatures
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
        Inject a bearing fault → the simulator streams the matching vibration into the{' '}
        <span className="text-[#8B5CF6] font-medium">trained model</span> → it classifies the fault and the{' '}
        <span className="text-amber font-medium">3D model highlights the exact broken part</span>.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {FAULT_OPTIONS.map((opt) => {
          const busy = injecting === opt.key;
          const active = confirmed === false && lastInjected === opt.key && lastInjected !== 'Healthy';
          return (
            <button
              key={opt.key}
              onClick={() => inject(opt)}
              disabled={injecting !== null}
              className={`group relative rounded-xl border p-3 text-left transition-all ${
                active
                  ? 'border-[#EF4444]/60 bg-[#EF4444]/10'
                  : 'border-navy bg-[#0A0E1A] hover:border-slate-500 hover:bg-[#0F1629]'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
              title={opt.desc}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${opt.color}1A`, color: opt.color }}
                >
                  {busy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <opt.icon className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="text-xs font-semibold text-white">{opt.label}</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-snug">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Live model verdict strip */}
      <div
        className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono-data ${
          modelSeesFault
            ? 'border-[#EF4444]/40 bg-[#EF4444]/10 text-[#FCA5A5]'
            : 'border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]'
        }`}
      >
        {modelSeesFault ? (
          <>
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-bold uppercase">ML verdict: {mlLabel}</span>
            {mlConfidence !== undefined && (
              <span className="ml-auto text-slate-400">
                {(mlConfidence * 100).toFixed(1)}% confidence
              </span>
            )}
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-bold uppercase">ML verdict: Healthy</span>
            <span className="ml-auto text-slate-400">waiting for next 2048-pt window…</span>
          </>
        )}
      </div>

      {confirmed && (
        <p className="mt-2 text-[11px] text-[#6EE7B7] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          Model confirmed <span className="font-bold">{lastInjected}</span> — highlighted in the CAD model.
        </p>
      )}
      {error && (
        <p className="mt-2 text-[11px] text-[#FCA5A5] flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
