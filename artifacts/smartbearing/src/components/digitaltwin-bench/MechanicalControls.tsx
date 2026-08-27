/**
 * MechanicalControls — interactive controls for the 3D Mechanical Digital Twin.
 *
 * Provides Start/Stop spindle toggle, RPM slider, load torque, bearing
 * friction coefficient, and supply voltage controls. Also displays live
 * mechanical telemetry readouts.
 */
import { motion } from 'framer-motion';
import {
  Play, Pause, Gauge, Activity, Zap, CircleDot,
  AlertTriangle, CheckCircle, Disc3, RotateCcw, Tags, EyeOff,
} from 'lucide-react';
import { useDigitalTwinStore } from '@/simulation/store';
import { useMechanicalTelemetry } from '@/simulation/useLiveTelemetry';

const WEAR_COLOR = (wear: number): string => {
  if (wear > 0.7) return '#EF4444';
  if (wear > 0.4) return '#F59E0B';
  return '#10B981';
};

const TEMP_COLOR = (temp: number): string => {
  if (temp > 80) return '#EF4444';
  if (temp > 55) return '#F97316';
  if (temp > 40) return '#F59E0B';
  return '#10B981';
};

export default function MechanicalControls() {
  const mechParams = useDigitalTwinStore((s) => s.mechParams);
  const setMechParams = useDigitalTwinStore((s) => s.setMechParams);
  const showLabels = useDigitalTwinStore((s) => s.showMechLabels);
  const toggleLabels = useDigitalTwinStore((s) => s.toggleMechLabels);
  const snap = useMechanicalTelemetry();

  return (
    <div className="space-y-4">
      {/* Spindle control */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Disc3 className="w-4 h-4 text-amber" />
            <h3 className="text-sm font-bold text-white">Spindle Control</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleLabels}
              className={`p-1.5 rounded-lg border text-xs transition ${
                showLabels
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                  : 'bg-navy border-navy text-slate-500'
              }`}
              title={showLabels ? 'Hide labels' : 'Show labels'}
            >
              {showLabels ? <Tags className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setMechParams({ spindleRunning: !mechParams.spindleRunning })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                mechParams.spindleRunning
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber/15 border-amber/30 text-amber'
              }`}
            >
              {mechParams.spindleRunning ? (
                <><Pause className="w-3.5 h-3.5" /> STOP</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> START</>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* RPM Control */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <Gauge className="w-3 h-3 text-amber" /> Spindle RPM
              </label>
              <span className="font-mono-data text-sm font-bold text-amber">
                {mechParams.spindleRPM.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={15000}
              step={100}
              value={mechParams.spindleRPM}
              onChange={(e) => setMechParams({ spindleRPM: Number(e.target.value) })}
              className="w-full accent-amber"
            />
            <div className="flex justify-between text-[9px] font-mono-data text-slate-600 mt-0.5">
              <span>0</span>
              <span>Resonance zone</span>
              <span>15k</span>
            </div>
          </div>

          {/* Load Torque */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <Activity className="w-3 h-3 text-amber" /> Spindle Load
              </label>
              <span className="font-mono-data text-sm font-bold text-amber">
                {(mechParams.spindleLoad * 1000).toFixed(1)} mN·m
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.1}
              step={0.001}
              value={mechParams.spindleLoad}
              onChange={(e) => setMechParams({ spindleLoad: Number(e.target.value) })}
              className="w-full accent-amber"
            />
          </div>

          {/* Bearing Friction */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-amber" /> Bearing Friction (μ)
              </label>
              <span className="font-mono-data text-sm font-bold text-amber">
                {mechParams.bearingFriction.toFixed(4)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.01}
              step={0.0001}
              value={mechParams.bearingFriction}
              onChange={(e) => setMechParams({ bearingFriction: Number(e.target.value) })}
              className="w-full accent-amber"
            />
          </div>

          {/* Supply Voltage */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber" /> Supply Voltage
              </label>
              <span className="font-mono-data text-sm font-bold text-amber">
                {mechParams.supplyVoltage}V
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={24}
              step={0.5}
              value={mechParams.supplyVoltage}
              onChange={(e) => setMechParams({ supplyVoltage: Number(e.target.value) })}
              className="w-full accent-amber"
            />
          </div>
        </div>
      </div>

      {/* Live mechanical telemetry */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-amber" />
          <h3 className="text-sm font-bold text-white">Live Mechanical Telemetry</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Spindle RPM', value: snap.spindleRPM.toFixed(0), unit: 'rev/min', color: '#F59E0B', icon: Gauge },
            { label: 'Motor Current', value: (snap.motorCurrent * 1000).toFixed(1), unit: 'mA', color: '#3B82F6', icon: Zap },
            { label: 'Motor Torque', value: (snap.motorTorque * 1000).toFixed(2), unit: 'mN·m', color: '#F97316', icon: Activity },
            { label: 'Bearing Temp', value: snap.bearingTemp.toFixed(1), unit: '°C', color: TEMP_COLOR(snap.bearingTemp), icon: CircleDot },
          ].map((item) => (
            <div key={item.label} className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
              <div className="flex items-center gap-1 mb-1">
                <item.icon className="w-3 h-3" style={{ color: item.color }} />
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">{item.label}</span>
              </div>
              <div className="font-mono-data text-sm font-bold" style={{ color: item.color }}>
                {item.value} <span className="text-[9px] text-slate-600">{item.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bearing health */}
        <div className="mt-3 bg-[#0A0E1A]/60 border border-navy rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {snap.bearingWear > 0.7 ? (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
              <span className="text-xs font-bold text-white">Bearing Health</span>
            </div>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: `${WEAR_COLOR(snap.bearingWear)}15`,
                color: WEAR_COLOR(snap.bearingWear),
                border: `1px solid ${WEAR_COLOR(snap.bearingWear)}30`,
              }}
            >
              {snap.bearingWear > 0.7 ? 'REPLACE' : snap.bearingWear > 0.4 ? 'WEARING' : 'HEALTHY'}
            </span>
          </div>
          <div className="h-1.5 bg-[#0A0E1A] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${snap.bearingWear * 100}%` }}
              transition={{ duration: 0.5 }}
              style={{ background: `linear-gradient(90deg, ${WEAR_COLOR(snap.bearingWear)}88, ${WEAR_COLOR(snap.bearingWear)})` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
            <span>0% — New</span>
            <span>{(snap.bearingWear * 100).toFixed(1)}%</span>
            <span>100% — Failed</span>
          </div>
        </div>

        {/* Shaft wobble indicator */}
        <div className="mt-2 bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-purple-400" />
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
              Shaft Wobble
            </span>
          </div>
          <span className="font-mono-data text-sm font-bold text-purple-400">
            {(snap.shaftWobble * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
