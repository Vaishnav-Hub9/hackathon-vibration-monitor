import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowRight, Banknote, Boxes, CheckCircle2,
  CircleAlert, ClipboardCheck, Clock3, Eye, Factory, Gauge, HardHat,
  LockKeyhole, PackageCheck, ShieldCheck, Target, TrendingUp, Truck, Users,
  Wrench,
} from 'lucide-react';
import DashLayout from '@/components/layout/DashLayout';
import { alertsApi, analyticsApi, authApi, machinesApi } from '@/lib/api';
import { useRealSensors } from '@/hooks/useRealSensors';
import { getCurrentUser, normalizeRole, ROLE_DEFINITIONS, type AppRole } from '@/lib/roles';

interface RoleDashboardData {
  machines: any[];
  alerts: any[];
  summary: any;
  roi: any;
}

const EMPTY_DATA: RoleDashboardData = {
  machines: [],
  alerts: [],
  summary: { totalMachines: 6, avgHealthScore: 78, sensorUptime: 94, alertsToday: 3 },
  roi: { estimatedSavings: 54000, downtimePrevented: 18, preventedFailures: 3 },
};

const FALLBACK_MACHINES = [
  { id: 'M003', name: 'Ring Frame #3', status: 'critical', healthScore: 45, factoryUnit: 'unit-a', totalSpindles: 320 },
  { id: 'M002', name: 'Ring Frame #2', status: 'warning', healthScore: 71, factoryUnit: 'unit-a', totalSpindles: 400 },
  { id: 'M001', name: 'Ring Frame #1', status: 'healthy', healthScore: 92, factoryUnit: 'unit-a', totalSpindles: 400 },
];

const FALLBACK_ALERTS = [
  { id: 'A001', machineId: 'M003', machineName: 'Ring Frame #3', type: 'CRITICAL', message: 'BPFO frequency spike detected. Bearing failure imminent.', status: 'active' },
  { id: 'A002', machineId: 'M002', machineName: 'Ring Frame #2', type: 'WARNING', message: 'Vibration RMS elevated 2.3x above baseline. Monitor closely.', status: 'active' },
];

const ROLE_COPY: Record<AppRole, { eyebrow: string; title: string; description: string; action: string; actionHref: string }> = {
  maintenance_engineer: {
    eyebrow: 'Maintenance command center',
    title: 'Intervene before the line stops.',
    description: 'Prioritize machine risk, diagnose root cause, and close the loop with verified maintenance work.',
    action: 'Open maintenance queue',
    actionHref: '/alerts',
  },
  admin: {
    eyebrow: 'Platform governance',
    title: 'Keep every factory accountable.',
    description: 'Manage access, factory structure, integrations, and the operating controls behind early warning.',
    action: 'Manage factory settings',
    actionHref: '/settings',
  },
  factory_manager: {
    eyebrow: 'Factory control tower',
    title: 'See the constraints before they become delays.',
    description: 'Connect machine health to quality, people, materials, and delivery commitments across your factory.',
    action: 'Review factory risks',
    actionHref: '/analytics',
  },
  worker: {
    eyebrow: 'Shift action board',
    title: 'Know what needs attention next.',
    description: 'See the affected machine, the reason it was flagged, and the safest next step for your shift.',
    action: 'View assigned machines',
    actionHref: '/machine/M003',
  },
  operator: {
    eyebrow: 'Shift action board',
    title: 'Know what needs attention next.',
    description: 'See the affected machine, the reason it was flagged, and the safest next step for your shift.',
    action: 'View assigned machines',
    actionHref: '/machine/M003',
  },
  customer: {
    eyebrow: 'Partner performance report',
    title: 'Know how reliably your goods are moving.',
    description: 'Track factory efficiency, delivery confidence, quality deviations, and the value protected by early action.',
    action: 'Open performance report',
    actionHref: '/analytics',
  },
};

const WORKFLOW_BY_ROLE: Record<AppRole, string[]> = {
  maintenance_engineer: ['Detect signal', 'Diagnose cause', 'Dispatch fix', 'Verify recovery'],
  admin: ['Configure access', 'Connect factories', 'Monitor controls', 'Audit continuity'],
  factory_manager: ['See exposure', 'Prioritize impact', 'Remove constraint', 'Confirm output'],
  worker: ['Read alert', 'Inspect safely', 'Apply solution', 'Report result'],
  operator: ['Read alert', 'Inspect safely', 'Apply solution', 'Report result'],
  customer: ['View health', 'Review quality', 'Track shipment', 'Measure value'],
};

const CONSTRAINTS = [
  {
    key: 'quality',
    label: 'Quality deviations',
    value: '1.8%',
    status: '2 lines need review',
    detail: 'Scrap risk is concentrated around Ring Frame #3 and its outer-race signature.',
    color: '#F59E0B',
    icon: ClipboardCheck,
  },
  {
    key: 'workforce',
    label: 'Workforce constraints',
    value: '1 shift',
    status: 'Coverage gap flagged',
    detail: 'One trained bearing technician is needed on the next planned maintenance window.',
    color: '#38BDF8',
    icon: Users,
  },
  {
    key: 'materials',
    label: 'Material delays',
    value: '18 hrs',
    status: 'Bearing kit at risk',
    detail: 'A replacement kit should be staged before the predicted failure window closes.',
    color: '#EA580C',
    icon: PackageCheck,
  },
];

function MetricCard({ label, value, detail, icon: Icon, color }: { label: string; value: string; detail: string; icon: typeof Activity; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-navy bg-navy-card p-4">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-full opacity-10 blur-2xl" style={{ background: color }} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</div>
          <div className="mt-3 font-mono-data text-2xl font-bold" style={{ color }}>{value}</div>
          <div className="mt-1 text-[10px] text-slate-500">{detail}</div>
        </div>
        <div className="rounded-xl border border-navy bg-[#0A0E1A] p-2.5" style={{ color }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function WorkflowRail({ role }: { role: AppRole }) {
  return (
    <div className="rounded-2xl border border-navy bg-[#0F1629]/80 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber">Role workflow</div>
          <div className="mt-1 text-sm font-bold text-white">From early signal to measurable continuity</div>
        </div>
        <Target className="h-4 w-4 text-amber" />
      </div>
      <div className="grid gap-2 md:grid-cols-4">
        {WORKFLOW_BY_ROLE[role].map((step, index) => (
          <div key={step} className="relative flex items-center gap-2 rounded-xl border border-navy bg-[#0A0E1A]/80 px-3 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber/30 bg-amber/10 font-mono-data text-[10px] font-bold text-amber">{String(index + 1).padStart(2, '0')}</span>
            <span className="text-[11px] font-semibold text-slate-300">{step}</span>
            {index < 3 && <ArrowRight className="absolute -right-3 z-10 hidden h-3 w-3 text-slate-600 md:block" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProblemStatementBrief() {
  return (
    <details className="group rounded-2xl border border-blue-400/20 bg-blue-400/[0.04] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-blue-400/20 bg-blue-400/10 p-2.5 text-blue-300"><Eye className="h-4 w-4" /></div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">Problem statement 1 · Manufacturing</div>
            <div className="mt-1 text-sm font-bold text-white">AI-enabled production disruption early warning</div>
          </div>
        </div>
        <span className="text-[10px] font-mono-data uppercase tracking-widest text-slate-500 group-open:text-blue-300">Read brief</span>
      </summary>
      <div className="mt-4 grid gap-4 border-t border-blue-400/10 pt-4 lg:grid-cols-[220px_1fr]">
        <img src="/problem-statement.png" alt="Provided manufacturing problem statement" className="h-64 w-full rounded-xl border border-navy object-cover object-top opacity-90" />
        <div className="space-y-3 text-xs leading-relaxed text-slate-400">
          <p><strong className="text-white">The disruption:</strong> machine downtime, material delays, quality deviations, workforce constraints, and changing demand priorities are often discovered after they impact output, delivery, or cost.</p>
          <p><strong className="text-white">The data:</strong> production logs, maintenance records, shift schedules, machine status, quality inspections, material availability, time-series readings, issue notes, and synthetic operational events.</p>
          <p><strong className="text-white">The expected response:</strong> identify early signals, explain likely business impact, prioritize risks, recommend actions, and support escalation with role-friendly context.</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {['Predict before impact', 'Explain root cause', 'Recommend next action'].map((item) => (
              <div key={item} className="rounded-lg border border-blue-400/15 bg-[#0A0E1A]/70 px-2.5 py-2 text-[10px] font-bold text-blue-200">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}

function ConstraintGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {CONSTRAINTS.map((item) => (
        <div key={item.key} className="rounded-2xl border border-navy bg-navy-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <item.icon className="h-4 w-4" style={{ color: item.color }} />
              <span className="text-xs font-bold text-white">{item.label}</span>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: item.color, borderColor: `${item.color}40`, background: `${item.color}12` }}>{item.status}</span>
          </div>
          <div className="mt-4 font-mono-data text-xl font-bold" style={{ color: item.color }}>{item.value}</div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

function MaintenancePanel({ machines, alerts }: { machines: any[]; alerts: any[] }) {
  const rows = alerts.length > 0 ? alerts.slice(0, 3) : FALLBACK_ALERTS;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-navy bg-navy-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber">Priority queue</div><h2 className="mt-1 text-base font-bold text-white">Interventions ranked by production impact</h2></div>
          <Wrench className="h-5 w-5 text-amber" />
        </div>
        <div className="space-y-2">
          {rows.map((alert: any, index: number) => {
            const critical = alert.type === 'CRITICAL' || alert.severity === 'critical';
            return (
              <div key={alert.id || index} className="flex items-center gap-3 rounded-xl border border-navy bg-[#0A0E1A]/75 p-3">
                <div className={`rounded-lg p-2 ${critical ? 'bg-red-500/10 text-red-400' : 'bg-amber/10 text-amber'}`}><CircleAlert className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-xs font-bold text-white">{alert.machineName || alert.machineId}</span><span className="font-mono-data text-[9px] text-slate-600">#{index + 1}</span></div><div className="mt-1 truncate text-[11px] text-slate-500">{alert.message}</div></div>
                <Link href={`/machine/${alert.machineId || machines[index]?.id || 'M003'}`} className="shrink-0 rounded-lg border border-amber/25 px-2.5 py-1.5 text-[10px] font-bold text-amber transition hover:bg-amber/10">Diagnose</Link>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-2xl border border-amber/20 bg-amber/[0.04] p-5">
        <div className="flex items-center gap-2 text-amber"><ShieldCheck className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Engineer decision note</span></div>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">Ring Frame #3 is the first intervention because the frequency signature and elevated vibration can become a quality and delivery event, not just a machine event.</p>
        <div className="mt-4 space-y-2 text-[11px] text-slate-500"><div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Stage replacement bearing kit</div><div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Assign trained technician to next window</div><div className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Verify RMS and temperature after repair</div></div>
      </div>
    </div>
  );
}

function ManagerPanel({ summary, roi }: { summary: any; roi: any }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-navy bg-navy-card p-5">
        <div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Factory control tower</div><h2 className="mt-1 text-base font-bold text-white">Business impact, not isolated alerts</h2></div><Factory className="h-5 w-5 text-sky-300" /></div>
        <div className="grid grid-cols-2 gap-2">
          {[['Output at risk', '8.4%', 'M003 + M002 exposure', '#EA580C'], ['On-time confidence', '94.2%', 'Based on active constraints', '#10B981'], ['Downtime protected', `${roi.downtimePrevented ?? 18} hrs`, 'Resolved early warnings', '#38BDF8'], ['Active lines', `${summary.totalMachines ?? 6}`, 'Factory Unit A', '#F59E0B']].map(([label, value, detail, color]) => <div key={label} className="rounded-xl border border-navy bg-[#0A0E1A]/70 p-3"><div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div><div className="mt-2 font-mono-data text-lg font-bold" style={{ color }}>{value}</div><div className="mt-1 text-[10px] text-slate-600">{detail}</div></div>)}
        </div>
      </div>
      <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-5">
        <div className="flex items-center gap-2 text-sky-300"><TrendingUp className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Manager decision queue</span></div>
        <div className="mt-4 space-y-3"><div className="flex gap-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber" /><div><div className="text-xs font-bold text-white">Protect the next delivery slot</div><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Approve a planned maintenance window before the critical bearing becomes unplanned downtime.</p></div></div><div className="flex gap-3"><Users className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" /><div><div className="text-xs font-bold text-white">Move trained coverage</div><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Assign one technician and one line supervisor to close the quality risk.</p></div></div><div className="flex gap-3"><Truck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><div><div className="text-xs font-bold text-white">Stage material now</div><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Replacement stock is cheaper than a missed customer dispatch.</p></div></div></div>
      </div>
    </div>
  );
}

function WorkerPanel({ machines }: { machines: any[] }) {
  const [done, setDone] = useState<string[]>([]);
  const tasks = [{ id: 'inspect', title: 'Inspect Ring Frame #3', detail: 'Check outer race for pitting and listen for impact noise.', href: '/machine/M003' }, { id: 'stage', title: 'Stage replacement bearing kit', detail: 'Confirm kit 6205 is available before the next stop.', href: '/hardware' }, { id: 'report', title: 'Record post-fix reading', detail: 'Submit RPM and temperature after the intervention.', href: '/hardware' }];
  return (
    <div className="rounded-2xl border border-navy bg-navy-card p-5">
      <div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">My shift actions</div><h2 className="mt-1 text-base font-bold text-white">Safe, specific, and easy to complete</h2></div><HardHat className="h-5 w-5 text-emerald-400" /></div>
      <div className="space-y-2">{tasks.map((task, index) => { const complete = done.includes(task.id); return <div key={task.id} className={`flex items-center gap-3 rounded-xl border p-3 transition ${complete ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-navy bg-[#0A0E1A]/75'}`}><button aria-label={complete ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`} onClick={() => setDone((current) => complete ? current.filter((id) => id !== task.id) : [...current, task.id])} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-400' : 'border-slate-600 text-slate-600 hover:border-emerald-400 hover:text-emerald-400'}`}>{complete ? <CheckCircle2 className="h-4 w-4" /> : <span className="font-mono-data text-[10px]">{index + 1}</span>}</button><div className="min-w-0 flex-1"><div className={`text-xs font-bold ${complete ? 'text-emerald-300 line-through' : 'text-white'}`}>{task.title}</div><div className="mt-1 text-[11px] leading-relaxed text-slate-500">{task.detail}</div></div><Link href={task.href} className="shrink-0 text-[10px] font-bold text-emerald-400 hover:text-white">Open</Link></div>; })}</div>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2 text-[10px] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Predictions are guidance — confirm with an engineer before changing machinery.</div>
      <div className="mt-3 text-[10px] text-slate-600">{machines.length || 3} assigned machines visible · no financial or admin controls</div>
    </div>
  );
}

function CustomerPanel({ summary, roi, customerName }: { summary: any; roi: any; customerName: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl border border-navy bg-navy-card p-5">
        <div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300">{customerName} · Factory Unit A</div><h2 className="mt-1 text-base font-bold text-white">Supply commitment health</h2></div><Truck className="h-5 w-5 text-purple-300" /></div>
        <div className="overflow-hidden rounded-xl border border-navy"><div className="grid grid-cols-[1.2fr_0.7fr_0.7fr] border-b border-navy bg-[#0A0E1A] px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-600"><span>Order stream</span><span>Status</span><span>Confidence</span></div>{[['Spring collection · yarn', 'On track', '96%'], ['Core replenishment', 'Watch', '88%'], ['Custom lot · 6205 line', 'Protected', '93%']].map(([name, status, confidence]) => <div key={name} className="grid grid-cols-[1.2fr_0.7fr_0.7fr] items-center border-b border-navy/60 px-3 py-3 last:border-0"><span className="text-[11px] text-slate-300">{name}</span><span className={`text-[10px] font-bold ${status === 'Watch' ? 'text-amber' : 'text-emerald-400'}`}>{status}</span><span className="font-mono-data text-[11px] text-white">{confidence}</span></div>)}</div>
      </div>
      <div className="rounded-2xl border border-purple-400/20 bg-purple-400/[0.04] p-5">
        <div className="flex items-center gap-2 text-purple-300"><Banknote className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-[0.18em]">Value protected</span></div>
        <div className="mt-4 font-mono-data text-3xl font-bold text-white">₹{Number(roi.estimatedSavings ?? 54000).toLocaleString()}</div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Estimated continuity value from early warnings, resolved alerts, and avoided downtime at the connected factory.</p>
        <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-navy bg-[#0A0E1A]/70 p-3"><div className="text-[9px] uppercase tracking-wider text-slate-500">On-time</div><div className="mt-1 font-mono-data text-lg font-bold text-emerald-400">94.2%</div></div><div className="rounded-xl border border-navy bg-[#0A0E1A]/70 p-3"><div className="text-[9px] uppercase tracking-wider text-slate-500">Factory health</div><div className="mt-1 font-mono-data text-lg font-bold text-amber">{summary.avgHealthScore ?? 78}%</div></div></div>
      </div>
    </div>
  );
}

function AdminPanel({ data }: { data: RoleDashboardData }) {
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    authApi.getUsers().then((response) => {
      if (Array.isArray(response.data?.data)) setUsers(response.data.data);
    }).catch(() => {});
  }, []);

  const updateRole = async (user: any, role: string) => {
    try {
      const response = await authApi.updateUserRole(user._id || user.id, { role, factoryUnits: user.factoryUnits || [] });
      const updated = response.data?.data;
      if (updated) setUsers((current) => current.map((item) => (item._id === user._id ? updated : item)));
    } catch {
      // Keep the last confirmed role visible if the API rejects the change.
    }
  };

  const visibleUsers = users.length > 0 ? users : [
    { _id: 'demo-maintenance', name: 'Maintenance Engineer', email: 'maintenance@smartbearing.com', role: 'maintenance_engineer', factoryUnits: ['unit-a', 'unit-b'] },
    { _id: 'demo-manager', name: 'Factory Manager', email: 'manager@smartbearing.com', role: 'factory_manager', factoryUnits: ['unit-a'] },
    { _id: 'demo-worker', name: 'Line Worker', email: 'worker@smartbearing.com', role: 'worker', factoryUnits: ['unit-a'] },
    { _id: 'demo-customer', name: 'Mangalya Narayana', email: 'customer@mangalyanarayana.com', role: 'customer', factoryUnits: ['unit-a'] },
  ];

  return (
    <div className="rounded-2xl border border-navy bg-navy-card p-5">
      <div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300">Governance overview</div><h2 className="mt-1 text-base font-bold text-white">Access and factory health</h2></div><LockKeyhole className="h-5 w-5 text-purple-300" /></div>
      <div className="grid gap-3 md:grid-cols-4">{[['Roles', '5', 'Engineer · manager · worker · customer', Users], ['Factories', '2', 'Unit A · Unit B', Factory], ['Machines', String(data.summary.totalMachines ?? 6), 'Monitored assets', Boxes], ['Policy', 'Least privilege', 'Actions are role-gated', ShieldCheck]].map(([label, value, detail, Icon]) => <div key={label as string} className="rounded-xl border border-navy bg-[#0A0E1A]/70 p-3"><Icon className="h-4 w-4 text-purple-300" /><div className="mt-3 font-mono-data text-base font-bold text-white">{value as string}</div><div className="mt-1 text-[9px] uppercase tracking-wider text-slate-500">{label as string}</div><div className="mt-1 text-[10px] text-slate-600">{detail as string}</div></div>)}</div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-purple-400/15 bg-purple-400/[0.04] px-3 py-2.5"><span className="text-[11px] text-slate-400">Admin can govern access; maintenance engineers own operational intervention.</span><Link href="/settings" className="text-[10px] font-bold text-purple-300 hover:text-white">Open governance settings <ArrowRight className="ml-1 inline h-3 w-3" /></Link></div>
      <div className="mt-4 border-t border-navy pt-4">
        <div className="mb-3 flex items-center justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300">People & access</div><div className="mt-1 text-xs text-slate-500">Assign role and factory scope from one place.</div></div><Users className="h-4 w-4 text-purple-300" /></div>
        <div className="grid gap-2 md:grid-cols-2">
          {visibleUsers.map((user: any) => (
            <div key={user._id || user.id || user.email} className="flex items-center gap-3 rounded-xl border border-navy bg-[#0A0E1A]/70 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-purple-400/20 bg-purple-400/10 text-[10px] font-bold text-purple-300">{String(user.name || 'U').slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-white">{user.name}</div><div className="truncate text-[10px] text-slate-600">{user.email} · {(user.factoryUnits || []).join(', ') || 'unassigned'}</div></div>
              <select aria-label={`Role for ${user.name}`} value={user.role} onChange={(event) => updateRole(user, event.target.value)} className="max-w-[132px] rounded-lg border border-navy bg-[#0F1629] px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-300 outline-none focus:border-purple-400/50">
                {Object.entries(ROLE_DEFINITIONS).map(([value, item]) => <option key={value} value={value}>{item.shortLabel}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RoleDashboard() {
  const user = getCurrentUser();
  const role = normalizeRole(user.role);
  const definition = ROLE_DEFINITIONS[role];
  const copy = ROLE_COPY[role];
  const [data, setData] = useState<RoleDashboardData>(EMPTY_DATA);
  const { sensors } = useRealSensors();

  useEffect(() => {
    let active = true;
    Promise.allSettled([machinesApi.getAll(), alertsApi.getAll({ status: 'active' }), analyticsApi.getSummary(), analyticsApi.getROI()]).then((results) => {
      if (!active) return;
      const [machinesResult, alertsResult, summaryResult, roiResult] = results;
      setData({
        machines: machinesResult.status === 'fulfilled' ? machinesResult.value.data?.data ?? [] : [],
        alerts: alertsResult.status === 'fulfilled' ? alertsResult.value.data?.data ?? [] : [],
        summary: summaryResult.status === 'fulfilled' ? { ...EMPTY_DATA.summary, ...summaryResult.value.data?.data } : EMPTY_DATA.summary,
        roi: roiResult.status === 'fulfilled' ? { ...EMPTY_DATA.roi, ...roiResult.value.data?.data } : EMPTY_DATA.roi,
      });
    });
    return () => { active = false; };
  }, []);

  const machines = data.machines.length > 0 ? data.machines : FALLBACK_MACHINES;
  const alerts = data.alerts.length > 0 ? data.alerts : FALLBACK_ALERTS;
  const criticalCount = alerts.filter((alert) => alert.type === 'CRITICAL' || alert.severity === 'critical').length;
  const currentHealth = data.summary.avgHealthScore ?? 78;
  const liveCount = sensors.length || data.summary.totalMachines * 5 || 30;
  const panel = useMemo(() => {
    if (role === 'maintenance_engineer') return <div className="space-y-4"><MaintenancePanel machines={machines} alerts={alerts} /><AdminPanel data={data} /></div>;
    if (role === 'factory_manager') return <ManagerPanel summary={data.summary} roi={data.roi} />;
    if (role === 'worker' || role === 'operator') return <WorkerPanel machines={machines} />;
    if (role === 'customer') return <CustomerPanel summary={data.summary} roi={data.roi} customerName={user.customerName || user.name || 'Brand Customer'} />;
    return <AdminPanel data={data} />;
  }, [alerts, data, machines, role]);

  return (
    <DashLayout>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-amber/20 bg-gradient-to-br from-[#141E35] via-[#0F1629] to-[#0A0E1A] p-5 sm:p-7">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-amber/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: definition.accent, borderColor: `${definition.accent}40`, background: `${definition.accent}12` }}>{definition.label}</span><span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Factory Unit A live</span></div><div className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-amber">{copy.eyebrow}</div><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{copy.title}</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">{copy.description}</p></div>
            <Link href={copy.actionHref} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-xs font-bold text-[#0A0E1A] transition hover:bg-amber/90">{copy.action}<ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="relative mt-6 grid gap-2 border-t border-white/5 pt-4 text-[10px] text-slate-500 sm:grid-cols-3"><div className="flex items-center gap-2"><Activity className="h-3.5 w-3.5 text-amber" /> Early-warning signals combine machine and business context</div><div className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-sky-300" /> {liveCount} telemetry points in the current view</div><div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Actions remain human-confirmed</div></div>
        </motion.div>

        <ProblemStatementBrief />
        <WorkflowRail role={role} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Factory health" value={`${currentHealth}%`} detail="Latest scoped machine readings" icon={Activity} color="#10B981" />
          <MetricCard label="Critical signals" value={String(criticalCount)} detail={`${data.summary.alertsToday ?? 3} alerts raised today`} icon={AlertTriangle} color="#EA580C" />
          <MetricCard label="Continuity protected" value={`${data.roi.downtimePrevented ?? 18} hrs`} detail={`₹${Number(data.roi.estimatedSavings ?? 54000).toLocaleString()} estimated value`} icon={TrendingUp} color="#38BDF8" />
          <MetricCard label="Connected assets" value={String(data.summary.totalMachines ?? 6)} detail={`${data.summary.sensorUptime ?? 94}% sensor uptime`} icon={Factory} color="#F59E0B" />
        </div>

        <ConstraintGrid />
        {panel}

        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-navy bg-[#0F1629]/70 p-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><div className="rounded-xl border border-amber/20 bg-amber/10 p-2.5 text-amber"><Boxes className="h-4 w-4" /></div><div><div className="text-xs font-bold text-white">Explore the physical workflow</div><div className="mt-1 text-[11px] text-slate-500">Open the 3D twin to connect a machine signal to a real maintenance decision.</div></div></div><Link href="/twin/bench" className="inline-flex items-center gap-2 text-xs font-bold text-amber hover:text-white">Open 3D Digital Twin <ArrowRight className="h-3.5 w-3.5" /></Link></div>
      </div>
    </DashLayout>
  );
}
