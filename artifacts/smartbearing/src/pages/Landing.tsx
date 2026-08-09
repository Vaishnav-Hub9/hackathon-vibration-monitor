import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { Link } from 'wouter';
import {
  Activity, ActivitySquare, ArrowRight, CheckCircle2, ShieldAlert, Cpu, Zap, MessageCircle,
  Wifi, BellRing, Gauge, Thermometer, Waves, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import BearingModel from '@/components/landing/BearingModel';
import WhatsAppAlert from '@/components/dashboard/WhatsAppAlert';
import { useCountUp } from '@/hooks/useCountUp';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

const SECTIONS = [
  { id: 'problem', label: 'Problem' },
  { id: 'how', label: 'How It Works' },
  { id: 'features', label: 'Features' },
  { id: 'demo', label: 'Live Demo' },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------ Live FFT overlay ------------------------------ */
function useLiveFFT() {
  const [data, setData] = useState(() => Array.from({ length: 24 }, (_, i) => ({ freq: i * 50, amp: 0.05 + Math.random() * 0.12 + (i === 4 ? 0.7 : 0) })));
  useEffect(() => {
    const t = setInterval(() => {
      setData((prev) =>
        prev.map((d, i) => ({
          ...d,
          amp: Math.max(0.02, Math.min(1.2, d.amp * 0.85 + Math.random() * 0.18 + (i === 4 ? 0.28 : 0))),
        }))
      );
    }, 700);
    return () => clearInterval(t);
  }, []);
  return data;
}

/* ------------------------------ WhatsApp simulator ------------------------------ */
const WA_ALERTS = [
  { type: 'CRITICAL', machine: 'Ring Frame #3', id: 'M003', time: 'Just now', vib: '3.84 g', ttf: '~6 hrs', msg: 'BPFO spike detected. Bearing failure imminent — replace by next shift.' },
  { type: 'WARNING', machine: 'Ring Frame #2', id: 'M002', time: '2 min ago', vib: '2.11 g', ttf: '~22 hrs', msg: 'Vibration RMS elevated 2.3x. Schedule maintenance within next shift.' },
  { type: 'WARNING', machine: 'Ring Frame #5', id: 'M006', time: '9 min ago', vib: '1.52 g', ttf: '5–10 days', msg: 'Temperature anomaly: bearing housing at 61°C.' },
];

/* Live data ticker strip */
const TICKER_ITEMS = [
  { icon: Waves, text: 'Live BPFO detection' },
  { icon: Gauge, text: '14,400 RPM ring frames' },
  { icon: Cpu, text: '6 fault classes · real ML model' },
  { icon: Wifi, text: 'Offline-first edge intelligence' },
  { icon: MessageCircle, text: 'WhatsApp alerts in plain language' },
  { icon: Zap, text: '<2ms fault detection' },
  { icon: Thermometer, text: 'Dual-modal sensing · vib + acoustic' },
  { icon: ShieldAlert, text: '400 spindles protected per machine' },
];

function WhatsAppSimulator() {
  const [idx, setIdx] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const alert = WA_ALERTS[idx];
  const isCritical = alert.type === 'CRITICAL';

  useEffect(() => {
    if (dismissed) return;
    let swap: ReturnType<typeof setTimeout> | undefined;
    const t = setInterval(() => {
      swap = setTimeout(() => {
        setIdx((i) => (i + 1) % WA_ALERTS.length);
      }, 450);
    }, 6000);
    return () => {
      clearInterval(t);
      if (swap) clearTimeout(swap);
    };
  }, [dismissed]);

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className={`absolute -inset-6 rounded-3xl blur-2xl ${isCritical ? 'bg-[#EA580C]/15' : 'bg-[#F59E0B]/10'}`} />
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="relative bg-[#0E1621] border rounded-2xl overflow-hidden shadow-2xl"
          style={{ borderColor: isCritical ? 'rgba(234,88,12,0.45)' : 'rgba(245,158,11,0.35)' }}
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-[#1F2C34]">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#25D366] rounded-full border-2 border-[#1F2C34]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm truncate">SmartBearing Alerts</div>
              <div className="text-[11px] text-[#8696A0]">+91 98765 43210 · {alert.time}</div>
            </div>
            <button onClick={() => setDismissed(true)} className="text-[#8696A0] hover:text-white transition-colors" aria-label="Dismiss alert"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-3">
            <div className="rounded-xl rounded-tl-none px-4 py-3 text-xs leading-relaxed" style={{ background: '#1E2B33', color: '#E9EDF0' }}>
              <div
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold mb-2"
                style={{ background: isCritical ? 'rgba(234,88,12,0.2)' : 'rgba(245,158,11,0.2)', color: isCritical ? '#EA580C' : '#F59E0B', border: `1px solid ${isCritical ? 'rgba(234,88,12,0.4)' : 'rgba(245,158,11,0.4)'}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: isCritical ? '#EA580C' : '#F59E0B' }} />
                {alert.type}
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2.5">
                {[
                  { label: 'Machine', value: alert.id },
                  { label: 'Vibration', value: alert.vib },
                  { label: 'Est. TTF', value: alert.ttf },
                ].map((s) => (
                  <div key={s.label} className="bg-[#0E1621] rounded-lg p-2 text-center">
                    <div className="text-[9px] text-[#8696A0] uppercase tracking-wide mb-0.5">{s.label}</div>
                    <div className="text-white font-mono font-bold text-xs">{s.value}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-[#C9D1D9] leading-relaxed mb-1">🧠 {alert.msg}</p>
              <div className="text-right text-[10px] text-[#8696A0] font-mono">{alert.time} ✓✓</div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------ Landing ------------------------------ */
export default function Landing() {
  const hoursSaved = useCountUp(6, 2000);
  const costSaved = useCountUp(54000, 2200);
  const spindles = useCountUp(50000, 2500);
  const fftData = useLiveFFT();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');

  const { scrollYProgress } = useScroll();
  const progressScale = useSpring(scrollYProgress, { stiffness: 130, damping: 28, restDelta: 0.001 });

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
      const current = SECTIONS.map((s) => s.id).find((id) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top < 160 : false;
      });
      setActiveSection(current || '');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const liveTelemetry = useMemo(() => {
    const t = Date.now();
    return {
      rpm: 14200 + Math.round(Math.sin(t / 400) * 120),
      temp: +(37 + Math.sin(t / 900) * 1.8 + Math.random() * 0.4).toFixed(1),
      vib: +(0.42 + Math.abs(Math.sin(t / 700)) * 0.5 + Math.random() * 0.1).toFixed(2),
    };
  }, [fftData]);

  return (
    <div className="min-h-screen bg-navy text-slate-200 font-sans selection:bg-amber/30 selection:text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className={`fixed top-0 w-full z-50 border-b transition-all duration-300 ${scrolled ? 'border-navy bg-navy/90 backdrop-blur-md' : 'border-transparent bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-amber" />
            <span className="font-display font-bold text-lg tracking-wide text-white">Smart<span className="text-amber">Bearing</span></span>
          </button>
          <div className="hidden md:flex items-center gap-7">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToId(s.id)}
                className={`text-sm font-medium transition-colors ${activeSection === s.id ? 'text-amber' : 'text-slate-300 hover:text-white'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Log In</Link>
            <Link href="/register">
              <Button className="bg-amber hover:bg-amber/90 text-navy font-semibold h-10 px-5 text-sm shadow-[0_0_20px_rgba(245,158,11,0.3)] border-none">
                Get Started <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[3px] origin-left z-[60] bg-gradient-to-r from-amber via-[#EA580C] to-amber shadow-[0_0_12px_rgba(245,158,11,0.5)]"
        style={{ scaleX: progressScale }}
      />

      {/* ============================ HERO ============================ */}
      <section className="noise relative min-h-[100dvh] pt-20 flex items-center overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-navy/40 to-navy" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-amber/10 rounded-full blur-[140px] pointer-events-none" />
        {/* Premium aurora ambience */}
        <div className="aurora aurora-animate w-[420px] h-[420px] bg-[#F59E0B]/10 top-[12%] -left-24" />
        <div className="aurora aurora-animate w-[520px] h-[520px] bg-[#3B82F6]/10 bottom-[8%] -right-32" style={{ animationDelay: '-5s' }} />
        <div className="aurora aurora-animate w-[300px] h-[300px] bg-[#8B5CF6]/10 top-[45%] right-[28%]" style={{ animationDelay: '-9s' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center w-full py-16">
          {/* Left copy */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: 'easeOut' }} className="space-y-8">
            <div className="inline-flex items-center gap-2 border border-amber/30 bg-amber/10 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
              <span className="text-amber text-xs font-bold tracking-widest uppercase">MSME Predictive Maintenance</span>
            </div>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.08] text-white">
              Hear the bearing <br />
              <span className="text-gradient-amber drop-shadow-[0_0_24px_rgba(245,158,11,0.35)]">before it breaks.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-xl leading-relaxed">
              Dual-modal edge intelligence for spindle bearing failure prediction in power loom MSMEs. Plug in, walk away, get alerted on WhatsApp — before 400 spindles go dark.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link href="/register">
                <Button className="shimmer glow-pulse bg-amber hover:bg-amber/90 text-navy font-semibold h-12 px-8 text-base border-none">
                  Get Started <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button variant="outline" onClick={() => scrollToId('how')} className="border-navy text-slate-300 hover:text-white hover:bg-navy-card h-12 px-8 text-base">
                See How It Works
              </Button>
              <div className="flex flex-wrap items-center gap-3 pt-1 w-full">
                <Link href="/twin" className="flex items-center gap-1.5 text-[11px] font-mono-data px-3.5 py-2 rounded-lg border border-[#00F0FF]/40 bg-[#00F0FF]/5 text-[#00F0FF] hover:bg-[#00F0FF]/15 hover:shadow-[0_0_20px_rgba(0,240,255,0.25)] transition-all">
                  <Cpu className="w-3.5 h-3.5" /> Live Digital Twin
                </Link>
                <Link href="/workflow" className="flex items-center gap-1.5 text-[11px] font-mono-data px-3.5 py-2 rounded-lg border border-amber/40 bg-amber/5 text-amber hover:bg-amber/15 hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all">
                  <Activity className="w-3.5 h-3.5" /> Pipeline Simulation
                </Link>
              </div>
            </div>

            {/* Live telemetry chips */}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              {[
                { icon: Gauge, label: 'Spindle', value: `${liveTelemetry.rpm.toLocaleString()}`, unit: 'RPM' },
                { icon: Thermometer, label: 'Housing', value: liveTelemetry.temp, unit: '°C' },
                { icon: Waves, label: 'Vib RMS', value: liveTelemetry.vib, unit: 'g' },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-2.5 bg-navy-card/70 backdrop-blur border border-navy px-3.5 py-2 rounded-lg">
                  <m.icon className="w-4 h-4 text-amber" />
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-slate-500">{m.label}</div>
                    <div className="font-mono-data text-sm font-bold text-white">{m.value}<span className="text-slate-500 ml-1 text-xs">{m.unit}</span></div>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 bg-[#0D2B1F]/60 border border-[#10B981]/30 px-3.5 py-2 rounded-lg">
                <span className="relative w-2 h-2 rounded-full bg-[#10B981] text-[#10B981] ping-ring" />
                <Wifi className="w-4 h-4 text-[#10B981]" />
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-slate-500">Node Status</div>
                  <div className="font-mono-data text-sm font-bold text-[#10B981]">ONLINE</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-navy">
              <div className="flex items-center gap-2 text-sm text-slate-400"><CheckCircle2 className="w-4 h-4 text-amber" /><span>₹1,800/node</span></div>
              <div className="flex items-center gap-2 text-sm text-slate-400"><CheckCircle2 className="w-4 h-4 text-amber" /><span>&lt;2ms detection</span></div>
              <div className="flex items-center gap-2 text-sm text-slate-400"><CheckCircle2 className="w-4 h-4 text-amber" /><span>WhatsApp alerts</span></div>
            </div>
          </motion.div>

          {/* Right: interactive 3D model + overlays (borderless, floating) */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.2 }} className="relative">
            {/* Soft halo behind the floating model */}
            <div className="absolute -inset-6 bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.14),transparent_65%)] blur-2xl pointer-events-none" />

            {/* Floating header chip */}
            <div className="relative z-30 flex items-center justify-between gap-3 mb-2 px-2">
              <div className="inline-flex items-center gap-2 bg-[#0F1629]/70 backdrop-blur-md border border-navy rounded-full px-3.5 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-[11px] font-mono-data text-slate-300 uppercase tracking-wider">Ring Frame #1 · Spindle Assembly</span>
              </div>
              <span className="text-[10px] font-mono-data text-slate-400 bg-[#0F1629]/70 backdrop-blur-md border border-navy px-2.5 py-1 rounded-full hidden sm:inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber" /> WebGL Interactive
              </span>
            </div>

            {/* Borderless 3D model — no card, full-bleed */}
            <div className="relative">
              <BearingModel />

              {/* FFT overlay — floating glass chip, anchored to the empty top-right corner so it never covers the exploded parts */}
              <div className="glass float-slow absolute top-20 right-3 z-30 hidden sm:block w-[210px] rounded-xl p-3 shadow-[0_8px_40px_rgba(0,0,0,0.5)] pointer-events-none">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Live FFT Spectrum</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-mono-data text-[#10B981]"><BellRing className="w-3 h-3" /> BPFO @ 200Hz</span>
                </div>
                <div className="h-14">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fftData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="freq" hide />
                      <YAxis hide domain={[0, 1.3]} />
                      <Bar dataKey="amp" isAnimationActive={false} radius={[1, 1, 0, 0]}>
                        {fftData.map((d, i) => <Cell key={i} fill={d.amp > 0.7 ? '#EA580C' : d.amp > 0.4 ? '#F59E0B' : '#3B82F6'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================ LIVE TICKER ============================ */}
      <div aria-hidden="true" className="relative border-y border-navy bg-[#0F1629]/70 backdrop-blur-md overflow-hidden py-3 select-none">
        <div className="flex w-max animate-[marquee_32s_linear_infinite] whitespace-nowrap">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5 px-7 text-[11px] font-mono-data text-slate-400">
              <item.icon className="w-3.5 h-3.5 text-amber" />
              <span className="uppercase tracking-widest">{item.text}</span>
              <span className="text-amber/40 ml-5">✦</span>
            </div>
          ))}
        </div>
      </div>

      {/* ============================ PROBLEM ============================ */}
      <section id="problem" className="py-24 bg-[#0A0E1A] scroll-mt-16">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-16">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="font-display text-3xl md:text-5xl font-bold text-white">
            A single bearing failure stops <span className="text-amber">400 spindles.</span>
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { label: 'Average Downtime', value: `${Math.round(hoursSaved)} hrs`, icon: ActivitySquare, color: '#F59E0B' },
              { label: 'Cost Per Incident', value: `₹${Math.round(costSaved).toLocaleString()}+`, icon: ShieldAlert, color: '#EA580C' },
              { label: 'Spindles Protected', value: `${Math.round(spindles).toLocaleString()}+`, icon: Zap, color: '#10B981' },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-navy-card border border-navy p-8 rounded-2xl hover:border-amber/30 hover:-translate-y-1 transition-all duration-300 card-hover"
              >
                <stat.icon className="w-8 h-8 mb-4 mx-auto" style={{ color: stat.color }} />
                <div className="text-4xl font-display font-bold text-white mb-2">{stat.value}</div>
                <div className="text-slate-400 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ HOW IT WORKS ============================ */}
      <section id="how" className="py-24 bg-navy-card relative overflow-hidden scroll-mt-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.07),transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-block border border-amber/30 bg-amber/10 px-3 py-1 rounded-full mb-4">
              <span className="text-amber text-xs font-bold tracking-widest uppercase">How It Works</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">Edge Intelligence. Simplified.</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">No cloud dependency for critical alerts. The decision happens on the machine.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Sense', desc: 'Dual-modal MEMS sensors capture high-freq vibration and acoustics.', icon: Waves },
              { step: '02', title: 'Normalize', desc: 'Edge processor accounts for voltage drops and spindle speeds.', icon: Gauge },
              { step: '03', title: 'Predict', desc: 'Lightweight ML models detect BPFO spikes before failure.', icon: Cpu },
              { step: '04', title: 'Alert', desc: 'Instant WhatsApp & dashboard alerts with estimated time-to-failure.', icon: MessageCircle },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative bg-navy p-6 rounded-xl border border-navy hover:border-amber/40 hover:-translate-y-1.5 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber/10 border border-amber/25 flex items-center justify-center group-hover:bg-amber/20 transition-colors">
                    <item.icon className="w-5 h-5 text-amber" />
                  </div>
                  <div className="text-amber font-mono font-bold text-xl opacity-60">{item.step}</div>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ FEATURES ============================ */}
      <section id="features" className="py-24 bg-[#0A0E1A] scroll-mt-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block border border-amber/30 bg-amber/10 px-3 py-1 rounded-full mb-4">
              <span className="text-amber text-xs font-bold tracking-widest uppercase">Features</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">Built for the shop floor, not the lab.</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">Everything runs locally on a ₹1,800 edge node.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Cpu, title: 'On-device ML', desc: 'XGBoost fault models run on the edge node with zero cloud dependency.' },
              { icon: MessageCircle, title: 'WhatsApp Alerts', desc: 'Instant alerts with estimated time-to-failure, in plain language.' },
              { icon: Zap, title: '<2ms Detection', desc: 'Fault signatures are caught in the same control cycle they appear.' },
              { icon: Gauge, title: 'Voltage Normalization', desc: 'Readings auto-correct for supply drops as low as −20%.' },
              { icon: Thermometer, title: 'Dual-Modal Sensing', desc: 'Vibration + acoustics fused for fewer false alarms.' },
              { icon: Wifi, title: 'Offline-First', desc: 'Survives power cuts and network failures; alerts queue locally.' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.1 }}
                className="group bg-navy-card border border-navy p-7 rounded-xl hover:border-amber/40 hover:shadow-[0_8px_40px_rgba(245,158,11,0.12)] transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-lg bg-amber/10 border border-amber/25 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-amber/20 transition-all duration-300">
                  <f.icon className="w-5 h-5 text-amber" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================ LIVE DEMO ============================ */}
      <section id="demo" className="py-24 bg-navy-card relative overflow-hidden scroll-mt-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_80%,rgba(37,211,102,0.06),transparent_50%)]" />
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid lg:grid-cols-2 gap-14 items-center">
          <div className="space-y-8">
            <div className="inline-block border border-amber/30 bg-amber/10 px-3 py-1 rounded-full">
              <span className="text-amber text-xs font-bold tracking-widest uppercase">Live Demo</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
              The alert that saves the <span className="text-amber">next shift.</span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              When the edge model detects a BPFO spike, the foreman's phone buzzes before the bearing seizes. Watch the simulator cycle through real alert payloads.
            </p>
            <ul className="space-y-3">
              {[
                'BPFO / BPFI fault-frequency detection',
                'Estimated time-to-failure on every alert',
                'AI technician summary in plain language',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-[#10B981] flex-shrink-0" /> <span className="text-sm">{t}</span>
                </li>
              ))}
            </ul>
            <Link href="/register">
              <Button className="bg-amber hover:bg-amber/90 text-navy font-semibold h-12 px-8 text-base mt-2 shadow-[0_0_24px_rgba(245,158,11,0.3)] border-none">
                Try the Dashboard <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
          <WhatsAppSimulator />
        </div>
      </section>

      {/* ============================ CTA ============================ */}
      <section className="py-20 bg-[#0A0E1A]">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative bg-gradient-to-br from-[#0F1629] to-[#141E35] border border-amber/25 p-10 sm:p-14 rounded-2xl text-center overflow-hidden glow-amber"
          >
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber/10 rounded-full blur-[100px]" />
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-4 relative z-10">
              Your next bearing failure is <span className="text-amber">already speaking.</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-8 relative z-10">
              Stop it before 400 spindles go silent. Deployment takes under 15 minutes per machine.
            </p>
            <div className="relative z-10 flex flex-wrap justify-center gap-4">
              <Link href="/register">
                <Button className="bg-amber hover:bg-amber/90 text-navy font-semibold h-12 px-9 text-base shadow-[0_0_30px_rgba(245,158,11,0.4)] border-none">
                  Get Started Free <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-navy text-slate-300 hover:text-white hover:bg-navy h-12 px-9 text-base">
                  Log In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#05070A] py-12 border-t border-navy">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber" />
            <span className="font-display font-bold text-white">Smart<span className="text-amber">Bearing</span></span>
          </div>
          <p className="text-slate-500 text-sm">© 2024 SmartBearing India. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/login" className="text-slate-400 hover:text-amber text-sm font-medium">Log In</Link>
            <Link href="/register" className="text-slate-400 hover:text-amber text-sm font-medium">Register</Link>
          </div>
        </div>
      </footer>

      <WhatsAppAlert />
    </div>
  );
}
