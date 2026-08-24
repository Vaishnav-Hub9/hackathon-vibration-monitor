/**
 * MechThermalPanel — dedicated thermal diagnostics for the mechanical twin.
 *
 * Shows heat generation, thermal balance, cooling efficiency, and
 * temperature trend analysis for the bearing assembly.
 */
import { motion } from 'framer-motion';
import { Flame, Thermometer, Wind, TrendingUp, Info } from 'lucide-react';
import { useMechanicalTelemetry } from '@/simulation/useLiveTelemetry';
import { useDigitalTwinStore } from '@/simulation/store';
import ThermalChart from './ThermalChart';

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

export default function MechThermalPanel() {
  const snap = useMechanicalTelemetry();
  const mechParams = useDigitalTwinStore((s) => s.mechParams);

  // Use live values from the engine — no hardcoded friction
  const ambientTemp = snap.ambientTemp;
  const frictionPower = snap.frictionPower;       // mW (from engine)
  const dissipationRate = snap.dissipationPower;   // mW (from engine)
  const netHeat = frictionPower - dissipationRate;

  return (
    <div className="space-y-4">
      {/* Temperature Overview */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-bold text-white">Bearing Thermal State</h3>
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
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

      {/* Heat Flow Diagram */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wind className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white">Heat Flow Analysis</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Friction Power</div>
            <div className="font-mono-data text-sm font-bold text-orange-400">
              {frictionPower.toFixed(2)} <span className="text-[9px] text-slate-600">mW</span>
            </div>
          </div>
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Dissipation</div>
            <div className="font-mono-data text-sm font-bold text-sky-400">
              {dissipationRate.toFixed(2)} <span className="text-[9px] text-slate-600">mW</span>
            </div>
          </div>
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Net Heat</div>
            <div className="font-mono-data text-sm font-bold" style={{ color: netHeat > 0 ? '#F97316' : '#10B981' }}>
              {netHeat > 0 ? '+' : ''}{netHeat.toFixed(2)} <span className="text-[9px] text-slate-600">mW</span>
            </div>
          </div>
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Spindle Speed</div>
            <div className="font-mono-data text-sm font-bold text-amber">
              {snap.spindleRPM.toFixed(0)} <span className="text-[9px] text-slate-600">RPM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Temperature Trend Chart */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-amber" />
          <h3 className="text-sm font-bold text-white">Temperature Trend</h3>
          <span className="text-[9px] font-mono-data text-slate-500">rolling 2 min</span>
        </div>
        <ThermalChart />
      </div>

      {/* Thermal Equations */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-amber" />
          <h3 className="text-sm font-bold text-white">Thermal Equations</h3>
        </div>
        <div className="space-y-1">
          {[
            'Q_friction = μ · N · r · ω',
            'Q_dissipation = h · A · (T - T_amb)',
            'C · dT/dt = Q_friction - Q_dissipation',
            'dT/dt > 0 → heating (Q_in > Q_out)',
            'dT/dt < 0 → cooling (Q_out > Q_in)',
          ].map((eq, i) => (
            <div key={i} className="text-[10px] font-mono-data text-amber/80 bg-[#0A0E1A]/50 px-2 py-1 rounded">
              {eq}
            </div>
          ))}
        </div>
      </div>

      {/* Ambient Reference */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-300">Ambient Temperature</span>
          </div>
          <span className="font-mono-data text-sm font-bold text-slate-400">
            {snap.ambientTemp}°C
          </span>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">
          Thermal constants: C=8.0 J/°C, h=15 W/m²·°C, A=0.001 m²
        </div>
      </div>
    </div>
  );
}
