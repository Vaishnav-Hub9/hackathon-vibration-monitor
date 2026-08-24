import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Link } from 'wouter';
import DashLayout from '@/components/layout/DashLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useCountUp } from '@/hooks/useCountUp';
import { useRealSensors } from '@/hooks/useRealSensors';
import { machinesApi, analyticsApi, alertsApi, hardwareApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Clock, Cpu, ShieldAlert, BellRing, Wifi, TrendingUp, TrendingDown, Minus, Volume2, Square, PenLine, Gauge, Thermometer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WhatsAppAlert from '@/components/dashboard/WhatsAppAlert';
import FaultInjector from '@/components/dashboard/FaultInjector';
import FleetCopilot from '@/components/dashboard/FleetCopilot';
import LiveBearingWidget from '@/components/dashboard/LiveBearingWidget';
import { useFaultAudio, toneForStatus, AUDITION_RPM } from '@/lib/faultSound';
import { Mic, Smartphone } from 'lucide-react';

function AcousticCapturesCard() {
  const [captures, setCaptures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () => {
      hardwareApi.getRecentCaptures(10).then(res => {
        if (active) { setCaptures(Array.isArray(res.data) ? res.data : []); setLoading(false); }
      }).catch(() => { if (active) setLoading(false); });
    };
    load();
    const iv = setInterval(load, 8000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  return (
    <div className="bg-navy-card border border-navy rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone className="w-4 h-4 text-amber" />
        <h3 className="text-sm font-semibold text-white">Recent Acoustic Captures</h3>
        <a href="/capture/" target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] text-amber hover:text-amber/80 transition-colors">Open Capture App ↗</a>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading...</p>
      ) : captures.length === 0 ? (
        <p className="text-xs text-slate-500">No captures yet. Open the <a href="/capture/" target="_blank" className="text-amber underline">Capture App</a> and record a reading.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {captures.map((c, i) => {
            const score = c.anomalyScore ?? 0;
            const color = score > 0.7 ? 'text-red-400 border-red-500/30' : score > 0.4 ? 'text-amber border-amber/30' : 'text-emerald-400 border-emerald-500/30';
            const verdict = c.mlLabel || (score > 0.7 ? 'ANOMALY' : score > 0.4 ? 'WARNING' : 'HEALTHY');
            return (
              <div key={c.id || i} className={`flex items-center justify-between text-xs p-2 rounded-lg bg-[#0F1629] border ${color.split(' ')[1]}`}>
                <div className="flex items-center gap-2">
                  <Mic className={`w-3.5 h-3.5 ${color.split(' ')[0]}`} />
                  <span className="text-slate-300">{c.machineId || 'M001'}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <span>{c.vibrationRMS?.toFixed(2) ?? '-'}g</span>
                  <span>{c.temperature?.toFixed(0) ?? '-'}°C</span>
                  <span>{c.rpm ?? '-'} RPM</span>
                  <span className={`font-semibold ${color.split(' ')[0]}`}>{verdict}</span>
                  <span className="text-[10px] text-slate-600">{c.captureMethod || 'audio'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const dtSaved = useCountUp(summary.downtimePrevented ?? 0, 1500);
  const { sensors: liveSensors, isLive } = useRealSensors();
  const { playingKey, play, stop } = useFaultAudio();
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [manualReadings, setManualReadings] = useState<any[]>([]);
  const [manualRpm, setManualRpm] = useState('');
  const [manualTemp, setManualTemp] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualFeedback, setManualFeedback] = useState<{ok: boolean; msg: string} | null>(null);
  
  // The Fault Injector targets machines[0] (M001). Its verdict comes from the
  // Live Sensor Feed, which caps at 6 nodes — M003/M002 traffic can evict M001
  // between cycles, making the verdict strip flicker. Pin the last-seen sensor
  // for the injector machine so the highlight stays stable.
  const [injectorSensor, setInjectorSensor] = useState<any | undefined>(undefined);

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
          estimatedSavings: roiRes.data.data.estimatedSavings,
          downtimePrevented: roiRes.data.data.downtimePrevented
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
       refreshFleet();
    };

    // Debounced fleet refresh — machine cards (healthScore/status) and KPIs
    // must update for EVERY rig/manual reading, not just ones that raise
    // alerts. Healthy readings change M001's health score silently.
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshFleet = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        machinesApi.getAll().then((res: any) => {
          if (isMounted && res.data?.data) setMachines(res.data.data);
        }).catch(() => {});
        analyticsApi.getSummary().then((res: any) => {
          if (isMounted && res.data?.data) setSummary((prev: any) => ({ ...prev, ...res.data.data }));
        }).catch(() => {});
      }, 800);
    };

    const onHardwareManual = (reading: any) => {
      setManualReadings(prev => [reading, ...prev].slice(0, 10));
      refreshFleet();
    };

    const onSensorUpdate = (data: any) => {
      // Physical rig frames (Arduino ingest) flow through as sensor:update —
      // refresh machine cards/KPIs for those too.
      if (data?.source === 'arduino' || data?.spindleId === 'RIG01' || data?.nodeId === 'RIG01') {
        refreshFleet();
      }
    };

    // Safety net: poll every 10 s so Machine Status cards / KPIs always
    // converge to the database truth, even if a socket event was missed.
    const pollTimer = setInterval(refreshFleet, 10_000);

    socket.on('fleet:summary', onFleetSummary);
    socket.on('alert:new', onAlertNew);
    socket.on('hardware:manual', onHardwareManual);
    socket.on('sensor:update', onSensorUpdate);
    
    return () => {
      isMounted = false;
      clearInterval(pollTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.off('fleet:summary', onFleetSummary);
      socket.off('alert:new', onAlertNew);
      socket.off('hardware:manual', onHardwareManual);
      socket.off('sensor:update', onSensorUpdate);
    };
  }, []);

  // Manual reading submission handler (Dashboard quick entry)
  const handleManualSubmit = async () => {
    const rpm = parseFloat(manualRpm);
    if (!rpm || rpm <= 0) return;
    setManualSubmitting(true);
    setManualFeedback(null);
    try {
      await hardwareApi.submitManual({
        rpm,
        temperature: manualTemp ? parseFloat(manualTemp) : undefined,
      });
      setManualFeedback({ ok: true, msg: 'Submitted ✓' });
      setManualRpm('');
      setManualTemp('');
      setTimeout(() => setManualFeedback(null), 3000);
    } catch {
      setManualFeedback({ ok: false, msg: 'Submit failed' });
    } finally {
      setManualSubmitting(false);
    }
  };

  const allSensors = liveSensors.slice(0, 6);

  // Fault Injector targets the first machine; pass its live ML verdict from the socket feed
  const injectorMachine = machines[0];
  const liveInjectorSensor = liveSensors.find(s => s.machineId === injectorMachine?.id);
  // Keep the latest verdict even when the cap-6 feed evicts the machine
  useEffect(() => {
    if (liveInjectorSensor) setInjectorSensor(liveInjectorSensor);
  }, [liveInjectorSensor]);

  return (
    <DashLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-white tracking-wide">Fleet Overview</h1>

        {/* Row 1: KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="card-accent bg-navy-card border border-navy p-5 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm font-medium">Fleet Risk Assessment</span>
              <span className="w-9 h-9 rounded-lg bg-[#F59E0B]/10 border border-amber/25 flex items-center justify-center">
                <ShieldAlert className="w-4.5 h-4.5 text-amber" />
              </span>
            </div>
            <div className="flex items-end gap-3 mt-4">
              <span className="font-mono-data text-4xl font-bold text-amber">{fleetHealth}%</span>
            </div>
            <div className="w-full bg-[#0A0E1A] h-2 rounded-full mt-4 overflow-hidden">
              <div className="bg-gradient-to-r from-amber to-[#EA580C] h-full rounded-full transition-all duration-700" style={{ width: `${fleetHealth}%` }}></div>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="card-accent bg-navy-card border border-navy p-5 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm font-medium">Active Alerts</span>
              <span className="w-9 h-9 rounded-lg bg-[#EA580C]/10 border border-[#EA580C]/25 flex items-center justify-center">
                <BellRing className="w-4.5 h-4.5 text-[#EA580C]" />
              </span>
            </div>
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

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="card-accent bg-navy-card border border-navy p-5 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm font-medium">Downtime Prevented</span>
              <span className="w-9 h-9 rounded-lg bg-[#10B981]/10 border border-[#10B981]/25 flex items-center justify-center">
                <Clock className="w-4.5 h-4.5 text-[#10B981]" />
              </span>
            </div>
            <div className="mt-4">
              <span className="font-mono-data text-4xl font-bold text-[#10B981]">{dtSaved}</span>
              <span className="text-slate-400 ml-2">hrs</span>
            </div>
            <span className="text-xs text-[#10B981] mt-4 font-mono-data">
              Est. ₹{summary.estimatedSavings.toLocaleString()} saved
            </span>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.3}} className="card-accent bg-navy-card border border-navy p-5 rounded-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm font-medium">Sensor Network</span>
              <span className="w-9 h-9 rounded-lg bg-[#3B82F6]/10 border border-[#3B82F6]/25 flex items-center justify-center">
                <Wifi className="w-4.5 h-4.5 text-[#3B82F6]" />
              </span>
            </div>
            <div className="mt-4">
              <span className="font-mono-data text-4xl font-bold text-white">{summary.totalMachines * 5}</span>
              <span className="text-slate-400 ml-2">nodes active</span>
            </div>
            <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full dot-healthy"></span> {summary.sensorUptime ?? 0}% Uptime
            </div>
          </motion.div>
        </div>

        {/* Live Sensor Feed */}
        <div className="bg-navy-card border border-navy rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-navy">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#10B981] animate-pulse' : 'bg-slate-600'}`}></span>
              <h3 className="text-sm font-semibold text-white">Live Sensor Feed</h3>
              <span className="text-[10px] text-slate-500 font-mono-data">{isLive ? 'Live via Socket.io' : 'Reconnecting…'}</span>
            </div>
            <Link href="/predictions" className="text-xs text-amber hover:underline">View all →</Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-navy min-h-[100px]">
            {allSensors.map(s => {
              const vColor = s.accel_z > 3 ? '#EA580C' : s.accel_z > 1.5 ? '#F59E0B' : '#10B981';
              const DeltaIcon = s.vibDelta > 0.02 ? TrendingUp : s.vibDelta < -0.02 ? TrendingDown : Minus;
              const deltaColor = s.vibDelta > 0.02 ? '#EA580C' : s.vibDelta < -0.02 ? '#10B981' : '#64748b';
              return (
                <div key={`${s.machineId}-${s.id}`} className="p-3 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-500 font-mono-data truncate">{s.id}</span>
                    {(s.source === 'manual' || s.source === 'arduino') && (
                      <span className={`text-[8px] font-bold px-1 py-px rounded ${
                        s.source === 'manual' ? 'bg-amber/20 text-amber border border-amber/30' : 'bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30'
                      }`}>{s.source === 'manual' ? 'MANUAL' : 'RIG'}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{s.machineId}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={s.accel_z}
                        initial={{ opacity: 0.4, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="font-mono-data text-sm font-bold"
                        style={{ color: vColor }}
                      >
                        {s.accel_x?.toFixed(1)}/{s.accel_y?.toFixed(1)}/{s.accel_z?.toFixed(1)}g
                      </motion.span>
                    </AnimatePresence>
                    <DeltaIcon className="w-3 h-3 flex-shrink-0" style={{ color: deltaColor }} />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-data">{s.temperature}°C</div>
                  {s.mlLabel && s.mlLabel !== 'Healthy' && (
                    <div className="text-[10px] font-semibold mt-0.5 text-[#EA580C]">{s.mlLabel.toUpperCase()}</div>
                  )}
                  <div className={`text-[10px] font-semibold mt-0.5 ${
                    s.status === 'critical' ? 'text-[#EA580C]' : s.status === 'warning' ? 'text-[#F59E0B]' : 'text-[#10B981]'
                  }`}>{s.status.toUpperCase()}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Acoustic Captures */}
        <AcousticCapturesCard />

        {/* Fault Injector + digital twin — live ML demo panel */}
        {injectorMachine && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-stretch">
            <FaultInjector
              machineId={injectorMachine.id}
              mlLabel={injectorSensor?.mlLabel}
              mlConfidence={injectorSensor?.mlConfidence}
            />
            <LiveBearingWidget
              name={injectorMachine.name}
              rpm={injectorSensor?.rpm || 14400}
              accelZ={injectorSensor?.accel_z ?? 0}
              status={injectorSensor?.status || injectorMachine.status}
              mlLabel={injectorSensor?.mlLabel}
              mlConfidence={injectorSensor?.mlConfidence}
            />
          </div>
        )}

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
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); const k = `${m.id}:${toneForStatus(m.status)}`; playingKey === k ? stop() : play(k, AUDITION_RPM); }}
                    className={`flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1.5 rounded-lg border transition-all ${playingKey === `${m.id}:${toneForStatus(m.status)}` ? 'border-amber/60 bg-amber/15 text-amber shadow-[0_0_12px_rgba(245,158,11,0.3)]' : 'border-navy bg-[#0A0E1A] text-slate-400 hover:text-white hover:border-slate-500'}`}
                    title="Hear this machine's fault signature"
                    aria-label="Play fault audio"
                  >
                    {playingKey === `${m.id}:${toneForStatus(m.status)}` ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    Hear
                  </button>
                  <StatusBadge status={m.status} />
                </div>
              </div>

              <div className="flex items-end justify-between mt-6">
                <div>
                  <div className="text-3xl font-mono-data font-bold" style={{ color: m.healthScore < 50 ? '#EA580C' : m.healthScore < 80 ? '#F59E0B' : '#10B981' }}>
                    {m.healthScore}%
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Risk Score</div>
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

        {/* Row 3: Hardware Manual Input */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Manual entry quick form */}
          <div className="bg-navy-card border border-navy rounded-xl overflow-hidden">
            <div className="p-5 border-b border-navy flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-amber" />
                <h3 className="text-white font-bold text-sm">Hardware Manual Input</h3>
              </div>
              <Link href="/hardware" className="text-xs text-amber hover:underline">Open Hardware Lab →</Link>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-mono-data mb-1 block">RPM *</label>
                  <input
                    type="number"
                    value={manualRpm}
                    onChange={e => setManualRpm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                    placeholder="e.g. 1500"
                    className="w-full bg-[#0A0E1A] border border-navy rounded-lg px-3 py-2 text-white text-sm font-mono-data placeholder:text-slate-600 focus:outline-none focus:border-amber/50 focus:ring-1 focus:ring-amber/30 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-mono-data mb-1 block">Temp °C</label>
                  <input
                    type="number"
                    value={manualTemp}
                    onChange={e => setManualTemp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                    placeholder="e.g. 55"
                    className="w-full bg-[#0A0E1A] border border-navy rounded-lg px-3 py-2 text-white text-sm font-mono-data placeholder:text-slate-600 focus:outline-none focus:border-amber/50 focus:ring-1 focus:ring-amber/30 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={handleManualSubmit}
                disabled={manualSubmitting || !manualRpm}
                className="w-full bg-amber/20 hover:bg-amber/30 disabled:opacity-40 text-amber border border-amber/30 rounded-lg py-2 text-sm font-semibold transition-all active:scale-[0.98]"
              >
                {manualSubmitting ? 'Submitting…' : 'Submit Reading'}
              </button>
              {manualFeedback && (
                <p className={`text-xs font-medium ${manualFeedback.ok ? 'text-[#10B981]' : 'text-[#EA580C]'}`}>{manualFeedback.msg}</p>
              )}
            </div>
          </div>

          {/* Recent manual readings feed */}
          <div className="bg-navy-card border border-navy rounded-xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-navy flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#3B82F6]" />
                <h3 className="text-white font-bold text-sm">Manual Readings Feed</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono-data">{manualReadings.length} entries</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[260px]">
              {manualReadings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                  <PenLine className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No manual readings yet</p>
                  <p className="text-[10px] mt-1">Submit from the panel or Hardware Lab</p>
                </div>
              ) : (
                manualReadings.map((r, i) => {
                  const color = r.colour === 'red' ? '#EA580C' : r.colour === 'yellow' ? '#F59E0B' : '#10B981';
                  const time = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : '';
                  return (
                    <div key={i} className="p-3 bg-[#0A0E1A] rounded-lg border-l-4" style={{ borderColor: color }}>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-data text-sm font-bold text-white">{r.rpm} RPM</span>
                          {r.temperature != null && (
                            <span className="font-mono-data text-xs text-[#3B82F6]">{r.temperature}°C</span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono-data" style={{ color }}>{r.verdict}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono-data">{time} · manual</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Row 4: Charts & Alerts */}
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
      <FleetCopilot
        ctx={{
          machines,
          alerts,
          summary,
          sensors: liveSensors,
        }}
      />
    </DashLayout>
  );
}
