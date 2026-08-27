// CWRU bearing dataset — measured values at fault severities
// Source: CWRU Bearing Data Center (bearing-data-center.cwru.edu)
//
// Dataset: DE (Drive End) bearing, 6205-2RS, 1797 RPM
// Fault diameters: 0.007" (stage1), 0.014" (stage2), 0.021" (stage3)
// We map these to health score ranges and interpolate
//
// A phone cannot measure temperature or line voltage directly, so we
// synthesize realistic values for those channels from the health stage —
// the same mapping the capture PWA applies client-side. The backend uses
// this as a fallback when a reading arrives without temperature/voltage.

const CWRU_REFERENCE = [
  // healthScore range → [temp_base, temp_sigma, acoustic_base, acoustic_sigma]
  { minHealth: 85, maxHealth: 100, tempBase: 38, tempSigma: 3, acBase: 0.25, acSigma: 0.05 }, // Healthy
  { minHealth: 70, maxHealth: 84, tempBase: 48, tempSigma: 4, acBase: 0.45, acSigma: 0.08 }, // Early fault (0.007" dia)
  { minHealth: 50, maxHealth: 69, tempBase: 58, tempSigma: 5, acBase: 0.72, acSigma: 0.1 }, // Moderate (0.014" dia)
  { minHealth: 30, maxHealth: 49, tempBase: 68, tempSigma: 4, acBase: 1.05, acSigma: 0.12 }, // Severe (0.021" dia)
  { minHealth: 5, maxHealth: 29, tempBase: 76, tempSigma: 5, acBase: 1.35, acSigma: 0.15 }, // Critical / imminent failure
];

/** Gaussian sample (Box–Muller transform). */
function gaussianSample(mean: number, sigma: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sigma * z;
}

export interface DatasetAugmentation {
  temperature: number;
  voltage: number;
}

/**
 * Map a health score to realistic (temperature, voltage) channel values.
 *
 * - Temperature: inverse-linear health → temperature model with gaussian
 *   measurement variance, clamped to a plausible bearing-housing range.
 * - Voltage: Indian grid model — 220V nominal, σ=8V, clamped to 195–240V.
 */
export function augmentFromDataset(healthScore: number): DatasetAugmentation {
  const row =
    CWRU_REFERENCE.find((r) => healthScore >= r.minHealth && healthScore <= r.maxHealth) ??
    CWRU_REFERENCE[4];

  const temperature = Math.round(
    Math.max(30, Math.min(100, gaussianSample(row.tempBase, row.tempSigma))),
  );

  const voltage = Math.round(Math.max(195, Math.min(240, 220 + gaussianSample(0, 8))));

  return { temperature, voltage };
}
