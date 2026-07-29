import { useState, useEffect } from 'react';
import DashLayout from '@/components/layout/DashLayout';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { FileDown, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { machinesApi, analyticsApi } from '@/lib/api';
import { generatePDFReport } from '@/utils/printReport';

export default function Analytics() {
  const [calcInputs, setCalcInputs] = useState({ machines: 8, valPerHour: 1500, downtime: 4, incidents: 2 });
  const [exporting, setExporting] = useState(false);
  const [machineList, setMachineList] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalMachines: 0,
    avgHealthScore: 0,
    alertsToday: 0,
  });
  const [roiData, setRoiData] = useState<any>({ preventedFailures: 0, estimatedSavings: 0, avgDowntimePrevented: 0 });
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [fleetChartData, setFleetChartData] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [machinesRes, summaryRes, roiRes, heatmapRes] = await Promise.all([
          machinesApi.getAll(),
          analyticsApi.getSummary(),
          analyticsApi.getROI(),
          analyticsApi.getHeatmap()
        ]);
        if (!isMounted) return;
        setMachineList(machinesRes.data.data);
        setSummary(summaryRes.data.data);
        setRoiData(roiRes.data.data);
        setHeatmapData(heatmapRes.data.data);

        // Generate fleet chart from real machines
        const machines = machinesRes.data.data.slice(0, 3);
        const chart = Array.from({ length: 30 }, (_, i) => {
          const entry: any = { day: `D${i + 1}` };
          machines.forEach((m: any, idx: number) => {
            const base = m.healthScore;
            const drift = idx === 1 ? -(i * 0.5) : 0; // degrading machine drops
            entry[m.name] = +(Math.max(20, base + drift + (Math.random() - 0.5) * 3)).toFixed(1);
          });
          return entry;
        });
        setFleetChartData(chart);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  const alertBarData = Array.from({ length: 12 }, (_, i) => ({
    month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
    Critical: Math.floor(Math.random() * 4),
    Warning: Math.floor(Math.random() * 8) + 1,
    Prevented: Math.floor(Math.random() * 6) + 2,
  }));

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

        {/* 6 KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Machines', val: summary.totalMachines },
            { label: 'Sensor Uptime', val: '94.2%' },
            { label: 'Failures Prevented', val: roiData.preventedFailures },
            { label: 'Downtime Saved', val: `${roiData.avgDowntimePrevented}h` },
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
                    <Area key={name} type="monotone" dataKey={name} stroke={lineColors[idx]} fillOpacity={1} fill={`url(#${gradientIds[idx]})`} strokeWidth={2} dot={false} />
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
                  {['ID', 'Machine', 'Status', 'Health Score', 'Spindles', 'Sensors', 'Location'].map(h => (
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
