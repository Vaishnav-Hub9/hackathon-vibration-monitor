import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'wouter';
import DashLayout from '@/components/layout/DashLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, LineChart, Line, ReferenceLine, Cell } from 'recharts';
import { ChevronRight, Cpu, Activity, Zap, Thermometer, Radio } from 'lucide-react';
import { machinesApi, alertsApi } from '@/lib/api';
import { useLiveSensors } from '@/hooks/useLiveSensors';

export default function MachineDetail() {
  const params = useParams();
  const machineId = params.id || 'M003';
  
  const [machine, setMachine] = useState<any>(null);
  const [mAlerts, setMAlerts] = useState<any[]>([]);
  const [fftData, setFftData] = useState<any[]>([]);
  const [waveformData, setWaveformData] = useState<any[]>([]);
  
  const liveSensors = useLiveSensors(machineId);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [machineRes, alertsRes, fftRes] = await Promise.all([
          machinesApi.getById(machineId),
          alertsApi.getAll({ machineId }),
          machinesApi.getFFT(machineId)
        ]);
        
        if (!isMounted) return;
        
        setMachine(machineRes.data.data);
        setMAlerts(alertsRes.data.data);
        setFftData(fftRes.data.data || []);
        
        const wf = Array.from({ length: 100 }, (_, i) => {
          let value = Math.sin(i * 0.3) * 0.3;
          if (machineRes.data.data.status === 'critical') {
            value = Math.sin(i * 0.3) * 1.5 + (Math.random() > 0.85 ? (Math.random() - 0.5) * 4 : 0);
          }
          return { t: i, value };
        });
        setWaveformData(wf);
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchData();
    
    const interval = setInterval(async () => {
      try {
        const fftRes = await machinesApi.getFFT(machineId);
        if (isMounted && fftRes.data.data) {
           setFftData(fftRes.data.data);
        }
      } catch (e) {}
    }, 4000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [machineId]);

  const liveData = useMemo(() => {
     if (!liveSensors || liveSensors.length === 0) return null;
     const critical = liveSensors.find(s => s.status === 'critical');
     if (critical) return critical;
     const warning = liveSensors.find(s => s.status === 'warning');
     if (warning) return warning;
     return liveSensors[0];
  }, [liveSensors]);

  const radarData = useMemo(() => {
    if (!liveData) return [];
    return [
      { subject: 'Vibration', A: liveData.anomalyScore > 0.5 ? 90 : 30, fullMark: 100 },
      { subject: 'Acoustics', A: liveData.acousticLevel > 1.0 ? 85 : 40, fullMark: 100 },
      { subject: 'Temperature', A: liveData.temperature > 60 ? 80 : 50, fullMark: 100 },
      { subject: 'Voltage', A: 20, fullMark: 100 },
      { subject: 'Anomaly', A: liveData.anomalyScore * 100, fullMark: 100 },
    ];
  }, [liveData]);

  if (!machine) return <DashLayout><div className="text-white p-6">Loading machine data...</div></DashLayout>;

  return (
    <DashLayout>
      <div className="space-y-6">
        <div className="flex items-center text-sm text-slate-400 mb-2">
          <Link href="/dashboard" className="hover:text-amber">Dashboard</Link>
          <ChevronRight className="w-4 h-4 mx-1" />
          <span className="text-white font-medium">{machine.name}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-navy-card p-6 rounded-xl border border-navy">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="font-display text-3xl font-bold text-white">{machine.name}</h1>
              <StatusBadge status={machine.status} />
            </div>
            <p className="text-slate-400 font-mono-data text-sm">{machine.id} | Unit {machine.section || 'Main'} | {machine.totalSpindles} Spindles</p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Health Score</div>
              <div className={`text-3xl font-mono-data font-bold ${machine.healthScore < 50 ? 'text-[#EA580C]' : 'text-[#10B981]'}`}>{machine.healthScore}%</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nodes Active</div>
              <div className="text-3xl font-mono-data font-bold text-white">{machine.activeSensors || 5}</div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-navy-card border border-navy mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-navy data-[state=active]:text-amber">Overview</TabsTrigger>
            <TabsTrigger value="sensors" className="data-[state=active]:bg-navy data-[state=active]:text-amber">Live Sensors</TabsTrigger>
            <TabsTrigger value="vibration" className="data-[state=active]:bg-navy data-[state=active]:text-amber">Vibration Analysis</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-navy data-[state=active]:text-amber">History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-white mb-4">Sensor Nodes</h3>
              {liveSensors.map(node => (
                <div key={node.id} className="bg-navy-card border border-navy p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="#1E2D4A" strokeWidth="4" fill="none" />
                        <circle cx="24" cy="24" r="20" stroke={node.healthScore < 50 ? '#EA580C' : '#10B981'} strokeWidth="4" fill="none" strokeDasharray="125" strokeDashoffset={125 - (125 * node.healthScore) / 100} />
                      </svg>
                      <span className="absolute text-xs font-bold font-mono-data text-white">{node.healthScore}</span>
                    </div>
                    <div>
                      <div className="font-medium text-white">{node.location}</div>
                      <div className="text-xs font-mono-data text-slate-400 mt-1">{node.id}</div>
                    </div>
                  </div>
                  <StatusBadge status={node.status} />
                </div>
              ))}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-navy-card border border-navy p-5 rounded-xl h-72">
                <h3 className="font-semibold text-white mb-4">Multivariate Profile</h3>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#1E2D4A" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Machine" dataKey="A" stroke={machine.healthScore < 50 ? '#EA580C' : '#3B82F6'} fill={machine.healthScore < 50 ? '#EA580C' : '#3B82F6'} fillOpacity={0.4} />
                    <Tooltip contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sensors" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Vibration RMS', val: liveData?.vibrationRMS?.toFixed(3) || '0.000', unit: 'mm/s', icon: Activity, color: '#F59E0B' },
                { label: 'Temperature', val: liveData?.temperature?.toFixed(1) || '0.0', unit: '°C', icon: Thermometer, color: '#EA580C' },
                { label: 'Acoustic Emission', val: liveData?.acousticLevel?.toFixed(2) || '0.00', unit: 'dB', icon: Radio, color: '#3B82F6' },
                { label: 'Supply Voltage', val: '220', unit: 'V', icon: Zap, color: '#10B981' }
              ].map((m, i) => (
                <div key={i} className="bg-navy-card border border-navy p-5 rounded-xl relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-medium text-slate-400">{m.label}</span>
                    <m.icon className="w-5 h-5 opacity-50" style={{ color: m.color }} />
                  </div>
                  <div className="font-mono-data text-4xl font-bold text-white">
                    {m.val} <span className="text-sm text-slate-500">{m.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-navy-card border border-navy p-6 rounded-xl flex flex-col items-center justify-center py-12">
              <h3 className="text-xl font-display font-bold text-white mb-8">Edge AI Anomaly Score</h3>
              <div className="relative w-64 h-32 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[200%] rounded-full border-[24px] border-[#1E2D4A]"></div>
                <div className="absolute top-0 left-0 w-full h-[200%] rounded-full border-[24px]" 
                     style={{ 
                       borderColor: (liveData?.anomalyScore || 0) > 0.6 ? '#EA580C' : (liveData?.anomalyScore || 0) > 0.3 ? '#F59E0B' : '#10B981',
                       clipPath: `polygon(0 50%, 100% 50%, 100% 100%, 0 100%)`,
                       transform: `rotate(${180 + ((liveData?.anomalyScore || 0) * 180)}deg)`,
                       transformOrigin: 'center',
                       transition: 'transform 1s ease-out'
                     }}></div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-5xl font-mono-data font-bold text-white">
                  {(liveData?.anomalyScore || 0).toFixed(2)}
                </div>
              </div>
              <p className="mt-4 text-slate-400">Score &gt; 0.65 indicates imminent bearing failure</p>
            </div>
          </TabsContent>

          <TabsContent value="vibration" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-navy-card border border-navy p-5 rounded-xl h-80">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-white">Frequency Spectrum (FFT)</h3>
                  <span className="text-xs font-mono-data text-amber bg-amber/10 px-2 py-1 rounded border border-amber/20">Live Update</span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fftData} margin={{top:20}}>
                    <XAxis dataKey="freq" stroke="#64748B" fontSize={10} tickFormatter={(val) => `${val}Hz`} />
                    <YAxis stroke="#64748B" fontSize={10} />
                    <Tooltip cursor={{fill: '#1E2D4A'}} contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A', color: '#fff' }} />
                    <Bar dataKey="amplitude" fill="#3B82F6" radius={[2,2,0,0]} isAnimationActive={false}>
                      {
                        fftData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.amplitude > 0.7 ? '#EA580C' : '#3B82F6'} />
                        ))
                      }
                    </Bar>
                    {machine.status === 'critical' && <ReferenceLine x={157} stroke="#EA580C" strokeDasharray="3 3" label={{ position: 'top', value: 'BPFO Spike', fill: '#EA580C', fontSize: 12, fontWeight: 'bold' }} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-navy-card border border-navy p-5 rounded-xl">
                <h3 className="font-semibold text-white mb-4">Diagnostics</h3>
                {machine.status === 'critical' ? (
                  <div className="space-y-4">
                    <div className="bg-[#EA580C]/10 border border-[#EA580C]/30 p-4 rounded-lg">
                      <div className="font-bold text-[#EA580C] mb-1">Outer Race Defect (BPFO)</div>
                      <p className="text-sm text-slate-300">High amplitude peaks detected at ball pass frequency outer race harmonics (~157Hz). Indicates severe spalling on the outer ring.</p>
                    </div>
                    <ul className="text-sm text-slate-400 space-y-2 list-disc pl-4">
                      <li>Recommended action: Schedule replacement within 18 hours.</li>
                      <li>Secondary indicator: Elevated temperature.</li>
                    </ul>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-[#10B981] opacity-50" />
                    <p>No specific bearing fault frequencies detected.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-navy-card border border-navy p-5 rounded-xl h-64">
              <h3 className="font-semibold text-white mb-4">Time Waveform</h3>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={waveformData}>
                  <XAxis dataKey="t" stroke="#64748B" tick={false} axisLine={false} />
                  <YAxis stroke="#64748B" tick={false} axisLine={false} domain={[-2, 2]} />
                  <Line type="monotone" dataKey="value" stroke={machine.status === 'critical' ? '#EA580C' : '#10B981'} strokeWidth={1} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="bg-navy-card border border-navy rounded-xl overflow-hidden">
              <div className="p-5 border-b border-navy">
                <h3 className="font-semibold text-white">Alert History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#0A0E1A] text-slate-400 text-xs uppercase font-medium">
                    <tr>
                      <th className="px-6 py-4">Date & Time</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Message</th>
                      <th className="px-6 py-4">Score</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy">
                    {mAlerts.length > 0 ? mAlerts.map(alert => (
                      <tr key={alert.id} className="hover:bg-[#141E35] transition-colors">
                        <td className="px-6 py-4 font-mono-data text-slate-300">{alert.timestamp}</td>
                        <td className="px-6 py-4"><StatusBadge status={alert.type} /></td>
                        <td className="px-6 py-4 text-slate-300">{alert.message}</td>
                        <td className="px-6 py-4 font-mono-data text-amber">{alert.anomalyScore}</td>
                        <td className="px-6 py-4 capitalize text-slate-400">{alert.status}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No alerts found for this machine.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashLayout>
  );
}

function CheckCircle(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  )
}
