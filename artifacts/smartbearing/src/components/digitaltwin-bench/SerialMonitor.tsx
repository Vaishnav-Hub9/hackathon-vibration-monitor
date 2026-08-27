/**
 * SerialMonitor — virtual 9600-baud serial monitor displaying JSON telemetry
 * frames emitted by the AVR8js firmware, exactly like a real Arduino serial
 * monitor connected to the physical rig.
 */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Trash2, Copy } from 'lucide-react';
import { useDigitalTwinStore } from '@/simulation/store';

export default function SerialMonitor() {
  const serialLog = useDigitalTwinStore((s) => s.serialLog);
  const clearSerialLog = useDigitalTwinStore((s) => s.clearSerialLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [serialLog]);

  const handleCopy = () => {
    const text = serialLog.join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="bg-[#0a0a0a] rounded-xl border border-navy overflow-hidden font-mono-data">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-navy">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-slate-300">Serial Monitor</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold">
            9600 BAUD
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300 transition"
            title="Copy all"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={clearSerialLog}
            className="p-1.5 rounded hover:bg-white/5 text-slate-500 hover:text-red-400 transition"
            title="Clear"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        className="h-56 overflow-y-auto p-3 space-y-0.5 text-[11px] leading-relaxed"
      >
        {serialLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
            <Terminal className="w-6 h-6 opacity-40" />
            <span>Waiting for firmware output…</span>
          </div>
        ) : (
          serialLog.map((line, i) => {
            // Try to parse JSON for syntax highlighting
            let formatted = line;
            let isJson = false;
            try {
              const jsonStart = line.indexOf('{');
              if (jsonStart >= 0) {
                const ts = line.substring(0, jsonStart);
                const obj = JSON.parse(line.substring(jsonStart));
                formatted = ts + JSON.stringify(obj, null, 2);
                isJson = true;
              }
            } catch {
              // not JSON — display raw
            }

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={`${isJson ? 'text-emerald-300/80' : 'text-slate-400'}`}
              >
                {isJson ? (
                  <pre className="whitespace-pre-wrap break-all">
                    <span className="text-slate-600">{line.substring(0, line.indexOf('{'))}</span>
                    <JsonHighlight text={line.substring(line.indexOf('{'))} />
                  </pre>
                ) : (
                  <span>{line}</span>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#111] border-t border-navy text-[9px] text-slate-600">
        <span>{serialLog.length} frames received</span>
        <span>JSON @ 1 Hz · OneWire D5</span>
      </div>
    </div>
  );
}

/** Minimal JSON syntax highlighter for serial output */
function JsonHighlight({ text }: { text: string }) {
  // Highlight keys, strings, numbers, booleans
  const highlighted = text
    .replace(/"([^"]+)":/g, '<span class="text-amber-400">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="text-emerald-300">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="text-sky-300">$1</span>')
    .replace(/: (true|false|null)/g, ': <span class="text-purple-300">$1</span>');

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}
