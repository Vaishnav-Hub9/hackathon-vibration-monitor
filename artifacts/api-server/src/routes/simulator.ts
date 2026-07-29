import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { sensorSimulator } from '../simulator/SensorSimulator.js';

const router = Router();
router.use(authenticateJWT);

router.post('/start', (req: Request, res: Response) => {
  try {
    sensorSimulator.start();
    res.json({ success: true, data: { status: 'Simulator started' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stop', (req: Request, res: Response) => {
  try {
    sensorSimulator.stop();
    res.json({ success: true, data: { status: 'Simulator stopped' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/inject-fault', (req: Request, res: Response) => {
  try {
    const { machineId } = req.body;
    if (!machineId) {
      res.status(400).json({ success: false, error: 'machineId is required' });
      return;
    }
    
    sensorSimulator.injectFault(machineId);
    res.json({ success: true, data: { status: `Fault injected on ${machineId}` } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
