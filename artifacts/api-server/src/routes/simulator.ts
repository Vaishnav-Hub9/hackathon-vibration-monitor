import { Router, Request, Response } from 'express';
import { authenticateJWT, requireRoles } from '../middleware/auth.js';
import { sensorSimulator } from '../simulator/SensorSimulator.js';

const router = Router();
router.use(authenticateJWT);

router.post('/start', requireRoles('maintenance_engineer', 'admin'), (req: Request, res: Response) => {
  try {
    sensorSimulator.start();
    res.json({ success: true, data: { status: 'Simulator started' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stop', requireRoles('maintenance_engineer', 'admin'), (req: Request, res: Response) => {
  try {
    sensorSimulator.stop();
    res.json({ success: true, data: { status: 'Simulator stopped' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/inject-fault', requireRoles('maintenance_engineer', 'admin'), (req: Request, res: Response) => {
  try {
    const { machineId, faultType } = req.body;
    if (!machineId) {
      res.status(400).json({ success: false, error: 'machineId is required' });
      return;
    }

    sensorSimulator.injectFault(machineId, faultType);
    res.json({ success: true, data: { status: `Fault injected on ${machineId}${faultType ? ` (${faultType})` : ''}` } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
