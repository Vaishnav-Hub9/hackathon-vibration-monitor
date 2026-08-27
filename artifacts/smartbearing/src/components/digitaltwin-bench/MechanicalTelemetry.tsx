/**
 * MechanicalTelemetry — detailed telemetry panel for the mechanical digital twin.
 *
 * Shows bearing diagnostics, shaft wobble analysis, thermal state,
 * and governing equations for the mechanical assembly.
 */
import { motion } from 'framer-motion';
import { Flame, Thermometer, TrendingUp, Wind, Info, AlertTriangle, CircleDot } from 'lucide-react';
import { useMechanicalTelemetry } from '@/simulation/useLiveTelemetry';

const TEMP_COLOR = (temp: number): string => {
  if (temp > 80) return '#EF4444';
  if (temp > 55) return '#F97316';
  if (temp > 40) return '#F59E0B';
  return '#10B981';
};

const TEMP_LABEL = (temp: number): string => {
  if (temp > 80) return 'CRITICAL';
  if (temp > 55) return 'HIGH';
  if (temp > 40) return 'WARM';
  return 'NORMAL';
};

export default function MechanicalTelemetry() {
  const snap = useMechanicalTelemetry();

  // Use live values from the engine — no hardcoded friction
  const bearingFrictionPower = snap.frictionPower / 1000; // convert mW → W for display
  const dissipation = snap.dissipationPower / 1000;       // mW → W
  const shaftSpeed = (snap.spindleRPM * 2 * Math.PI) / 60; // rad/s

  return (
    <div className="space-y-4">
      {/* Bearing temperature */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-bold text-white">Bearing Thermal State</h3>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 ml-auto">
            LIVE
          </span>
        </div>

        <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Thermometer className="w-3.5 h-3.5" style={{ color: TEMP_COLOR(snap.bearingTemp) }} />
              <span className="text-xs font-bold text-white">Ball Bearing Block</span>
            </div>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: `${TEMP_COLOR(snap.bearingTemp)}15`,
                color: TEMP_COLOR(snap.bearingTemp),
                border: `1px solid ${TEMP_COLOR(snap.bearingTemp)}30`,
              }}
            >
              {TEMP_LABEL(snap.bearingTemp)}
            </span>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono-data text-lg font-bold" style={{ color: TEMP_COLOR(snap.bearingTemp) }}>
              {snap.bearingTemp.toFixed(1)}°C
            </span>
            <span className="text-[9px] text-slate-500">Inner race contact zone</span>
          </div>
          <div className="h-1.5 bg-[#0A0E1A] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${Math.min(100, (snap.bearingTemp / 100) * 100)}%` }}
              transition={{ duration: 0.5 }}
              style={{ background: `linear-gradient(90deg, ${TEMP_COLOR(snap.bearingTemp)}88, ${TEMP_COLOR(snap.bearingTemp)})` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
            <span>20°C</span>
            <span>100°C — Critical</span>
          </div>
        </div>
      </div>

      {/* Heat flow diagram */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wind className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white">Heat Flow</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Friction Power</div>
            <div className="font-mono-data text-sm font-bold text-orange-400">
              {snap.frictionPower.toFixed(2)} mW
            </div>
          </div>
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Dissipation</div>
            <div className="font-mono-data text-sm font-bold text-sky-400">
              {snap.dissipationPower.toFixed(2)} mW
            </div>
          </div>
        </div>
      </div>

      {/* Shaft dynamics */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <CircleDot className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">Shaft Dynamics</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Angular Vel.</div>
            <div className="font-mono-data text-sm font-bold text-purple-400">
              {shaftSpeed.toFixed(0)} <span className="text-[9px] text-slate-600">rad/s</span>
            </div>
          </div>
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Wobble</div>
            <div className="font-mono-data text-sm font-bold" style={{ color: snap.shaftWobble > 0.5 ? '#EF4444' : '#10B981' }}>
              {(snap.shaftWobble * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Governing equations */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-amber" />
          <h3 className="text-sm font-bold text-white">Governing Equations</h3>
        </div>
        <div className="space-y-1">
          {[
            'J·dω/dt + bω = Kt·(V-Ktω/Ra) - τ_load - τ_friction',
            'τ_friction = μ · N · r  (bearing contact)',
            'Q_bearing = μ · N · r · ω  (friction heating)',
            'C · dT/dt = Q_bearing - h·A·(T - T_amb)',
            'Wear ∝ ∫ P·v·dt  (Archard equation)',
          ].map((eq, i) => (
            <div key={i} className="text-[10px] font-mono-data text-amber/80 bg-[#0A0E1A]/50 px-2 py-1 rounded">
              {eq}
            </div>
          ))}
        </div>
      </div>

      {/* Bearing wear warning */}
      {snap.bearingWear > 0.4 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 rounded-xl p-4"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-red-400">
              Bearing wear at {(snap.bearingWear * 100).toFixed(1)}% — monitor closely
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
