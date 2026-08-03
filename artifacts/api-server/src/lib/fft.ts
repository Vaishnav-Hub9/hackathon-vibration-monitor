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
// Precompute Sine/Cosine twiddle factors for FFT sizes up to 4096.
// This completely eliminates trigonometric calculations and floating-point 
// drift inside the high-frequency butterfly loops.
const MAX_FFT_SIZE = 4096;
const cosTable = new Float64Array(MAX_FFT_SIZE / 2);
const sinTable = new Float64Array(MAX_FFT_SIZE / 2);
for (let i = 0; i < MAX_FFT_SIZE / 2; i++) {
  cosTable[i] = Math.cos((-2 * Math.PI * i) / MAX_FFT_SIZE);
  sinTable[i] = Math.sin((-2 * Math.PI * i) / MAX_FFT_SIZE);
}

export function fftMagnitudeSpectrum(signal: number[]): number[] {
  const n = signal.length;
  if (n === 0) return [];

  // Remove DC offset (mean) before transforming
  let mean = 0;
  for (const v of signal) mean += v;
  mean /= n;

  // Pad to the next power of two
  let size = 1;
  while (size < n) size <<= 1;
  
  if (size > MAX_FFT_SIZE) {
    throw new Error(`FFT size ${size} exceeds maximum supported size of ${MAX_FFT_SIZE}`);
  }

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

  // Butterfly stages using precomputed twiddle factors
  for (let len = 2; len <= size; len <<= 1) {
    const halfLen = len / 2;
    const step = MAX_FFT_SIZE / len;
    
    for (let i = 0; i < size; i += len) {
      for (let k = 0; k < halfLen; k++) {
        const wR = cosTable[k * step];
        const wI = sinTable[k * step];
        
        const idx = i + k;
        const idxHalf = idx + halfLen;
        
        const uR = re[idx];
        const uI = im[idx];
        const vR = re[idxHalf] * wR - im[idxHalf] * wI;
        const vI = re[idxHalf] * wI + im[idxHalf] * wR;
        
        re[idx] = uR + vR;
        im[idx] = uI + vI;
        re[idxHalf] = uR - vR;
        im[idxHalf] = uI - vI;
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
