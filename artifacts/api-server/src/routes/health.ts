import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Real ML-server liveness probe: tries to reach the FastAPI /predict service
 * (any HTTP response = online). Drives the "ML model offline" banner.
 */
router.get("/health/ml", async (_req, res) => {
  const mlServerUrl = process.env.ML_SERVER_URL || 'http://127.0.0.1:8000';
  let online = false;
  try {
    const r = await fetch(`${mlServerUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: new Array(2048).fill(0) }),
      signal: AbortSignal.timeout(4000),
    });
    // Any HTTP response (even 4xx/5xx for a zero signal) means the ML server is up
    online = r.status !== 0;
  } catch (e) {
    online = false;
  }
  res.json({ success: true, data: { online, timestamp: new Date().toISOString() } });
});

export default router;
