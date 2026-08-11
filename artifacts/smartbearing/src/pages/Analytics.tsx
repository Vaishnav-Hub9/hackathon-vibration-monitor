import { useState, useEffect } from 'react';
import DashLayout from '@/components/layout/DashLayout';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceArea
} from 'recharts';
import {
  FileDown, TrendingUp, Gauge, Thermometer, Timer, ShieldAlert, Activity, Sigma
} from 'lucide-react';
import { motion } from 'framer-motion';
import { machinesApi, analyticsApi } from '@/lib/api';
import { generatePDFReport } from '@/utils/printReport';

type BearingTrend = {
  range: string;
  days: number;
  points: { date: string; t: number; vibration: number; temperature: number; health: number }[];
  phases: { key: string; name: string; from: number; to: number; description: string }[];
  stats: {
    peakVibration: number; meanVibration: number; meanTemperature: number;
    stdDeviation: number; kurtosis: number; peakToPeak: number; movingAverage30d: number;
    rulDecayRate: number; degradationIndex: number;
  } | null;
  summary: string;
};

const PHASE_COLORS: Record<string, string> = {
  baseline: '#10B981',
  microcrack: '#F59E0B',
  wear: '#EA580C',
};

const RANGES = [
  { key: '1m', label: '1 Month' },
  { key: '6m', label: '6 Months' },
  { key: '1y', label: '1 Year' },
];

export default function Analytics() {
  const [calcInputs, setCalcInputs] = useState({ machines: 8, valPerHour: 1500, downtime: 4, incidents: 2 });
  const [exporting, setExporting] = useState(false);
  const [machineList, setMachineList] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ totalMachines: 0, avgHealthScore: 0, alertsToday: 0 });
  const [roiData, setRoiData] = useState<any>({ preventedFailures: 0, estimatedSavings: 0, downtimePrevented: 0 });
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [fleetChartData, setFleetChartData] = useState<any[]>([]);
  const [alertBarData, setAlertBarData] = useState<any[]>([]);

  // ---- Bearing trend state (Feature: 1-year historical ball-bearing trend) ----
  const [range, setRange] = useState<string>('1y');
  const [machineId, setMachineId] = useState<string>('');
  const [bearing, setBearing] = useState<BearingTrend | null>(null);
  const [bearingLoading, setBearingLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [machinesRes, summaryRes, roiRes, heatmapRes, trendsRes, monthlyRes] = await Promise.all([
          machinesApi.getAll(),
          analyticsApi.getSummary(),
          analyticsApi.getROI(),
          analyticsApi.getHeatmap(),
          analyticsApi.getTrends(),
          analyticsApi.getMonthly()
        ]);
        if (!isMounted) return;
        setMachineList(machinesRes.data.data);
        setSummary(summaryRes.data.data);
        setRoiData(roiRes.data.data);
        setHeatmapData(heatmapRes.data.data);

        // Real 30-day fleet trajectory from the trends endpoint
        const trends = trendsRes.data.data || [];
        const chart = trends.map((d: any) => ({ day: `D${d.day}`, 'Fleet Average': d.avgHealth ?? 0 }));
        setFleetChartData(chart);

        // Real 12-month alert data from the monthly endpoint
        setAlertBarData(monthlyRes.data.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  // Bearing trend — refetch when the time horizon or target machine changes
  useEffect(() => {
    let isMounted = true;
    setBearingLoading(true);
    analyticsApi.getBearingTrend(range, machineId)
      .then((res) => { if (isMounted) setBearing(res.data.data); })
      .catch((err) => { if (isMounted) console.error(err); })
      .finally(() => { if (isMounted) setBearingLoading(false); });
    return () => { isMounted = false; };
  }, [range, machineId]);

  const saved = calcInputs.machines * calcInputs.valPerHour * calcInputs.downtime * calcInputs.incidents * 0.8;

  function handleExport() {
    setExporting(true);
    setTimeout(() => {
      generatePDFReport();
      setExporting(false);
    }, 200);
  }

  const lineColors = ['#10B981', '#EA580C', '#3B82F6'];
  const gradientIds = ['color1', 'color3', 'color4'];
  const gradientColors = ['#10B981', '#EA580C', '#3B82F6'];
  const machineNames = fleetChartData.length > 0 ? Object.keys(fleetChartData[0]).filter(k => k !== 'day') : [];

  // Sparse x-axis date ticks for the trend chart (avoid label crowding)
  const pts = bearing?.points || [];
  const tickStep = Math.max(1, Math.floor(pts.length / 6));
  const dateTicks = pts.filter((_, i) => i % tickStep === 0).map((p) => p.date);

  const kpiCards = bearing?.stats ? [
    { label: 'Peak Vibration Amplitude', val: `${bearing.stats.peakVibration} g`, icon: Gauge, color: '#EA580C', note: `vs ${bearing.stats.meanVibration} g mean` },
    { label: 'Mean Temperature Trend', val: `${bearing.stats.meanTemperature}°C`, icon: Thermometer, color: '#3B82F6', note: 'bearing housing, fleet avg' },
    { label: 'RUL Decay Rate', val: `${bearing.stats.rulDecayRate}%/mo`, icon: Timer, color: '#F59E0B', note: 'remaining useful life lost per month' },
    { label: 'Degradation Index', val: `${bearing.stats.degradationIndex}/100`, icon: ShieldAlert, color: bearing.stats.degradationIndex > 60 ? '#EA580C' : bearing.stats.degradationIndex > 30 ? '#F59E0B' : '#10B981', note: bearing.stats.degradationIndex > 60 ? 'replacement window' : bearing.stats.degradationIndex > 30 ? 'early wear detected' : 'healthy band' },
  ] : [];

  return (
    <DashLayout>
      <div className="space-y-6" id="analytics-content">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-white tracking-wide">Fleet Analytics & ROI</h1>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: exporting ? '#1E2D4A' : 'linear-gradient(135deg,#F59E0B,#D97706)',
              color: exporting ? '#64748b' : '#0A0E1A',
            }}
          >
            <FileDown className="w-4 h-4" />
            {exporting ? 'Preparing…' : 'Export PDF Report'}
          </motion.button>
        </div>

        {/* ══════════════ Bearing 1-year degradation trend (new) ══════════════ */}
        <div className="bg-navy-card border border-navy rounded-xl p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Ball Bearing Degradation Trend</h2>
              <p className="text-xs text-slate-500 mt-1">
                Historical vibration vs. housing temperature, with degradation phases. Anchored on live stored readings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Time horizon selector */}
              <div className="flex items-center bg-[#0A0E1A] border border-navy rounded-lg p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRange(r.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      range === r.key ? 'bg-gradient-to-r from-amber to-[#EA580C] text-[#0A0E1A]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {/* Machine selector */}
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="bg-[#0A0E1A] border border-navy rounded-lg px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber/50"
              >
                <option value="">All Fleet (avg)</option>
                {machineList.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Phase legend */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            {(bearing?.phases || []).map((ph) => (
              <span key={ph.key} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PHASE_COLORS[ph.key] }} />
                {ph.name}
              </span>
            ))}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {kpiCards.map((k, i) => (
              <motion.div
                key={k.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <k.icon className="w-4 h-4" style={{ color: k.color }} />
                  <span className="text-[11px] text-slate-400">{k.label}</span>
                </div>
                <div className="font-mono-data text-2xl font-bold" style={{ color: k.color }}>{k.val}</div>
                <div className="text-[10px] text-slate-500 mt-1">{k.note}</div>
              </motion.div>
            ))}
          </div>

          {/* Dual-axis trend chart with degradation phase bands */}
          <div className="h-72 sm:h-80">
            {bearingLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">Computing degradation trend…</div>
            ) : pts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">{bearing?.summary || 'No data yet.'}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pts} margin={{ top: 10, right: 0, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
                  <XAxis dataKey="date" ticks={dateTicks} stroke="#64748B" fontSize={10} tickLine={false} />
                  <YAxis yAxisId="vib" stroke="#EA580C" fontSize={10} tickLine={false} unit=" g" />
                  <YAxis yAxisId="temp" orientation="right" stroke="#3B82F6" fontSize={10} tickLine={false} unit="°C" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px' }}
                    itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }}
                    formatter={(value: any, name: string) => [value, name]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  {(bearing?.phases || []).map((ph) => (
                    <ReferenceArea
                      key={ph.key}
                      yAxisId="vib"
                      x1={ph.from}
                      x2={ph.to}
                      fill={PHASE_COLORS[ph.key]}
                      fillOpacity={0.08}
                      stroke={PHASE_COLORS[ph.key]}
                      strokeOpacity={0.25}
                      strokeDasharray="4 4"
                    />
                  ))}
                  <Line yAxisId="vib" type="monotone" dataKey="vibration" name="Vibration (g)" stroke="#EA580C" strokeWidth={2.5} dot={false} activeDot={{ r: 3 }} />
                  <Line yAxisId="temp" type="monotone" dataKey="temperature" name="Temperature (°C)" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Statistical summary & insight panel */}
        {bearing?.stats && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="bg-navy-card border border-navy rounded-xl p-5 lg:col-span-1">
              <h3 className="text-sm font-medium text-slate-300 mb-4">Statistical Summary <span className="text-slate-500 font-mono-data text-xs ml-1">(past {bearing.days} days)</span></h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Moving Avg (30d)', val: `${bearing.stats.movingAverage30d} g`, icon: Activity },
                  { label: 'Std Deviation', val: `±${bearing.stats.stdDeviation} g`, icon: Sigma },
                  { label: 'Kurtosis', val: `${bearing.stats.kurtosis}`, icon: Sigma, hint: bearing.stats.kurtosis > 3 ? 'heavy-tailed · impacts' : 'near-Gaussian' },
                  { label: 'Peak-to-Peak', val: `${bearing.stats.peakToPeak} g`, icon: Gauge },
                ].map((s, i) => (
                  <div key={s.label} className="bg-[#0A0E1A]/60 border border-navy rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <s.icon className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[10px] text-slate-500">{s.label}</span>
                    </div>
                    <div className="font-mono-data text-lg font-bold text-white">{s.val}</div>
                    {s.hint && <div className="text-[10px] text-slate-500 mt-0.5">{s.hint}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-[#0F1629] to-[#141E35] border border-amber/20 rounded-xl p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-amber" />
                <h3 className="text-sm font-medium text-slate-200">Auto-Generated Wear Summary</h3>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{bearing.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(bearing.phases || []).map((ph) => (
                  <div key={ph.key} className="text-[11px] text-slate-400 border border-navy rounded-lg px-3 py-2 flex-1 min-w-[200px]">
                    <span className="font-bold" style={{ color: PHASE_COLORS[ph.key] }}>{ph.name}</span>
                    <span className="text-slate-600 mx-1">·</span>
                    {ph.description}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6 KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Machines', val: summary.totalMachines },
            { label: 'Sensor Uptime', val: `${summary.sensorUptime ?? 0}%` },
            { label: 'Failures Prevented', val: roiData.preventedFailures },
            { label: 'Downtime Saved', val: `${roiData.downtimePrevented ?? 0}h` },
            { label: 'Cost Saved', val: `₹${roiData.estimatedSavings.toLocaleString()}`, color: 'text-[#10B981]' },
            { label: 'Avg Health', val: `${summary.avgHealthScore}%`, color: 'text-amber' }
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-navy-card border border-navy p-4 rounded-xl text-center"
            >
              <div className="text-xs text-slate-400 mb-2">{s.label}</div>
              <div className={`text-xl font-mono-data font-bold ${s.color || 'text-white'}`}>{s.val}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Fleet Health Area Chart */}
          <div className="bg-navy-card border border-navy p-5 rounded-xl">
            <h3 className="text-sm font-medium text-slate-300 mb-6">Fleet Health Trajectory (30 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={fleetChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    {gradientIds.map((id, idx) => (
                      <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={gradientColors[idx]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={gradientColors[idx]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="day" stroke="#64748B" fontSize={10} tickLine={false} interval={4} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px' }} itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  {machineNames.map((name, idx) => (
                    <Area key={name} type="monotone" dataKey={name} stroke={lineColors[idx % lineColors.length]} fillOpacity={1} fill={`url(#${gradientIds[idx % gradientIds.length]})`} strokeWidth={2} dot={false} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Heatmap */}
          <div className="bg-navy-card border border-navy p-5 rounded-xl">
            <h3 className="text-sm font-medium text-slate-300 mb-6">Alert Intensity Heatmap (28 Days)</h3>
            <div className="grid grid-cols-7 gap-2">
              {['M','T','W','T','F','S','S'].map((d, i) => <div key={i} className="text-center text-xs text-slate-500">{d}</div>)}
              {heatmapData.map((d: any, i: number) => {
                const colors = ['bg-[#0A0E1A]', 'bg-[#1E2D4A]', 'bg-[#F59E0B]/50', 'bg-[#EA580C]/80', 'bg-[#EA580C]'];
                return (
                  <div key={i} title={`Day ${i + 1}: ${d.intensity} alerts`}
                    className={`aspect-square rounded-sm ${colors[d.intensity] || colors[0]} border border-navy/50 hover:ring-1 hover:ring-amber/40 transition-all cursor-default`}>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-slate-500">
              <span>Less</span>
              <div className="w-3 h-3 rounded-sm bg-[#0A0E1A] border border-navy"></div>
              <div className="w-3 h-3 rounded-sm bg-[#1E2D4A]"></div>
              <div className="w-3 h-3 rounded-sm bg-[#F59E0B]/50"></div>
              <div className="w-3 h-3 rounded-sm bg-[#EA580C]"></div>
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Monthly alert bar chart */}
        <div className="bg-navy-card border border-navy p-5 rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-medium text-slate-300">Monthly Alert & Prevention Trends</h3>
            <div className="flex items-center gap-1.5 text-xs text-[#10B981] font-mono-data">
              <TrendingUp className="w-3.5 h-3.5" /> Prevention rate improving
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alertBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(30,45,74,0.5)' }} contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px' }} itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Critical" stackId="a" fill="#EA580C" radius={[0,0,2,2]} />
                <Bar dataKey="Warning" stackId="a" fill="#F59E0B" />
                <Bar dataKey="Prevented" fill="#10B981" radius={[4,4,2,2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Machine health table */}
        <div className="bg-navy-card border border-navy rounded-xl overflow-hidden">
          <div className="p-5 border-b border-navy">
            <h3 className="text-sm font-medium text-slate-300">Machine Health Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy">
                  {['ID', 'Machine', 'Status', 'Risk Score', 'Spindles', 'Sensors', 'Location'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-slate-500 uppercase tracking-wider font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {machineList.map((m, i) => {
                  const healthColor = m.healthScore < 50 ? '#EA580C' : m.healthScore < 80 ? '#F59E0B' : '#10B981';
                  return (
                    <tr key={m.id} className={`border-b border-navy/50 hover:bg-[#0A0E1A] transition-colors ${i % 2 === 0 ? '' : 'bg-[#0A0E1A]/30'}`}>
                      <td className="px-5 py-3 font-mono-data text-xs text-slate-400">{m.id}</td>
                      <td className="px-5 py-3 text-white font-medium">{m.name}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          m.status === 'critical' ? 'bg-[#2B0D0A] text-[#EA580C]' :
                          m.status === 'warning' ? 'bg-[#2B1D0A] text-[#F59E0B]' : 'bg-[#0D2B1F] text-[#10B981]'
                        }`}>{m.status?.toUpperCase()}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-[#0A0E1A] h-1.5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${m.healthScore}%`, background: healthColor }}></div>
                          </div>
                          <span className="font-mono-data text-xs font-bold" style={{ color: healthColor }}>{m.healthScore}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono-data text-xs text-slate-300">{m.totalSpindles}</td>
                      <td className="px-5 py-3 font-mono-data text-xs text-slate-300">{m.activeSensors || 5}</td>
                      <td className="px-5 py-3 text-xs text-slate-500">{m.location}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ROI Calculator */}
        <div className="bg-gradient-to-r from-[#0F1629] to-[#141E35] border border-amber/20 p-8 rounded-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-amber/5 rounded-full blur-3xl"></div>
          <h2 className="font-display text-2xl font-bold text-white mb-2 relative z-10">ROI & Cost Savings Calculator</h2>
          <p className="text-slate-400 text-sm mb-8 relative z-10">Adjust parameters based on your factory's metrics to estimate monthly savings.</p>

          <div className="grid md:grid-cols-2 gap-12 relative z-10">
            <div className="space-y-6">
              {[
                { label: 'Monitored Machines', key: 'machines', min: 1, max: 100, step: 1 },
                { label: 'Production Value per Hour (₹)', key: 'valPerHour', min: 500, max: 10000, step: 100 },
                { label: 'Avg. Downtime per Failure (Hrs)', key: 'downtime', min: 1, max: 24, step: 1 },
                { label: 'Historical Failures per Month', key: 'incidents', min: 1, max: 20, step: 1 },
              ].map(input => (
                <div key={input.key}>
                  <div className="flex justify-between text-sm mb-2">
                    <label className="text-slate-300">{input.label}</label>
                    <span className="font-mono-data text-amber">{calcInputs[input.key as keyof typeof calcInputs]}</span>
                  </div>
                  <input
                    type="range"
                    className="w-full accent-amber"
                    min={input.min} max={input.max} step={input.step}
                    value={calcInputs[input.key as keyof typeof calcInputs]}
                    onChange={(e) => setCalcInputs({ ...calcInputs, [input.key]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-col justify-center items-center p-8 bg-[#0A0E1A]/50 border border-navy rounded-xl">
              <div className="text-slate-400 mb-2 text-sm">Estimated Monthly Savings</div>
              <motion.div
                key={saved}
                initial={{ scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-mono-data font-bold text-[#10B981] mb-4"
              >
                ₹{saved.toLocaleString()}
              </motion.div>
              <div className="text-xs text-slate-500 text-center mb-4">Based on 80% predictive prevention rate vs run-to-failure strategy.</div>
              <button onClick={handleExport} className="text-xs text-amber hover:underline flex items-center gap-1">
                <FileDown className="w-3 h-3" /> Download full report
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashLayout>
  );
}
