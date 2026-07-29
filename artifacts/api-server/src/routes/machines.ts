import { Router, Request, Response } from 'express';
import { Machine } from '../models/Machine.js';
import { SpindleReading } from '../models/SpindleReading.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();
router.use(authenticateJWT);

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const machines = await Machine.find().lean();
    
    const machinesWithHealth = await Promise.all(machines.map(async (m) => {
      const latestReading = await SpindleReading.findOne({ machineId: m.machineId })
        .sort({ timestamp: -1 })
        .lean();
      
      return {
        ...m,
        id: m.machineId,
        healthScore: latestReading ? latestReading.healthScore : 100,
        activeSensors: 5
      };
    }));
    
    res.json({ success: true, data: machinesWithHealth });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const machine = await Machine.findOne({ machineId: req.params.id }).lean();
    if (!machine) {
      res.status(404).json({ success: false, error: 'Machine not found' });
      return;
    }
    
    const latestReading = await SpindleReading.findOne({ machineId: machine.machineId })
      .sort({ timestamp: -1 }).lean();
      
    const data = {
      ...machine,
      id: machine.machineId,
      healthScore: latestReading ? latestReading.healthScore : 100,
      activeSensors: 5
    };
    
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const machine = await Machine.findOneAndUpdate(
      { machineId: req.params.id }, 
      req.body, 
      { new: true }
    );
    if (!machine) {
      res.status(404).json({ success: false, error: 'Machine not found' });
      return;
    }
    res.json({ success: true, data: machine });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/spindles', async (req: Request, res: Response): Promise<void> => {
  try {
    const spindles = await SpindleReading.aggregate([
      { $match: { machineId: req.params.id } },
      { $sort: { timestamp: -1 } },
      { $group: {
          _id: "$spindleId",
          latestReading: { $first: "$$ROOT" }
      }}
    ]);
    
    const formatted = spindles.map(s => ({
      id: s._id,
      machineId: req.params.id,
      location: s.latestReading.spindleId,
      healthScore: s.latestReading.healthScore,
      anomalyScore: s.latestReading.bpfoScore,
      vibrationRMS: s.latestReading.vibrationRMS,
      temperature: s.latestReading.temperature,
      voltage: s.latestReading.voltageNormalized,
      acousticLevel: s.latestReading.acousticRMS,
      status: s.latestReading.anomalyFlag ? 'critical' : (s.latestReading.vibrationRMS > 1.5 ? 'warning' : 'healthy'),
      vibDelta: 0,
      tempDelta: 0
    }));
    
    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const readings = await SpindleReading.find({
      machineId: req.params.id,
      timestamp: { $gte: since }
    }).sort({ timestamp: 1 }).select('timestamp vibrationRMS temperature').lean();
    
    const historyData = readings.map(r => {
      const d = new Date(r.timestamp);
      return {
        time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
        value: r.vibrationRMS,
        temperature: r.temperature
      };
    });
    
    res.json({ success: true, data: { vibration: historyData, temperature: historyData } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/fft', async (req: Request, res: Response): Promise<void> => {
  try {
    const latest = await SpindleReading.findOne({ machineId: req.params.id }).sort({ timestamp: -1 }).lean();
    if (!latest || !latest.vibrationFFT) {
      res.json({ success: true, data: [] });
      return;
    }
    res.json({ success: true, data: latest.vibrationFFT });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id/rul', async (req: Request, res: Response): Promise<void> => {
  try {
    const latest = await SpindleReading.findOne({ machineId: req.params.id }).sort({ timestamp: -1 }).lean();
    const currentHealth = latest ? latest.healthScore : 100;
    
    const rulData = Array.from({ length: 30 }, (_, i) => {
      const degradeRate = req.params.id === 'M003' ? 1.5 : (req.params.id === 'M002' ? 0.5 : 0.1);
      return {
        day: i,
        healthScore: Math.max(20, currentHealth - (i * degradeRate)),
        projected: true
      };
    });
    
    res.json({ success: true, data: rulData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
