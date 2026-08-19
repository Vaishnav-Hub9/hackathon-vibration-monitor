import DashLayout from '@/components/layout/DashLayout';
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from 'recharts';
import {
  Gauge, Thermometer, Zap, ShieldAlert, Activity, Wrench, Cpu, Radio, Waves, Database, Unplug
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useHardwareStream } from '@/hooks/useHardwareStream';

const COLOUR_HEX: Record<string, string> = {
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EA580C',
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/**
 * HardwareLab — live Arduino rig + dataset analytics.
 *
 * The LIVE signal is the Arduino's PWM command (motorSpeed) — the one reliable
 * real-time reading from the rig. It flatlines and the page flips OFFLINE
 * within ~3.5 s of the board going silent (motor off / USB dropped / serial
 * dead). The RPM / temperature / verdict analytics panels are populated from
 * the dataset stream (backend reference history) since the rig's tach and
 * DS18B20 wiring may still be in progress.
 */
export default function HardwareLab() {
  const { liveReadings, datasetReadings, liveLatest, datasetLatest, isLive, online, lastSource } = useHardwareStream();

  const liveChartData = liveReadings.map((r) => ({
    t: fmtTime(r.timestamp),
    pwm: r.motorSpeed,
  }));

  // Analytics chart from the dataset (simulator reference) stream only, so it
  // never alternates with the rig's in-progress sensor values.
  const datasetChartData = datasetReadings.map((r) => ({
    t: fmtTime(r.timestamp),
    rpm: r.rpm,
    temperature: r.temperature ?? null,
  }));

  const latest = datasetLatest ?? liveLatest;
  const verdictHex = latest ? COLOUR_HEX[latest.colour] ?? '#10B981' : '#64748B';
  const healthPct = latest ? Math.round(latest.health_index * 100) : 0;
  const sourceLabel = lastSource === 'arduino' ? 'ARDUINO RIG' : lastSource === 'simulator' ? 'DATASET' : '—';
  // The live PWM is the Arduino<->laptop connection heartbeat: 150 while the
  // board streams, and the feed stops only when the connection itself drops.
  const pwmChip = online && isLive ? 'LIVE' : 'STOPPED';
  const pwmChipStyle = online && isLive
    ? 'bg-[#0D2B1F] text-[#10B981]'
    : 'bg-[#2B0D0A] text-[#EA580C]';

  const kpis = [
    {
      label: 'Motor PWM Command',
      val: liveLatest ? liveLatest.motorSpeed.toFixed(0) : (latest ? latest.motorSpeed.toFixed(0) : '—'),
      unit: '/ 255 PWM',
      icon: Zap,
      color: '#A78BFA',
      note: liveLatest
        ? 'connection heartbeat — 150 = Arduino streaming over USB'
        : 'no live frame yet',
      live: true,
    },
    {
      label: 'Tachometer RPM',
      val: latest ? latest.rpm.toFixed(1) : '—',
      unit: 'rev/min',
      icon: Gauge,
      color: '#F59E0B',
      note: 'dataset · 1 pulse/rev, D2 INT0',
    },
    {
      label: 'DS18B20 Temperature',
      val: latest && latest.temperature !== null ? latest.temperature.toFixed(1) : '—',
      unit: '°C',
      icon: Thermometer,
      color: latest && latest.temperature !== null && latest.temperature > 60 ? '#EA580C' : '#3B82F6',
      note: 'dataset · probe on D5',
    },
    {
      label: 'Health Index',
      val: String(healthPct),
      unit: '/ 100',
      icon: ShieldAlert,
      color: verdictHex,
      note: latest?.verdict ?? '—',
    },
  ];

  return (
    <DashLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white tracking-wide">Hardware Lab — Arduino Motor Rig</h1>
            <p className="text-xs text-slate-500 mt-1">
              Live PWM command from the physical Arduino · analytics from the reference dataset · real-time offline detection.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full border ${
                online && isLive ? 'bg-[#0D2B1F] text-[#10B981] border-[#10B981]/30' : 'bg-[#2B0D0A] text-[#EA580C] border-[#EA580C]/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${online && isLive ? 'bg-[#10B981] animate-pulse' : 'bg-[#EA580C]'}`} />
              {online && isLive ? 'LIVE STREAM' : 'OFFLINE'}
            </span>
            <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${lastSource === 'simulator' ? 'bg-[#2B1D0A] text-[#F59E0B] border-[#F59E0B]/30' : 'bg-[#0D2B1F] text-[#10B981] border-[#10B981]/30'}`}>
              {sourceLabel}
            </span>
          </div>
        </div>

        {/* Real-time disconnect banner */}
        {!online && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-[#2B0D0A] border border-[#EA580C]/40 text-[#EA580C] px-4 py-3 rounded-xl text-sm font-medium"
          >
            <Unplug className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <div>
              <span className="font-bold">Arduino connection lost</span>
              <span className="text-[#f0b28a]"> — the live feed has stopped (motor off / USB dropped / serial link dead). Reconnect the board to resume.</span>
            </div>
          </motion.div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-navy-card border border-navy rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <k.icon className="w-4 h-4" style={{ color: k.color }} />
                <span className="text-[11px] text-slate-400">{k.label}</span>
                {(k as any).live && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${pwmChipStyle}`}>
                    {pwmChip}
                  </span>
                )}
              </div>
              <div className="font-mono-data text-2xl font-bold text-white">
                {k.val} <span className="text-xs text-slate-500 font-sans font-medium">{k.unit}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{k.note}</div>
            </motion.div>
          ))}
        </div>

        {/* Dataset analytics chart — stable reference RPM + temperature */}
        <div className="bg-navy-card border border-navy p-5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Waves className="w-4 h-4 text-amber" /> Dataset Analytics — RPM &amp; Temperature
            </h3>
            <span className="text-[11px] font-mono-data text-slate-500">
              {datasetReadings.length} dataset samples · reference stream
            </span>
          </div>
          <div className="h-64">
            {datasetChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                Collecting dataset samples…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={datasetChartData} margin={{ top: 5, right: 0, left: -14, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
                  <XAxis dataKey="t" stroke="#64748B" fontSize={9} tickLine={false} minTickGap={50} />
                  <YAxis yAxisId="rpm" stroke="#F59E0B" fontSize={10} tickLine={false} domain={[1200, 1700]} />
                  <YAxis yAxisId="temp" orientation="right" stroke="#3B82F6" fontSize={10} tickLine={false} unit="°C" domain={[20, 60]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px' }}
                    itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Line yAxisId="rpm" type="monotone" dataKey="rpm" name="RPM (dataset)" stroke="#F59E0B" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#3B82F6" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Reference dataset stream (simulator) — stable RPM ~1440 with load-cycle temperature drift, independent of the rig's in-progress sensor wiring.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Live PWM chart (Arduino only — flatlines on disconnect) */}
          <div className="bg-navy-card border border-navy p-5 rounded-xl lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber" /> Live PWM Feedback (Arduino)
              </h3>
              <span className="text-[11px] font-mono-data text-slate-500">
                {liveReadings.length} samples ·              {online && isLive ? '1 Hz · 150 PWM' : 'STOPPED'}
              </span>
            </div>
            <div className="h-72">
              {liveReadings.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-500">
                  {online ? 'Waiting for the first live frame from the Arduino…' : 'No live frames — rig offline.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={liveChartData} margin={{ top: 5, right: 0, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
                    <XAxis dataKey="t" stroke="#64748B" fontSize={9} tickLine={false} minTickGap={40} />
                    <YAxis stroke="#A78BFA" fontSize={10} tickLine={false} domain={[0, 255]} unit="" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px' }}
                      itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Line type="monotone" dataKey="pwm" name="Motor PWM Command" stroke="#A78BFA" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            {!online ? (
              <p className="text-[11px] text-[#EA580C] mt-3 font-medium">
                ⏹ Connection lost — the feed stops and holds flat at the last PWM value until the Arduino reconnects.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 mt-3">
                Live frames only from the physical rig (<span className="font-mono text-slate-400">source: arduino</span>). The PWM value is the Arduino↔laptop connection heartbeat — it stays at 150 while the board streams and the feed flatlines within ~3.5 s if the connection drops.
              </p>
            )}
          </div>

          {/* Verdict + feature analysis (dataset) */}
          <div className="bg-gradient-to-br from-[#0F1629] to-[#141E35] border border-navy rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-medium text-slate-200">Anomaly Verdict</h3>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#141E35] text-slate-400 border border-navy ml-auto">DATASET</span>
            </div>

            <div
              className="rounded-xl p-4 mb-4 border"
              style={{
                background: `${verdictHex}14`,
                borderColor: `${verdictHex}40`,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">Model says</span>
                <span className="font-mono-data text-xl font-bold" style={{ color: verdictHex }}>
                  {latest?.verdict ?? 'WAITING'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 bg-[#0A0E1A] h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${healthPct}%`, background: verdictHex }}
                  />
                </div>
                <span className="font-mono-data text-sm font-bold" style={{ color: verdictHex }}>{healthPct}%</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-2">
                Health index from the dataset stream (IsolationForest on the rig, reference profile in dataset mode).
              </div>
            </div>

            {/* 30 s rolling-window feature stats */}
            <h4 className="text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-2">30 s Rolling Window Features</h4>
            <div className="space-y-2">
              {[
                { label: 'rpm_mean', val: latest ? latest.rpm_mean.toFixed(1) : '—', hint: 'average shaft speed' },
                { label: 'rpm_std', val: latest ? latest.rpm_std.toFixed(2) : '—', hint: 'speed wobble (jitter)' },
                { label: 'temp_mean', val: latest ? `${latest.temp_mean.toFixed(2)} °C` : '—', hint: 'mean housing temp' },
                { label: 'temp rate of change', val: latest ? `${latest.temp_rate_of_change >= 0 ? '+' : ''}${latest.temp_rate_of_change.toFixed(3)} °C/s` : '—', hint: 'thermal slope over window' },
                { label: 'rpm_temp_ratio', val: latest ? latest.rpm_temp_ratio.toFixed(1) : '—', hint: 'RPM ÷ temp coupling' },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between bg-[#0A0E1A]/60 border border-navy rounded-lg px-3 py-2">
                  <div>
                    <div className="font-mono-data text-xs font-bold text-white">{f.label}</div>
                    <div className="text-[10px] text-slate-500">{f.hint}</div>
                  </div>
                  <span className="font-mono-data text-sm font-bold text-amber">{f.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wiring map + pipeline explainer */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-navy-card border border-navy rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-medium text-slate-300">Arduino Wiring Map</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy">
                    {['Component', 'Pin', 'Arduino'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] text-slate-500 uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['L298N driver', 'ENA (PWM)', 'D9'],
                    ['L298N driver', 'IN1 / IN2', 'D10 / D11'],
                    ['IR tachometer (LM393)', 'OUT', 'D2 (INT0, FALLING)'],
                    ['DS18B20', 'DATA', 'D5 (OneWire)'],
                    ['DS18B20', 'VCC', '5V rail (breadboard)'],
                    ['12 V supply', 'GND', 'shared ground'],
                  ].map((row, i) => (
                    <tr key={i} className={`border-b border-navy/50 ${i % 2 === 0 ? '' : 'bg-[#0A0E1A]/30'}`}>
                      <td className="px-3 py-2 font-mono-data text-xs text-slate-300">{row[0]}</td>
                      <td className="px-3 py-2 font-mono-data text-xs text-slate-400">{row[1]}</td>
                      <td className="px-3 py-2"><span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#141E35] text-amber border border-amber/20">{row[2]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Full hardware build, firmware and Python pipeline live in <span className="font-mono text-slate-400">hardware/</span> (motor_monitor.ino + main.py).
            </p>
          </div>

          <div className="bg-navy-card border border-navy rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Waves className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-medium text-slate-300">Data Path &amp; Analysis</h3>
            </div>
            <div className="space-y-3">
              {[
                { icon: Zap, step: 'Sense', text: 'The Arduino streams its PWM command (motorSpeed = 150) every second at 9600 baud — the live signal is the Arduino↔laptop connection itself, not the motor.' },
                { icon: Database, step: 'Dataset', text: 'RPM, temperature and verdict analytics come from the backend reference dataset instead of the in-progress sensor wiring, so the page always shows meaningful values.' },
                { icon: Radio, step: 'Sync', text: 'Frames are pushed to /api/hardware/ingest and broadcast over WebSocket. A 3.5 s watchdog flips the page OFFLINE in real time the instant the board stops sending.' },
                { icon: Activity, step: 'Analyse', text: 'Window features (rpm_mean, rpm_std, temp_mean, temp slope °C/s, rpm/temp ratio) feed the dual anomaly engine: hard thresholds (temp > 60 °C, RPM drop > 30 %) plus an IsolationForest health index.' },
                { icon: ShieldAlert, step: 'Act', text: 'BEARING FAULT / SEVERE trips a red verdict and the rig is flagged for inspection; every sample is logged to predictive_maintenance_log.csv.' },
              ].map((s) => (
                <div key={s.step} className="flex gap-3 bg-[#0A0E1A]/60 border border-navy rounded-lg p-3">
                  <s.icon className="w-4 h-4 text-amber flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-white mb-0.5">{s.step}</div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashLayout>
  );
}
