import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { X, MessageCircle, ExternalLink } from 'lucide-react';
import { alertsApi } from '@/lib/api';

type AlertData = {
  machine: string;
  id: string;
  time: string;
  vibration: string;
  rul: string;
  bpfo: string;
  message: string;
  prevention: string[];
  critical: boolean;
};

const ALERTS: AlertData[] = [];

export default function WhatsAppAlert() {
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [alertIdx, setAlertIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [alerts, setAlerts] = useState<AlertData[]>(ALERTS);

  const show = useCallback((idx: number) => {
    setAlertIdx(idx);
    setExpanded(false);
    setVisible(true);
  }, []);

  // Pull the latest real alerts from the API (no hardcoded fake values)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await alertsApi.getAll({ status: 'active' });
        const list = res.data.data || [];
        if (!isMounted || list.length === 0) return;
        const mapped: AlertData[] = list.slice(0, 2).map((a: any, i: number) => {
          const vib = a.message?.match(/([\d.]+)\s*g/i);
          const prevention = Array.isArray(a.prevention) && a.prevention.length > 0
            ? a.prevention
            : ['Schedule inspection. Monitor vibration closely.'];
          return {
            machine: a.machineName || a.machineId,
            id: a.machineId,
            time: i === 0 ? 'Just now' : 'Live',
            vibration: vib ? `${vib[1]} g` : '—',
            rul: a.estimatedTimeToFailure || '—',
            bpfo: `${Math.round((a.anomalyScore || 0) * 100)}%`, // anomaly confidence
            message:
              `${a.type === 'CRITICAL' ? '⚠️ *CRITICAL BEARING ALERT*' : '⚠️ *WARNING — Bearing Degradation*'}\n\n` +
              `Machine: ${a.machineName || a.machineId} (${a.machineId})\n` +
              `Anomaly Score: ${(a.anomalyScore || 0).toFixed(2)}\n` +
              `${a.message}\n` +
              `Est. Time to Failure: ${a.estimatedTimeToFailure || '—'}\n\n` +
              `${a.technicianSummary || 'Schedule inspection.'}`,
            prevention,
            critical: a.type === 'CRITICAL',
          };
        });
        if (isMounted) setAlerts(mapped);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Auto-trigger after 5 seconds on first mount if real alerts exist
  useEffect(() => {
    if (triggered) return;
    if (alerts.length === 0) return;
    const t = setTimeout(() => {
      setTriggered(true);
      show(0);
    }, 5000);
    return () => clearTimeout(t);
  }, [triggered, show, alerts.length]);

  const alert = alerts[Math.min(alertIdx, alerts.length - 1)];
  const isCritical = alerts[alertIdx]?.critical ?? false;

  if (!alert) return null;

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring' }}
        onClick={() => show(0)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.35)] transition-colors"
        title="WhatsApp alert"
      >
        <MessageCircle className="w-4 h-4" />
        Alerts
      </motion.button>

      {/* Notification */}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="wa-alert"
            initial={{ opacity: 0, y: 80, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-20 right-6 z-50 w-[340px] max-w-[calc(100vw-3rem)] rounded-2xl overflow-hidden shadow-2xl border flex flex-col"
            style={{
              background: '#0E1621',
              borderColor: isCritical ? 'rgba(234,88,12,0.4)' : 'rgba(245,158,11,0.35)',
              maxHeight: 'min(calc(100dvh - 5.5rem), 640px)',
            }}
          >
            {/* WhatsApp-style header */}
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
              <button
                onClick={() => setVisible(false)}
                className="text-[#8696A0] hover:text-white transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message bubble */}
            <div className="p-3 flex-1 overflow-y-auto min-h-0">
              <div
                className="rounded-xl rounded-tl-none px-4 py-3 text-xs leading-relaxed relative"
                style={{ background: '#1E2B33', color: '#E9EDF0' }}
              >
                {/* Alert type badge */}
                <div
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold mb-2"
                  style={{
                    background: isCritical ? 'rgba(234,88,12,0.2)' : 'rgba(245,158,11,0.2)',
                    color: isCritical ? '#EA580C' : '#F59E0B',
                    border: `1px solid ${isCritical ? 'rgba(234,88,12,0.4)' : 'rgba(245,158,11,0.4)'}`,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: isCritical ? '#EA580C' : '#F59E0B' }} />
                  {isCritical ? 'CRITICAL' : 'WARNING'}
                </div>

                {/* Key stats row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Machine', value: alert.id },
                    { label: 'Vibration', value: alert.vibration },
                    { label: 'Est. TTF', value: alert.rul },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#0E1621] rounded-lg p-2 text-center">
                      <div className="text-[9px] text-[#8696A0] uppercase tracking-wide mb-0.5">{s.label}</div>
                      <div className="text-white font-mono font-bold text-xs">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Expandable full message */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="font-sans whitespace-pre-wrap text-[11px] text-[#C9D1D9] leading-relaxed mb-2">
                        {alert.message}
                      </div>

                      {/* Prevention techniques — actionable steps per fault class */}
                      {alert.prevention.length > 0 && (
                        <div
                          className="rounded-lg p-2.5 mb-2 border"
                          style={{
                            background: 'rgba(37,211,102,0.06)',
                            borderColor: 'rgba(37,211,102,0.25)',
                          }}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#25D366] uppercase tracking-wide mb-1.5">
                            <span>🛠️</span> Prevention techniques
                          </div>
                          <ul className="space-y-1">
                            {alert.prevention.map((p, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-[11px] text-[#C9D1D9] leading-snug">
                                <span className="text-[#25D366] font-bold mt-px">✓</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="text-[#53BDEB] text-[11px] hover:underline"
                >
                  {expanded ? 'Show less' : 'Read full message ↓'}
                </button>

                {/* Timestamp */}
                <div className="text-right text-[10px] text-[#8696A0] mt-2 font-mono">{alert.time} ✓✓</div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex border-t" style={{ borderColor: '#1F2C34' }}>
              <button
                onClick={() => {
                  setVisible(false);
                  setTimeout(() => show(alertIdx + 1 >= alerts.length ? 0 : alertIdx + 1), 350);
                }}
                className="flex-1 py-3 text-xs font-semibold text-[#8696A0] hover:text-white hover:bg-[#1F2C34] transition-colors"
              >
                Next alert
              </button>
              <div className="w-px" style={{ background: '#1F2C34' }} />
              <button
                onClick={() => {
                  setVisible(false);
                  navigate('/alerts');
                }}
                className="flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                style={{ color: '#25D366' }}
              >
                <ExternalLink className="w-3.5 h-3.5" /> View in dashboard
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
