import { stats, machines, alerts } from '@/data/mockData';

export function generatePDFReport() {
  const date = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
  const reportId = `SB-${Date.now().toString(36).toUpperCase()}`;

  const machineRows = machines.map(m => `
    <tr>
      <td style="font-family:monospace;font-weight:600">${m.id}</td>
      <td>${m.name}</td>
      <td class="${m.status}">${m.status.toUpperCase()}</td>
      <td style="font-family:monospace;font-weight:700;color:${m.healthScore < 50 ? '#EA580C' : m.healthScore < 80 ? '#F59E0B' : '#10B981'}">${m.healthScore}%</td>
      <td>${m.spindles}</td>
      <td>${m.activeSensors}</td>
      <td style="color:#64748b">${m.lastAlert ?? '—'}</td>
    </tr>
  `).join('');

  const alertRows = alerts.map(a => `
    <tr>
      <td class="${a.type.toLowerCase()}">${a.type}</td>
      <td style="font-weight:600">${a.machineName}</td>
      <td style="color:#475569">${a.message}</td>
      <td style="font-family:monospace;font-size:11px;color:#64748b">${a.timestamp}</td>
      <td style="font-family:monospace;color:#F59E0B">${a.estimatedTimeToFailure ?? '—'}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SmartBearing Fleet Report — ${date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #0F172A; background: #fff; padding: 40px; font-size: 13px; line-height: 1.5; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 3px solid #0F1629; }
    .logo { font-size: 26px; font-weight: 900; color: #0F1629; letter-spacing: -0.5px; }
    .logo span { color: #F59E0B; }
    .tagline { font-size: 11px; color: #64748b; margin-top: 3px; }
    .report-meta { text-align: right; color: #64748b; font-size: 12px; line-height: 2; }
    .report-meta strong { color: #0F172A; font-size: 14px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0 28px; }
    .kpi { border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 16px 12px; text-align: center; }
    .kpi .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 6px; }
    .kpi .val { font-size: 26px; font-weight: 800; font-family: 'Courier New', monospace; color: #0F172A; }
    .kpi.green .val { color: #10B981; } .kpi.amber .val { color: #F59E0B; } .kpi.blue .val { color: #3B82F6; } .kpi.red .val { color: #EA580C; }
    h2 { font-size: 14px; font-weight: 700; color: #0F1629; margin: 28px 0 12px; padding-left: 10px; border-left: 4px solid #F59E0B; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #0F1629; color: #e2e8f0; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; }
    th:first-child { border-radius: 6px 0 0 0; } th:last-child { border-radius: 0 6px 0 0; }
    td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
    tr:nth-child(even) td { background: #f8fafc; }
    .healthy { color: #10B981; font-weight: 700; } .warning { color: #D97706; font-weight: 700; } .critical { color: #EA580C; font-weight: 700; } .info { color: #3B82F6; font-weight: 700; }
    .roi { background: linear-gradient(135deg, #0F1629, #1a2744); color: #fff; border-radius: 12px; padding: 28px 32px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .roi .amount { font-size: 40px; font-weight: 900; color: #10B981; font-family: 'Courier New', monospace; margin: 6px 0; }
    .roi .note { font-size: 11px; color: #94a3b8; max-width: 260px; text-align: right; line-height: 1.7; }
    .summary-row { display: flex; gap: 24px; margin-top: 6px; }
    .summary-row span { font-size: 12px; color: #94a3b8; }
    .summary-row strong { color: #e2e8f0; }
    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; color: #94a3b8; font-size: 11px; }
    @page { margin: 18mm; size: A4; }
    @media print { body { padding: 0; } .footer { position: fixed; bottom: 0; width: 100%; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Smart<span>Bearing</span></div>
      <div class="tagline">Dual-modal edge intelligence for power loom MSMEs · Sircilla, Telangana</div>
    </div>
    <div class="report-meta">
      <strong>Fleet Analytics Report</strong><br>
      ${date} at ${time}<br>
      Factory Units A + B<br>
      Report ID: ${reportId}
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="lbl">Total Machines</div><div class="val">${stats.totalMachines}</div></div>
    <div class="kpi amber"><div class="lbl">Avg Fleet Health</div><div class="val">${stats.averageFleetHealth}%</div></div>
    <div class="kpi green"><div class="lbl">Cost Saved</div><div class="val">₹${(stats.estimatedCostSaved / 1000).toFixed(0)}K</div></div>
    <div class="kpi blue"><div class="lbl">Sensor Uptime</div><div class="val">${stats.uptimePercent}%</div></div>
  </div>

  <h2>Machine Health Summary</h2>
  <table>
    <thead><tr><th>ID</th><th>Machine</th><th>Status</th><th>Health Score</th><th>Spindles</th><th>Active Sensors</th><th>Last Alert</th></tr></thead>
    <tbody>${machineRows}</tbody>
  </table>

  <h2>Alert Log</h2>
  <table>
    <thead><tr><th>Severity</th><th>Machine</th><th>Description</th><th>Timestamp</th><th>Est. Time to Failure</th></tr></thead>
    <tbody>${alertRows}</tbody>
  </table>

  <h2>ROI & Cost Savings</h2>
  <div class="roi">
    <div>
      <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.6px">Estimated Monthly Savings</div>
      <div class="amount">₹${stats.estimatedCostSaved.toLocaleString()}</div>
      <div class="summary-row">
        <span>Downtime prevented: <strong>${stats.estimatedDowntimePrevented} hrs</strong></span>
        <span>Failures prevented: <strong>${stats.failuresPrevented}</strong></span>
      </div>
    </div>
    <div class="note">Based on 80% predictive prevention rate vs run-to-failure strategy. ${stats.activeSensorNodes} sensor nodes active at ${stats.uptimePercent}% uptime.</div>
  </div>

  <div class="footer">
    <div>SmartBearing v1.0 · Predictive Bearing Intelligence Platform</div>
    <div>Confidential — Internal use only · ${reportId}</div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Pop-ups are blocked. Please allow pop-ups for this site to export the PDF report.');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 600);
}

export function exportAlertsCSV() {
  const headers = ['ID', 'Machine', 'Type', 'Status', 'Message', 'Anomaly Score', 'Timestamp', 'Est. Time to Failure'];
  const rows = alerts.map(a => [
    a.id, a.machineName, a.type, a.status,
    `"${a.message.replace(/"/g, '""')}"`,
    a.anomalyScore, a.timestamp,
    a.estimatedTimeToFailure ?? 'N/A',
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smartbearing-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
