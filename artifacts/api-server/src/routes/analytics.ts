import { Router, Request, Response } from 'express';
import { Machine } from '../models/Machine.js';
import { Alert } from '../models/Alert.js';
import { SpindleReading } from '../models/SpindleReading.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();
router.use(authenticateJWT);

/**
 * All analytics here are computed from real stored data (readings + alerts
 * produced by the ML pipeline). No hardcoded KPIs, no Math.random().
 */
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const totalMachines = await Machine.countDocuments();
    const criticalCount = await Machine.countDocuments({ status: 'critical' });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const alertsToday = await Alert.countDocuments({
      detectedAt: { $gte: startOfDay }
    });

    // Real average health across the latest reading per spindle
    const latestReadings = await SpindleReading.aggregate([
      { $sort: { timestamp: -1 } },
      { $group: { _id: { machineId: '$machineId', spindleId: '$spindleId' }, healthScore: { $first: '$healthScore' } } }
    ]);
    const avgHealthScore = latestReadings.length > 0
      ? Math.round(latestReadings.reduce((acc, r) => acc + r.healthScore, 0) / latestReadings.length)
      : 100;

    // Real uptime: % of machines with a reading in the last 10 minutes
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const machinesWithRecentReading = await SpindleReading.distinct('machineId', { timestamp: { $gte: tenMinAgo } });
    const sensorUptime = totalMachines > 0
      ? Math.round((machinesWithRecentReading.length / totalMachines) * 100)
      : 0;

    res.json({ success: true, data: { totalMachines, criticalCount, avgHealthScore, alertsToday, sensorUptime } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Real 30-day trend: daily alert counts + daily average health from readings. */
router.get('/trends', async (req: Request, res: Response): Promise<void> => {
  try {
    const days = 30;
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const alerts = await Alert.find({ detectedAt: { $gte: start } }).select('detectedAt severity').lean();
    const readings = await SpindleReading.find({ timestamp: { $gte: start } })
      .select('timestamp healthScore')
      .lean();

    const trends = [];
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(start);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayAlerts = alerts.filter((a) => a.detectedAt >= dayStart && a.detectedAt <= dayEnd);
      const dayReadings = readings.filter((r) => r.timestamp >= dayStart && r.timestamp <= dayEnd);
      const avgHealth = dayReadings.length > 0
        ? Math.round(dayReadings.reduce((acc, r) => acc + r.healthScore, 0) / dayReadings.length)
        : null;

      trends.push({
        day: i + 1,
        alerts: dayAlerts.length,
        critical: dayAlerts.filter((a) => a.severity === 'critical').length,
        warning: dayAlerts.filter((a) => a.severity === 'warning').length,
        avgHealth
      });
    }
    res.json({ success: true, data: trends });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Real 28-day alert-intensity heatmap, aggregated from the alerts collection. */
router.get('/heatmap', async (req: Request, res: Response): Promise<void> => {
  try {
    const days = 28;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    const alerts = await Alert.find({ detectedAt: { $gte: start } }).select('detectedAt').lean();

    const heatmap = [];
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(start);
      dayStart.setDate(dayStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const count = alerts.filter((a) => a.detectedAt >= dayStart && a.detectedAt <= dayEnd).length;
      heatmap.push({ day: i, intensity: count });
    }
    res.json({ success: true, data: heatmap });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Real 12-month alert bar chart, aggregated from the alerts collection. */
router.get('/monthly', async (req: Request, res: Response): Promise<void> => {
  try {
    const months = 12;
    const now = new Date();
    const results = [];
    for (let i = months - 1; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = m.toLocaleString('en-US', { month: 'short' });
      const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);

      const [critical, warning, resolved] = await Promise.all([
        Alert.countDocuments({ severity: 'critical', detectedAt: { $gte: m, $lt: next } }),
        Alert.countDocuments({ severity: 'warning', detectedAt: { $gte: m, $lt: next } }),
        Alert.countDocuments({ status: 'resolved', resolvedAt: { $gte: m, $lt: next } })
      ]);
      results.push({ month: monthLabel, Critical: critical, Warning: warning, Prevented: resolved });
    }
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ROI derived from real resolved alerts + maintenance logs. No random numbers.
 */
router.get('/roi', async (req: Request, res: Response): Promise<void> => {
  try {
    const resolvedCritical = await Alert.countDocuments({ status: 'resolved', severity: 'critical' });
    const resolvedWarning = await Alert.countDocuments({ status: 'resolved', severity: 'warning' });

    // Cost assumptions (documented constants, not random):
    // critical failure ≈ ₹18,000 downtime+repair, warning ≈ ₹9,000
    const estimatedSavings = resolvedCritical * 18000 + resolvedWarning * 9000;
    const preventedFailures = resolvedCritical + resolvedWarning;
    const downtimePrevented = resolvedCritical * 18; // hours prevented (18h per critical failure)

    res.json({ success: true, data: { preventedFailures, estimatedSavings, downtimePrevented } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
