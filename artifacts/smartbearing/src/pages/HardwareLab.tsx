import DashLayout from '@/components/layout/DashLayout';
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
  Area, AreaChart
} from 'recharts';
import {
  Gauge, Thermometer, Zap, ShieldAlert, Activity, Wrench, Cpu, Radio, Waves, Database, Unplug,
  PenLine, Timer, CircleDot, ArrowRight
} from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useHardwareStream } from '@/hooks/useHardwareStream';
import { hardwareApi } from '@/lib/api';

const COLOUR_HEX: Record<string, string> = {
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EA580C',
};

const SOURCE_STYLE: Record<string, { label: string; cls: string }> = {
  arduino: { label: 'ARDUINO RIG', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  manual: { label: 'MANUAL ENTRY', cls: 'bg-violet-500/10 text-violet-300 border-violet-400/30' },
  simulator: { label: 'DATASET', cls: 'bg-amber-500/10 text-amber border-amber/30' },
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
 * within ~3.5 s of the board going silent. RPM / temperature prefer real rig
 * values when streaming, then manual operator entries, then the reference
 * dataset stream.
 */
export default function HardwareLab() {
  const { liveReadings, datasetReadings, manualReadings, liveLatest, datasetLatest, manualLatest, isLive, online, lastSource } = useHardwareStream();

  // ── Manual entry form state (operator-entered gauge readings) ──
  const [mRpm, setMRpm] = useState('');
  const [mTemp, setMTemp] = useState('');
  const [mBusy, setMBusy] = useState(false);
  const [mMsg, setMMsg] = useState<string | null>(null);

  const submitManual = async () => {
    const rpm = parseFloat(mRpm);
    if (!Number.isFinite(rpm)) {
      setMMsg('RPM is required');
      return;
    }
    const temp = mTemp.trim() === '' ? null : parseFloat(mTemp);
    setMBusy(true);
    setMMsg(null);
    try {
      await hardwareApi.submitManual({ rpm, temperature: temp });
      setMMsg('Reading submitted ✓');
      setMRpm('');
      setMTemp('');
    } catch {
      setMMsg('Submit failed — check the API server');
    } finally {
      setMBusy(false);
    }
  };

  // Combined live feed: Arduino frames carry the PWM heartbeat; manual entries
  // plot their RPM/temperature on the same timeline so operator submissions
  // visibly move every graph.
  const liveChartData = [...liveReadings, ...manualReadings]
    .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
    .map((r) => ({
      t: fmtTime(r.timestamp),
      pwm: r.source === 'arduino' ? r.motorSpeed : null,
      rpm: r.rpm,
      temperature: r.temperature ?? null,
      source: r.source,
    }));

  const latest =
    (online && liveLatest && liveLatest.rpm > 0 ? liveLatest : null) ??
    manualLatest ?? datasetLatest ?? liveLatest;
  const latestSource = latest === liveLatest ? 'arduino' : latest === manualLatest ? 'manual' : 'dataset';
  const srcStyle = SOURCE_STYLE[lastSource ?? 'simulator'] ?? SOURCE_STYLE.simulator;
  const sensorSrcLabel = latestSource === 'arduino' ? 'LIVE RIG' : latestSource === 'manual' ? 'MANUAL' : 'DATASET';

  const verdictHex = latest ? COLOUR_HEX[latest.colour] ?? '#10B981' : '#64748B';
  const healthPct = latest ? Math.round(latest.health_index * 100) : 0;

  // The live PWM is the Arduino<->laptop connection heartbeat.
  const pwmChip = online && isLive ? 'LIVE' : 'STOPPED';
  const pwmChipStyle = online && isLive
    ? 'bg-emerald-500/10 text-emerald-400'
    : 'bg-red-500/10 text-orange-400';

  const secondsSinceLast = latest ? Math.round((Date.now() - new Date(latest.timestamp).getTime()) / 1000) : null;

  return (
    <DashLayout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-white tracking-wide">Hardware Lab</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-navy border border-navy text-slate-400 uppercase tracking-widest">
                Arduino Motor Rig
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live telemetry from the physical rig · anomaly verdicts · operator fallback entry · real-time offline detection
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full border ${
                online && isLive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-orange-400 border-orange-500/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${online && isLive ? 'bg-emerald-400 animate-pulse' : 'bg-orange-500'}`} />
              {online && isLive ? 'RIG ONLINE' : 'RIG OFFLINE'}
            </div>
            <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border ${srcStyle.cls}`}>
              {srcStyle.label}
            </span>
            {secondsSinceLast !== null && (
              <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono-data text-slate-500 px-3 py-1.5 rounded-full bg-navy border border-navy">
                <Timer className="w-3 h-3" /> last frame {secondsSinceLast}s ago
              </span>
            )}
          </div>
        </div>

        {/* ── Verdict hero + disconnect banner ── */}
        {!online ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-gradient-to-r from-red-950/60 to-transparent border border-orange-500/40 text-orange-400 px-4 py-3 rounded-xl text-sm"
          >
            <Unplug className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <div>
              <span className="font-bold">Arduino connection lost</span>
              <span className="text-orange-200/70"> — the live feed has stopped (motor off / USB dropped / serial link dead). Reconnect the board or use manual entry below.</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-xl border px-5 py-4"
            style={{ background: `linear-gradient(90deg, ${verdictHex}1A, transparent 70%)`, borderColor: `${verdictHex}45` }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${online && isLive ? '' : 'opacity-70'}`}
                  style={{ background: `${verdictHex}22`, border: `1px solid ${verdictHex}55` }}
                >
                  <ShieldAlert className="w-6 h-6" style={{ color: verdictHex }} />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Current machine verdict</div>
                  <div className="font-display text-xl font-bold truncate" style={{ color: verdictHex }}>
                    {latest?.verdict ?? 'WAITING FOR FIRST FRAME'}
                  </div>
                </div>
              </div>
              <div className="text-right hidden md:block">
                <div className="font-mono-data text-3xl font-bold" style={{ color: verdictHex }}>{healthPct}<span className="text-sm">%</span></div>
                <div className="text-[10px] uppercase tracking-widest text-slate-500">health index</div>
              </div>
            </div>
            <div className="mt-3 h-1.5 bg-[#0A0E1A] rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${healthPct}%` }}
                transition={{ duration: 0.6 }}
                style={{ background: `linear-gradient(90deg, ${verdictHex}88, ${verdictHex})` }}
              />
            </div>
          </motion.div>
        )}

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Motor PWM Command',
              val: liveLatest ? liveLatest.motorSpeed.toFixed(0) : (latest ? latest.motorSpeed.toFixed(0) : '—'),
              unit: '/ 255',
              icon: Zap,
              color: '#A78BFA',
              note: online && isLive ? 'connection heartbeat · Arduino streaming' : 'no live frame yet',
              badge: pwmChip,
              badgeCls: pwmChipStyle,
            },
            {
              label: 'Tachometer RPM',
              val: latest ? latest.rpm.toFixed(1) : '—',
              unit: 'rev/min',
              icon: Gauge,
              color: '#F59E0B',
              note: latestSource === 'arduino' ? 'IR tach · D2 (INT0)' : latestSource === 'manual' ? 'operator-entered reading' : 'dataset reference · D2 INT0',
              badge: sensorSrcLabel,
              badgeCls: 'bg-navy text-slate-400',
            },
            {
              label: 'DS18B20 Temperature',
              val: latest && latest.temperature !== null ? latest.temperature.toFixed(1) : '—',
              unit: '°C',
              icon: Thermometer,
              color: latest && latest.temperature !== null && latest.temperature > 60 ? '#EA580C' : '#3B82F6',
              note: latestSource === 'arduino' ? 'OneWire probe on D5' : latestSource === 'manual' ? 'operator-entered reading' : 'dataset reference · probe on D5',
              badge: sensorSrcLabel,
              badgeCls: 'bg-navy text-slate-400',
            },
            {
              label: 'Health Index',
              val: String(healthPct),
              unit: '/ 100',
              icon: ShieldAlert,
              color: verdictHex,
              note: latest?.verdict ?? '—',
              badge: sensorSrcLabel,
              badgeCls: 'bg-navy text-slate-400',
            },
          ].map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -2 }}
              className="relative overflow-hidden bg-navy-card border border-navy rounded-xl p-4 hover:border-slate-600/50 transition-colors"
            >
              <div
                className="absolute top-0 left-0 right-0 h-0.5"
                style={{ background: `linear-gradient(90deg, ${k.color}, transparent)` }}
              />
              <div className="flex items-center gap-2 mb-2">
                <k.icon className="w-4 h-4" style={{ color: k.color }} />
                <span className="text-[11px] text-slate-400 truncate">{k.label}</span>
                <span className={`ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${k.badgeCls}`}>
                  {k.badge}
                </span>
              </div>
              <div className="font-mono-data text-2xl font-bold text-white tabular-nums">
                {k.val} <span className="text-xs text-slate-500 font-sans font-medium">{k.unit}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1 truncate">{k.note}</div>
            </motion.div>
          ))}
        </div>

        {/* ── Charts row ── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Live PWM chart */}
          <div className="bg-navy-card border border-navy p-5 rounded-xl lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Radio className="w-4 h-4 text-amber" /> Live Feed — PWM · RPM · Temperature
              </h3>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${pwmChipStyle}`}>{pwmChip}</span>
                <span className="text-[11px] font-mono-data text-slate-500">{liveReadings.length} samples · 1 Hz</span>
              </div>
            </div>
            <div className="h-64">
              {liveChartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-sm text-slate-500 gap-2">
                  <CircleDot className="w-6 h-6 opacity-40" />
                  No readings yet — connect the rig or submit a manual entry below.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={liveChartData} margin={{ top: 5, right: 4, left: -14, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pwmFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#A78BFA" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
                    <XAxis dataKey="t" stroke="#64748B" fontSize={9} tickLine={false} minTickGap={40} />
                    <YAxis yAxisId="pwm" stroke="#A78BFA" fontSize={10} tickLine={false} domain={[0, 255]} />
                    <YAxis yAxisId="val" orientation="right" stroke="#F59E0B" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px', fontSize: '12px' }}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                    <Area yAxisId="pwm" type="monotone" dataKey="pwm" name="Motor PWM (rig)" stroke="#A78BFA" strokeWidth={2} fill="url(#pwmFill)" dot={false} isAnimationActive={false} connectNulls />
                    <Line yAxisId="val" type="monotone" dataKey="rpm" name="RPM" stroke="#F59E0B" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} connectNulls />
                    <Line yAxisId="val" type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#3B82F6" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            {!online ? (
              <p className="text-[11px] text-orange-400 mt-3 font-medium">
                ⏹ Connection lost — the feed holds flat at the last PWM value until the Arduino reconnects.
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 mt-3">
                Frames only from the physical rig (<span className="font-mono text-slate-400">source: arduino</span>) — flatlines within ~3.5 s if the serial link drops.
              </p>
            )}
          </div>

          {/* Verdict + feature analysis */}
          <div className="bg-gradient-to-br from-[#101a30] to-[#141E35] border border-navy rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-medium text-slate-200">Anomaly Verdict</h3>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ml-auto ${(SOURCE_STYLE[latestSource] ?? SOURCE_STYLE.simulator).cls}`}>
                {(SOURCE_STYLE[latestSource] ?? SOURCE_STYLE.simulator).label}
              </span>
            </div>

            <div className="rounded-xl p-4 mb-4 border bg-[#0A0E1A]/60" style={{ borderColor: `${verdictHex}40` }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">Model says</span>
                <span className="font-mono-data text-lg font-bold" style={{ color: verdictHex }}>
                  {latest?.verdict ?? '—'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 bg-[#0A0E1A] h-2 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${healthPct}%` }}
                    transition={{ duration: 0.6 }}
                    style={{ background: verdictHex }}
                  />
                </div>
                <span className="font-mono-data text-sm font-bold tabular-nums" style={{ color: verdictHex }}>{healthPct}%</span>
              </div>
            </div>

            <h4 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold mb-2">30 s Rolling Window Features</h4>
            <div className="space-y-1.5">
              {[
                { label: 'rpm_mean', val: latest ? latest.rpm_mean.toFixed(1) : '—', hint: 'average shaft speed' },
                { label: 'rpm_std', val: latest ? latest.rpm_std.toFixed(2) : '—', hint: 'speed wobble (jitter)' },
                { label: 'temp_mean', val: latest ? `${latest.temp_mean.toFixed(2)} °C` : '—', hint: 'mean housing temp' },
                { label: 'temp_rate_of_change', val: latest ? `${latest.temp_rate_of_change >= 0 ? '+' : ''}${latest.temp_rate_of_change.toFixed(3)} °C/s` : '—', hint: 'thermal slope over window' },
                { label: 'rpm_temp_ratio', val: latest ? latest.rpm_temp_ratio.toFixed(1) : '—', hint: 'RPM ÷ temp coupling' },
              ].map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between bg-[#0A0E1A]/60 border border-navy rounded-lg px-3 py-2 hover:border-slate-600/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-mono-data text-xs font-bold text-white truncate">{f.label}</div>
                    <div className="text-[10px] text-slate-500">{f.hint}</div>
                  </div>
                  <span className="font-mono-data text-sm font-bold text-amber tabular-nums pl-2">{f.val}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Dataset analytics chart ── */}
        <div className="bg-navy-card border border-navy p-5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Waves className="w-4 h-4 text-amber" /> Reference Analytics — RPM &amp; Temperature
            </h3>
            <span className="text-[11px] font-mono-data text-slate-500">{datasetReadings.length} dataset samples</span>
          </div>
          <div className="h-64">
            {datasetChartData(datasetReadings).length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">Collecting dataset samples…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={datasetChartData(datasetReadings)} margin={{ top: 5, right: 0, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tempFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
                  <XAxis dataKey="t" stroke="#64748B" fontSize={9} tickLine={false} minTickGap={50} />
                  <YAxis yAxisId="rpm" stroke="#F59E0B" fontSize={10} tickLine={false} domain={[1200, 1700]} />
                  <YAxis yAxisId="temp" orientation="right" stroke="#3B82F6" fontSize={10} tickLine={false} unit="°C" domain={[20, 60]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Line yAxisId="rpm" type="monotone" dataKey="rpm" name="RPM (dataset)" stroke="#F59E0B" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Area yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature °C" stroke="#3B82F6" strokeWidth={2} fill="url(#tempFill)" dot={false} isAnimationActive={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Simulator reference stream — stable RPM ~1440 with load-cycle temperature drift, independent of the rig's live sensors.
          </p>
        </div>

        {/* ── Manual entry ── */}
        <div className="bg-navy-card border border-navy rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <PenLine className="w-4 h-4 text-amber" />
            <h3 className="text-sm font-medium text-slate-300">Manual Reading Entry</h3>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-400/30">FALLBACK INPUT</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-4">
            No serial bridge running? Enter the tachometer / thermometer readings by hand — values flow through the same ingest → verdict → WebSocket path as Arduino frames.
          </p>
          <form
            className="flex flex-col sm:flex-row sm:items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitManual();
            }}
          >
            <div className="flex-1">
              <label htmlFor="manual-rpm" className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">RPM (required)</label>
              <input
                id="manual-rpm"
                type="number"
                min="0"
                placeholder="e.g. 1440"
                value={mRpm}
                onChange={(e) => setMRpm(e.target.value)}
                className="w-full bg-[#0A0E1A] border border-navy rounded-lg px-3 py-2 text-sm font-mono-data text-white outline-none focus:border-amber/50 focus:ring-1 focus:ring-amber/20 transition"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="manual-temp" className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">Temperature °C (optional)</label>
              <input
                id="manual-temp"
                type="number"
                placeholder="e.g. 42.5"
                value={mTemp}
                onChange={(e) => setMTemp(e.target.value)}
                className="w-full bg-[#0A0E1A] border border-navy rounded-lg px-3 py-2 text-sm font-mono-data text-white outline-none focus:border-amber/50 focus:ring-1 focus:ring-amber/20 transition"
              />
            </div>
            <button
              type="submit"
              disabled={mBusy}
              className="inline-flex items-center gap-2 bg-amber text-[#0A0E1A] font-bold text-sm px-5 py-2.5 rounded-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition cursor-pointer"
            >
              <Activity className="w-4 h-4" />
              {mBusy ? 'Submitting…' : 'Submit reading'}
            </button>
          </form>
          {mMsg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`text-xs mt-2 font-medium ${mMsg.includes('✓') ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {mMsg}
            </motion.div>
          )}
        </div>

        {/* ── Wiring map + pipeline explainer ── */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-navy-card border border-navy rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-medium text-slate-300">Arduino Wiring Map</h3>
              <span className="text-[10px] font-mono-data text-slate-500 ml-auto">Uno R3 · L298N rig</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-navy/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0A0E1A]/60">
                    {['Component', 'Pin', 'Arduino'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] text-slate-500 uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['L298N driver', 'ENA (PWM)', 'D9'],
                    ['L298N driver', 'IN1 / IN2', 'D10 / D11'],
                    ['IR tachometer (LM393)', 'OUT', 'D2 (INT0)'],
                    ['DS18B20 probe', 'DATA', 'D5 (OneWire)'],
                    ['DS18B20 probe', 'VCC', '5V rail'],
                    ['12 V supply', 'GND', 'shared ground'],
                  ].map((row, i) => (
                    <tr key={i} className={`border-t border-navy/50 ${i % 2 === 0 ? 'bg-transparent' : 'bg-[#0A0E1A]/30'} hover:bg-[#141E35]/60 transition-colors`}>
                      <td className="px-3 py-2 font-mono-data text-xs text-slate-300">{row[0]}</td>
                      <td className="px-3 py-2 font-mono-data text-xs text-slate-400">{row[1]}</td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber/10 text-amber border border-amber/20">{row[2]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Full build guide, firmware and Python pipeline in <span className="font-mono text-slate-400">hardware/</span> (motor_monitor.ino + main.py).
            </p>
          </div>

          <div className="bg-navy-card border border-navy rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Waves className="w-4 h-4 text-amber" />
              <h3 className="text-sm font-medium text-slate-300">Data Path &amp; Analysis</h3>
            </div>
            <div className="space-y-2">
              {[
                { icon: Zap, step: 'Sense', text: 'The Arduino streams its PWM command every second at 9600 baud — the live signal doubles as the Arduino↔laptop heartbeat.' },
                { icon: Database, step: 'Enrich', text: 'Bare rig frames are auto-enriched with window features and a threshold verdict so every panel always shows meaningful values.' },
                { icon: Radio, step: 'Sync', text: 'Frames POST to /api/hardware/ingest and broadcast over WebSocket (`hardware:update`). A 3.5 s watchdog flips the page OFFLINE instantly.' },
                { icon: Activity, step: 'Analyse', text: 'Rolling-window features (rpm_mean, rpm_std, temp slope, RPM/temp ratio) feed hard thresholds plus an IsolationForest health index.' },
                { icon: ShieldAlert, step: 'Act', text: 'BEARING FAULT / SEVERE trips a red verdict flagged for inspection; every sample logs to predictive_maintenance_log.csv.' },
              ].map((s, i, arr) => (
                <div key={s.step} className="relative flex gap-3 bg-[#0A0E1A]/60 border border-navy rounded-lg p-3">
                  <div className="flex flex-col items-center">
                    <s.icon className="w-4 h-4 text-amber flex-shrink-0 mt-0.5" />
                    {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-slate-700 rotate-90 mt-1" />}
                  </div>
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

function datasetChartData(readings: { timestamp: string; rpm: number; temperature: number | null }[]) {
  return readings.map((r) => ({
    t: fmtTime(r.timestamp),
    rpm: r.rpm,
    temperature: r.temperature ?? null,
  }));
}
