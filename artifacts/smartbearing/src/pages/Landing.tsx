import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useSpring, useTransform } from 'framer-motion';
import { Link } from 'wouter';
import {
  Activity, ArrowRight, CheckCircle2, ShieldAlert, Cpu, Zap, MessageCircle,
  Wifi, Gauge, Thermometer, Waves, ChevronDown,
  Menu, Globe, BarChart3, Shield, Clock, Sparkles, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import BearingModel from '@/components/landing/BearingModel';
import AmbientCanvas from '@/components/ui/AmbientCanvas';
import WaveField from '@/components/ui/WaveField';
import { Magnetic, TiltCard, CountUp } from '@/components/ui/fx';

/* ─── Spotlight card — border + inner glow track the cursor ─── */
function SpotlightCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--sx', `${e.clientX - r.left}px`);
        el.style.setProperty('--sy', `${e.clientY - r.top}px`);
      }}
      className={`spotlight-card ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

const NAV_LINKS = [
  { label: 'About', href: '#problem' },
  { label: 'How It Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'FAQ', href: '#faq' },
];

const ROTATING_WORDS = [
  'monitor', 'predict', 'protect', 'analyse', 'detect', 'prevent',
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─── Rotating Text ─── */
function RotatingText() {
  const [wordIdx, setWordIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setWordIdx((i) => (i + 1) % ROTATING_WORDS.length), 2400);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-flex items-end relative min-w-[180px] h-[1.2em] align-bottom">
      <AnimatePresence mode="wait">
        <motion.span
          key={wordIdx}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -24, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif-display text-gradient-amber inline-block leading-none"
        >
          {ROTATING_WORDS[wordIdx]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ─── FAQ Item ─── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06] last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left group">
        <span className="text-[15px] font-medium text-white/80 group-hover:text-white transition-colors pr-4">{q}</span>
        <ChevronDown className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <p className="pb-5 text-sm text-white/40 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Status Dot ─── */
function StatusDot({ status }: { status: 'online' | 'healthy' | 'warning' }) {
  const colors = { online: 'bg-emerald-500', healthy: 'bg-emerald-500', warning: 'bg-amber-500' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
      {status === 'online' ? 'Online' : status === 'healthy' ? 'Healthy' : 'Warning'}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════ */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cinematic parallax — hero layers drift at different rates on scroll
  const { scrollYProgress } = useScroll();
  const progressScale = useSpring(scrollYProgress, { stiffness: 130, damping: 28, restDelta: 0.001 });
  const heroY = useTransform(scrollYProgress, [0, 0.12], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);
  const modelY = useTransform(scrollYProgress, [0, 0.12], [0, -80]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white/90 font-sans selection:bg-blue-500/20 selection:text-white">

      {/* ═══════════════ NAVBAR ═══════════════ */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06]' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight">SmartBearing</span>
          </button>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <button key={link.label} onClick={() => scrollToId(link.href.slice(1))} className="text-sm font-medium text-white/40 hover:text-white transition-colors">
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:inline-flex text-sm font-medium text-white/50 hover:text-white transition-colors px-3 py-2">Log In</Link>
            <Link href="/register">
              <Button className="bg-white text-black hover:bg-white/90 h-9 px-5 text-sm font-semibold rounded-lg">Get Started <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-white/40 hover:text-white" aria-label="Menu">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden overflow-hidden border-b border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-xl">
              <div className="px-6 py-4 space-y-3">
                {NAV_LINKS.map((link) => (
                  <button key={link.label} onClick={() => { scrollToId(link.href.slice(1)); setMobileMenuOpen(false); }} className="block text-sm font-medium text-white/50 hover:text-white">{link.label}</button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-[2px] origin-left z-[60] bg-gradient-to-r from-blue-400 via-indigo-400 to-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)]"
        style={{ scaleX: progressScale }}
      />

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-[100dvh] pt-16 flex items-center overflow-hidden">
        {/* Cinematic living-light layer + light shaft + rotating halo */}
        <AmbientCanvas particles={70} />
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="light-shaft" />
        <div className="halo-ring w-[760px] h-[760px] top-1/2 left-[72%] -translate-x-1/2 -translate-y-1/2 hidden lg:block opacity-60" />
        {/* Small, subtle vibration waves hugging the hero floor */}
        <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none">
          <WaveField layers={2} opacity={0.4} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center w-full py-20">
          <motion.div style={{ y: heroY, opacity: heroOpacity }} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="space-y-8">
            <div className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.03] px-3.5 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-blue-400 text-xs font-semibold tracking-widest uppercase">Predictive Maintenance</span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.05] tracking-tight">
              {['We', 'help', 'factories'].map((w, i) => (
                <motion.span
                  key={w}
                  initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: 0.15 + i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block mr-[0.28em]"
                >
                  {w}
                </motion.span>
              ))}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.4 }}
                className="inline-block"
              >
                <RotatingText />
              </motion.span>
              <br />
              <motion.span
                initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.55, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="inline-block"
              >
                bearing failures.
              </motion.span>
            </h1>

            <p className="text-lg text-white/40 max-w-xl leading-relaxed">
              Dual-modal edge intelligence for spindle bearing failure prediction.
              Plug in, walk away, get alerted — before 400 spindles go dark.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link href="/register">
                <Magnetic>
                  <Button className="shimmer glow-pulse bg-white hover:bg-white/90 text-black font-semibold h-12 px-8 text-base rounded-xl border-none">
                    Get Started <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Magnetic>
              </Link>
              <Button variant="outline" onClick={() => scrollToId('how')} className="border-white/10 text-white/60 hover:text-white hover:bg-white/5 h-12 px-8 text-base rounded-xl bg-transparent">
                See How It Works
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-sm text-white/30">
              <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-500" /><span>₹1,800/node</span></div>
              <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-blue-400" /><span>&lt;2ms detection</span></div>
              <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-emerald-500" /><span>WhatsApp alerts</span></div>
              <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-purple-400" /><span>Offline-first</span></div>
            </div>
          </motion.div>

          <motion.div style={{ y: modelY }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2 }} className="relative hidden lg:block">
            <BearingModel />
          </motion.div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 pointer-events-none">
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/25">Scroll</span>
          <div className="w-5 h-9 rounded-full border border-white/20 flex items-start justify-center p-1">
            <motion.div
              animate={{ y: [0, 14, 0], opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════ LIVE TICKER ═══════════════ */}
      <div aria-hidden="true" className="relative border-y border-white/[0.05] bg-white/[0.015] backdrop-blur-sm overflow-hidden py-3 select-none">
        <div className="flex w-max animate-[marquee_36s_linear_infinite] whitespace-nowrap">
          {[...Array(2)].flatMap((_, rep) =>
            ['BPFO/BPFI defect-frequency detection', '14,400 RPM ring frames', '6 fault classes · real ML model', 'Offline-first edge intelligence', 'WhatsApp alerts in plain language', '<2ms fault detection', 'Dual-modal vib + acoustic sensing', '400 spindles protected per machine'].map((text, i) => (
              <div key={`${rep}-${i}`} className="flex items-center gap-2.5 px-7 text-[11px] font-mono uppercase tracking-widest text-white/30">
                <span className="w-1 h-1 rounded-full bg-blue-400/70" />
                {text}
                <span className="text-white/10 ml-5">✦</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══════════════ ABOUT ═══════════════ */}
      <section id="problem" className="py-28 border-t border-white/[0.04] scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <div className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-4">About</div>
              <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-6">
                A single bearing failure stops{' '}
                <span className="font-serif-display italic text-blue-400">400 spindles.</span>
              </h2>
              <p className="text-white/40 text-lg leading-relaxed mb-8">
                In power loom MSMEs, unplanned downtime costs ₹54,000+ per incident.
                SmartBearing uses dual-modal edge intelligence — vibration + acoustics — to detect
                bearing defects hours before failure, giving operators time to act.
              </p>
              <div className="space-y-3">
                {['Zero cloud dependency for critical alerts', 'Runs on a ₹1,800 edge node per machine', 'WhatsApp alerts in plain language'].map((t) => (
                  <div key={t} className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-white/50">{t}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }} className="grid grid-cols-2 gap-4">
              {[
                { label: 'Avg. Downtime', value: 6, suffix: ' hrs', icon: Clock, color: 'text-blue-400' },
                { label: 'Cost / Incident', value: 54, prefix: '₹', suffix: 'K+', icon: ShieldAlert, color: 'text-red-400' },
                { label: 'Detection Speed', value: null, display: '<2ms', icon: Zap, color: 'text-emerald-400' },
                { label: 'Spindles Protected', value: 50, suffix: 'K+', icon: Activity, color: 'text-purple-400' },
              ].map((stat, i) => (
                <TiltCard key={i}>
                  <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    className="deck-card deck-card-stacked rounded-xl p-6 h-full"
                  >
                    <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
                    <div className="font-serif-display italic text-2xl font-bold mb-1">
                      {'display' in stat && stat.display ? stat.display : <CountUp to={stat.value as number} prefix={(stat as any).prefix ?? ''} suffix={(stat as any).suffix ?? ''} />}
                    </div>
                    <div className="text-sm text-white/35">{stat.label}</div>
                  </motion.div>
                </TiltCard>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section id="how" className="py-28 bg-white/[0.02] border-t border-white/[0.04] scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-4">How It Works</div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Edge intelligence. <span className="font-serif-display italic">Simplified.</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto text-lg">No cloud dependency for critical alerts. The decision happens on the machine.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-5">
            {[
              { step: '01', title: 'Sense', desc: 'Dual-modal MEMS sensors capture high-frequency vibration and acoustics.', icon: Waves, color: 'text-blue-400' },
              { step: '02', title: 'Normalise', desc: 'Edge processor accounts for voltage drops and spindle speed variations.', icon: Gauge, color: 'text-emerald-400' },
              { step: '03', title: 'Predict', desc: 'Lightweight ML models detect BPFO/BPFI spikes before failure.', icon: Cpu, color: 'text-purple-400' },
              { step: '04', title: 'Alert', desc: 'Instant WhatsApp and dashboard alerts with estimated time-to-failure.', icon: MessageCircle, color: 'text-amber-400' },
            ].map((item, i) => (
              <SpotlightCard key={i} className="h-full">
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="deck-card deck-card-stacked rounded-xl p-6 group h-full hover:-translate-y-1 transition-transform duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center group-hover:bg-white/[0.08] transition-colors">
                      <item.icon className={`w-5 h-5 ${item.color}`} />
                    </div>
                    <div className="text-white/10 font-mono font-bold text-2xl">{item.step}</div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-white/35 text-sm leading-relaxed">{item.desc}</p>
                </motion.div>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="features" className="py-28 border-t border-white/[0.04] scroll-mt-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-4">Features</div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for the shop floor, <span className="font-serif-display italic">not the lab.</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto text-lg">Everything runs locally on a ₹1,800 edge node.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Cpu, title: 'On-device ML', desc: 'XGBoost fault models run on the edge node with zero cloud dependency.', status: 'online' as const },
              { icon: MessageCircle, title: 'WhatsApp Alerts', desc: 'Instant alerts with estimated time-to-failure, in plain language.', status: 'online' as const },
              { icon: Zap, title: '<2ms Detection', desc: 'Fault signatures are caught in the same control cycle they appear.', status: 'online' as const },
              { icon: Gauge, title: 'Voltage Normalisation', desc: 'Readings auto-correct for supply drops as low as −20%.', status: 'healthy' as const },
              { icon: Thermometer, title: 'Dual-Modal Sensing', desc: 'Vibration + acoustics fused for fewer false alarms.', status: 'online' as const },
              { icon: Wifi, title: 'Offline-First', desc: 'Survives power cuts and network failures; alerts queue locally.', status: 'online' as const },
            ].map((f, i) => (
              <SpotlightCard key={i} className="h-full">
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.08, duration: 0.5 }}
                  className="deck-card deck-card-stacked p-7 rounded-xl group h-full hover:-translate-y-1 transition-transform duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center group-hover:bg-white/[0.08] transition-colors">
                      <f.icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <StatusDot status={f.status} />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-white/35 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ TECH STACK ═══════════════ */}
      <section className="py-28 bg-white/[0.02] border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <div className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-4">Tech Stack</div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Built for the shop floor, <span className="font-serif-display italic">not the lab.</span>
              </h2>
              <p className="text-white/40 text-lg leading-relaxed mb-8">
                Everything runs locally on a ₹1,800 edge node. From sensor fusion to ML inference to WhatsApp alerts — no cloud round-trip required.
              </p>
              <div className="flex flex-wrap gap-2">
                {['ESP32-S3', 'React', 'Node.js', 'scikit-learn', 'MongoDB', 'Socket.io'].map((t) => (
                  <span key={t} className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded-lg text-xs font-medium text-white/50">{t}</span>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }}
              className="deck-card deck-card-stacked rounded-xl p-8"
            >
              <div className="space-y-5">
                {[
                  { phase: 'Hardware Setup', time: 'Day 1', desc: 'Mount sensors, flash firmware, connect WiFi', icon: Cpu },
                  { phase: 'Data Collection', time: 'Week 1', desc: 'Collect baseline vibration signatures', icon: BarChart3 },
                  { phase: 'ML Training', time: 'Week 2', desc: 'Train fault classifiers on site-specific data', icon: Sparkles },
                  { phase: 'Go Live', time: 'Week 3', desc: 'Deploy alerts, train operators, start monitoring', icon: Zap },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center flex-shrink-0">
                      <step.icon className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">{step.phase}</div>
                        <div className="text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">{step.time}</div>
                      </div>
                      <div className="text-xs text-white/35 mt-1">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section id="faq" className="py-28 border-t border-white/[0.04] scroll-mt-16">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold text-blue-400 tracking-widest uppercase mb-4">FAQ</div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Got <span className="font-serif-display italic">questions?</span>
            </h2>
            <p className="text-white/40 text-lg">Everything you need to know about SmartBearing.</p>
          </div>
          <div className="deck-card rounded-xl px-6">
            {[
              { q: 'How does the bearing fault detection work?', a: 'SmartBearing uses dual-modal MEMS sensors (vibration + acoustics) connected to an ESP32-S3 edge node. The 29-feature ML pipeline extracts FFT peaks, RMS, kurtosis, and defect-frequency band-energy ratios (BPFO/BPFI/BSF/FTF) to classify 6 fault types with confidence scores.' },
              { q: 'Do I need internet connectivity?', a: 'No. Critical alerts run entirely on the edge node. The system survives power cuts and network failures — alerts queue locally and sync when connectivity returns.' },
              { q: 'How long does deployment take?', a: 'Typical deployment is 2-3 weeks per factory: hardware setup on Day 1, baseline data collection in Week 1, ML training in Week 2, and go-live in Week 3.' },
              { q: 'What machines are compatible?', a: 'SmartBearing works with any rotating machinery — power looms, CNC spindles, pumps, compressors, gearboxes. The sensor kit mounts to existing bearing housings.' },
              { q: 'What happens if the ML model is uncertain?', a: 'Every prediction includes a confidence score. Low-confidence predictions are flagged with additional context, and the system falls back to RMS-heuristic detection to ensure you always get an alert.' },
              { q: 'Is there a safety disclaimer?', a: 'Yes. All fault predictions are probabilistic and require human engineer confirmation. The system monitors only and never issues shutdown or control commands.' },
            ].map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA ═══════════════ */}
      <section className="py-28 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Your next bearing failure is{' '}
              <span className="font-serif-display italic text-gradient-amber">already speaking.</span>
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto mb-10">
              Stop it before 400 spindles go silent. Deployment takes under 15 minutes per machine.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/register">
                <Magnetic>
                  <Button className="bg-white hover:bg-white/90 text-black font-semibold h-12 px-9 text-base rounded-xl border-none">
                    Get Started Free <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Magnetic>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="border-white/10 text-white/60 hover:text-white hover:bg-white/5 h-12 px-9 text-base rounded-xl bg-transparent">
                  Log In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <div className="relative h-16 pointer-events-none" aria-hidden="true">
        <WaveField layers={2} opacity={0.3} />
      </div>
      <footer className="border-t border-white/[0.06] py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <span className="font-display font-bold text-lg">SmartBearing</span>
              </div>
              <p className="text-sm text-white/30 leading-relaxed">Dual-modal edge intelligence for spindle bearing failure prediction in power loom MSMEs.</p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Dashboard', 'Digital Twin', 'Workflow'] },
              { title: 'Resources', links: ['Documentation', 'API Reference', 'Hardware Spec', 'Research'] },
              { title: 'Company', links: ['About', 'Contact', 'Privacy', 'Terms'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}><span className="text-sm text-white/30 hover:text-white/60 cursor-pointer transition-colors">{l}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-white/[0.06]">
            <p className="text-sm text-white/25">© 2025 SmartBearing India. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/login" className="text-sm text-white/25 hover:text-white/50 transition-colors">Log In</Link>
              <Link href="/register" className="text-sm text-white/25 hover:text-white/50 transition-colors">Register</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
