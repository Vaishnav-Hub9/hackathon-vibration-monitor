import { Router, Request, Response } from 'express';
import { Alert } from '../models/Alert.js';
import { authenticateJWT } from '../middleware/auth.js';
import { Machine } from '../models/Machine.js';
import { notifyMailAlert, isMailConfigured, type MailAlertPayload } from '../lib/mail.js';

const router = Router();
router.use(authenticateJWT);

// Fire a sample warning email immediately to every configured recipient —
// used by Settings -> Notifications -> "Send Test Alert Email" for demos.
router.post('/test-email', async (_req: Request, res: Response): Promise<void> => {
  if (!isMailConfigured()) {
    res.status(503).json({
      success: false,
      error: 'Email delivery not configured — set SMTP_USER / SMTP_PASS in the api-server .env',
    });
    return;
  }
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
  res.json({ success: true });
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
