import { Router, Request, Response } from 'express';
import { FactoryUnit } from '../models/FactoryUnit.js';
import { Machine } from '../models/Machine.js';

const router = Router();

// GET /api/factory-units — list all factory units with machine counts
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const units = await FactoryUnit.find().sort({ createdAt: 1 }).lean();
    const unitsWithCounts = await Promise.all(units.map(async (u) => {
      const machineCount = await Machine.countDocuments({ factoryUnit: u.unitId });
      return { ...u, machineCount };
    }));
    res.json({ success: true, data: unitsWithCounts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/factory-units/:unitId — get single unit
router.get('/:unitId', async (req: Request, res: Response): Promise<void> => {
  try {
    const unit = await FactoryUnit.findOne({ unitId: req.params.unitId }).lean();
    if (!unit) {
      res.status(404).json({ success: false, error: 'Factory unit not found' });
      return;
    }
    const machines = await Machine.find({ factoryUnit: unit.unitId }).lean();
    res.json({ success: true, data: { ...unit, machines } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/factory-units — create new factory unit
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { unitId, name, location, description } = req.body;
    if (!unitId || !name || !location) {
      res.status(400).json({ success: false, error: 'unitId, name, and location are required' });
      return;
    }
    const existing = await FactoryUnit.findOne({ unitId });
    if (existing) {
      res.status(409).json({ success: false, error: 'Factory unit ID already exists' });
      return;
    }
    const unit = await FactoryUnit.create({ unitId, name, location, description });
    res.status(201).json({ success: true, data: unit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/factory-units/:unitId — update factory unit
router.put('/:unitId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, location, description, isActive } = req.body;
    const unit = await FactoryUnit.findOneAndUpdate(
      { unitId: req.params.unitId },
      { ...(name && { name }), ...(location && { location }), ...(description !== undefined && { description }), ...(isActive !== undefined && { isActive }) },
      { new: true }
    ).lean();
    if (!unit) {
      res.status(404).json({ success: false, error: 'Factory unit not found' });
      return;
    }
    res.json({ success: true, data: unit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/factory-units/:unitId — delete factory unit (unlinks machines, doesn't delete them)
router.delete('/:unitId', async (req: Request, res: Response): Promise<void> => {
  try {
    const unit = await FactoryUnit.findOneAndDelete({ unitId: req.params.unitId });
    if (!unit) {
      res.status(404).json({ success: false, error: 'Factory unit not found' });
      return;
    }
    // Unlink machines from this unit
    await Machine.updateMany({ factoryUnit: req.params.unitId }, { $unset: { factoryUnit: '' } });
    res.json({ success: true, message: 'Factory unit deleted' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/factory-units/:unitId/machines — assign machines to a factory unit
router.post('/:unitId/machines', async (req: Request, res: Response): Promise<void> => {
  try {
    const { machineIds } = req.body;
    if (!Array.isArray(machineIds)) {
      res.status(400).json({ success: false, error: 'machineIds must be an array' });
      return;
    }
    const unit = await FactoryUnit.findOne({ unitId: req.params.unitId });
    if (!unit) {
      res.status(404).json({ success: false, error: 'Factory unit not found' });
      return;
    }
    // Remove machines from other units first
    await Machine.updateMany({ machineId: { $in: machineIds } }, { factoryUnit: req.params.unitId });
    // Update the unit's machine list
    unit.machineIds = [...new Set([...unit.machineIds, ...machineIds])];
    await unit.save();
    res.json({ success: true, data: unit });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
