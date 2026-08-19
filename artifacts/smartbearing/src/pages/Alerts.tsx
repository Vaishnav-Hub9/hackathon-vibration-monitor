import { useState, useEffect } from 'react';
import DashLayout from '@/components/layout/DashLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, CheckCircle2, Bell, Clock, ChevronDown, ChevronUp, FileSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { alertsApi, analyticsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import LiveReadingsChart from '@/components/dashboard/LiveReadingsChart';

type AlertStatus = 'active' | 'acknowledged' | 'resolved';

type AlertEvidence = {
  label: string;
  confidence: number;
  dominantFreq: number;
  rpm: number;
  peaks: { freq: number; amplitude: number }[];
  features?: { rms: number; kurtosis: number; crestFactor: number };
  defectFrequencies?: { fr: number; bpfo: number; bpfi: number; bsf: number; ftf: number };
};

type Alert = {
  id: string;
  nodeId: string;
  machineId: string;
  machineName: string;
  type: string;
  message: string;
  technicianSummary?: string;
  anomalyScore: number;
  evidence?: AlertEvidence | null;
  timestamp: string;
  status: AlertStatus;
  estimatedTimeToFailure: string | null;
};

export default function Alerts() {
  const [filter, setFilter] = useState('All');
  const [alertList, setAlertList] = useState<Alert[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [expandedEvidence, setExpandedEvidence] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [alertsRes, trendsRes] = await Promise.all([
          alertsApi.getAll(),
          analyticsApi.getTrends()
        ]);
        if (!isMounted) return;
        setAlertList(alertsRes.data.data);

        // Real 30-day alert timeline aggregated from the database
        const timeline = (trendsRes.data.data || []).map((d: any) => ({
          day: d.day,
          alerts: d.alerts ?? 0,
          critical: d.critical ?? 0,
          warning: d.warning ?? 0,
          info: Math.max(0, d.alerts - (d.critical ?? 0) - (d.warning ?? 0)),
        }));
        setTimelineData(timeline);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
    
    const socket = getSocket();
    const handleNewAlert = (alert: Alert) => {
       setAlertList(prev => [alert, ...prev]);

       // Live: bump today's bar in the Alert Frequency chart so the graph
       // visibly reacts as new alerts arrive over WebSocket.
       setTimelineData(prev => {
         if (prev.length === 0) return prev;
         const next = [...prev];
         const last = { ...next[next.length - 1] };
         const type = String(alert.type || '').toUpperCase();
         if (type === 'CRITICAL') last.critical = (last.critical ?? 0) + 1;
         else if (type === 'WARNING') last.warning = (last.warning ?? 0) + 1;
         else last.info = (last.info ?? 0) + 1;
         last.alerts = (last.alerts ?? 0) + 1;
         next[next.length - 1] = last;
         return next;
       });

       if (alert.type === 'CRITICAL') {
           showToast(`CRITICAL: ${alert.machineName || alert.machineId} - ${alert.message}`);
       }
    };
    
    socket.on('alert:new', handleNewAlert);
    
    return () => {
       isMounted = false;
       socket.off('alert:new', handleNewAlert);
    };
  }, []);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function acknowledge(id: string, machineName: string) {
    try {
      await alertsApi.acknowledge(id);
      setAlertList(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' } : a));
      showToast(`✓ Alert acknowledged — ${machineName}`);
    } catch (err) {
      console.error(err);
    }
  }

  async function resolve(id: string, machineName: string) {
    try {
      await alertsApi.resolve(id);
      setAlertList(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' } : a));
      showToast(`✓ Alert resolved — ${machineName}`);
    } catch (err) {
      console.error(err);
    }
  }
  
  function exportAlertsCSV() {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/alerts/export/csv`;
  }

  const activeCount = alertList.filter(a => a.status === 'active').length;
  const criticalCount = alertList.filter(a => a.type === 'CRITICAL' && a.status === 'active').length;
  const warnCount = alertList.filter(a => a.type === 'WARNING' && a.status === 'active').length;
  const resolvedCount = alertList.filter(a => a.status === 'resolved').length;
  const resolvedRate = alertList.length > 0 ? Math.round((resolvedCount / alertList.length) * 100) : 0;

  const filteredAlerts = alertList.filter(a => {
    if (filter === 'All') return true;
    if (filter === 'Resolved') return a.status === 'resolved';
    if (filter === 'Acknowledged') return a.status === 'acknowledged';
    return a.type === filter;
  });

  return (
    <DashLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-white tracking-wide">Alert Center</h1>
          <button
            onClick={exportAlertsCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0F1629] border border-navy hover:border-slate-600 text-slate-300 hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Alerts', val: alertList.length, icon: Bell },
            { label: 'Critical Active', val: criticalCount, color: 'text-[#EA580C]', icon: Bell },
            { label: 'Warning Active', val: warnCount, color: 'text-[#F59E0B]', icon: Clock },
            { label: 'Resolved Rate', val: `${resolvedRate}%`, color: 'text-[#10B981]', icon: CheckCircle2 }
          ].map((s, i) => (
            <div key={i} className="bg-navy-card border border-navy p-4 rounded-xl">
              <div className="text-sm text-slate-400 mb-1">{s.label}</div>
              <div className={`text-2xl font-mono-data font-bold ${s.color || 'text-white'}`}>{s.val}</div>
            </div>
          ))}
        </div>

        <div className="bg-navy-card border border-navy p-5 rounded-xl">
          <LiveReadingsChart height={180} />
        </div>

        <div className="bg-navy-card border border-navy p-5 rounded-xl h-48">
          <h3 className="text-sm font-medium text-slate-300 mb-4">Alert Frequency (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="day" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip cursor={{fill: '#1E2D4A'}} contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', borderRadius: '8px' }} />
              <Bar dataKey="critical" stackId="a" fill="#EA580C" />
              <Bar dataKey="warning" stackId="a" fill="#F59E0B" />
              <Bar dataKey="info" stackId="a" fill="#3B82F6" radius={[2,2,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-navy-card border border-navy rounded-xl p-6">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
            <Tabs defaultValue="All" onValueChange={setFilter}>
              <TabsList className="bg-[#0A0E1A] border border-navy">
                <TabsTrigger value="All" className="data-[state=active]:bg-navy-card data-[state=active]:text-white text-slate-400">All</TabsTrigger>
                <TabsTrigger value="CRITICAL" className="data-[state=active]:bg-[#2B0D0A] data-[state=active]:text-[#EA580C] text-slate-400">Critical</TabsTrigger>
                <TabsTrigger value="WARNING" className="data-[state=active]:bg-[#2B1D0A] data-[state=active]:text-[#F59E0B] text-slate-400">Warning</TabsTrigger>
                <TabsTrigger value="INFO" className="data-[state=active]:bg-[#0A1B2B] data-[state=active]:text-[#3B82F6] text-slate-400">Info</TabsTrigger>
                <TabsTrigger value="Acknowledged" className="data-[state=active]:bg-[#141E35] data-[state=active]:text-slate-300 text-slate-400">Ack'd</TabsTrigger>
                <TabsTrigger value="Resolved" className="data-[state=active]:bg-[#0D2B1F] data-[state=active]:text-[#10B981] text-slate-400">Resolved</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="text-xs text-slate-500 font-mono-data">{filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {filteredAlerts.map(alert => {
                const isResolved = alert.status === 'resolved';
                const isAcknowledged = alert.status === 'acknowledged';
                const colorHex = alert.type === 'CRITICAL' ? '#EA580C' : alert.type === 'WARNING' ? '#F59E0B' : '#3B82F6';

                return (
                  <motion.div
                    key={alert.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: isResolved ? 0.6 : 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`relative p-5 rounded-lg border flex flex-col md:flex-row gap-6 items-start md:items-center justify-between transition-colors ${
                      isResolved ? 'bg-[#0A0E1A] border-navy' :
                      isAcknowledged ? 'bg-[#0F1629] border-slate-700' :
                      'bg-[#0F1629] border-navy hover:border-slate-700'
                    }`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ backgroundColor: isResolved ? '#64748B' : isAcknowledged ? '#94A3B8' : colorHex }}></div>

                    <div className="flex-1 pl-2">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <StatusBadge status={isResolved ? 'RESOLVED' : isAcknowledged ? 'ACKNOWLEDGED' : alert.type} />
                        <span className="font-bold text-white">{alert.machineName || alert.machineId}</span>
                        <span className="text-xs font-mono-data text-slate-500">{alert.timestamp}</span>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed">{alert.message}</p>
                      {alert.technicianSummary && (
                        <div className="mt-3 p-3 bg-[#0A0E1A] border border-[#EA580C]/20 rounded-lg">
                          <p className="text-[#EA580C] text-xs font-bold mb-1 flex items-center gap-1 uppercase tracking-wider">
                            <span>🧠</span> AI Technician Assessment
                          </p>
                          <p className="text-slate-300 text-sm leading-relaxed">{alert.technicianSummary}</p>
                        </div>
                      )}
                      <div className="flex gap-4 mt-3 text-xs font-mono-data text-slate-500 flex-wrap">
                        <span>Node: {alert.nodeId}</span>
                        <span>Score: {alert.anomalyScore}</span>
                        {alert.estimatedTimeToFailure && <span className="text-amber">ETF: {alert.estimatedTimeToFailure}</span>}
                      </div>

                      {alert.evidence && (
                        <div className="mt-3">
                          <button
                            onClick={() => setExpandedEvidence(expandedEvidence === alert.id ? null : alert.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-amber hover:text-amber/80 transition-colors"
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                            {expandedEvidence === alert.id ? 'Hide' : 'View'} Evidence
                            {expandedEvidence === alert.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          <AnimatePresence>
                            {expandedEvidence === alert.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 p-4 bg-[#0A0E1A] border border-navy rounded-lg grid lg:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Triggering Spectrum (top peaks)</p>
                                    <div className="h-28">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={alert.evidence.peaks ?? []}>
                                          <XAxis dataKey="freq" stroke="#64748B" fontSize={9} tickFormatter={(v) => `${v}Hz`} />
                                          <YAxis stroke="#64748B" fontSize={9} />
                                          <Tooltip cursor={{ fill: '#1E2D4A' }} contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A' }} />
                                          <Bar dataKey="amplitude" fill="#EA580C" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                  <div className="text-xs font-mono-data space-y-2 text-slate-400">
                                    <p className="text-slate-300 font-bold">
                                      {alert.evidence.label ?? 'Unknown'} ·{' '}
                                      {alert.evidence.confidence !== undefined
                                        ? `${(alert.evidence.confidence * 100).toFixed(1)}% confidence`
                                        : 'confidence unavailable'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <span>RMS: <b className="text-white">{alert.evidence.features?.rms?.toFixed(2) ?? '—'}</b> g</span>
                                      <span>Kurtosis: <b className="text-white">{alert.evidence.features?.kurtosis?.toFixed(2) ?? '—'}</b></span>
                                      <span>Crest: <b className="text-white">{alert.evidence.features?.crestFactor?.toFixed(2) ?? '—'}</b></span>
                                      <span>RPM: <b className="text-white">{alert.evidence.rpm ?? '—'}</b></span>
                                    </div>
                                    <p className="pt-1 text-[11px]">
                                      Defect freqs: BPFO <b className="text-[#EA580C]">{alert.evidence.defectFrequencies?.bpfo?.toFixed(0) ?? '—'}</b> · BPFI <b className="text-[#F59E0B]">{alert.evidence.defectFrequencies?.bpfi?.toFixed(0) ?? '—'}</b> · BSF <b className="text-[#A855F7]">{alert.evidence.defectFrequencies?.bsf?.toFixed(0) ?? '—'}</b> Hz
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>

                    {!isResolved && (
                      <div className="flex gap-2 w-full md:w-auto flex-shrink-0">
                        {!isAcknowledged && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acknowledge(alert.id, alert.machineName || alert.machineId)}
                            className="border-navy bg-[#0A0E1A] hover:bg-[#141E35] text-slate-300"
                          >
                            Acknowledge
                          </Button>
                        )}
                        {isAcknowledged && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resolve(alert.id, alert.machineName || alert.machineId)}
                            className="border-[#10B981]/30 bg-[#0D2B1F]/50 hover:bg-[#0D2B1F] text-[#10B981]"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
                          </Button>
                        )}
                        <Link href={`/machine/${alert.machineId}`}>
                          <Button size="sm" className="bg-[#141E35] hover:bg-amber hover:text-navy text-white transition-colors">
                            View
                          </Button>
                        </Link>
                      </div>
                    )}

                    {isResolved && (
                      <div className="text-2xl font-display font-bold text-slate-700 uppercase tracking-widest absolute right-6 opacity-20 transform rotate-12 pointer-events-none select-none">
                        Resolved
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredAlerts.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-[#10B981] opacity-40" />
                No alerts found for this filter.
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl"
            style={{ background: '#0F1629', border: '1px solid #10B981', color: '#10B981' }}
          >
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </DashLayout>
  );
}
