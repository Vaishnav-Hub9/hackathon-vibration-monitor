/**
 * SimControls — interactive controls for the digital twin simulation.
 *
 * Provides motor PWM duty cycle, load torque, supply voltage, ambient
 * temperature, simulation speed, and pause/play controls.
 * Also shows live motor telemetry readouts.
 */
import { motion } from 'framer-motion';
import {
  Play, Pause, RotateCcw, Gauge, Zap, Thermometer, Cpu, Clock,
  Activity, CircleDot, Disc3
} from 'lucide-react';
import { useDigitalTwinStore } from '@/simulation/store';
import { useLiveTelemetry } from '@/simulation/useLiveTelemetry';

export default function SimControls() {
  const params = useDigitalTwinStore((s) => s.params);
  const setParams = useDigitalTwinStore((s) => s.setParams);
  const reset = useDigitalTwinStore((s) => s.reset);
  const simulationSpeed = useDigitalTwinStore((s) => s.simulationSpeed);
  const setSimulationSpeed = useDigitalTwinStore((s) => s.setSimulationSpeed);
  const { motor, thermal, tachometer } = useLiveTelemetry();

  return (
    <div className="space-y-4">
      {/* Simulation controls */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber" />
            <h3 className="text-sm font-bold text-white">Simulation Controls</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setParams({ paused: !params.paused })}
              className={`p-1.5 rounded-lg border transition ${
                params.paused
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber/15 border-amber/30 text-amber'
              }`}
            >
              {params.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
            <button
              onClick={reset}
              className="p-1.5 rounded-lg border border-navy bg-[#0A0E1A] text-slate-400 hover:text-white transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Manual RPM override */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                Manual RPM Override
              </label>
              <span className="font-mono-data text-sm font-bold text-amber">
                {params.manualRPM > 0 ? params.manualRPM.toLocaleString() : 'AUTO'}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={15000}
              step={100}
              value={params.manualRPM}
              onChange={(e) => setParams({ manualRPM: Number(e.target.value) })}
              className="w-full accent-amber"
            />
            <div className="flex justify-between text-[9px] font-mono-data text-slate-600 mt-0.5">
              <span>0 (Auto PWM)</span>
              <span>7.5k</span>
              <span>15k</span>
            </div>
          </div>

          {/* Supply Voltage */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber" /> Supply Voltage
              </label>
              <span className="font-mono-data text-sm font-bold text-amber">{params.supplyVoltage}V</span>
            </div>
            <input
              type="range"
              min={3}
              max={24}
              step={0.5}
              value={params.supplyVoltage}
              onChange={(e) => setParams({ supplyVoltage: Number(e.target.value) })}
              className="w-full accent-amber"
            />
          </div>

          {/* Load Torque */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <Activity className="w-3 h-3 text-amber" /> Load Torque
              </label>
              <span className="font-mono-data text-sm font-bold text-amber">{params.loadTorque} N·m</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.15}
              step={0.005}
              value={params.loadTorque}
              onChange={(e) => setParams({ loadTorque: Number(e.target.value) })}
              className="w-full accent-amber"
            />
          </div>

          {/* Ambient Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-amber" /> Ambient Temp
              </label>
              <span className="font-mono-data text-sm font-bold text-amber">{params.ambientTemp}°C</span>
            </div>
            <input
              type="range"
              min={10}
              max={45}
              step={1}
              value={params.ambientTemp}
              onChange={(e) => setParams({ ambientTemp: Number(e.target.value) })}
              className="w-full accent-amber"
            />
          </div>

          {/* Simulation Speed */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber" /> Sim Speed
              </label>
              <span className="font-mono-data text-sm font-bold text-amber">{simulationSpeed}×</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={simulationSpeed}
              onChange={(e) => setSimulationSpeed(Number(e.target.value))}
              className="w-full accent-amber"
            />
          </div>
        </div>
      </div>

      {/* Live motor readouts */}
      <div className="bg-navy-card border border-navy rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-amber" />
          <h3 className="text-sm font-bold text-white">Live Motor Telemetry</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'RPM', value: motor.rpm.toFixed(1), unit: 'rev/min', color: '#F59E0B', icon: Gauge },
            { label: 'PWM Duty', value: `${(motor.dutyCycle * 100).toFixed(1)}%`, unit: '', color: '#A78BFA', icon: Activity },
            { label: 'Back-EMF', value: motor.backEmf.toFixed(2), unit: 'V', color: '#3B82F6', icon: Zap },
            { label: 'Current', value: (motor.current * 1000).toFixed(1), unit: 'mA', color: '#10B981', icon: Activity },
            { label: 'Torque', value: (motor.torque * 1000).toFixed(2), unit: 'mN·m', color: '#F97316', icon: Disc3 },
            { label: 'Direction', value: motor.direction === 1 ? 'FWD' : motor.direction === -1 ? 'REV' : 'STOP', unit: '', color: motor.direction === 0 ? '#6B7280' : '#10B981', icon: CircleDot },
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

        {/* Encoder readout */}
        <div className="mt-2 bg-[#0A0E1A]/60 border border-navy rounded-lg p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc3 className="w-3 h-3 text-purple-400" />
            <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">
              Encoder Pulses
            </span>
          </div>
          <span className="font-mono-data text-sm font-bold text-purple-400">
            {tachometer.pulseCount}
          </span>
        </div>
      </div>
    </div>
  );
}
