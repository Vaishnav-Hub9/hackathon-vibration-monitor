import { Router, Request, Response } from 'express';
import { FactoryProfile } from '../models/FactoryProfile.js';

const router = Router();

// GET /api/factory-profile — get the factory profile (singleton)
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    let profile = await FactoryProfile.findOne().lean();
    if (!profile) {
      // Create default profile
      profile = await FactoryProfile.create({
        unitName: 'Factory Unit A',
        location: 'Sircilla, Telangana',
        shiftTimings: '24x7 (3 Shifts)',
      });
    }
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/factory-profile — update the factory profile
router.put('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { unitName, location, shiftTimings, description } = req.body;
    let profile = await FactoryProfile.findOne();
    if (!profile) {
      profile = new FactoryProfile({});
    }
    if (unitName !== undefined) profile.unitName = unitName;
    if (location !== undefined) profile.location = location;
    if (shiftTimings !== undefined) profile.shiftTimings = shiftTimings;
    if (description !== undefined) profile.description = description;
    profile.updatedAt = new Date();
    await profile.save();
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
