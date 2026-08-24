import { Router, Request, Response } from 'express';
import { Alert } from '../models/Alert.js';
import { authenticateJWT, type AuthRequest } from '../middleware/auth.js';
import { Machine } from '../models/Machine.js';
import { notifyMailAlert, isMailConfigured, type MailAlertPayload } from '../lib/mail.js';
import { isWhatsAppConfigured, sendWhatsAppMessage } from '../lib/whatsapp.js';
import { User } from '../models/User.js';

const router = Router();
router.use(authenticateJWT);

// Fire a sample warning email immediately to every configured recipient —
// used by Settings -> Notifications -> "Send Test Alert Email" for demos.
router.post('/test-email', async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user.id).select('email alertEmail');
  const to = user?.alertEmail || user?.email || '';

  if (isMailConfigured()) {
    // Real SMTP delivery
    const payload: MailAlertPayload = {
      machineId: 'M004',
      machineName: 'Bearing #4 - Conveyor Line A',
      severity: 'critical',
      message: 'OUTER RACE fault detected with 94.2% confidence (test alert).',
      technicianSummary: 'Outer race spalling likely; plan bearing replacement within shift.',
      prevention: ['Replace bearing', 'Check lubrication'],
      anomalyScore: 0.87,
      estimatedTimeToFailure: '6-18 hours',
      detectedAt: new Date(),
    };
    await notifyMailAlert(payload);
    res.json({ success: true, message: 'Test email sent via SMTP' });
  } else {
    // Simulated delivery — create a real alert in the database so it shows
    // up on the Dashboard and Alerts page.
    const alert = await Alert.create({
      machineId: 'M004',
      spindleId: 'SN004',
      severity: 'critical',
      type: 'OUTER RACE',
      message: `[TEST EMAIL] OUTER RACE fault detected with 94.2% confidence on Bearing #4 - Conveyor Line A.`,
      anomalyScore: 0.87,
      status: 'active',
      detectedAt: new Date(),
      technicianSummary: 'Outer race spalling likely; plan bearing replacement within shift.',
      evidence: {
        label: 'OUTER RACE',
        confidence: 0.942,
        dominantFreq: 180,
        rpm: 14400,
        peaks: [{ freq: 180, amplitude: 0.87 }],
      },
    });

    // Broadcast to dashboard
    try {
      const { getIo } = await import('../socket.js');
      const io = getIo();
      if (io) {
        io.to('fleet').emit('alert:new', alert);
        io.to('fleet').emit('fleet:summary', {
          alertsToday: await Alert.countDocuments({ detectedAt: { $gte: new Date(Date.now() - 86400000) } }),
        });
      }
    } catch {}

    res.json({
      success: true,
      message: to ? `Test alert created (email would be sent to ${to} — configure SMTP for real delivery)` : 'Test alert created (simulated — set alert email in profile for real delivery)',
      simulated: true,
    });
  }
});

// Fire a sample WhatsApp alert to the signed-in user's saved number —
// used by Settings -> Notifications -> "Send Test WhatsApp".
router.post('/test-whatsapp', async (req: AuthRequest, res: Response): Promise<void> => {
  if (!isWhatsAppConfigured()) {
    res.status(503).json({
      success: false,
      error: 'WhatsApp delivery not configured — add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in Settings → Environment (Keys tab). See https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
    });
    return;
  }
  const user = await User.findById(req.user.id).select('alertWhatsapp');
  const to = user?.alertWhatsapp || process.env.MESSAGEBIRD_ALERT_TO || '';
  if (!to) {
    res.status(400).json({ success: false, error: 'No WhatsApp number set — save one in Settings → Notifications first' });
    return;
  }
  const text = [
    '⚙️ SmartBearing CRITICAL ALERT (test)',
    'Machine: Bearing #4 - Conveyor Line A (M004)',
    '',
    'OUTER RACE fault detected with 94.2% confidence (test alert).',
    '',
    '🧠 Assessment: Outer race spalling likely; plan bearing replacement within shift.',
    '',
    '⚠️ Fault predictions are probabilistic — an engineer must confirm before action.',
  ].join('\n');
  const ok = await sendWhatsAppMessage(to, text);
  if (!ok) {
    res.status(502).json({ success: false, error: 'Bird rejected the message — check the channel ID / number format (+E.164)' });
    return;
  }
  res.json({ success: true, data: { sentTo: to } });
});

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, machineId } = req.query;
    const query: any = {};
    if (status) query.status = status;
    if (machineId) query.machineId = machineId;
    
    const alerts = await Alert.find(query).sort({ detectedAt: -1 }).lean();
    
    const machines = await Machine.find().lean();
    const machineMap = machines.reduce((acc, m) => {
      acc[m.machineId] = m.name;
      return acc;
    }, {} as Record<string, string>);
    
    const formatted = alerts.map(a => ({
      id: a._id.toString(),
      nodeId: a.spindleId,
      machineId: a.machineId,
      machineName: machineMap[a.machineId] || a.machineId,
      type: a.severity.toUpperCase(),
      message: a.message,
      technicianSummary: a.technicianSummary,
      prevention: a.prevention ?? [],
      anomalyScore: a.anomalyScore ?? 0,
      evidence: a.evidence ?? null,
      timestamp: a.detectedAt.toISOString().replace('T', ' ').substring(0, 19),
      status: a.status,
      estimatedTimeToFailure: a.severity === 'critical' ? '6-18 hours' : (a.severity === 'warning' ? '3-7 days' : null)
    }));
    
    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export/csv', async (req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await Alert.find().sort({ detectedAt: -1 }).lean();
    
    const headers = ['machineId', 'spindleId', 'severity', 'type', 'message', 'status', 'detectedAt'].join(',');
    const rows = alerts.map(a => `${a.machineId},${a.spindleId},${a.severity},${a.type},"${a.message.replace(/"/g, '""')}",${a.status},${a.detectedAt.toISOString()}`).join('\n');
    const csvStr = headers + '\n' + rows;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=alerts.csv');
    res.send(csvStr);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const alert = await Alert.findById(req.params.id).lean();
    if (!alert) {
      res.status(404).json({ success: false, error: 'Alert not found' });
      return;
    }
    res.json({ success: true, data: alert });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/acknowledge', async (req: Request, res: Response): Promise<void> => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id, 
      { status: 'acknowledged', acknowledgedAt: new Date() },
      { new: true }
    );
    res.json({ success: true, data: alert });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id, 
      { status: 'resolved', resolvedAt: new Date() },
      { new: true }
    );
    res.json({ success: true, data: alert });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
