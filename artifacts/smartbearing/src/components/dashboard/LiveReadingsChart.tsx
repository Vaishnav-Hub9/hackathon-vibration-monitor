import { useState, useEffect, useRef } from 'react';
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { getSocket } from '@/lib/socket';

/**
 * LiveReadingsChart — a real-time strip tied to the ARDUINO<->COMPUTER
 * connection. It listens to `hardware:update` WebSocket events (the same
 * stream the Hardware Lab uses):
 *
 *  - Live PWM (connection heartbeat) — from Arduino frames (source: arduino).
 *    Sits at 150 while the board streams; the moment the connection drops
 *    (USB unplugged / serial dead), a 3.5 s watchdog flips the chart OFFLINE
 *    and the feed stops — no more points are appended.
 *  - Temperature (dataset) — from the simulator reference frames, so the
 *    second curve stays meaningful while the rig's sensors are in progress.
 */

type LivePoint = {
  t: string;
  pwm: number | null;
  temperature: number | null;
  rpm: number | null;
};

const OFFLINE_AFTER_MS = 3500;

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function LiveReadingsChart({
  maxPoints = 60,
  height = 200,
}: {
  maxPoints?: number;
  height?: number;
}) {
  const [points, setPoints] = useState<LivePoint[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [readingCount, setReadingCount] = useState(0);
  const buffer = useRef<LivePoint[]>([]);
  const lastArduinoAt = useRef(0);

  useEffect(() => {
    let isMounted = true;
    let watchdog: number | undefined;
    const socket = getSocket();

    const checkLiveness = () => {
      if (!isMounted) return;
      const alive = Date.now() - lastArduinoAt.current < OFFLINE_AFTER_MS;
      setIsLive(alive && socket.connected);
    };

    const onConnect = () => {
      if (Date.now() - lastArduinoAt.current < OFFLINE_AFTER_MS) setIsLive(true);
    };
    const onDisconnect = () => setIsLive(false);
    const onHardwareUpdate = (data: any) => {
      if (!data || typeof data.rpm !== 'number') return;
      // Arduino and dataset frames alternate (2/s), so carry the last known
      // value of each series forward — otherwise the two lines fragment into
      // single-point gaps and render flat/invisible.
      const prev = buffer.current[buffer.current.length - 1];
      const point: LivePoint = {
        t: fmtTime(new Date()),
        pwm: prev?.pwm ?? null,
        temperature: prev?.temperature ?? null,
        rpm: prev?.rpm ?? null,
      };
      if (data.source === 'arduino') {
        // Live connection heartbeat from the physical rig.
        lastArduinoAt.current = Date.now();
        point.pwm = Math.round(data.motorSpeed ?? 0);
        point.rpm = typeof data.rpm === 'number' ? Math.round(data.rpm) : prev?.rpm ?? null;
        point.temperature = typeof data.temperature === 'number' ? +data.temperature.toFixed(1) : prev?.temperature ?? null;
        setIsLive(true);
      } else if (data.source === 'manual') {
        // Operator-entered readings plot on the same curves so manual entries
        // visibly move the graph and appear on the fleet dashboard.
        point.rpm = Math.round(data.rpm);
        if (typeof data.temperature === 'number' && data.temperature > 0) {
          point.temperature = +data.temperature.toFixed(1);
        }
      } else if (data.source === 'simulator') {
        // Dataset reference temperature.
        point.temperature = typeof data.temperature === 'number' ? +data.temperature.toFixed(1) : null;
      } else {
        return;
      }
      buffer.current = [...buffer.current, point].slice(-maxPoints);
      setPoints(buffer.current);
      setReadingCount((c) => c + 1);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('hardware:update', onHardwareUpdate);
    if (socket.connected && Date.now() - lastArduinoAt.current < OFFLINE_AFTER_MS) setIsLive(true);

    watchdog = window.setInterval(checkLiveness, 1000);

    return () => {
      isMounted = false;
      if (watchdog) window.clearInterval(watchdog);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('hardware:update', onHardwareUpdate);
    };
  }, [maxPoints]);

  const hasData = points.length > 0;
  const hasPwm = points.some((p) => p.pwm !== null);
  const hasTemp = points.some((p) => p.temperature !== null);
  const hasRpm = points.some((p) => p.rpm !== null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-300">Live Sensor Stream — Arduino Connection</h3>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono-data text-slate-500">
            {readingCount > 0 ? `${readingCount} readings streamed` : 'waiting for readings…'}
          </span>
          <span
            className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isLive ? 'bg-[#0D2B1F] text-[#10B981]' : 'bg-[#2B0D0A] text-[#EA580C]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-[#10B981] animate-pulse' : 'bg-[#EA580C]'}`}
            />
            {isLive ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 5, right: 0, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
            <XAxis dataKey="t" stroke="#64748B" fontSize={9} tickLine={false} minTickGap={30} />
            <YAxis yAxisId="pwm" stroke="#A78BFA" fontSize={10} tickLine={false} unit="" domain={[0, 255]} />
            <YAxis yAxisId="temp" orientation="right" stroke="#3B82F6" fontSize={10} tickLine={false} unit="°C" domain={[0, (max: number) => Math.max(100, max)]} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px' }}
              itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}
              labelFormatter={(label) => `Time: ${label}`}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
            {hasPwm && (
              <Line yAxisId="pwm" type="monotone" dataKey="pwm" name="Connection (PWM)" stroke="#A78BFA" strokeWidth={2} dot={false} isAnimationActive={false} />
            )}
            {hasTemp && (
              <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#3B82F6" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            )}
            {hasRpm && (
              <Line yAxisId="pwm" type="monotone" dataKey="rpm" name="RPM" stroke="#F59E0B" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!hasData && (
        <p className="text-[11px] text-slate-500 mt-2">
          Streams the Arduino↔computer connection (PWM heartbeat) plus dataset temperature over WebSocket. Connect the rig and it moves every second.
        </p>
      )}
      {hasData && !isLive && (
        <p className="text-[11px] text-[#EA580C] mt-2 font-medium">
          ⏹ Connection lost — the feed has stopped. Reconnect the Arduino to resume.
        </p>
      )}
    </div>
  );
}
