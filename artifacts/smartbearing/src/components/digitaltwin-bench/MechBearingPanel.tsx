/**
 * MechBearingPanel — dedicated bearing diagnostics view.
 *
 * Shows bearing health, wear progression, load analysis, vibration
 * spectrum, and failure prediction based on the mechanical twin state.
 */
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, CircleDot, Activity, Clock, TrendingUp } from 'lucide-react';
import { useMechanicalTelemetry } from '@/simulation/useLiveTelemetry';

const WEAR_COLOR = (wear: number): string => {
  if (wear > 0.7) return '#EF4444';
  if (wear > 0.4) return '#F59E0B';
  return '#10B981';
};

const WEAR_LABEL = (wear: number): string => {
  if (wear > 0.7) return 'REPLACE SOON';
  if (wear > 0.4) return 'WEARING';
  return 'HEALTHY';
};

const TEMP_COLOR = (temp: number): string => {
  if (temp > 80) return '#EF4444';
  if (temp > 55) return '#F97316';
  if (temp > 40) return '#F59E0B';
  return '#10B981';
};

export default function MechBearingPanel() {
  const snap = useMechanicalTelemetry();

  // Estimated time to failure (hours) based on current wear rate
  const estimatedLife = snap.bearingWear > 0.001
    ? Math.max(0, ((1 - snap.bearingWear) / snap.bearingWear) * 0.001).toFixed(1)
    : '∞';

  // Vibration severity based on wobble
  const vibrationSeverity = snap.shaftWobble > 0.5 ? 'SEVERE'
    : snap.shaftWobble > 0.2 ? 'MODERATE'
    : snap.shaftWobble > 0.05 ? 'MILD'
    : 'NORMAL';

  const vibrationColor = snap.shaftWobble > 0.5 ? '#EF4444'
    : snap.shaftWobble > 0.2 ? '#F59E0B'
    : snap.shaftWobble > 0.05 ? '#3B82F6'
    : '#10B981';

  return (
    <div className="space-y-4">
      {/* Bearing Health Overview */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CircleDot className="w-4 h-4 text-amber" />
            <h3 className="text-sm font-bold text-white">Bearing Health</h3>
          </div>
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full"
            style={{
              background: `${WEAR_COLOR(snap.bearingWear)}15`,
              color: WEAR_COLOR(snap.bearingWear),
              border: `1px solid ${WEAR_COLOR(snap.bearingWear)}30`,
            }}
          >
            {WEAR_LABEL(snap.bearingWear)}
          </span>
        </div>

        {/* Wear bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-400">Wear Progression</span>
            <span className="font-mono-data text-sm font-bold" style={{ color: WEAR_COLOR(snap.bearingWear) }}>
              {(snap.bearingWear * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-[#0A0E1A] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${snap.bearingWear * 100}%` }}
              transition={{ duration: 0.3 }}
              style={{ background: `linear-gradient(90deg, ${WEAR_COLOR(snap.bearingWear)}88, ${WEAR_COLOR(snap.bearingWear)})` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
            <span>New</span>
            <span>Warning</span>
            <span>Failure</span>
          </div>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-[9px] text-slate-500 font-bold">Est. Life</span>
            </div>
            <span className="font-mono-data text-sm font-bold text-white">
              {estimatedLife} <span className="text-[9px] text-slate-600">hrs</span>
            </span>
          </div>
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Activity className="w-3 h-3" style={{ color: vibrationColor }} />
              <span className="text-[9px] text-slate-500 font-bold">Vibration</span>
            </div>
            <span className="font-mono-data text-sm font-bold" style={{ color: vibrationColor }}>
              {vibrationSeverity}
            </span>
          </div>
        </div>
      </div>

      {/* Bearing Temperature */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4" style={{ color: TEMP_COLOR(snap.bearingTemp) }} />
          <h3 className="text-sm font-bold text-white">Bearing Temperature</h3>
        </div>
        <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono-data text-lg font-bold" style={{ color: TEMP_COLOR(snap.bearingTemp) }}>
              {snap.bearingTemp.toFixed(1)}°C
            </span>
            <span className="text-[9px] text-slate-500">Inner race contact</span>
          </div>
          <div className="h-2 bg-[#0A0E1A] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${Math.min(100, (snap.bearingTemp / 100) * 100)}%` }}
              transition={{ duration: 0.5 }}
              style={{ background: `linear-gradient(90deg, ${TEMP_COLOR(snap.bearingTemp)}88, ${TEMP_COLOR(snap.bearingTemp)})` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
            <span>20°C</span>
            <span>60°C Warning</span>
            <span>100°C Critical</span>
          </div>
        </div>
      </div>

      {/* Failure Modes */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber" />
          <h3 className="text-sm font-bold text-white">Failure Risk Assessment</h3>
        </div>
        <div className="space-y-2">
          {[
            { mode: 'Spalling', risk: snap.bearingWear > 0.3 ? 'HIGH' : snap.bearingWear > 0.1 ? 'MEDIUM' : 'LOW', color: snap.bearingWear > 0.3 ? '#EF4444' : snap.bearingWear > 0.1 ? '#F59E0B' : '#10B981' },
            { mode: 'Brinelling', risk: snap.bearingTemp > 60 ? 'HIGH' : snap.bearingTemp > 40 ? 'MEDIUM' : 'LOW', color: snap.bearingTemp > 60 ? '#EF4444' : snap.bearingTemp > 40 ? '#F59E0B' : '#10B981' },
            { mode: 'Cage fracture', risk: snap.shaftWobble > 0.3 ? 'HIGH' : snap.shaftWobble > 0.1 ? 'MEDIUM' : 'LOW', color: snap.shaftWobble > 0.3 ? '#EF4444' : snap.shaftWobble > 0.1 ? '#F59E0B' : '#10B981' },
            { mode: 'Corrosion', risk: snap.bearingTemp > 50 ? 'MEDIUM' : 'LOW', color: snap.bearingTemp > 50 ? '#F59E0B' : '#10B981' },
          ].map((item) => (
            <div key={item.mode} className="flex items-center justify-between bg-[#0A0E1A]/60 border border-navy rounded-lg px-3 py-2">
              <span className="text-xs text-slate-300">{item.mode}</span>
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ color: item.color, background: `${item.color}15`, border: `1px solid ${item.color}30` }}
              >
                {item.risk}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Shaft Wobble Detail */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">Shaft Wobble</h3>
        </div>
        <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono-data text-lg font-bold" style={{ color: vibrationColor }}>
              {(snap.shaftWobble * 100).toFixed(1)}%
            </span>
            <span className="text-[9px] text-slate-500">Eccentric vibration</span>
          </div>
          <div className="h-2 bg-[#0A0E1A] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${snap.shaftWobble * 100}%` }}
              transition={{ duration: 0.3 }}
              style={{ background: `linear-gradient(90deg, ${vibrationColor}88, ${vibrationColor})` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
