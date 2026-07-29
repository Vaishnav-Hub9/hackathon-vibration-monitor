import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { Activity, ArrowRight, CheckCircle2, ShieldAlert, Cpu, Zap, ActivitySquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BearingModel from '@/components/landing/BearingModel';
import { useCountUp } from '@/hooks/useCountUp';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const mockFFTData = Array.from({ length: 20 }, (_, i) => ({
  freq: i * 50,
  amp: Math.random() * 0.2 + (i === 4 ? 0.8 : 0) // Spike at index 4
}));

export default function Landing() {
  const hoursSaved = useCountUp(4, 2000);
  const costSaved = useCountUp(12000, 2000);
  const spindles = useCountUp(50000, 2500);

  return (
    <div className="min-h-screen bg-navy text-slate-200 font-sans selection:bg-amber/30 selection:text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-navy bg-navy/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-amber" />
            <span className="font-display font-bold text-lg tracking-wide text-white">Smart<span className="text-amber">Bearing</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Log In</Link>
            <Link href="/register" className="text-sm font-medium bg-amber hover:bg-amber/90 text-navy px-4 py-2 rounded-md transition-colors">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[100dvh] pt-20 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-navy/50 to-navy"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center w-full">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="space-y-8"
          >
            <div className="inline-block border border-amber/30 bg-amber/10 px-3 py-1 rounded-full">
              <span className="text-amber text-xs font-bold tracking-widest uppercase">MSME Predictive Maintenance</span>
            </div>
            <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] text-white">
              Hear the bearing <br/>
              <span className="text-amber">before it breaks.</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-400 max-w-xl leading-relaxed">
              Dual-modal edge intelligence system for spindle bearing failure prediction in power loom MSMEs. Plug in, walk away, get alerted on WhatsApp.
            </p>
            
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link href="/register">
                <Button className="bg-amber hover:bg-amber/90 text-navy font-semibold h-12 px-8 text-base shadow-[0_0_20px_rgba(245,158,11,0.3)] border-none">
                  Get Started <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button variant="outline" className="border-navy text-slate-300 hover:text-white hover:bg-navy-card h-12 px-8 text-base">
                See How It Works
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-8 border-t border-navy">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-amber" />
                <span>₹1,800/node</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-amber" />
                <span>&lt;2ms detection</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-amber" />
                <span>WhatsApp alerts</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="absolute inset-0 bg-amber/5 rounded-full blur-3xl filter"></div>
            <BearingModel />
            
            {/* Overlay Graph */}
            <div className="absolute bottom-10 -left-10 bg-navy-card/90 backdrop-blur border border-navy p-4 rounded-xl shadow-2xl w-64">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-300">Live FFT Spectrum</span>
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
              </div>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockFFTData}>
                    <Line type="monotone" dataKey="amp" stroke="#F59E0B" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-24 bg-[#0A0E1A]">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-3xl md:text-5xl font-bold text-white"
          >
            A single bearing failure stops <span className="text-amber">400 spindles.</span>
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { label: "Average Downtime", value: `${hoursSaved}–6 hrs`, icon: ActivitySquare },
              { label: "Cost Per Incident", value: `₹${costSaved.toLocaleString()}+`, icon: ShieldAlert },
              { label: "Spindles Protected", value: `${spindles.toLocaleString()}+`, icon: Zap }
            ].map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-navy-card border border-navy p-8 rounded-2xl hover:border-amber/30 transition-colors"
              >
                <stat.icon className="w-8 h-8 text-amber mb-4 mx-auto" />
                <div className="text-4xl font-display font-bold text-white mb-2">{stat.value}</div>
                <div className="text-slate-400 font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-navy-card relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">Edge Intelligence. Simplified.</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-lg">No cloud dependency for critical alerts. The decision happens on the machine.</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Sense", desc: "Dual-modal MEMS sensors capture high-freq vibration and acoustics." },
              { step: "02", title: "Normalize", desc: "Edge processor accounts for voltage drops and spindle speeds." },
              { step: "03", title: "Predict", desc: "Lightweight ML models detect BPFO spikes before failure." },
              { step: "04", title: "Alert", desc: "Instant WhatsApp & dashboard alerts with estimated time-to-failure." }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative bg-navy p-6 rounded-xl border border-navy hover:-translate-y-1 transition-transform"
              >
                <div className="text-amber font-mono font-bold text-xl mb-4">{item.step}</div>
                <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
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
    </div>
  );
}
