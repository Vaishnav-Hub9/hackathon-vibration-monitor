import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { machines } from '@/data/mockData';
import {
  LayoutDashboard, Activity, Bell, BarChart2, Settings,
  Cpu, ChevronRight, Search, Zap, TrendingDown
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Fleet Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: 'D' },
  { label: 'Predictions', href: '/predictions', icon: TrendingDown, shortcut: 'P' },
  { label: 'Alert Center', href: '/alerts', icon: Bell, shortcut: 'A' },
  { label: 'Analytics & ROI', href: '/analytics', icon: BarChart2, shortcut: 'R' },
  { label: 'Settings', href: '/settings', icon: Settings, shortcut: 'S' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [, navigate] = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function go(href: string) {
    navigate(href);
    setOpen(false);
    setQuery('');
  }

  const filteredMachines = machines.filter(m =>
    query === '' ||
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.id.toLowerCase().includes(query.toLowerCase())
  );

  const filteredNav = NAV_ITEMS.filter(n =>
    query === '' || n.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Palette */}
            <motion.div
              key="palette"
              initial={{ opacity: 0, scale: 0.96, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed top-[18%] left-1/2 -translate-x-1/2 z-50 w-full max-w-lg"
            >
              <Command
                className="rounded-2xl border overflow-hidden shadow-2xl"
                style={{ background: '#0F1629', borderColor: '#1E2D4A' }}
                shouldFilter={false}
              >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: '#1E2D4A' }}>
                  <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <Command.Input
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search machines, pages, actions…"
                    className="flex-1 bg-transparent text-white placeholder-slate-500 text-sm outline-none font-sans"
                    autoFocus
                  />
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E2D4A] text-slate-400 font-mono">ESC</kbd>
                </div>

                <Command.List className="max-h-[380px] overflow-y-auto p-2 space-y-1">
                  <Command.Empty className="py-10 text-center text-slate-500 text-sm">
                    No results for "{query}"
                  </Command.Empty>

                  {/* Navigation */}
                  {filteredNav.length > 0 && (
                    <Command.Group>
                      <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-slate-600 font-semibold">Navigation</div>
                      {filteredNav.map(item => (
                        <Command.Item
                          key={item.href}
                          onSelect={() => go(item.href)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-slate-300 hover:bg-[#1E2D4A] hover:text-white transition-colors group"
                        >
                          <item.icon className="w-4 h-4 text-amber flex-shrink-0" />
                          <span className="flex-1 text-sm">{item.label}</span>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[#0A0E1A] text-slate-500 font-mono">{item.shortcut}</kbd>
                            <ChevronRight className="w-3 h-3 text-slate-600" />
                          </div>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}

                  {/* Machines */}
                  {filteredMachines.length > 0 && (
                    <Command.Group>
                      <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-slate-600 font-semibold mt-2">Machines</div>
                      {filteredMachines.map(m => {
                        const statusColor = m.status === 'critical' ? '#EA580C' : m.status === 'warning' ? '#F59E0B' : '#10B981';
                        return (
                          <Command.Item
                            key={m.id}
                            onSelect={() => go(`/machine/${m.id}`)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-slate-300 hover:bg-[#1E2D4A] hover:text-white transition-colors"
                          >
                            <Cpu className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white truncate">{m.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{m.id} · {m.spindles} spindles</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[11px] font-bold font-mono"
                                style={{ color: statusColor }}
                              >
                                {m.healthScore}%
                              </span>
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: statusColor }}
                              />
                            </div>
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  )}

                  {/* Quick actions */}
                  {query === '' && (
                    <Command.Group>
                      <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-slate-600 font-semibold mt-2">Quick Actions</div>
                      <Command.Item
                        onSelect={() => { go('/analytics'); }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-slate-300 hover:bg-[#1E2D4A] hover:text-white transition-colors"
                      >
                        <Zap className="w-4 h-4 text-amber flex-shrink-0" />
                        <span className="text-sm">Export PDF Report → Analytics</span>
                      </Command.Item>
                      <Command.Item
                        onSelect={() => { go('/alerts'); }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-slate-300 hover:bg-[#1E2D4A] hover:text-white transition-colors"
                      >
                        <Activity className="w-4 h-4 text-[#EA580C] flex-shrink-0" />
                        <span className="text-sm">View critical alerts</span>
                      </Command.Item>
                    </Command.Group>
                  )}
                </Command.List>

                {/* Footer hint */}
                <div
                  className="px-4 py-2.5 flex items-center gap-4 text-[11px] text-slate-600 border-t"
                  style={{ borderColor: '#1E2D4A' }}
                >
                  <span><kbd className="font-mono bg-[#1E2D4A] text-slate-500 px-1 rounded">↑↓</kbd> navigate</span>
                  <span><kbd className="font-mono bg-[#1E2D4A] text-slate-500 px-1 rounded">↵</kbd> open</span>
                  <span><kbd className="font-mono bg-[#1E2D4A] text-slate-500 px-1 rounded">⌘K</kbd> toggle</span>
                </div>
              </Command>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Trigger hint shown on dashboard */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-30 hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 bg-[#0F1629] border border-[#1E2D4A] rounded-lg hover:border-slate-600 hover:text-slate-300 transition-colors shadow-lg"
        >
          <Search className="w-3 h-3" />
          Search or jump to…
          <kbd className="ml-1 font-mono text-[10px] bg-[#1E2D4A] px-1 rounded">⌘K</kbd>
        </button>
      )}
    </>
  );
}
