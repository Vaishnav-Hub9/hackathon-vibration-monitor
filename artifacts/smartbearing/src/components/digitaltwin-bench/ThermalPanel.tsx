/**
 * ThermalPanel — real-time thermal heatmap display showing temperatures of
 * each component in the SmartBearing bench assembly.
 *
 * Uses the thermal model from the physics engine to render temperature
 * bars, heat flow arrows, and a summary of thermal health.
 */
import { motion } from 'framer-motion';
import { Thermometer, Flame, Wind, TrendingUp } from 'lucide-react';
import { useLiveTelemetry } from '@/simulation/useLiveTelemetry';
import { THERMAL_CONSTANTS } from '@/simulation/types';

const TEMP_COLOR = (temp: number): string => {
  if (temp > 75) return '#EF4444';
  if (temp > 60) return '#F97316';
  if (temp > 45) return '#F59E0B';
  if (temp > 35) return '#3B82F6';
  return '#10B981';
};

const TEMP_LABEL = (temp: number): string => {
  if (temp > 75) return 'CRITICAL';
  if (temp > 60) return 'HIGH';
  if (temp > 45) return 'WARM';
  if (temp > 35) return 'NORMAL';
  return 'COOL';
};

export default function ThermalPanel() {
  const { thermal, motor, tempSensor } = useLiveTelemetry();

  const components = [
    {
      name: 'Bearing Housing',
      temp: thermal.bearingTemp,
      icon: Flame,
      location: 'Rolling contact zone',
      criticalTemp: 70,
    },
    {
      name: 'Motor Windings',
      temp: thermal.motorTemp,
      icon: Thermometer,
      location: 'Armature copper',
      criticalTemp: 80,
    },
    {
      name: 'DS18B20 Probe',
      temp: tempSensor.temperature,
      icon: Thermometer,
      location: 'OneWire sensor on D5',
      criticalTemp: 85,
    },
  ];

  const totalDissipation = thermal.dissipationRate;
  const frictionPower = thermal.frictionLoss;
  const electricalLoss = motor.current * motor.current * 2.5; // I²Ra

  return (
    <div className="space-y-4">
      {/* Temperature overview */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-bold text-white">Thermal State</h3>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 ml-auto">
            LIVE
          </span>
        </div>

        <div className="space-y-3">
          {components.map((comp, i) => {
            const color = TEMP_COLOR(comp.temp);
            const label = TEMP_LABEL(comp.temp);
            const pct = Math.min(100, (comp.temp / comp.criticalTemp) * 100);

            return (
              <motion.div
                key={comp.name}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <comp.icon className="w-3.5 h-3.5" style={{ color }} />
                    <span className="text-xs font-bold text-white">{comp.name}</span>
                  </div>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: `${color}15`,
                      color,
                      border: `1px solid ${color}30`,
                    }}
                  >
                    {label}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono-data text-lg font-bold" style={{ color }}>
                    {comp.temp.toFixed(1)}°C
                  </span>
                  <span className="text-[9px] text-slate-500">{comp.location}</span>
                </div>

                {/* Temperature bar */}
                <div className="h-1.5 bg-[#0A0E1A] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                    style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
                  <span>0°C</span>
                  <span>{comp.criticalTemp}°C</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Heat flow diagram */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wind className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-bold text-white">Heat Flow</h3>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Friction Power</div>
            <div className="font-mono-data text-sm font-bold text-orange-400">
              {(frictionPower * 1000).toFixed(1)} mW
            </div>
          </div>
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Electrical Loss</div>
            <div className="font-mono-data text-sm font-bold text-amber-400">
              {(electricalLoss * 1000).toFixed(1)} mW
            </div>
          </div>
          <div className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Dissipation</div>
            <div className="font-mono-data text-sm font-bold text-sky-400">
              {(totalDissipation * 1000).toFixed(1)} mW
            </div>
          </div>
        </div>

        {/* Thermal equations */}
        <div className="mt-3 bg-[#0A0E1A]/70 border border-navy rounded-lg px-3 py-2 text-[9px] font-mono-data text-slate-500 space-y-0.5">
          <div>
            <span className="text-amber">▸</span> Q_friction = b · ω² ={' '}
            <span className="text-orange-400">{(frictionPower * 1000).toFixed(2)} mW</span>
          </div>
          <div>
            <span className="text-amber">▸</span> Q_elec = I² · R_a ={' '}
            <span className="text-amber-400">{(electricalLoss * 1000).toFixed(2)} mW</span>
          </div>
          <div>
            <span className="text-amber">▸</span> Q_dissip = h · A · (T - T_amb) ={' '}
            <span className="text-sky-400">{(totalDissipation * 1000).toFixed(2)} mW</span>
          </div>
          <div>
            <span className="text-amber">▸</span> C · dT/dt = ΣQ_in - ΣQ_out
          </div>
        </div>
      </div>

      {/* Ambient reference */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-300">Ambient Temperature</span>
          </div>
          <span className="font-mono-data text-sm font-bold text-slate-400">
            {thermal.ambientTemp}°C
          </span>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">
          Thermal model constants: C={THERMAL_CONSTANTS.C} J/°C, h={THERMAL_CONSTANTS.h} W/m²·°C, A={THERMAL_CONSTANTS.A} m²
        </div>
      </div>
    </div>
  );
}
