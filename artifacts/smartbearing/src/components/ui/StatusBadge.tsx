export function StatusBadge({ status }: { status: string }) {
  const config = {
    healthy: { label: 'HEALTHY', bg: '#0D2B1F', text: '#10B981', border: '#10B981' },
    warning: { label: 'WARNING', bg: '#2B1D0A', text: '#F59E0B', border: '#F59E0B' },
    critical: { label: 'CRITICAL', bg: '#2B0D0A', text: '#EA580C', border: '#EA580C' },
    CRITICAL: { label: 'CRITICAL', bg: '#2B0D0A', text: '#EA580C', border: '#EA580C' },
    WARNING: { label: 'WARNING', bg: '#2B1D0A', text: '#F59E0B', border: '#F59E0B' },
    INFO: { label: 'INFO', bg: '#0A1B2B', text: '#3B82F6', border: '#3B82F6' },
    RESOLVED: { label: 'RESOLVED', bg: '#0D2B1F', text: '#10B981', border: '#10B981' },
  };
  const c = config[status as keyof typeof config] || config.healthy;
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>
      {c.label}
    </span>
  );
}
