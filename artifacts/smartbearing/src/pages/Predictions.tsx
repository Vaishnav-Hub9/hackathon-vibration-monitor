import { useState, useEffect } from 'react';
import DashLayout from '@/components/layout/DashLayout';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, Legend } from 'recharts';
import { AlertTriangle, TrendingDown, IndianRupee } from 'lucide-react';
import { machinesApi, alertsApi } from '@/lib/api';
import { useLiveSensors } from '@/hooks/useLiveSensors';

export default function Predictions() {
  const [machines, setMachines] = useState<any[]>([]);
  const [rulData, setRulData] = useState<Record<string, any[]>>({});
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);

  // Get live sensor data for node ranking from machines M001-M006
  const sensors = useLiveSensors('M001');
  const sensors2 = useLiveSensors('M002');
  const sensors3 = useLiveSensors('M003');

  const allSensors = [...sensors, ...sensors2, ...sensors3];
  const rankedNodes = [...allSensors].sort((a, b) => b.anomalyScore - a.anomalyScore);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [machinesRes, alertsRes] = await Promise.all([
          machinesApi.getAll(),
          alertsApi.getAll({ status: 'active' })
        ]);
        if (!isMounted) return;

        const m = machinesRes.data.data;
        setMachines(m);
        setCriticalAlerts(alertsRes.data.data.filter((a: any) => a.type === 'CRITICAL'));

        // Fetch RUL for degrading/critical machines
        const rulResults: Record<string, any[]> = {};
        for (const machine of m) {
          if (machine.status === 'critical' || machine.status === 'warning') {
            try {
              const rulRes = await machinesApi.getRUL(machine.id);
              rulResults[machine.id] = rulRes.data.data;
            } catch (e) {}
          }
        }
        if (isMounted) setRulData(rulResults);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, []);

  const criticalMachine = machines.find(m => m.status === 'critical');
  const warningMachine = machines.find(m => m.status === 'warning');

  // Build combined RUL chart data
  const rul1 = Object.values(rulData)[0] || [];
  const rul2 = Object.values(rulData)[1] || [];
  const machineIds = Object.keys(rulData);

  return (
    <DashLayout>
      <div className="space-y-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold text-white tracking-wide">Predictive Intelligence</h1>
          <p className="text-slate-400 mt-2 text-lg">Know before it breaks. Plan before it costs.</p>
        </div>

        {/* Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-[#2B0D0A] to-navy-card border border-[#EA580C]/30 p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-[#EA580C] w-6 h-6" />
              <h3 className="font-bold text-white">Highest Risk</h3>
            </div>
            <div className="font-mono-data text-2xl font-bold text-[#EA580C] mb-1">
              {criticalMachine?.name || 'None'}
            </div>
            <p className="text-sm text-slate-400">
              {criticalAlerts.length > 0 ? criticalAlerts[0].estimatedTimeToFailure || 'Est. failure: 6–18 hours. BPFO detected.' : 'No critical machines'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-[#2B1D0A] to-navy-card border border-[#F59E0B]/30 p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <TrendingDown className="text-[#F59E0B] w-6 h-6" />
              <h3 className="font-bold text-white">Trending Worse</h3>
            </div>
            <div className="font-mono-data text-2xl font-bold text-[#F59E0B] mb-1">
              {warningMachine?.name || 'None'}
            </div>
            <p className="text-sm text-slate-400">
              {warningMachine ? `Health at ${warningMachine.healthScore}%. Monitor bearing temperature.` : 'No warning machines'}
            </p>
          </div>

          <div className="bg-navy-card border border-navy p-6 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <IndianRupee className="text-slate-300 w-6 h-6" />
              <h3 className="font-bold text-white">Cost at Risk</h3>
            </div>
            <div className="font-mono-data text-2xl font-bold text-white mb-1">
              ₹{((criticalAlerts.length * 18000) + (machines.filter(m => m.status === 'warning').length * 9000)).toLocaleString()}
            </div>
            <p className="text-sm text-slate-400">Potential downtime cost if critical machines fail.</p>
          </div>
        </div>

        {/* RUL Curves Chart */}
        <div className="bg-navy-card border border-navy p-6 rounded-xl">
          <h2 className="font-bold text-white mb-6">Remaining Useful Life (RUL) Trajectories</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2D4A" vertical={false} />
                <XAxis dataKey="day" type="number" domain={[0, 29]} stroke="#64748B" tickFormatter={(val) => `Day ${val}`} />
                <YAxis domain={[0, 100]} stroke="#64748B" tickFormatter={(val) => `${val}%`} />
                <Tooltip contentStyle={{ backgroundColor: '#0F1629', borderColor: '#1E2D4A' }} />
                <Legend />
                <ReferenceLine y={20} stroke="#EA580C" strokeWidth={2} label={{ value: "Failure Threshold", position: 'top', fill: '#EA580C', fontSize: 12 }} />

                {rul1.length > 0 && (
                  <>
                    <Line data={rul1.slice(0, 16)} type="monotone" dataKey="healthScore"
                      name={`${machineIds[0]} (Historical)`} stroke="#EA580C" strokeWidth={3} dot={false} />
                    <Line data={rul1.slice(15)} type="monotone" dataKey="healthScore"
                      name={`${machineIds[0]} (Projected)`} stroke="#EA580C" strokeWidth={3} strokeDasharray="5 5" dot={false} />
                  </>
                )}
                {rul2.length > 0 && (
                  <>
                    <Line data={rul2.slice(0, 16)} type="monotone" dataKey="healthScore"
                      name={`${machineIds[1]} (Historical)`} stroke="#F59E0B" strokeWidth={2} dot={false} />
                    <Line data={rul2.slice(15)} type="monotone" dataKey="healthScore"
                      name={`${machineIds[1]} (Projected)`} stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Ranking Table */}
        <div className="bg-navy-card border border-navy rounded-xl overflow-hidden">
          <div className="p-5 border-b border-navy">
            <h2 className="font-bold text-white">Node Risk Ranking</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0A0E1A] text-slate-400 text-xs uppercase font-medium">
                <tr>
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Machine & Node</th>
                  <th className="px-6 py-4">Anomaly Score</th>
                  <th className="px-6 py-4">Est. Time to Failure</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy">
                {rankedNodes.length > 0 ? rankedNodes.map((node, i) => {
                  const m = machines.find(m => m.id === node.machineId);
                  const isHighRisk = node.anomalyScore > 0.6;
                  return (
                    <tr key={`${node.machineId}-${node.id}`} className="hover:bg-[#141E35] transition-colors">
                      <td className="px-6 py-4 font-mono-data text-slate-500">#{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-200">{m?.name || node.machineId}</div>
                        <div className="text-xs text-slate-500">{node.location} ({node.id})</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`font-mono-data font-bold ${isHighRisk ? 'text-[#EA580C]' : 'text-amber'}`}>
                            {node.anomalyScore.toFixed(2)}
                          </span>
                          <div className="w-24 bg-[#0A0E1A] h-1.5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${node.anomalyScore * 100}%`, backgroundColor: isHighRisk ? '#EA580C' : '#F59E0B' }}>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono-data text-slate-300">
                        {isHighRisk ? '6-18 hrs' : node.anomalyScore > 0.3 ? '3-7 days' : '> 30 days'}
                      </td>
                      <td className="px-6 py-4">
                        {isHighRisk ? (
                          <span className="bg-[#EA580C]/20 text-[#EA580C] px-2 py-1 rounded text-xs font-bold border border-[#EA580C]/30">REPLACE IMMINENT</span>
                        ) : node.anomalyScore > 0.3 ? (
                          <span className="bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-1 rounded text-xs font-bold border border-[#F59E0B]/30">MONITOR CLOSELY</span>
                        ) : (
                          <span className="text-slate-500 text-xs">No action needed</span>
                        )}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Loading sensor data…</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashLayout>
  );
}
