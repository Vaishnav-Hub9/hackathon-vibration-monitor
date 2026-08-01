/**
 * Real (non-simulated) FFT helper.
 * Converts a raw time-domain vibration signal (e.g. 2048 samples pushed by an
 * edge node) into the 128-bin { freq, amplitude } spectrum the dashboard
 * renders on the Machine Detail FFT chart.
 */

/**
 * Iterative radix-2 FFT (Cooley–Tukey). Requires a power-of-two length.
 * Returns the single-sided magnitude spectrum, normalized so a pure sine of
 * amplitude A produces a peak of ~A.
 *
 * AC-couples the signal first (subtracts the mean). This removes the DC /
 * gravity offset a real MEMS accelerometer reports (e.g. +1 g on the Z axis
 * when mounted vertically), which would otherwise dominate bin 0 and inflate
 * every downstream RMS-based value.
 */
export function fftMagnitudeSpectrum(signal: number[]): number[] {
  const n = signal.length;
  if (n === 0) return [];

  // Remove DC offset (mean) before transforming — standard vibration practice.
  let mean = 0;
  for (const v of signal) mean += v;
  mean /= n;

  // Pad to the next power of two so any buffer length is accepted.
  let size = 1;
  while (size < n) size <<= 1;

  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let i = 0; i < n; i++) re[i] = signal[i] - mean;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  // Butterfly stages
  for (let len = 2; len <= size; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wlenR = Math.cos(angle);
    const wlenI = Math.sin(angle);
    for (let i = 0; i < size; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < len / 2; k++) {
        const uR = re[i + k];
        const uI = im[i + k];
        const vR = re[i + k + len / 2] * wR - im[i + k + len / 2] * wI;
        const vI = re[i + k + len / 2] * wI + im[i + k + len / 2] * wR;
        re[i + k] = uR + vR;
        im[i + k] = uI + vI;
        re[i + k + len / 2] = uR - vR;
        im[i + k + len / 2] = uI - vI;
        const nwR = wR * wlenR - wI * wlenI;
        wI = wR * wlenI + wI * wlenR;
        wR = nwR;
      }
    }
  }

  // Single-sided magnitudes, normalized by N (peak ≈ amplitude of a pure tone)
  const half = size / 2;
  const mags = new Array<number>(half);
  for (let i = 0; i < half; i++) {
    mags[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / size;
  }
  return mags;
}

/**
 * Collapse the full magnitude spectrum into `bins` dashboard bins, each with a
 * human-readable frequency label based on the sampling rate.
 */
export function computeFFTBins(
  signal: number[],
  sampleRateHz = 1000,
  bins = 128,
): { freq: number; amplitude: number }[] {
  if (signal.length === 0) return [];
  const mags = fftMagnitudeSpectrum(signal);
  const half = mags.length;
  const nyquist = sampleRateHz / 2;
  const out: { freq: number; amplitude: number }[] = [];

  for (let b = 0; b < bins; b++) {
    const start = Math.floor((b * half) / bins);
    const end = Math.floor(((b + 1) * half) / bins);
    let peak = 0;
    for (let i = start; i < end && i < half; i++) {
      if (mags[i] > peak) peak = mags[i];
    }
    const freq = (b * nyquist) / bins;
    out.push({ freq: +freq.toFixed(1), amplitude: +(peak * 2).toFixed(3) });
  }
  return out;
}
