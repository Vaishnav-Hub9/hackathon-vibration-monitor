import { Router, Response } from 'express';
import { MaintenanceLog } from '../models/MaintenanceLog.js';
import { Machine } from '../models/Machine.js';
import { authenticateJWT, factoryScope, hasGlobalFactoryAccess, requireRoles, type AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticateJWT);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query: Record<string, unknown> = {};
    if (!hasGlobalFactoryAccess(req.user)) {
      const scope = factoryScope(req.user);
      const machineIds = scope ? await Machine.find(scope).distinct('machineId') : [];
      query.machineId = { $in: machineIds };
    }
    const logs = await MaintenanceLog.find(query).sort({ performedAt: -1 }).lean();
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', requireRoles('maintenance_engineer', 'factory_manager', 'worker', 'operator'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const machineId = String(req.body?.machineId || '');
    const scope = factoryScope(req.user);
    const machine = scope === null ? null : await Machine.findOne({ ...(scope ?? {}), machineId }).lean();
    if (!machine) {
      res.status(403).json({ success: false, error: 'You cannot create maintenance work for this machine' });
      return;
    }
    const log = new MaintenanceLog(req.body);
    await log.save();
    res.status(201).json({ success: true, data: log });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
