import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { computeDefectFrequencies, DEFAULT_BEARING } from '@/lib/defectFrequencies';
import type { FaultType } from '@/components/digitaltwin/BearingVisualizer3D';
import { faultFrequencyHz, FAULT_LABELS } from '@/components/digitaltwin/BearingVisualizer3D';

const MAX_FREQ = 2000;
const STEP = 16;

interface SpectrumPoint {
  f: number;
  amp: number;
}

const FAULT_LINE_COLORS: Record<string, string> = {
  bpfo: '#EA580C',
  bpfi: '#F59E0B',
  bsf: '#A855F7',
  ftf: '#3B82F6',
  rpm: '#10B981',
};

function gaussian(x: number, center: number, height: number, bw: number) {
  return height * Math.exp(-Math.pow((x - center) / bw, 2));
}

/** Generate a live-looking spectrum: noise floor + RPM harmonics + fault-frequency harmonics surging with severity. */
function generateSpectrum(rpm: number, fault: FaultType, severity: number): SpectrumPoint[] {
  const df = computeDefectFrequencies(rpm, DEFAULT_BEARING);
  const sev = severity / 100;
  const faultFreq = faultFrequencyHz(rpm, fault);
  const points: SpectrumPoint[] = [];

  for (let f = 0; f <= MAX_FREQ; f += STEP) {
    let amp = 0.028 + Math.random() * 0.02; // noise floor

    // Rotating-speed harmonics (always present — 1×/2× RPM)
    amp += gaussian(f, df.fr, 0.22, 14);
    amp += gaussian(f, df.fr * 2, 0.09, 14);

    if (fault !== 'healthy' && faultFreq > 0) {
      // Fault harmonics surge with severity — 1×..4× of the defect frequency
      for (let h = 1; h <= 4; h++) {
        const target = faultFreq * h;
        if (target > MAX_FREQ) break;
        amp += gaussian(f, target, (sev * 0.9) / h, 12);
      }
      // Sidebands around the first harmonic
      amp += gaussian(f, faultFreq * 0.5, sev * 0.22, 10);
      amp += gaussian(f, faultFreq * 1.5, sev * 0.3, 10);
      amp += gaussian(f, faultFreq * 2.5, sev * 0.18, 10);
    }

    points.push({ f, amp: Math.min(1.3, +amp.toFixed(3)) });
  }
  return points;
}

export default function FFTPlot({ rpm, fault, severity }: { rpm: number; fault: FaultType; severity: number }) {
  const [data, setData] = useState<SpectrumPoint[]>(() => generateSpectrum(rpm, fault, severity));
  const paramsRef = useRef({ rpm, fault, severity });
  paramsRef.current = { rpm, fault, severity };

  // Animate: re-generate the spectrum ~10×/s with fresh noise so peaks shimmer
  useEffect(() => {
    const id = setInterval(() => {
      const p = paramsRef.current;
      setData(generateSpectrum(p.rpm, p.fault, p.severity));
    }, 110);
    return () => clearInterval(id);
  }, []);

  const df = useMemo(() => computeDefectFrequencies(rpm, DEFAULT_BEARING), [rpm]);

  const referenceLines = useMemo(() => {
    const lines: { key: string; freq: number; label: string; color: string }[] = [
      { key: 'rpm', freq: df.fr, label: '1×RPM', color: FAULT_LINE_COLORS.rpm },
      { key: 'bpfo', freq: df.bpfo, label: 'BPFO', color: FAULT_LINE_COLORS.bpfo },
      { key: 'bpfi', freq: df.bpfi, label: 'BPFI', color: FAULT_LINE_COLORS.bpfi },
      { key: 'bsf', freq: df.bsf, label: 'BSF', color: FAULT_LINE_COLORS.bsf },
      { key: 'ftf', freq: df.ftf, label: 'FTF', color: FAULT_LINE_COLORS.ftf },
    ];
    return lines.filter((l) => l.freq <= MAX_FREQ);
  }, [df]);

  return (
    <div className="w-full">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="fftFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00F0FF" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#00F0FF" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1E2D4A" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="f"
              type="number"
              domain={[0, MAX_FREQ]}
              tickFormatter={(v: number) => `${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#1E2D4A' }}
            />
            <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1.3]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0F1629', border: '1px solid #1E2D4A', borderRadius: '8px', fontFamily: 'JetBrains Mono', fontSize: '11px' }}
              labelFormatter={(v) => `${v} Hz`}
              formatter={(v: any) => [`${Number(v).toFixed(2)} g`, 'Amplitude']}
              cursor={{ stroke: '#F59E0B33' }}
            />
            {referenceLines.map((l) => (
              <ReferenceLine
                key={l.key}
                x={l.freq}
                stroke={l.color}
                strokeDasharray="4 3"
                strokeOpacity={0.75}
                label={{ value: l.label, position: 'insideTopRight', fill: l.color, fontSize: 9, fontFamily: 'JetBrains Mono' }}
              />
            ))}
            <Area
              type="monotone"
              dataKey="amp"
              stroke="#00F0FF"
              strokeWidth={1.6}
              fill="url(#fftFill)"
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Live frequency readouts */}
      <div className="grid grid-cols-5 gap-1.5 mt-3">
        {[
          { label: '1×RPM', value: df.fr, color: FAULT_LINE_COLORS.rpm },
          { label: 'BPFO', value: df.bpfo, color: FAULT_LINE_COLORS.bpfo },
          { label: 'BPFI', value: df.bpfi, color: FAULT_LINE_COLORS.bpfi },
          { label: 'BSF', value: df.bsf, color: FAULT_LINE_COLORS.bsf },
          { label: 'FTF', value: df.ftf, color: FAULT_LINE_COLORS.ftf },
        ].map((m) => (
          <div key={m.label} className="bg-[#0A0E1A]/70 border border-navy rounded-md px-1.5 py-1 text-center">
            <div className="text-[8px] uppercase tracking-widest text-slate-500 font-bold">{m.label}</div>
            <div className="font-mono-data text-[10px] font-bold" style={{ color: m.color }}>
              {m.value.toFixed(1)}Hz
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2 text-[9px] uppercase tracking-widest text-slate-500">
        <span>Spectrum · 0–2 kHz</span>
        <span className={fault === 'healthy' ? 'text-[#10B981]' : 'text-[#EA580C]'}>
          {fault === 'healthy' ? 'Healthy baseline' : `${FAULT_LABELS[fault]} @ ${faultFrequencyHz(rpm, fault).toFixed(0)} Hz`}
        </span>
      </div>
    </div>
  );
}
