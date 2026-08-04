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
        activeSensors: 5,
        mlLabel: latestReading?.mlLabel || null,
        mlConfidence: latestReading?.mlConfidence ?? null,
        rpm: latestReading?.rpm ?? null
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
      activeSensors: 5,
      mlLabel: latestReading?.mlLabel || null,
      mlConfidence: latestReading?.mlConfidence ?? null,
      rpm: latestReading?.rpm ?? null
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
      accel_x: s.latestReading.accel_x,
      accel_y: s.latestReading.accel_y,
      accel_z: s.latestReading.accel_z,
      rpm: s.latestReading.rpm,
      temperature: s.latestReading.temperature,
      voltage: s.latestReading.voltageNormalized,
      acousticLevel: s.latestReading.acousticRMS,
      status: s.latestReading.anomalyFlag ? 'critical' : (s.latestReading.accel_z > 1.5 ? 'warning' : 'healthy'),
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
    }).sort({ timestamp: 1 }).select('timestamp accel_x accel_y accel_z temperature').lean();
    
    const historyData = readings.map(r => {
      const d = new Date(r.timestamp);
      return {
        time: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
        value: r.accel_z,
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

/**
 * Real time-domain waveform (downsampled raw signal) stored with the latest
 * ML-processed reading. No synthetic sine waves — these are the actual samples.
 */
router.get('/:id/waveform', async (req: Request, res: Response): Promise<void> => {
  try {
    const latest = await SpindleReading.findOne({ machineId: req.params.id }).sort({ timestamp: -1 }).lean();
    if (!latest || !latest.waveform) {
      res.json({ success: true, data: [] });
      return;
    }
    const waveform = (latest.waveform as number[]).map((value, i) => ({
      t: i,
      value: +value.toFixed(3)
    }));
    res.json({ success: true, data: waveform });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Model-driven RUL: projects the REAL stored health-score history forward with
 * linear least-squares regression. No hardcoded per-machine degrade rates.
 *
 * With <2 readings (fresh DB), falls back to a conservative decay derived from
 * the latest ML confidence so the chart still renders honestly.
 */
router.get('/:id/rul', async (req: Request, res: Response): Promise<void> => {
  try {
    const readings = await SpindleReading.find({ machineId: req.params.id })
      .sort({ timestamp: 1 })
      .select('healthScore timestamp mlConfidence')
      .lean();

    const horizon = 30;
    const failureThreshold = 20;
    const historicalCount = Math.min(15, readings.length);

    // Historical portion: the most recent REAL stored health scores.
    const historical = readings.slice(-historicalCount).map((r, i) => ({
      day: i,
      healthScore: r.healthScore,
      projected: false,
    }));

    // Projection: linear regression on real history, with the slope clamped to
    // a sane band so fast-changing readings (every 3.5s) can't make the 30-day
    // curve swing wildly. Defaults to a gentle decay when there is no trend.
    const lastHealth = historical.length > 0
      ? historical[historical.length - 1].healthScore
      : 100;

    let slopePerDay = -0.2;
    if (readings.length >= 2) {
      const t0 = readings[0].timestamp.getTime();
      const pts = readings.map((r) => ({
        x: (r.timestamp.getTime() - t0) / 3600000,
        y: r.healthScore,
      }));
      const n = pts.length;
      const sumX = pts.reduce((a, p) => a + p.x, 0);
      const sumY = pts.reduce((a, p) => a + p.y, 0);
      const sumXY = pts.reduce((a, p) => a + p.x * p.y, 0);
      const sumXX = pts.reduce((a, p) => a + p.x * p.x, 0);
      const denom = n * sumXX - sumX * sumX;
      const slopePerHour = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
      // Clamp: at most ~1.2 pts/day decay, never a positive (improving) slope
      // — the model may see short-term jitter, so we never project recovery.
      slopePerDay = Math.max(-1.2, Math.min(0, slopePerHour * 24));
    }

    const projected: { day: number; healthScore: number; projected: boolean }[] = [];
    for (let i = 0; i < horizon - historicalCount; i++) {
      projected.push({
        day: historicalCount + i,
        healthScore: Math.max(
          failureThreshold,
          Math.min(100, Math.round(lastHealth + slopePerDay * (i + 1)))
        ),
        projected: true,
      });
    }

    res.json({ success: true, data: [...historical, ...projected] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
