import { Router, Request, Response } from 'express';
import { authenticateJWT, requireRoles } from '../middleware/auth.js';

/**
 * ML training-analysis proxy: forwards to the Python FastAPI server (/analysis),
 * which computes real model diagnostics (confusion matrix, per-class metrics,
 * loss curves, feature scatter, PCA) from the trained pickles.
 */
const router = Router();
router.use(authenticateJWT);

router.get('/analysis', requireRoles('maintenance_engineer', 'admin', 'factory_manager'), async (req: Request, res: Response): Promise<void> => {
  const mlServerUrl = process.env.ML_SERVER_URL || 'http://127.0.0.1:8000';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000); // first call computes eagerly
    const r = await fetch(`${mlServerUrl}/analysis`, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`ML server returned ${r.status}`);
    const data = await r.json();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(503).json({
      success: false,
      mlOnline: false,
      error: 'ML server offline — start the ML server (port 8000) to load live training metrics.',
    });
  }
});

export default router;
