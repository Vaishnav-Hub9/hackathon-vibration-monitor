import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Link } from 'wouter';
import DashLayout from '@/components/layout/DashLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useCountUp } from '@/hooks/useCountUp';
import { useLiveSensors } from '@/hooks/useLiveSensors';
import { machinesApi, analyticsApi, alertsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Clock, Cpu, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WhatsAppAlert from '@/components/dashboard/WhatsAppAlert';

export default function Dashboard() {
  const [, setLocation] = useLocation();
  
  const [machines, setMachines] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    avgHealthScore: 0,
    estimatedSavings: 0,
    totalMachines: 0,
    alertsToday: 0
  });
  
  const fleetHealth = useCountUp(summary.avgHealthScore, 1500);
  const dtSaved = useCountUp(summary.estimatedSavings ? 18 : 0, 1500);
  const liveSensors = useLiveSensors();
  
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [machinesRes, summaryRes, alertsRes, roiRes] = await Promise.all([
          machinesApi.getAll(),
          analyticsApi.getSummary(),
          alertsApi.getAll({ status: 'active' }),
          analyticsApi.getROI()
        ]);
        
        if (!isMounted) return;
        
        setMachines(machinesRes.data.data);
        setAlerts(alertsRes.data.data);
        setSummary({
          ...summaryRes.data.data,
          estimatedSavings: roiRes.data.data.estimatedSavings
        });
        
        const top3 = machinesRes.data.data.slice(0, 3);
        if (top3.length >= 3) {
           const [h1, h2, h3] = await Promise.all([
             machinesApi.getHistory(top3[0].id, 24),
             machinesApi.getHistory(top3[1].id, 24),
             machinesApi.getHistory(top3[2].id, 24)
           ]);
           
           const d1 = h1.data.data.vibration;
           const d2 = h2.data.data.vibration;
           const d3 = h3.data.data.vibration;
           
           const combined = d1.map((d: any, i: number) => ({
             time: d.time,
             [top3[0].id]: +(d.value).toFixed(2),
             [top3[1].id]: +(d2[i]?.value || 0).toFixed(2),
             [top3[2].id]: +(d3[i]?.value || 0).toFixed(2)
           }));
           if (isMounted) setChartData(combined);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
    
    const socket = getSocket();
    
    const onFleetSummary = (data: any) => {
       setSummary((prev: any) => ({ ...prev, ...data }));
    };
    
    const onAlertNew = (alert: any) => {
       setAlerts(prev => [alert, ...prev]);
    };
    
    socket.on('fleet:summary', onFleetSummary);
    socket.on('alert:new', onAlertNew);
    
    return () => {
      isMounted = false;
      socket.off('fleet:summary', onFleetSummary);
      socket.off('alert:new', onAlertNew);
    };
  }, []);

  const allSensors = liveSensors.slice(0, 6);

  return (
    <DashLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-white tracking-wide">Fleet Overview</h1>

        {/* Row 1: KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-navy-card border border-navy p-5 rounded-xl flex flex-col justify-between">
            <span className="text-slate-400 text-sm font-medium">Fleet Health Score</span>
            <div className="flex items-end gap-3 mt-4">
              <span className="font-mono-data text-4xl font-bold text-amber">{fleetHealth}%</span>
            </div>
            <div className="w-full bg-[#0A0E1A] h-2 rounded-full mt-4 overflow-hidden">
              <div className="bg-amber h-full rounded-full transition-all duration-700" style={{ width: `${fleetHealth}%` }}></div>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="bg-navy-card border border-navy p-5 rounded-xl flex flex-col justify-between">
            <span className="text-slate-400 text-sm font-medium">Active Alerts</span>
            <div className="mt-4 flex gap-2">
              <span className="bg-[#2B0D0A] text-[#EA580C] border border-[#EA580C]/30 px-3 py-1 rounded-md text-lg font-bold font-mono-data">
                {alerts.filter(a => a.type === 'CRITICAL').length} Crit
              </span>
              <span className="bg-[#2B1D0A] text-[#F59E0B] border border-[#F59E0B]/30 px-3 py-1 rounded-md text-lg font-bold font-mono-data">
                {alerts.filter(a => a.type === 'WARNING').length} Warn
              </span>
            </div>
            <span className="text-xs text-slate-500 mt-4">Last 24 hours</span>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="bg-navy-card border border-navy p-5 rounded-xl flex flex-col justify-between">
            <span className="text-slate-400 text-sm font-medium">Downtime Prevented</span>
            <div className="mt-4">
              <span className="font-mono-data text-4xl font-bold text-[#10B981]">{dtSaved}</span>
              <span className="text-slate-400 ml-2">hrs</span>
            </div>
            <span className="text-xs text-[#10B981] mt-4 font-mono-data">
              Est. ₹{summary.estimatedSavings.toLocaleString()} saved
            </span>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.3}} className="bg-navy-card border border-navy p-5 rounded-xl flex flex-col justify-between">
            <span className="text-slate-400 text-sm font-medium">Sensor Network</span>
            <div className="mt-4">
              <span className="font-mono-data text-4xl font-bold text-white">{summary.totalMachines * 5}</span>
              <span className="text-slate-400 ml-2">nodes active</span>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full dot-healthy"></span> 100% Uptime
            </div>
          </motion.div>
        </div>

        {/* Live Sensor Feed */}
        <div className="bg-navy-card border border-navy rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-navy">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
              <h3 className="text-sm font-semibold text-white">Live Sensor Feed</h3>
              <span className="text-[10px] text-slate-500 font-mono-data">Live via Socket.io</span>
            </div>
            <Link href="/machine/M003" className="text-xs text-amber hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-navy min-h-[100px]">
            {allSensors.map(s => {
              const vColor = s.vibrationRMS > 3 ? '#EA580C' : s.vibrationRMS > 1.5 ? '#F59E0B' : '#10B981';
              const DeltaIcon = s.vibDelta > 0.02 ? TrendingUp : s.vibDelta < -0.02 ? TrendingDown : Minus;
              const deltaColor = s.vibDelta > 0.02 ? '#EA580C' : s.vibDelta < -0.02 ? '#10B981' : '#64748b';
              return (
                <div key={`${s.machineId}-${s.id}`} className="p-3 flex flex-col gap-1 min-w-0">
                  <div className="text-[10px] text-slate-500 font-mono-data truncate">{s.id}</div>
                  <div className="text-[10px] text-slate-400 truncate">{s.machineId}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={s.vibrationRMS}
                        initial={{ opacity: 0.4, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="font-mono-data text-sm font-bold"
                        style={{ color: vColor }}
                      >
                        {s.vibrationRMS.toFixed(2)}g
                      </motion.span>
                    </AnimatePresence>
                    <DeltaIcon className="w-3 h-3 flex-shrink-0" style={{ color: deltaColor }} />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-data">{s.temperature}°C</div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${
                    s.status === 'critical' ? 'text-[#EA580C]' : s.status === 'warning' ? 'text-[#F59E0B]' : 'text-[#10B981]'
                  }`}>{s.status.toUpperCase()}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2: Machines Grid */}
        <h2 className="font-display text-lg font-semibold text-white pt-2">Machine Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {machines.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} transition={{delay: 0.1 * i}}
              onClick={() => setLocation(`/machine/${m.id}`)}
              className="bg-navy-card border border-navy p-5 rounded-xl cursor-pointer card-hover relative overflow-hidden group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{m.name}</h3>
                  <p className="text-xs text-slate-400 font-mono-data mt-1">{m.id} | {m.totalSpindles || 400} Spindles</p>
                </div>
                <StatusBadge status={m.status} />
              </div>

              <div className="flex items-end justify-between mt-6">
                <div>
                  <div className="text-3xl font-mono-data font-bold" style={{ color: m.healthScore < 50 ? '#EA580C' : m.healthScore < 80 ? '#F59E0B' : '#10B981' }}>
                    {m.healthScore}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Health Score</div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-slate-300 font-mono-data text-sm">
                    <Cpu className="w-3 h-3" /> {m.activeSensors || 5}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Nodes Active</div>
                </div>
              </div>

              {m.lastAlert && (
                <div className="mt-4 pt-3 border-t border-navy/50 text-xs font-mono-data text-slate-400 flex items-center gap-2">
                  <Clock className="w-3 h-3" /> Last alert: {m.lastAlert}
                </div>
              )}

              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity text-amber text-sm font-medium flex items-center">
                View <Activity className="w-4 h-4 ml-1" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Row 3: Charts & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className="lg:col-span-2 bg-navy-card border border-navy p-5 rounded-xl">
            <h3 className="text-white font-bold mb-6">Fleet Vibration Trend (24h RMS)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis dataKey="time" stroke="#64748B" fontSize={12} tickLine={false} minTickGap={30} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F1629', border: '1px solid #1E2D4A', borderRadius: '8px', color: '#F1F5F9' }}
                    itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: '13px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <ReferenceLine y={1.5} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Warning', fill: '#F59E0B', fontSize: 10, position: 'insideTopLeft' }} />
                  <ReferenceLine y={3.0} stroke="#EA580C" strokeDasharray="3 3" label={{ value: 'Critical', fill: '#EA580C', fontSize: 10, position: 'insideTopLeft' }} />
                  {machines.slice(0, 3).map((m, i) => (
                     <Line key={m.id} type="monotone" dataKey={m.id} name={m.name} stroke={['#10B981', '#F59E0B', '#EA580C'][i]} strokeWidth={i === 2 ? 3 : 2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-navy-card border border-navy p-0 rounded-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-navy flex justify-between items-center">
              <h3 className="text-white font-bold">Recent Alerts</h3>
              <Link href="/alerts" className="text-xs text-amber hover:underline">View all →</Link>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {alerts.slice(0,4).map(alert => (
                <div key={alert.id} className="p-3 bg-[#0A0E1A] rounded-lg border-l-4" style={{ borderColor: alert.type === 'CRITICAL' ? '#EA580C' : alert.type === 'WARNING' ? '#F59E0B' : '#3B82F6' }}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-white">{alert.machineName || alert.machineId}</span>
                    <span className="text-[10px] text-slate-500 font-mono-data">{alert.timestamp.split(' ')[1] || alert.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      <WhatsAppAlert />
    </DashLayout>
  );
}
