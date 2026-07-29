import { Router, Request, Response } from 'express';
import { Machine } from '../models/Machine.js';
import { Alert } from '../models/Alert.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();
router.use(authenticateJWT);

router.get('/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const totalMachines = await Machine.countDocuments();
    const criticalCount = await Machine.countDocuments({ status: 'critical' });
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const alertsToday = await Alert.countDocuments({
      detectedAt: { $gte: startOfDay }
    });
    
    const avgHealthScore = 77; // Simple static KPI for now
    
    res.json({ success: true, data: { totalMachines, criticalCount, avgHealthScore, alertsToday } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/trends', async (req: Request, res: Response): Promise<void> => {
  try {
    const trends = Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      alerts: Math.floor(Math.random() * 5),
      avgHealth: 80 - Math.floor(Math.random() * 10)
    }));
    res.json({ success: true, data: trends });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/roi', async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: {
      preventedFailures: 3,
      estimatedSavings: 54000,
      avgDowntimePrevented: 18
    } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/heatmap', async (req: Request, res: Response): Promise<void> => {
  try {
    const heatmap = Array.from({length: 28}, (_, i) => ({
      day: i,
      intensity: Math.random() > 0.8 ? Math.floor(Math.random() * 4) + 1 : 0
    }));
    res.json({ success: true, data: heatmap });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
