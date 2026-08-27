/**
 * ThermalChart — real-time line chart for the Mechanical Digital Twin thermal tab.
 *
 * Plots bearing temperature (°C), friction power (mW), and dissipation (mW)
 * over a rolling 2-minute window. Samples the PhysicsEngine at 1 fps.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';
import { engine } from '@/simulation/engineRef';

const MAX_SAMPLES = 120; // 2 minutes at 1 sample/sec

interface ThermalSample {
  t: string;           // elapsed time label "0:05"
  temp: number;        // bearing temp °C
  friction: number;    // friction power mW
  dissipation: number; // dissipation mW
  netHeat: number;     // net heat mW
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Custom tooltip */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0A0E1A] border border-navy rounded-lg px-3 py-2 shadow-xl">
      <div className="text-[10px] font-mono-data text-slate-400 mb-1">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 text-[11px] font-mono-data">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-400">{entry.name}:</span>
          <span style={{ color: entry.color }} className="font-bold">
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ThermalChart() {
  const [data, setData] = useState<ThermalSample[]>([]);
  const elapsedRef = useRef(0);
  const lastSampleRef = useRef(0);

  const sample = useCallback(() => {
    const snap = engine.getMechanicalSnapshot();
    const now = performance.now();

    // Sample at 1 fps
    if (now - lastSampleRef.current < 1000) return;
    lastSampleRef.current = now;

    if (!snap.isRunning) return; // don't collect while stopped

    elapsedRef.current += 1;

    const newSample: ThermalSample = {
      t: formatElapsed(elapsedRef.current),
      temp: +snap.bearingTemp.toFixed(1),
      friction: +snap.frictionPower.toFixed(1),
      dissipation: +snap.dissipationPower.toFixed(1),
      netHeat: +(snap.frictionPower - snap.dissipationPower).toFixed(1),
    };

    setData((prev) => {
      const next = [...prev, newSample];
      return next.length > MAX_SAMPLES ? next.slice(-MAX_SAMPLES) : next;
    });
  }, []);

  // Reset data when spindle stops
  const wasRunning = useRef(false);
  const resetCheck = useCallback(() => {
    const snap = engine.getMechanicalSnapshot();
    if (wasRunning.current && !snap.isRunning) {
      // Just stopped — keep last data for reference, but stop sampling
      elapsedRef.current = 0;
    }
    wasRunning.current = snap.isRunning;
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      sample();
      resetCheck();
    }, 200); // check 5x/sec, sample 1x/sec
    return () => clearInterval(intervalId);
  }, [sample, resetCheck]);

  const hasData = data.length > 2;

  return (
    <div className="w-full" style={{ height: 220 }}>
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradFriction" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradDissip" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
            <XAxis
              dataKey="t"
              tick={{ fill: '#64748B', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={{ stroke: '#1E293B' }}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="temp"
              orientation="left"
              tick={{ fill: '#F59E0B', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              label={{
                value: '°C',
                position: 'insideTopLeft',
                offset: 10,
                style: { fill: '#F59E0B', fontSize: 9 },
              }}
            />
            <YAxis
              yAxisId="power"
              orientation="right"
              tick={{ fill: '#64748B', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              label={{
                value: 'mW',
                position: 'insideTopRight',
                offset: 10,
                style: { fill: '#64748B', fontSize: 9 },
              }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              iconType="circle"
              iconSize={6}
            />
            <ReferenceLine
              yAxisId="temp"
              y={60}
              stroke="#F97316"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: 'Warning', fill: '#F97316', fontSize: 8, position: 'right' }}
            />
            <ReferenceLine
              yAxisId="temp"
              y={100}
              stroke="#EF4444"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: 'Critical', fill: '#EF4444', fontSize: 8, position: 'right' }}
            />
            <Area
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              name="Bearing Temp"
              stroke="#F59E0B"
              strokeWidth={2}
              fill="url(#gradTemp)"
              dot={false}
              animationDuration={0}
            />
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="friction"
              name="Friction Power"
              stroke="#EF4444"
              strokeWidth={1.5}
              fill="url(#gradFriction)"
              dot={false}
              animationDuration={0}
            />
            <Area
              yAxisId="power"
              type="monotone"
              dataKey="dissipation"
              name="Dissipation"
              stroke="#3B82F6"
              strokeWidth={1.5}
              fill="url(#gradDissip)"
              dot={false}
              animationDuration={0}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-[11px] text-slate-500 font-mono-data">
          Start the spindle to see real-time thermal data
        </div>
      )}
    </div>
  );
}
