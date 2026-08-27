/**
 * WiringDiagram — 2D schematic view of the SmartBearing bench wiring.
 *
 * Shows all component-to-component connections as labeled lines with
 * pin mappings, matching the physical build guide.
 */
import { motion } from 'framer-motion';
import { Cable, ArrowRight } from 'lucide-react';

const WIRES = [
  { from: 'Arduino D9', to: 'L298N ENA', color: '#F59E0B', label: 'PWM Speed', note: 'Timer1 OCR1A' },
  { from: 'Arduino D10', to: 'L298N IN1', color: '#10B981', label: 'Direction A', note: 'PORTB bit 2' },
  { from: 'Arduino D11', to: 'L298N IN2', color: '#3B82F6', label: 'Direction B', note: 'PORTB bit 3' },
  { from: 'L298N OUT1', to: 'Motor (+)', color: '#10B981', label: 'Motor Power +', note: 'V_eff applied' },
  { from: 'L298N OUT2', to: 'Motor (-)', color: '#3B82F6', label: 'Motor Power -', note: 'V_eff applied' },
  { from: 'Tachometer OUT', to: 'Arduino D2', color: '#A855F7', label: 'IR Pulse', note: 'INT0 external interrupt' },
  { from: 'Arduino D5', to: 'DS18B20 DQ', color: '#EF4444', label: 'OneWire Data', note: '4.7kΩ pull-up to 5V' },
  { from: 'Arduino 5V', to: 'DS18B20 VCC', color: '#EC4899', label: 'Sensor Power', note: '3.0–5.5V supply' },
  { from: 'Supply 12V+', to: 'L298N 12V', color: '#F97316', label: 'Motor Supply', note: '470µF + 100nF decoupling' },
  { from: 'Common GND', to: 'All GND', color: '#6B7280', label: 'Ground Bus', note: 'Must be common to all modules' },
];

const COMPONENTS = [
  { name: 'Arduino Uno', x: 10, y: 80, w: 20, h: 120, color: '#1a472a' },
  { name: 'L298N', x: 180, y: 60, w: 20, h: 160, color: '#1a237e' },
  { name: 'DC Motor', x: 340, y: 100, w: 20, h: 80, color: '#4a5568' },
  { name: 'Breadboard', x: 10, y: 240, w: 160, h: 40, color: '#f5f5f0' },
  { name: 'DS18B20', x: 50, y: 240, w: 16, h: 16, color: '#222' },
  { name: 'Tachometer', x: 320, y: 200, w: 24, h: 16, color: '#1a5276' },
  { name: '12V Supply', x: 120, y: 300, w: 24, h: 16, color: '#222' },
];

export default function WiringDiagram() {
  return (
    <div className="bg-navy-card border border-navy rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-navy">
        <Cable className="w-4 h-4 text-amber" />
        <h3 className="text-sm font-bold text-white">Wiring Diagram</h3>
        <span className="text-[9px] font-mono-data text-slate-500 ml-auto">
          {WIRES.length} connections
        </span>
      </div>

      {/* SVG Wiring Diagram */}
      <div className="p-4">
        <svg viewBox="0 0 400 340" className="w-full h-auto" style={{ maxHeight: '300px' }}>
          {/* Components */}
          {COMPONENTS.map((comp) => (
            <g key={comp.name}>
              <rect
                x={comp.x}
                y={comp.y}
                width={comp.w}
                height={comp.h}
                rx={4}
                fill={comp.color}
                stroke="#333"
                strokeWidth={1}
              />
              <text
                x={comp.x + comp.w / 2}
                y={comp.y - 6}
                textAnchor="middle"
                fill="#888"
                fontSize={8}
                fontFamily="JetBrains Mono, monospace"
              >
                {comp.name}
              </text>
            </g>
          ))}

          {/* Wire connections (simplified) */}
          {/* D9 → ENA */}
          <line x1={30} y1={100} x2={180} y2={90} stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 2" />
          {/* D10 → IN1 */}
          <line x1={30} y1={115} x2={180} y2={105} stroke="#10B981" strokeWidth={1.5} strokeDasharray="4 2" />
          {/* D11 → IN2 */}
          <line x1={30} y1={130} x2={180} y2={120} stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="4 2" />
          {/* OUT1 → Motor+ */}
          <line x1={200} y1={100} x2={340} y2={120} stroke="#10B981" strokeWidth={2} />
          {/* OUT2 → Motor- */}
          <line x1={200} y1={140} x2={340} y2={140} stroke="#3B82F6" strokeWidth={2} />
          {/* Tach → D2 */}
          <line x1={332} y1={200} x2={30} y2={90} stroke="#A855F7" strokeWidth={1.5} strokeDasharray="4 2" />
          {/* D5 → DS18B20 */}
          <line x1={30} y1={155} x2={58} y2={240} stroke="#EF4444" strokeWidth={1.5} strokeDasharray="4 2" />

          {/* Wire labels */}
          <text x={100} y={90} fill="#F59E0B" fontSize={6} fontFamily="JetBrains Mono">PWM</text>
          <text x={100} y={105} fill="#10B981" fontSize={6} fontFamily="JetBrains Mono">IN1</text>
          <text x={100} y={120} fill="#3B82F6" fontSize={6} fontFamily="JetBrains Mono">IN2</text>
          <text x={270} y={108} fill="#10B981" fontSize={6} fontFamily="JetBrains Mono">OUT1</text>
          <text x={270} y={138} fill="#3B82F6" fontSize={6} fontFamily="JetBrains Mono">OUT2</text>
          <text x={180} y={185} fill="#A855F7" fontSize={6} fontFamily="JetBrains Mono">INT0</text>
        </svg>
      </div>

      {/* Connection table */}
      <div className="px-4 pb-4">
        <div className="overflow-x-auto rounded-lg border border-navy/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0A0E1A]/60">
                {['From', '', 'To', 'Signal', 'Notes'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] text-slate-500 uppercase tracking-wider font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WIRES.map((wire, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0, x: 4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`border-t border-navy/50 ${i % 2 === 0 ? 'bg-transparent' : 'bg-[#0A0E1A]/30'}`}
                >
                  <td className="px-3 py-1.5 font-mono-data text-[11px] text-slate-300">{wire.from}</td>
                  <td className="px-1 py-1.5">
                    <ArrowRight className="w-3 h-3" style={{ color: wire.color }} />
                  </td>
                  <td className="px-3 py-1.5 font-mono-data text-[11px] text-slate-300">{wire.to}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${wire.color}15`, color: wire.color, border: `1px solid ${wire.color}30` }}
                    >
                      {wire.label}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-[10px] text-slate-500">{wire.note}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
