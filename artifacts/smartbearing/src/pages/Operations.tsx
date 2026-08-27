import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, AlertTriangle, ArrowRight, Banknote, CheckCircle2, CircleAlert,
  ClipboardCheck, Clock3, FileUp, Factory, Gauge, MessageSquare, PackageCheck,
  ShieldAlert, ShieldCheck, Target, Truck, Users, Wrench, X, Zap,
} from 'lucide-react';
import DashLayout from '@/components/layout/DashLayout';
import { operationsApi } from '@/lib/api';
import { getCurrentRole, ROLE_DEFINITIONS, type AppRole } from '@/lib/roles';
import { useI18n } from '@/i18n';

type ModalMode = 'create' | 'assign' | 'action' | 'comment' | 'evidence' | 'resolve' | 'impact' | null;

interface Incident {
  _id: string;
  incidentNo: string;
  category: string;
  severity: string;
  title: string;
  description?: string;
  factoryUnit: string;
  machineId?: string;
  orderId?: string;
  status: string;
  stage: string;
  ownerName?: string;
  ownerTeam?: string;
  dueAt?: string;
  impactScore?: number;
  escalationLevel?: number;
  rootCause?: string;
  recoveryVerified?: boolean;
}

interface Overview {
  orders: any[];
  runs: any[];
  materials: any[];
  quality: any[];
  workforce: any[];
  incidents: Incident[];
  impacts: any[];
  kpis: { plannedOutput: number; goodOutput: number; scheduleAdherence: number; downtimeHours: number; scrapQuantity: number; estimatedLoss: number; activeIncidentCount: number; outputLoss: number; overtimeCost: number; oee: number };
}

const INITIAL_OVERVIEW: Overview = { orders: [], runs: [], materials: [], quality: [], workforce: [], incidents: [], impacts: [], kpis: { plannedOutput: 0, goodOutput: 0, scheduleAdherence: 0, downtimeHours: 0, scrapQuantity: 0, estimatedLoss: 0, activeIncidentCount: 0, outputLoss: 0, overtimeCost: 0, oee: 0 } };

const STAGES = ['detect', 'triage', 'investigate', 'correct', 'verify', 'closed'];

const CATEGORY_META: Record<string, { label: string; color: string; icon: typeof Activity; translation: string }> = {
  machine_downtime: { label: 'Machine downtime', color: '#EA580C', icon: Wrench, translation: 'machineDowntime' },
  quality_deviation: { label: 'Quality deviation', color: '#F59E0B', icon: ClipboardCheck, translation: 'quality' },
  material_delay: { label: 'Material delay', color: '#EA580C', icon: PackageCheck, translation: 'materials' },
  workforce_constraint: { label: 'Workforce constraint', color: '#38BDF8', icon: Users, translation: 'workforce' },
  demand_change: { label: 'Demand priority change', color: '#A78BFA', icon: Truck, translation: 'demandChange' },
};

function formatDue(dueAt?: string) {
  if (!dueAt) return 'No due date';
  const date = new Date(dueAt);
  const hours = Math.round((date.getTime() - Date.now()) / 3_600_000);
  if (hours < 0) return `${Math.abs(hours)}h overdue`;
  if (hours < 24) return `${hours}h remaining`;
  return `${Math.round(hours / 24)}d remaining`;
}

function isBreached(dueAt?: string) {
  return Boolean(dueAt && new Date(dueAt).getTime() < Date.now());
}

function KpiCard({ label, value, detail, icon: Icon, color }: { label: string; value: string; detail: string; icon: typeof Activity; color: string }) {
  return <div className="rounded-2xl border border-navy bg-navy-card p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</div><div className="mt-3 font-mono-data text-2xl font-bold" style={{ color }}>{value}</div><div className="mt-1 text-[10px] text-slate-600">{detail}</div></div><div className="rounded-xl border border-navy bg-[#0A0E1A] p-2.5" style={{ color }}><Icon className="h-4 w-4" /></div></div></div>;
}

function StageProgress({ stage }: { stage: string }) {
  const activeIndex = Math.max(0, STAGES.indexOf(stage));
  return <div className="flex items-center gap-1">{STAGES.map((item, index) => <div key={item} className="flex flex-1 items-center gap-1"><div className={`h-1.5 w-full rounded-full ${index <= activeIndex ? 'bg-amber' : 'bg-navy'}`} /><span className={`hidden text-[8px] uppercase tracking-wider sm:block ${index === activeIndex ? 'text-amber' : 'text-slate-600'}`}>{item}</span></div>)}</div>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}><motion.div initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="w-full max-w-lg rounded-2xl border border-navy bg-[#0F1629] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h2 className="text-base font-bold text-white">{title}</h2><button onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button></div>{children}</motion.div></motion.div>;
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-slate-500">{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-navy bg-[#0A0E1A] px-3 py-2 text-xs text-white outline-none placeholder:text-slate-700 focus:border-amber/50" /></label>;
}

export default function Operations() {
  const role = getCurrentRole();
  const { t } = useI18n();
  const definition = ROLE_DEFINITIONS[role];
  const canManage = role === 'maintenance_engineer' || role === 'admin' || role === 'factory_manager';
  const canAct = canManage || role === 'worker' || role === 'operator';
  const customer = role === 'customer';
  const [overview, setOverview] = useState<Overview>(INITIAL_OVERVIEW);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Incident | null>(null);
  const [activity, setActivity] = useState<any>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await operationsApi.overview();
      setOverview(response.data?.data || INITIAL_OVERVIEW);
      setError('');
    } catch {
      setError('Operations data is unavailable. Start the API server and seed the development database.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  const openIncident = async (incident: Incident) => {
    setSelected(incident);
    try {
      const response = await operationsApi.getActivity(incident._id);
      setActivity(response.data?.data || null);
    } catch { setActivity(null); }
  };

  const closeModal = () => { setModal(null); setForm({}); setError(''); };
  const setField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const openModal = (mode: ModalMode, incident?: Incident) => { if (incident) setSelected(incident); setForm({}); setModal(mode); setError(''); };

  const submit = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      if (modal === 'create') {
        await operationsApi.createIncident({ title: form.title, description: form.description, category: form.category || 'machine_downtime', severity: form.severity || 'medium', factoryUnit: form.factoryUnit || 'unit-a', machineId: form.machineId, dueAt: form.dueAt || undefined, responseSlaMinutes: Number(form.responseSlaMinutes) || 60, resolutionSlaMinutes: Number(form.resolutionSlaMinutes) || 1440, impactScore: Number(form.impactScore) || 0 });
      } else if (!selected) return;
      else if (modal === 'assign') {
        await operationsApi.assignIncident(selected._id, { ownerUserId: form.ownerUserId || form.ownerName, ownerName: form.ownerName, ownerTeam: form.ownerTeam });
      } else if (modal === 'action') {
        await operationsApi.createAction(selected._id, { title: form.title, description: form.description, ownerUserId: form.ownerUserId, ownerName: form.ownerName, dueAt: form.dueAt || undefined });
      } else if (modal === 'comment') {
        await operationsApi.addComment(selected._id, form.body || '', customer ? 'customer' : (form.visibility === 'customer' ? 'customer' : 'internal'));
      } else if (modal === 'evidence') {
        await operationsApi.addEvidence(selected._id, { fileName: form.fileName, mimeType: form.mimeType || 'application/octet-stream', size: Number(form.size) || 0, storageRef: form.storageRef || `browser://${form.fileName}`, notes: form.notes });
      } else if (modal === 'resolve') {
        await operationsApi.resolve(selected._id, { rootCause: form.rootCause, recoveryEvidence: form.recoveryEvidence });
      } else if (modal === 'impact') {
        await operationsApi.calculateImpact(selected._id, { productionValuePerUnit: Number(form.productionValuePerUnit), unitsAtRisk: Number(form.unitsAtRisk), orderUrgency: Number(form.orderUrgency), deliveryHoursRemaining: Number(form.deliveryHoursRemaining), materialAvailability: Number(form.materialAvailability), qualityLossRate: Number(form.qualityLossRate), laborCost: Number(form.laborCost), scrapCost: Number(form.scrapCost), downtimeHours: Number(form.downtimeHours) });
      }
      closeModal();
      await loadOverview();
      if (selected) await openIncident(selected);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || 'Unable to save this workflow update.');
    } finally { setBusy(false); }
  };

  const escalate = async (incident: Incident) => {
    setBusy(true);
    try { await operationsApi.escalate(incident._id, { reason: `Escalated by ${definition.label}` }); await loadOverview(); if (selected?._id === incident._id) await openIncident(incident); } catch { setError('Escalation failed.'); } finally { setBusy(false); }
  };

  const verifyRecovery = async (recovered: boolean) => {
    if (!selected) return;
    setBusy(true);
    try { await operationsApi.verifyRecovery(selected._id, { recovered, evidence: form.recoveryEvidence }); closeModal(); await loadOverview(); await openIncident(selected); } catch { setError('Recovery verification failed.'); } finally { setBusy(false); }
  };

  const incidents = useMemo(() => filter === 'all' ? overview.incidents : overview.incidents.filter((incident) => incident.category === filter), [filter, overview.incidents]);
  const materialRisk = overview.materials.filter((material) => material.status === 'shortage' || material.status === 'delayed').length;
  const qualityRisk = overview.quality.filter((inspection) => inspection.result === 'fail' || inspection.result === 'watch').length;
  const workforceRisk = overview.workforce.filter((assignment) => assignment.availability !== 'available').length;

  return <DashLayout>
    <div className="mx-auto max-w-[1550px] space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: definition.accent, borderColor: `${definition.accent}40`, background: `${definition.accent}12` }}>{definition.label}</span><span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">{customer ? 'Read-only partner view' : 'Action-enabled workspace'}</span></div><div className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-amber">{t('operations')}</div><h1 className="mt-1 font-display text-3xl font-bold text-white">{customer ? 'Supply confidence, explained.' : 'Disruptions, ranked by impact.'}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">{customer ? 'See the factory signals that can affect quality, delivery, and protected value without exposing internal workforce or machine controls.' : 'One workflow connects machine health, production, quality, materials, workforce, demand, and business impact.'}</p></div>{canManage && <button onClick={() => openModal('create')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber px-4 py-2.5 text-xs font-bold text-[#0A0E1A] hover:bg-amber/90"><Zap className="h-3.5 w-3.5" /> {t('createIncident')}</button>}</div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs text-red-300"><ShieldAlert className="h-4 w-4 shrink-0" />{error}<button onClick={() => setError('')} className="ml-auto text-red-300/60 hover:text-white"><X className="h-3.5 w-3.5" /></button></div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><KpiCard label="OEE" value={`${overview.kpis.oee}%`} detail="Availability x performance x quality" icon={Gauge} color="#10B981" /><KpiCard label="Schedule adherence" value={`${overview.kpis.scheduleAdherence}%`} detail={`${overview.kpis.goodOutput.toLocaleString()} good units`} icon={Target} color="#38BDF8" /><KpiCard label="Output loss" value={overview.kpis.outputLoss.toLocaleString()} detail="Planned units not produced" icon={Activity} color="#EA580C" /><KpiCard label="Downtime exposure" value={`${overview.kpis.downtimeHours} hrs`} detail={`${overview.kpis.activeIncidentCount} active incidents`} icon={Clock3} color="#EA580C" /><KpiCard label="Quality holds" value={String(qualityRisk)} detail="Fail or watch inspections" icon={ClipboardCheck} color="#F59E0B" /><KpiCard label="Value at risk" value={`INR ${Number(overview.kpis.estimatedLoss || 0).toLocaleString()}`} detail={`INR ${Number(overview.kpis.overtimeCost || 0).toLocaleString()} overtime`} icon={Banknote} color="#A78BFA" /></div>

      <div className="grid gap-3 md:grid-cols-3"><div className="rounded-2xl border border-amber/20 bg-amber/[0.04] p-4"><div className="flex items-center gap-2 text-amber"><ClipboardCheck className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-widest">{t('quality')}</span></div><div className="mt-3 text-xs text-slate-300">{qualityRisk ? `${qualityRisk} inspections need disposition before release.` : 'No quality holds in this scope.'}</div></div><div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-4"><div className="flex items-center gap-2 text-sky-300"><Users className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-widest">{t('workforce')}</span></div><div className="mt-3 text-xs text-slate-300">{workforceRisk ? `${workforceRisk} assignments have partial or unavailable coverage.` : 'Coverage is available for current work.'}</div></div><div className="rounded-2xl border border-orange-400/20 bg-orange-400/[0.04] p-4"><div className="flex items-center gap-2 text-orange-300"><Truck className="h-4 w-4" /><span className="text-[10px] font-bold uppercase tracking-widest">{t('materials')}</span></div><div className="mt-3 text-xs text-slate-300">{materialRisk ? `${materialRisk} material records can threaten a delivery window.` : 'No material shortages detected.'}</div></div></div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="rounded-2xl border border-navy bg-navy-card p-4 sm:p-5"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber">{t('incidentQueue')}</div><h2 className="mt-1 text-base font-bold text-white">{customer ? 'Customer-visible disruption signals' : 'Unified disruption queue'}</h2></div><div className="flex flex-wrap gap-1.5"><button onClick={() => setFilter('all')} className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider ${filter === 'all' ? 'border-amber/40 bg-amber/10 text-amber' : 'border-navy text-slate-500'}`}>{t('allSignals')}</button>{Object.entries(CATEGORY_META).slice(0, 5).map(([key, meta]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-lg border px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider ${filter === key ? 'border-amber/40 bg-amber/10 text-amber' : 'border-navy text-slate-500'}`}>{t(meta.translation)}</button>)}</div></div>{loading ? <div className="flex items-center justify-center py-16 text-xs text-slate-500"><Activity className="mr-2 h-4 w-4 animate-pulse text-amber" />Loading operational signals...</div> : incidents.length === 0 ? <div className="rounded-xl border border-dashed border-navy py-16 text-center text-xs text-slate-500"><CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-emerald-400/60" />{t('noIncidents')}</div> : <div className="space-y-3">{incidents.map((incident) => { const meta = CATEGORY_META[incident.category] || CATEGORY_META.machine_downtime; const Icon = meta.icon; const breached = isBreached(incident.dueAt); return <motion.div layout key={incident._id} className={`rounded-xl border p-4 transition ${selected?._id === incident._id ? 'border-amber/40 bg-amber/[0.04]' : 'border-navy bg-[#0A0E1A]/60 hover:border-slate-700'}`}><div className="flex items-start gap-3"><div className="rounded-xl p-2.5" style={{ color: meta.color, background: `${meta.color}15` }}><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono-data text-[9px] text-slate-600">{incident.incidentNo}</span><span className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}10` }}>{incident.severity}</span><span className="text-[10px] uppercase tracking-wider text-slate-600">{incident.status.replace('_', ' ')}</span></div><h3 className="mt-2 text-sm font-bold text-white">{incident.title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{customer ? 'Operational signal can affect your delivery and quality commitment.' : incident.description}</p></div><div className="text-right"><div className="font-mono-data text-lg font-bold" style={{ color: (incident.impactScore || 0) >= 70 ? '#EA580C' : '#F59E0B' }}>{incident.impactScore || 0}</div><div className="text-[8px] uppercase tracking-widest text-slate-600">impact</div></div></div><div className="mt-4"><StageProgress stage={incident.stage} /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className={`flex items-center gap-2 text-[10px] font-mono-data ${breached ? 'text-red-300' : 'text-slate-500'}`}><Clock3 className="h-3.5 w-3.5" />{t('sla')}: {formatDue(incident.dueAt)}{incident.ownerName && <span className="ml-1 text-slate-600">· {incident.ownerName}</span>}</div><div className="flex flex-wrap gap-1.5"><button onClick={() => void openIncident(incident)} className="rounded-lg border border-navy px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:border-amber/40 hover:text-amber">Open</button>{canManage && <><button onClick={() => openModal('assign', incident)} className="rounded-lg border border-navy px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:border-amber/40 hover:text-amber">{t('assign')}</button><button onClick={() => void escalate(incident)} disabled={busy} className="rounded-lg border border-red-500/20 px-2.5 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-500/10">{t('escalate')}</button></>}{canAct && !customer && <button onClick={() => openModal('action', incident)} className="rounded-lg border border-navy px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:border-amber/40 hover:text-amber">{t('correctiveAction')}</button>}</div></div></motion.div>; })}</div>}</section>

        <aside className="rounded-2xl border border-navy bg-[#0F1629] p-4 sm:p-5"><div className="mb-4 flex items-center justify-between"><div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">{selected ? selected.incidentNo : 'Workflow guide'}</div><h2 className="mt-1 text-base font-bold text-white">{selected ? 'Investigation workspace' : 'How the loop closes'}</h2></div>{selected ? <CircleAlert className="h-5 w-5 text-amber" /> : <ShieldCheck className="h-5 w-5 text-emerald-400" />}</div>{selected ? <div className="space-y-4"><div><div className="text-sm font-bold text-white">{selected.title}</div><div className="mt-1 text-[11px] text-slate-500">{selected.factoryUnit}{selected.machineId ? ` · ${selected.machineId}` : ''}{selected.orderId ? ` · ${selected.orderId}` : ''}</div></div>{activity?.impact && <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.04] p-3"><div className="flex items-center gap-2 text-sky-300"><Banknote className="h-3.5 w-3.5" /><span className="text-[9px] font-bold uppercase tracking-widest">Live-input impact</span></div><div className="mt-3 grid grid-cols-2 gap-2"><div><div className="text-[9px] text-slate-500">Production value at risk</div><div className="font-mono-data text-sm font-bold text-white">INR {Number(activity.impact.productionValueAtRisk || 0).toLocaleString()}</div></div><div><div className="text-[9px] text-slate-500">Estimated loss</div><div className="font-mono-data text-sm font-bold text-orange-300">INR {Number(activity.impact.estimatedLoss || 0).toLocaleString()}</div></div><div><div className="text-[9px] text-slate-500">Delivery risk</div><div className="font-mono-data text-sm font-bold text-amber">{activity.impact.deliveryRisk}%</div></div><div><div className="text-[9px] text-slate-500">Confidence</div><div className="font-mono-data text-sm font-bold text-emerald-400">{Math.round(activity.impact.confidence * 100)}%</div></div></div></div>}{!customer && <div className="grid grid-cols-2 gap-2">{canManage && <button onClick={() => openModal('impact', selected)} className="rounded-lg border border-sky-400/20 bg-sky-400/[0.04] px-2 py-2 text-[10px] font-bold text-sky-300">Calculate impact</button>}<button onClick={() => openModal('comment', selected)} className="rounded-lg border border-navy px-2 py-2 text-[10px] font-bold text-slate-300"><MessageSquare className="mr-1 inline h-3 w-3" />{t('comments')}</button><button onClick={() => openModal('evidence', selected)} className="rounded-lg border border-navy px-2 py-2 text-[10px] font-bold text-slate-300"><FileUp className="mr-1 inline h-3 w-3" />{t('evidence')}</button>{canManage && <button onClick={() => openModal('resolve', selected)} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-2 py-2 text-[10px] font-bold text-emerald-300">{t('rootCause')}</button>}</div>}{customer && <div className="rounded-xl border border-purple-400/20 bg-purple-400/[0.04] p-3 text-[11px] leading-relaxed text-purple-200">Customer view hides internal owners, workforce detail, and machine controls. Your view focuses on delivery, quality, and value.</div>}{activity && <div className="space-y-2 border-t border-navy pt-3"><div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Activity</div>{[...(activity.actions || []).map((item: any) => ({ label: t('correctiveAction'), value: item.title })), ...(activity.comments || []).map((item: any) => ({ label: t('comments'), value: item.body })), ...(activity.evidence || []).map((item: any) => ({ label: t('evidence'), value: item.fileName })), ...(activity.escalations || []).map((item: any) => ({ label: t('escalate'), value: item.reason }))].slice(-5).map((item, index) => <div key={`${item.label}-${index}`} className="rounded-lg border border-navy bg-[#0A0E1A]/70 px-2.5 py-2"><div className="text-[9px] uppercase tracking-wider text-amber">{item.label}</div><div className="mt-1 text-[10px] leading-relaxed text-slate-400">{item.value}</div></div>)}</div>}{selected.status === 'resolved' && !customer && <div className="rounded-xl border border-amber/20 bg-amber/[0.04] p-3"><div className="text-[9px] font-bold uppercase tracking-widest text-amber">{t('verifyRecovery')}</div><div className="mt-2 flex gap-2"><button onClick={() => { setForm({}); void verifyRecovery(true); }} className="flex-1 rounded-lg bg-emerald-500/15 px-2 py-2 text-[10px] font-bold text-emerald-300">{t('recovered')}</button><button onClick={() => { setForm({}); void verifyRecovery(false); }} className="flex-1 rounded-lg border border-red-500/20 px-2 py-2 text-[10px] font-bold text-red-300">{t('notRecovered')}</button></div></div>}</div> : <div className="space-y-3 text-xs leading-relaxed text-slate-500"><div className="flex gap-3"><span className="font-mono-data text-amber">01</span><span><strong className="text-slate-300">Detect</strong> machine, quality, material, workforce, and demand signals.</span></div><div className="flex gap-3"><span className="font-mono-data text-amber">02</span><span><strong className="text-slate-300">Understand</strong> the likely cause and business impact using live inputs.</span></div><div className="flex gap-3"><span className="font-mono-data text-amber">03</span><span><strong className="text-slate-300">Act</strong> with an owner, corrective action, due date, and SLA.</span></div><div className="flex gap-3"><span className="font-mono-data text-amber">04</span><span><strong className="text-slate-300">Verify</strong> recovery before closing the incident.</span></div><Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 text-[10px] font-bold text-amber hover:text-white">Back to role dashboard <ArrowRight className="h-3 w-3" /></Link></div>}</aside>
      </div>
    </div>

    <AnimatePresence>{modal && <Modal title={modal === 'create' ? t('createIncident') : modal === 'assign' ? t('assign') : modal === 'action' ? t('correctiveAction') : modal === 'comment' ? t('comments') : modal === 'evidence' ? t('evidence') : modal === 'resolve' ? t('rootCause') : 'Calculate business impact'} onClose={closeModal}><div className="space-y-3">{modal === 'create' && <><Field label="Title" value={form.title || ''} onChange={(value) => setField('title', value)} placeholder="e.g. Material shortage threatens order" /><Field label="Description" value={form.description || ''} onChange={(value) => setField('description', value)} /><div className="grid grid-cols-2 gap-3"><Field label="Factory unit" value={form.factoryUnit || 'unit-a'} onChange={(value) => setField('factoryUnit', value)} /><Field label="Machine ID" value={form.machineId || ''} onChange={(value) => setField('machineId', value)} placeholder="M003" /><label><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-slate-500">Category</span><select value={form.category || 'machine_downtime'} onChange={(event) => setField('category', event.target.value)} className="w-full rounded-lg border border-navy bg-[#0A0E1A] px-3 py-2 text-xs text-white outline-none"><option value="machine_downtime">Machine downtime</option><option value="quality_deviation">Quality deviation</option><option value="material_delay">Material delay</option><option value="workforce_constraint">Workforce constraint</option><option value="demand_change">Demand change</option></select></label><label><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-slate-500">Severity</span><select value={form.severity || 'medium'} onChange={(event) => setField('severity', event.target.value)} className="w-full rounded-lg border border-navy bg-[#0A0E1A] px-3 py-2 text-xs text-white outline-none"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><Field label="Due date" type="datetime-local" value={form.dueAt || ''} onChange={(value) => setField('dueAt', value)} /></div></>}{modal === 'assign' && <><Field label="Person name" value={form.ownerName || ''} onChange={(value) => setField('ownerName', value)} placeholder="Maintenance Engineer" /><Field label="User ID or email" value={form.ownerUserId || ''} onChange={(value) => setField('ownerUserId', value)} /><Field label="Team" value={form.ownerTeam || ''} onChange={(value) => setField('ownerTeam', value)} placeholder="Reliability / Quality / Materials" /></>}{modal === 'action' && <><Field label="Action title" value={form.title || ''} onChange={(value) => setField('title', value)} placeholder="Stage replacement bearing" /><Field label="Action description" value={form.description || ''} onChange={(value) => setField('description', value)} /><div className="grid grid-cols-2 gap-3"><Field label="Owner" value={form.ownerName || ''} onChange={(value) => setField('ownerName', value)} /><Field label="Due date" type="datetime-local" value={form.dueAt || ''} onChange={(value) => setField('dueAt', value)} /></div></>}{modal === 'comment' && <><label><span className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-slate-500">{t('comments')}</span><textarea value={form.body || ''} onChange={(event) => setField('body', event.target.value)} rows={4} className="w-full resize-none rounded-lg border border-navy bg-[#0A0E1A] px-3 py-2 text-xs text-white outline-none focus:border-amber/50" placeholder="What did you observe or decide?" /></label>{!customer && <label className="flex items-center gap-2 text-[10px] text-slate-400"><input type="checkbox" checked={form.visibility === 'customer'} onChange={(event) => setField('visibility', event.target.checked ? 'customer' : 'internal')} className="accent-amber" /> Share this update with the customer</label>}</>}{modal === 'evidence' && <><Field label="File name" value={form.fileName || ''} onChange={(value) => setField('fileName', value)} placeholder="vibration-photo.jpg" /><Field label="Evidence reference" value={form.storageRef || ''} onChange={(value) => setField('storageRef', value)} placeholder="Camera, report, or object-storage reference" /><Field label="Notes" value={form.notes || ''} onChange={(value) => setField('notes', value)} /><div className="flex items-center gap-2 rounded-lg border border-dashed border-navy px-3 py-2 text-[10px] text-slate-500"><FileUp className="h-3.5 w-3.5 text-amber" /> Evidence metadata is stored with the incident for audit.</div></>}{modal === 'resolve' && <><Field label={t('rootCause')} value={form.rootCause || ''} onChange={(value) => setField('rootCause', value)} placeholder="Bearing lubrication failure" /><Field label="Recovery evidence" value={form.recoveryEvidence || ''} onChange={(value) => setField('recoveryEvidence', value)} placeholder="Post-fix RMS 0.4g; temperature 39 C" /></>}{modal === 'impact' && <div className="grid grid-cols-2 gap-3">{[['productionValuePerUnit', 'Value per unit', '520'], ['unitsAtRisk', 'Units at risk', '572'], ['orderUrgency', 'Order urgency (1-5)', '5'], ['deliveryHoursRemaining', 'Delivery hours left', '36'], ['materialAvailability', 'Material availability (0-1)', '0.67'], ['qualityLossRate', 'Quality loss rate (0-1)', '0.018'], ['laborCost', 'Labor cost', '3800'], ['scrapCost', 'Scrap cost', '6240'], ['downtimeHours', 'Downtime hours', '4.2']].map(([key, label, placeholder]) => <Field key={key} label={label} value={form[key] || ''} onChange={(value) => setField(key, value)} placeholder={placeholder} type="number" />)}</div>}<div className="flex items-center justify-end gap-2 border-t border-navy pt-4"><button onClick={closeModal} className="rounded-lg border border-navy px-3 py-2 text-[10px] font-bold text-slate-400 hover:text-white">{t('cancel')}</button><button onClick={() => void submit()} disabled={busy} className="rounded-lg bg-amber px-4 py-2 text-[10px] font-bold text-[#0A0E1A] disabled:opacity-50">{busy ? 'Saving...' : t('save')}</button></div></div></Modal>}</AnimatePresence>
  </DashLayout>;
}
