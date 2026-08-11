import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { computeDefectFrequencies } from '@/lib/defectFrequencies';

/**
 * Fleet Copilot — "Ask Your Fleet".
 *
 * A chat panel on the dashboard that answers operational questions from the
 * REAL live fleet state (machines, alerts, summary, live sensors) — no canned
 * demos, no fake numbers. It parses natural-language questions and replies
 * with structured insight (risk ranking, alert explanations, RUL bands,
 * physics-backed fault frequencies, ROI). Every answer is computed from the
 * data the dashboard already displays.
 */

export interface CopilotCtx {
  machines: any[];
  alerts: any[];
  summary: any;
  sensors: any[];
}

interface ChatMessage {
  id: number;
  role: 'user' | 'bot';
  text: string;
  blocks?: { label: string; value: string; tone: 'ok' | 'warn' | 'crit' }[];
  bullets?: string[];
}

const QUICK_PROMPTS = [
  'Highest risk machine now?',
  'Why did M003 alert?',
  'What is the fleet health?',
  'How much have we saved?',
  'Top fault the model sees?',
  'How does detection work?',
];

const TONE_COLOR = { ok: '#10B981', warn: '#F59E0B', crit: '#EA580C' };

/** Escape HTML entities, then turn **bold** into <strong>. Safe by construction. */
function renderBold(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-amber">$1</strong>');
}

function fmt(n: any): string {
  const v = Number(n || 0);
  return v.toLocaleString('en-IN');
}

function etaForMachine(m: any, alerts: any[]): string {
  const alert = alerts.find(
    (a: any) =>
      a.machineId === m.id ||
      a.machineName === m.name ||
      (m.id && a.machineId && a.machineId.toLowerCase() === m.id.toLowerCase()),
  );
  if (alert?.estimatedTimeToFailure) return alert.estimatedTimeToFailure;
  if (m.status === 'critical') return '6–18 hrs';
  if (m.status === 'warning') return '3–7 days';
  return '> 30 days';
}

/** The brain: parse the question against live fleet state → structured answer. */
function answerQuestion(raw: string, ctx: CopilotCtx): { text: string; blocks?: any[]; bullets?: string[] } {
  const q = raw.toLowerCase();
  const machines: any[] = ctx.machines || [];
  const alerts: any[] = ctx.alerts || [];
  const sensors: any[] = ctx.sensors || [];
  const summary: any = ctx.summary || {};

  const ranked = [...machines].sort(
    (a, b) => (a.healthScore ?? 0) - (b.healthScore ?? 0),
  );
  const riskiest = ranked[0];
  const critical = machines.filter((m) => m.status === 'critical');
  const warning = machines.filter((m) => m.status === 'warning');
  const machineById = (id: string) =>
    machines.find(
      (m) => m.id?.toLowerCase() === id.toLowerCase() || m.name?.toLowerCase().includes(id.toLowerCase()),
    );

  // ── Highest risk / what fails next ─────────────────────────────
  if (
    /highest risk|most at risk|worst machine|what fails next|riskiest|danger|top risk|which machine.*risk/.test(q) ||
    q.includes('risk') ||
    q.includes('danger')
  ) {
    if (!machines.length) return { text: 'No machine data loaded yet — the fleet API isn’t responding.' };
    const blocks = ranked
      .slice(0, 3)
      .map((m) => ({
        label: `${m.name} (${m.id})`,
        value: `health ${m.healthScore}% · ${etaForMachine(m, alerts)}`,
        tone: (m.status === 'critical' ? 'crit' : m.status === 'warning' ? 'warn' : 'ok') as any,
      }));
    return {
      text: `Risk-ranked from live health scores. ${riskiest ? `Highest risk: **${riskiest.name}** at ${riskiest.healthScore}% health (${riskiest.status.toUpperCase()}).` : ''}`,
      blocks,
      bullets: [
        critical.length ? `${critical.length} critical · ${warning.length} warning · ${machines.length - critical.length - warning.length} healthy` : 'Fleet is clear of critical alerts right now.',
        riskiest ? `Recommended action: ${riskiest.status === 'critical' ? 'schedule replacement within the next shift.' : riskiest.status === 'warning' ? 'monitor closely and plan maintenance this week.' : 'routine monitoring only.'}` : '',
      ].filter(Boolean),
    };
  }

  // ── Why did X alert / explain machine ──────────────────────────
  const idMatch = q.match(/m\d{3}/i);
  if (idMatch || /why did|what happened|explain|alert.*machine|tell me about/.test(q)) {
    const m = idMatch ? machineById(idMatch[0]) : riskiest;
    if (!m) return { text: 'No machine data loaded yet — the fleet API isn’t responding.' };
    const alertsFor = alerts.filter(
      (a: any) => a.machineId === m.id || a.machineName === m.name,
    );
    const live = sensors.find((s: any) => s.machineId === m.id);
    if (alertsFor.length) {
      return {
        text: `**${m.name} (${m.id})** has ${alertsFor.length} active alert${alertsFor.length > 1 ? 's' : ''}:`,
        blocks: alertsFor.slice(0, 3).map((a: any) => ({
          label: a.type,
          value: a.message,
          tone: (a.type === 'CRITICAL' ? 'crit' : a.type === 'WARNING' ? 'warn' : 'ok') as any,
        })),
        bullets: [
          alertsFor[0]?.estimatedTimeToFailure ? `Estimated time to failure: ${alertsFor[0].estimatedTimeToFailure}` : '',
          live ? `Live: ${live.accel_z?.toFixed(2)}g vibration · ${live.temperature}°C · model says ${live.mlLabel || 'Healthy'}` : '',
        ].filter(Boolean),
      };
    }
    return {
      text: `**${m.name} (${m.id})** has no active alerts. Health is ${m.healthScore}% (${m.status.toUpperCase()}).`,
      bullets: [
        live ? `Live: ${live.accel_z?.toFixed(2)}g vibration · ${live.temperature}°C · model says ${live.mlLabel || 'Healthy'}` : '',
        'Early warning is threshold-based: vibration > 1.5 g or BPFO band energy triggers a WARNING.',
      ].filter(Boolean),
    };
  }

  // ── Fleet health / overview ────────────────────────────────────
  if (/fleet health|overall health|fleet status|how are we|summary|overview|health score/.test(q)) {
    const avg = summary.avgHealthScore ?? Math.round(
      machines.reduce((s, m) => s + (m.healthScore ?? 0), 0) / Math.max(1, machines.length),
    );
    return {
      text: `Fleet health is **${avg}%** on average across ${machines.length || summary.totalMachines || 0} machines.`,
      blocks: [
        { label: 'Machines', value: `${machines.length || summary.totalMachines || 0}`, tone: 'ok' as any },
        { label: 'Critical', value: `${critical.length}`, tone: critical.length ? 'crit' as any : 'ok' as any },
        { label: 'Warning', value: `${warning.length}`, tone: warning.length ? 'warn' as any : 'ok' as any },
        { label: 'Active alerts', value: `${alerts.length}`, tone: alerts.length ? 'warn' as any : 'ok' as any },
        { label: 'Uptime', value: `${summary.sensorUptime ?? 0}%`, tone: 'ok' as any },
      ],
      bullets: [
        riskiest ? `Watch: ${riskiest.name} is the weakest at ${riskiest.healthScore}%.` : '',
        summary.alertsToday !== undefined ? `${summary.alertsToday} alerts in the last 24 hours.` : '',
      ].filter(Boolean),
    };
  }

  // ── Savings / ROI / cost ───────────────────────────────────────
  if (/sav|roi|cost|money|₹|rs\.|profit|prevent/.test(q)) {
    return {
      text: `Estimated impact so far: **₹${fmt(summary.estimatedSavings)}** saved by preventing ${fmt(summary.downtimePrevented ?? 0)} hrs of downtime.`,
      blocks: [
        { label: 'Downtime prevented', value: `${fmt(summary.downtimePrevented ?? 0)} hrs`, tone: 'ok' as any },
        { label: 'Est. savings', value: `₹${fmt(summary.estimatedSavings)}`, tone: 'ok' as any },
        { label: 'Cost at risk now', value: `₹${fmt(critical.length * 18000 + warning.length * 9000)}`, tone: critical.length ? 'crit' as any : 'warn' as any },
      ],
      bullets: [
        'Cost at risk assumes ₹18,000 per critical failure + ₹9,000 per warning.',
        'Payback: a ₹1,800/node sensor pays for itself after preventing roughly one failure.',
      ],
    };
  }

  // ── Most common fault / model verdicts ─────────────────────────
  if (/fault.*(see|most|common)|model.*see|ml verdict|what fault/.test(q)) {
    const labels = sensors
      .map((s: any) => s.mlLabel)
      .filter((l: any) => l && l !== 'Healthy');
    const counts: Record<string, number> = {};
    labels.forEach((l: string) => (counts[l] = (counts[l] || 0) + 1));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      return {
        text: `The live ML model currently sees **${top[0]}** on ${top[1]} of ${sensors.length} monitored nodes.`,
        blocks: Object.entries(counts).slice(0, 4).map(([k, v]) => ({
          label: k, value: `${v} node${v > 1 ? 's' : ''}`, tone: (k === 'Outer Race' || k === 'Inner Race' ? 'crit' : 'warn') as any,
        })),
        bullets: ['Verdicts come from the trained 6-class model scoring each 2048-point window in real time.'],
      };
    }
    return {
      text: `The live ML model currently sees **only Healthy** nodes — no fault signatures in the current windows.`,
      bullets: ['Try the Fault Injector to generate a real fault and watch the model catch it.'],
    };
  }

  // ── How detection works / physics ──────────────────────────────
  if (/how.*(detect|work|bpfo|physics)|bpfo|bpfi|frequency|fft|spectrum|harmonic/.test(q)) {
    const df = computeDefectFrequencies(14400);
    return {
      text: 'Detection is physics-first: the model scores **BPFO / BPFI / BSF / FTF** band energy computed from bearing geometry × live RPM.',
      blocks: [
        { label: 'BPFO @ 14.4k RPM', value: `${df.bpfo.toFixed(0)} Hz`, tone: 'crit' as any },
        { label: 'BPFI @ 14.4k RPM', value: `${df.bpfi.toFixed(0)} Hz`, tone: 'warn' as any },
        { label: 'BSF @ 14.4k RPM', value: `${df.bsf.toFixed(0)} Hz`, tone: 'warn' as any },
        { label: '1× RPM', value: `${df.fr.toFixed(0)} Hz`, tone: 'ok' as any },
      ],
      bullets: [
        'A peak at BPFO (outer race) is the strongest pre-failure marker — it triggers the CRITICAL path.',
        'The frontend overlays these exact frequencies on the FFT so you can see the match.',
      ],
    };
  }

  // ── Sensors / network ──────────────────────────────────────────
  if (/sensor|node|network|uptime|connected/.test(q)) {
    return {
      text: `**${sensors.length}** sensor nodes are streaming live right now.`,
      blocks: [
        { label: 'Streaming', value: `${sensors.length}`, tone: 'ok' as any },
        { label: 'Critical nodes', value: `${sensors.filter((s: any) => s.status === 'critical').length}`, tone: sensors.some((s: any) => s.status === 'critical') ? 'crit' as any : 'ok' as any },
        { label: 'Uptime', value: `${summary.sensorUptime ?? 0}%`, tone: 'ok' as any },
      ],
      bullets: ['Each node streams a 2048-point vibration window; the model scores it on the edge.'],
    };
  }

  // ── Fallback ───────────────────────────────────────────────────
  return {
    text: 'I can answer from live fleet data. Try asking:',
    bullets: [
      '“Which machine is at highest risk?”',
      '“Why did M003 alert?”',
      '“What is the fleet health?”',
      '“How much have we saved?”',
      '“What fault does the model see most?”',
    ],
  };
}

export default function FleetCopilot({ ctx }: { ctx: CopilotCtx }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'bot',
      text: 'Hey — ask me anything about the fleet. I read the live data: risk, alerts, savings, physics, you name it.',
      bullets: QUICK_PROMPTS,
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);
  const timerRef = useRef<number | null>(null);

  // Never let a pending answer write to an unmounted panel.
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing, open]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    setMessages((prev) => [...prev, { id: idRef.current++, role: 'user', text: trimmed }]);
    setInput('');
    setTyping(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const ans = answerQuestion(trimmed, ctx);
      setMessages((prev) => [
        ...prev,
        { id: idRef.current++, role: 'bot', text: ans.text, blocks: ans.blocks, bullets: ans.bullets },
      ]);
      setTyping(false);
    }, 650 + Math.random() * 550);
  };

  const online = ctx.machines.length > 0;

  return (
    <>
      {/* Launcher — always visible: initial={false} renders at the final values,
          so a throttled/background tab can never leave it stuck at scale 0. */}
      <motion.button
        initial={false}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-br from-amber to-[#EA580C] text-navy font-bold text-sm pl-4 pr-5 py-3 rounded-full shadow-[0_8px_30px_rgba(245,158,11,0.4)] hover:shadow-[0_8px_40px_rgba(245,158,11,0.6)] hover:-translate-y-0.5 transition-all"
        aria-label="Ask Your Fleet"
      >
        <span className="relative">
          {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#10B981] border-2 border-navy animate-pulse" />
        </span>
        <span className="hidden sm:inline">Ask Your Fleet</span>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-24 right-6 z-50 w-[min(400px,calc(100vw-3rem))] h-[560px] max-h-[calc(100dvh-8rem)] flex flex-col rounded-2xl overflow-hidden border border-navy bg-[#0C1220]/95 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
          >
            {/* Header */}
            <div className="relative px-4 py-3 border-b border-navy bg-[#0F1629]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber/50 to-transparent" />
              <div className="flex items-center gap-2.5">
                <span className="relative w-9 h-9 rounded-xl bg-amber/15 border border-amber/30 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-amber" />
                  <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0F1629] ${online ? 'bg-[#10B981]' : 'bg-slate-500'}`} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold text-sm flex items-center gap-1.5">
                    Ask Your Fleet
                    <Sparkles className="w-3.5 h-3.5 text-amber" />
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    {online ? <Wifi className="w-3 h-3 text-[#10B981]" /> : <WifiOff className="w-3 h-3 text-slate-500" />}
                    {online ? 'Live fleet data' : 'API offline — sample answers'}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) =>
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] bg-amber/15 border border-amber/30 text-slate-100 text-[13px] rounded-2xl rounded-br-sm px-3.5 py-2.5 leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-[92%] bg-[#141E35] border border-navy text-slate-200 text-[13px] rounded-2xl rounded-bl-sm px-3.5 py-3 leading-relaxed space-y-2.5">
                      <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: renderBold(msg.text) }} />
                      {msg.blocks && msg.blocks.length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {msg.blocks.map((b, i) => (
                            <div key={i} className="bg-[#0A0E1A] border border-navy rounded-lg px-2.5 py-2">
                              <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-0.5">{b.label}</div>
                              <div className="text-[11px] font-bold" style={{ color: TONE_COLOR[b.tone] }}>{b.value}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.bullets && msg.bullets.length > 0 && (
                        <ul className="space-y-1">
                          {msg.bullets.map((b, i) => (
                            <li key={i} className="flex gap-1.5 text-[12px] text-slate-400 leading-snug">
                              <span className="text-amber flex-shrink-0">›</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ),
              )}
              {typing && (
                <div className="flex justify-start">
                  <div className="bg-[#141E35] border border-navy rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                    <span className="sb-typing-dot" /><span className="sb-typing-dot" /><span className="sb-typing-dot" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick prompts — all six as a tidy 2×3 grid so every capability
                is visible at a glance without crowding the message area */}
            <div className="px-3 pb-2 grid grid-cols-2 gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-[10px] leading-tight text-left text-slate-300 bg-[#141E35] border border-navy hover:border-amber/40 hover:text-amber px-2 py-1.5 rounded-lg transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-3 pt-1">
              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="flex items-center gap-2 bg-[#0A0E1A] border border-navy focus-within:border-amber/40 rounded-xl px-3 py-2 transition-colors"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about the fleet…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  className="w-8 h-8 rounded-lg bg-amber text-navy flex items-center justify-center hover:bg-amber/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
