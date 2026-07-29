import { Router, Request, Response } from 'express';
import { MaintenanceLog } from '../models/MaintenanceLog.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();
router.use(authenticateJWT);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const logs = await MaintenanceLog.find().sort({ performedAt: -1 }).lean();
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const log = new MaintenanceLog(req.body);
    await log.save();
    res.status(201).json({ success: true, data: log });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
