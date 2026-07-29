import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle, ExternalLink } from 'lucide-react';

const ALERTS = [
  {
    machine: 'Ring Frame #3',
    id: 'M003',
    time: 'Just now',
    vibration: '3.84 g',
    rul: '~6 hrs',
    bpfo: '142.3 Hz',
    message:
      '⚠️ *CRITICAL BEARING ALERT*\n\nMachine: Ring Frame #3 (M003)\nVibration: 3.84 g RMS ↑↑\nBPFO Spike: 142.3 Hz\nEst. Time to Failure: ~6 hrs\n\nImmediate inspection required. Check lubrication and replace bearing by next shift.',
  },
  {
    machine: 'Ring Frame #2',
    id: 'M002',
    time: '2 min ago',
    vibration: '2.11 g',
    rul: '~22 hrs',
    bpfo: '89.7 Hz',
    message:
      '⚠️ *WARNING — Bearing Degradation*\n\nMachine: Ring Frame #2 (M002)\nVibration: 2.11 g RMS ↑\nBPFO Spike: 89.7 Hz\nEst. Time to Failure: ~22 hrs\n\nSchedule maintenance within next shift.',
  },
];

type AlertIdx = 0 | 1;

export default function WhatsAppAlert() {
  const [visible, setVisible] = useState(false);
  const [alertIdx, setAlertIdx] = useState<AlertIdx>(0);
  const [expanded, setExpanded] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const show = useCallback((idx: AlertIdx) => {
    setAlertIdx(idx);
    setExpanded(false);
    setVisible(true);
  }, []);

  // Auto-trigger after 5 seconds on first mount
  useEffect(() => {
    if (triggered) return;
    const t = setTimeout(() => {
      setTriggered(true);
      show(0);
    }, 5000);
    return () => clearTimeout(t);
  }, [triggered, show]);

  const alert = ALERTS[alertIdx];
  const isCritical = alertIdx === 0;

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring' }}
        onClick={() => show(0)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.35)] transition-colors"
        title="Simulate WhatsApp alert"
      >
        <MessageCircle className="w-4 h-4" />
        Simulate Alert
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
            className="fixed bottom-20 right-6 z-50 w-[340px] rounded-2xl overflow-hidden shadow-2xl border"
            style={{
              background: '#0E1621',
              borderColor: isCritical ? 'rgba(234,88,12,0.4)' : 'rgba(245,158,11,0.35)',
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
            <div className="p-3">
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
                    <motion.pre
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="font-sans whitespace-pre-wrap text-[11px] text-[#C9D1D9] leading-relaxed mb-2 overflow-hidden"
                    >
                      {alert.message}
                    </motion.pre>
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
                  show(alertIdx === 0 ? 1 : 0);
                  setTimeout(() => setVisible(true), 300);
                }}
                className="flex-1 py-3 text-xs font-semibold text-[#8696A0] hover:text-white hover:bg-[#1F2C34] transition-colors"
              >
                Next alert
              </button>
              <div className="w-px" style={{ background: '#1F2C34' }} />
              <button
                onClick={() => setVisible(false)}
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
