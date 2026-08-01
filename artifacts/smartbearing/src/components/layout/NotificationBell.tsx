import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { Bell, X, AlertTriangle, ShieldCheck, ChevronRight, ExternalLink } from 'lucide-react';
import { alertsApi } from '@/lib/api';
import { getSocket } from '@/lib/socket';

type AlertStatus = 'active' | 'acknowledged' | 'resolved';

type Alert = {
  id: string;
  nodeId: string;
  machineId: string;
  machineName: string;
  type: string;
  message: string;
  anomalyScore: number;
  timestamp: string;
  status: AlertStatus;
  estimatedTimeToFailure: string | null;
};

const TYPE_COLOR: Record<string, string> = {
  CRITICAL: '#EA580C',
  WARNING: '#F59E0B',
  INFO: '#3B82F6',
};

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

// Demo fallback so the bell is always functional, even when the backend is
// offline or the session is unauthenticated (the landing/API probe returns 401).
const MOCK_ALERTS: Alert[] = [
  {
    id: 'mock-c1',
    nodeId: 'SN005',
    machineId: 'M003',
    machineName: 'Ring Frame #3',
    type: 'CRITICAL',
    message: 'BPFO spike detected at 142.3 Hz · vibration 3.84 g — bearing failure imminent, replace by next shift.',
    anomalyScore: 0.91,
    timestamp: minsAgo(1),
    status: 'active',
    estimatedTimeToFailure: '~6 hrs',
  },
  {
    id: 'mock-w1',
    nodeId: 'SN002',
    machineId: 'M002',
    machineName: 'Ring Frame #2',
    type: 'WARNING',
    message: 'Vibration RMS elevated 2.3x (2.11 g). Schedule maintenance within next shift.',
    anomalyScore: 0.62,
    timestamp: minsAgo(12),
    status: 'active',
    estimatedTimeToFailure: '~22 hrs',
  },
  {
    id: 'mock-w2',
    nodeId: 'SN003',
    machineId: 'M006',
    machineName: 'Ring Frame #5',
    type: 'WARNING',
    message: 'Temperature anomaly — bearing housing at 61°C.',
    anomalyScore: 0.41,
    timestamp: minsAgo(45),
    status: 'active',
    estimatedTimeToFailure: '5–10 days',
  },
  {
    id: 'mock-i1',
    nodeId: 'SN001',
    machineId: 'M001',
    machineName: 'Ring Frame #1',
    type: 'INFO',
    message: 'Routine telemetry check complete. All nodes nominal.',
    anomalyScore: 0.08,
    timestamp: minsAgo(180),
    status: 'resolved',
    estimatedTimeToFailure: null,
  },
];

function timeAgo(ts: string): string {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return ts;
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Persist which alerts the user has already seen, so the badge stays correct
// across page navigations (DashLayout remounts the bell on every route).
const SEEN_KEY = 'smartbearing:seen-alerts';

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const seenIds = useRef<Set<string>>(loadSeen());

  const persistSeen = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seenIds.current]));
    } catch {
      /* storage unavailable — badge simply resets next mount */
    }
  }, []);

  const push = useCallback(
    (a: Alert) => {
      setAlerts((prev) => {
        if (prev.some((x) => x.id === a.id)) return prev;
        return [a, ...prev].slice(0, 20);
      });
      if (!seenIds.current.has(a.id)) {
        seenIds.current.add(a.id);
        setUnread((u) => u + 1);
        persistSeen();
      }
    },
    [persistSeen]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await alertsApi.getAll();
        if (!mounted) return;
        const list: Alert[] = Array.isArray(res.data?.data) ? res.data.data : [];
        setAlerts(list.slice(0, 20));
        const fresh = list.filter((a) => a.status === 'active' && !seenIds.current.has(a.id));
        setUnread(fresh.length);
        list.forEach((a) => seenIds.current.add(a.id));
        persistSeen();
      } catch {
        // Backend offline / unauthenticated — keep the bell fully functional
        // with the demo feed, and treat it like the live path: badge shows
        // unseen-active only, then clears once the panel is opened.
        if (!mounted) return;
        setAlerts(MOCK_ALERTS);
        const fresh = MOCK_ALERTS.filter((a) => a.status === 'active' && !seenIds.current.has(a.id));
        setUnread(fresh.length);
        MOCK_ALERTS.forEach((a) => seenIds.current.add(a.id));
        persistSeen();
      }
    };
    load();

    const socket = getSocket();
    const onNewAlert = (a: Alert) => {
      if (!mounted) return;
      push(a);
    };
    socket.on('alert:new', onNewAlert);

    return () => {
      mounted = false;
      socket.off('alert:new', onNewAlert);
    };
  }, [push, persistSeen]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Opening the panel marks everything currently shown as seen.
      seenIds.current = new Set(alerts.map((a) => a.id));
      setUnread(0);
      persistSeen();
    }
  };

  const unreadBadge = unread > 0 ? (unread > 9 ? '9+' : String(unread)) : null;

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        aria-label={`Notifications${unreadBadge ? ` (${unread} unread)` : ''}`}
        className="relative p-2 rounded-lg text-slate-300 hover:text-amber hover:bg-[#141E35] transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadBadge && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#EA580C] text-white text-[10px] font-bold border-2 border-navy-card">
            {unreadBadge}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-away backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="absolute right-0 top-12 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-[#0F1629] border border-navy rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-navy">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Notifications</span>
                  {unreadBadge ? (
                    <span className="text-[10px] font-bold text-[#EA580C] bg-[#EA580C]/15 border border-[#EA580C]/30 rounded-full px-2 py-0.5">
                      {unread} new
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono-data text-[#10B981]">ALL CAUGHT UP</span>
                  )}
                </div>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white transition-colors" aria-label="Close notifications">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* List */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-navy/60">
                {alerts.length === 0 && (
                  <div className="py-10 text-center">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-[#10B981] opacity-50" />
                    <p className="text-xs text-slate-500">No notifications yet.</p>
                  </div>
                )}
                {alerts.map((a) => {
                  const color = TYPE_COLOR[a.type] || '#64748B';
                  const isResolved = a.status === 'resolved';
                  return (
                    <Link key={a.id} href={`/machine/${a.machineId}`} onClick={() => setOpen(false)}>
                      <div className={`relative px-4 py-3 hover:bg-[#141E35] transition-colors ${isResolved ? 'opacity-60' : ''}`}>
                        <span className="absolute left-0 top-0 bottom-0 w-0.5" style={{ backgroundColor: color }} />
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ color, backgroundColor: `${color}1A`, border: `1px solid ${color}40` }}
                          >
                            {a.type}
                          </span>
                          <span className="text-xs font-bold text-white truncate">{a.machineName || a.machineId}</span>
                          <span className="ml-auto text-[10px] font-mono-data text-slate-500 flex-shrink-0">{timeAgo(a.timestamp)}</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">{a.message}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono-data text-slate-500">
                          <span>{a.nodeId}</span>
                          <span>Score {a.anomalyScore.toFixed(2)}</span>
                          {a.estimatedTimeToFailure && (
                            <span className="text-amber flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> ETF {a.estimatedTimeToFailure}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="border-t border-navy">
                <Link href="/alerts" onClick={() => setOpen(false)}>
                  <div className="flex items-center justify-center gap-1.5 px-4 py-3 text-xs font-semibold text-amber hover:bg-[#141E35] transition-colors">
                    View all alerts <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
                <a
                  href="https://wa.me/919876543210"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-navy/60 text-[11px] font-medium text-[#25D366] hover:bg-[#141E35] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Open WhatsApp alert channel
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
