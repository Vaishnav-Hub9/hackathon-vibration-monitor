import { useMemo } from 'react';
import { Activity, Cpu, Gauge, Wifi } from 'lucide-react';

/**
 * LiveBearingWidget — the "machine you can break" digital twin.
 *
 * A CSS-animated bearing that spins at the live RPM of the monitored machine,
 * jitters with the live vibration amplitude, and glows / labels by status.
 * Feed it the pinned injector sensor (or any live sensor) and it visibly
 * degrades the moment a fault is injected — the digital twin of the Fault
 * Injector's physics→model loop.
 */

interface LiveBearingWidgetProps {
  name?: string;
  rpm?: number;
  accelZ?: number;
  status?: string;
  mlLabel?: string;
  mlConfidence?: number;
}

const STATUS_THEME: Record<string, { color: string; label: string; glow: string }> = {
  healthy: { color: '#10B981', label: 'HEALTHY', glow: 'rgba(16,185,129,0.45)' },
  warning: { color: '#F59E0B', label: 'WARNING', glow: 'rgba(245,158,11,0.5)' },
  critical: { color: '#EA580C', label: 'CRITICAL', glow: 'rgba(234,88,12,0.65)' },
};

export default function LiveBearingWidget({
  name = 'Machine',
  rpm = 0,
  accelZ = 0,
  status = 'healthy',
  mlLabel,
  mlConfidence,
}: LiveBearingWidgetProps) {
  const theme = STATUS_THEME[status] || STATUS_THEME.healthy;

  // Visually scale spin: high RPM = fast rotation (blur), low RPM = slow.
  const spinDur = useMemo(
    () => Math.max(0.35, 2.4 - (rpm || 0) / 15000) * 1.4,
    [rpm],
  );
  // Jitter amplitude tracks live vibration — barely there when healthy,
  // violent when a fault is injected.
  const jit = Math.min(7, Math.max(0.5, (accelZ || 0) * 1.6));

  const verdictTone = mlLabel && mlLabel !== 'Healthy' ? 'text-[#FCA5A5]' : 'text-[#6EE7B7]';

  return (
    <div className="relative bg-navy-card border border-navy rounded-xl p-5 overflow-hidden flex flex-col card-accent">
      {/* Status-tinted ambient glow */}
      <div
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl pointer-events-none"
        style={{ background: theme.glow, opacity: 0.35 }}
      />

      <div className="flex items-center justify-between mb-1 relative">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-amber" />
          <h3 className="text-sm font-semibold text-white">Digital Twin — Live</h3>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono-data text-[#10B981]">
          <Wifi className="w-3 h-3" /> Socket.io
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-4 relative">
        <span className="text-white font-medium">{name}</span> — spins at live RPM, jitters
        with real vibration.
      </p>

      {/* Bearing */}
      <div
        className="relative w-40 h-40 mx-auto"
        style={{ '--jit': `${jit}px`, '--orbit': '62px' } as React.CSSProperties}
      >
        <div className="absolute inset-0 sb-jitter">
          {/* Outer race */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '13px solid #3b4659',
              background: 'conic-gradient(from 0deg, #374151, #55627a, #374151, #55627a, #374151)',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.7)',
              animation: `sbSpin ${spinDur}s linear infinite`,
            }}
          />
          {/* Cage ring */}
          <div
            className="absolute inset-[15px] rounded-full border-2"
            style={{ borderColor: theme.color, opacity: 0.7, animation: `sbSpinRev ${spinDur * 1.4}s linear infinite` }}
          />
          {/* Inner race */}
          <div
            className="absolute inset-[32px] rounded-full"
            style={{
              border: '9px solid #2c3550',
              background: 'conic-gradient(from 0deg, #262e45, #3b4659, #262e45, #3b4659, #262e45)',
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.8)',
              animation: `sbSpin ${spinDur * 0.8}s linear infinite`,
            }}
          />
          {/* Balls orbiting between the races */}
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 w-3.5 h-3.5 -ml-[7px] -mt-[7px]"
              style={{
                animation: `sbBallOrbit ${spinDur}s linear infinite`,
                animationDelay: `${-(i / 8) * spinDur}s`,
              }}
            >
              <div
                className="w-3.5 h-3.5 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 35% 30%, #E5E7EB, #6B7280)',
                  boxShadow: '0 1px 5px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.25)',
                }}
              />
            </div>
          ))}
        </div>
        {/* Center hub — status heart */}
        <div
          className="absolute inset-[52px] rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 35% 35%, #1E2D4A, #0A0E1A)',
            border: `1px solid ${theme.color}66`,
            boxShadow: `0 0 26px ${theme.glow}`,
          }}
        >
          <span className="font-mono-data text-[10px] font-bold tracking-wider" style={{ color: theme.color }}>
            {status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Live readouts */}
      <div className="grid grid-cols-3 gap-2 mt-5 relative">
        <div className="bg-[#0A0E1A] border border-navy rounded-lg p-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1 flex items-center justify-center gap-1">
            <Gauge className="w-2.5 h-2.5" /> RPM
          </div>
          <div className="font-mono-data text-sm font-bold text-white">
            {(rpm || 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-[#0A0E1A] border border-navy rounded-lg p-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1 flex items-center justify-center gap-1">
            <Activity className="w-2.5 h-2.5" /> Vib
          </div>
          <div className="font-mono-data text-sm font-bold" style={{ color: theme.color }}>
            {(accelZ || 0).toFixed(2)}g
          </div>
        </div>
        <div className="bg-[#0A0E1A] border border-navy rounded-lg p-2 text-center">
          <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1">Model</div>
          <div className={`font-mono-data text-sm font-bold truncate ${verdictTone}`}>
            {mlLabel || '—'}
          </div>
        </div>
      </div>

      {/* Model confidence bar */}
      {mlConfidence !== undefined && (
        <div className="mt-3 relative">
          <div className="flex justify-between text-[10px] font-mono-data mb-1">
            <span className="text-slate-500">ML confidence</span>
            <span className={verdictTone}>{(mlConfidence * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-[#0A0E1A] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${mlConfidence * 100}%`, background: theme.color, boxShadow: `0 0 8px ${theme.glow}` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
