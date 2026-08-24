/**
 * ComponentInspector — detailed view of a selected hardware component.
 *
 * Shows pin configuration, operational status, simulation equations,
 * and technical specifications when the user clicks a component
 * in the3D scene.
 */
import { motion, AnimatePresence } from 'framer-motion';
import { X, Info, Cpu, Zap, Thermometer, Radio, Disc3 } from 'lucide-react';
import { useDigitalTwinStore } from '@/simulation/store';

interface ComponentInfo {
  name: string;
  description: string;
  icon: typeof Cpu;
  pins: { name: string; pin: string; direction: string; color: string }[];
  specs: { label: string; value: string }[];
  equations: string[];
}

const COMPONENTS: Record<string, ComponentInfo> = {
  arduino: {
    name: 'Arduino Uno R3',
    description: 'ATmega328P microcontroller running the virtual firmware at 16 MHz cycle-accurate emulation via AVR8js.',
    icon: Cpu,
    pins: [
      { name: 'D9 (PWM)', pin: 'Timer1 OCR1A', direction: 'OUTPUT', color: '#F59E0B' },
      { name: 'D10 (IN1)', pin: 'PORTB bit 2', direction: 'OUTPUT', color: '#10B981' },
      { name: 'D11 (IN2)', pin: 'PORTB bit 3', direction: 'OUTPUT', color: '#3B82F6' },
      { name: 'D2 (INT0)', pin: 'PORTD bit 2', direction: 'INPUT', color: '#A855F7' },
      { name: 'D5 (1-Wire)', pin: 'PORTD bit 5', direction: 'BIDIR', color: '#EF4444' },
    ],
    specs: [
      { label: 'MCU', value: 'ATmega328P' },
      { label: 'Clock', value: '16 MHz' },
      { label: 'Flash', value: '32 KB' },
      { label: 'SRAM', value: '2 KB' },
      { label: 'Emulation', value: 'AVR8js Web Worker' },
    ],
    equations: [
      'PWM: D9 = Timer1 OCR1A / 255 × V_supply',
      'ISR(INT0): pulse_count++ on D2 falling edge',
      'OneWire: 480µs reset → presence → 0xBE read',
    ],
  },
  l298n: {
    name: 'L298N Dual H-Bridge',
    description: 'Motor driver module with onboard 5V regulator. ENA jumper must be removed for PWM speed control.',
    icon: Zap,
    pins: [
      { name: 'ENA', pin: 'D9 (PWM)', direction: 'INPUT', color: '#F59E0B' },
      { name: 'IN1', pin: 'D10', direction: 'INPUT', color: '#10B981' },
      { name: 'IN2', pin: 'D11', direction: 'INPUT', color: '#3B82F6' },
      { name: 'OUT1', pin: 'Motor +', direction: 'OUTPUT', color: '#10B981' },
      { name: 'OUT2', pin: 'Motor -', direction: 'OUTPUT', color: '#3B82F6' },
    ],
    specs: [
      { label: 'Driver IC', value: 'L298N' },
      { label: 'Max Voltage', value: '46V' },
      { label: 'Max Current', value: '2A per channel' },
      { label: 'Logic Voltage', value: '5V' },
      { label: 'PWM Frequency', value: '~490 Hz (default)' },
    ],
    equations: [
      'V_eff = (OCR1A / 255) × V_supply × dir',
      'IN1=1, IN2=0 → Forward (+V)',
      'IN1=0, IN2=1 → Reverse (-V)',
      'IN1=IN2 → Brake (0V)',
    ],
  },
  motor: {
    name: 'DC Motor + Encoder',
    description: 'High-voltage DC motor with slotted optical encoder disk for RPM measurement.',
    icon: Disc3,
    pins: [
      { name: 'Terminal +', pin: 'OUT1 (L298N)', direction: 'POWER', color: '#10B981' },
      { name: 'Terminal -', pin: 'OUT2 (L298N)', direction: 'POWER', color: '#3B82F6' },
      { name: 'Encoder OUT', pin: 'D2 (INT0)', direction: 'SIGNAL', color: '#A855F7' },
    ],
    specs: [
      { label: 'Type', value: 'Brushed DC' },
      { label: 'No-Load Speed', value: '15,000 RPM' },
      { label: 'Stall Torque', value: '0.12 N·m' },
      { label: 'Encoder Slots', value: '20' },
      { label: 'Shaft Diameter', value: '2mm' },
    ],
    equations: [
      'J·dω/dt + bω = Kt·I - τ_load',
      'I = (V_eff - Ke·ω) / Ra',
      'RPM = ω × 60 / (2π)',
    ],
  },
};

export default function ComponentInspector() {
  const selectedComponent = useDigitalTwinStore((s) => s.selectedComponent);
  const setSelectedComponent = useDigitalTwinStore((s) => s.setSelectedComponent);

  const info = selectedComponent ? COMPONENTS[selectedComponent] : null;

  return (
    <AnimatePresence>
      {info && (
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute top-4 right-4 z-30 w-80 bg-[#0F1629]/95 backdrop-blur-xl border border-navy rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-navy">
            <div className="flex items-center gap-2">
              <info.icon className="w-4 h-4 text-amber" />
              <span className="text-sm font-bold text-white">{info.name}</span>
            </div>
            <button
              onClick={() => setSelectedComponent(null)}
              className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Description */}
          <div className="px-4 py-3 text-[11px] text-slate-400 leading-relaxed border-b border-navy/50">
            {info.description}
          </div>

          {/* Pin Configuration */}
          <div className="px-4 py-3 border-b border-navy/50">
            <h4 className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">
              Pin Configuration
            </h4>
            <div className="space-y-1">
              {info.pins.map((pin) => (
                <div key={pin.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: pin.color }} />
                    <span className="font-bold text-white">{pin.name}</span>
                  </div>
                  <span className="font-mono-data text-slate-500">{pin.pin}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-navy text-slate-400">
                    {pin.direction}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Technical Specs */}
          <div className="px-4 py-3 border-b border-navy/50">
            <h4 className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">
              Specifications
            </h4>
            <div className="space-y-1">
              {info.specs.map((spec) => (
                <div key={spec.label} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{spec.label}</span>
                  <span className="font-mono-data font-bold text-white">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Equations */}
          <div className="px-4 py-3">
            <h4 className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2 flex items-center gap-1">
              <Info className="w-3 h-3" /> Governing Equations
            </h4>
            <div className="space-y-1">
              {info.equations.map((eq, i) => (
                <div key={i} className="text-[10px] font-mono-data text-amber/80 bg-[#0A0E1A]/50 px-2 py-1 rounded">
                  {eq}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
