import { Router, Request, Response, NextFunction } from 'express';
import { processEdgeReading } from '../simulator/ingest.js';

const router = Router();

// Optional shared secret for edge devices. When EDGE_DEVICE_KEY is set, nodes
// must send it in the `x-device-key` header. When unset (dev/demo mode), the
// endpoint is open — matching how the ML server is accessed locally.
const EDGE_DEVICE_KEY = process.env.EDGE_DEVICE_KEY;

function deviceAuth(req: Request, res: Response, next: NextFunction): void {
  if (!EDGE_DEVICE_KEY) {
    next();
    return;
  }
  const key =
    (req.headers['x-device-key'] as string | undefined) ||
    (req.headers['x-api-key'] as string | undefined);
  if (key !== EDGE_DEVICE_KEY) {
    res.status(401).json({ success: false, error: 'Invalid device key' });
    return;
  }
  next();
}

router.use(deviceAuth);

/**
 * POST /api/sensors/reading
 * Body: {
 *   machineId: string,            // required, must exist (M001..M006 seeded)
 *   spindleId?: string,           // defaults to 'SN001'
 *   signal: number[2048],         // required raw vibration samples (g)
 *   temperature?: number,         // °C (optional)
 *   rpm?: number,                 // optional
 *   voltageNormalized?: number,   // optional
 *   sampleRateHz?: number,        // optional, default 1000 — drives FFT axis
 *   accel_x?, accel_y?, accel_z?  // optional — derived from signal if omitted
 * }
 * Response: { success, data: { readingId, machineId, spindleId, timestamp,
 *   healthScore, label, confidence, anomalyFlag, bpfoScore, temperature, rpm } }
 */
router.post('/reading', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body ?? {};
    const {
      machineId,
      spindleId,
      signal,
      temperature,
      rpm,
      voltageNormalized,
      sampleRateHz,
      accel_x,
      accel_y,
      accel_z,
    } = body;

    if (!machineId || typeof machineId !== 'string') {
      res.status(400).json({ success: false, error: 'machineId is required' });
      return;
    }
    if (spindleId !== undefined && typeof spindleId !== 'string') {
      res.status(400).json({ success: false, error: 'spindleId must be a string' });
      return;
    }
    const numeric = [
      ['temperature', temperature],
      ['rpm', rpm],
      ['voltageNormalized', voltageNormalized],
      ['sampleRateHz', sampleRateHz],
      ['accel_x', accel_x],
      ['accel_y', accel_y],
      ['accel_z', accel_z],
    ] as const;
    for (const [name, value] of numeric) {
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
        res.status(400).json({ success: false, error: `${name} must be a finite number` });
        return;
      }
    }
    if (
      !Array.isArray(signal) ||
      signal.length !== 2048 ||
      signal.some((v: any) => typeof v !== 'number' || !Number.isFinite(v))
    ) {
      res.status(400).json({
        success: false,
        error: 'signal must be an array of exactly 2048 finite numbers',
      });
      return;
    }

    const result = await processEdgeReading({
      machineId,
      spindleId,
      signal,
      temperature,
      rpm,
      voltageNormalized,
      sampleRateHz,
      accel_x,
      accel_y,
      accel_z,
    });

    const reading = result.reading;
    res.json({
      success: true,
      data: {
        readingId: reading._id.toString(),
        machineId,
        spindleId: reading.spindleId,
        timestamp: reading.timestamp.toISOString(),
        healthScore: reading.healthScore,
        label: result.label,
        confidence: result.confidence,
        anomalyFlag: reading.anomalyFlag,
        bpfoScore: reading.bpfoScore,
        temperature: reading.temperature,
        rpm: reading.rpm,
      },
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

export default router;
