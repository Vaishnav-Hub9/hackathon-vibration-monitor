/**
 * Bearing defect frequency calculator (frontend twin of the ML pipeline).
 *
 * Computes the theoretical fault frequencies a rotating-machine expert uses to
 * read a vibration spectrum — BPFO, BPFI, BSF, FTF — from bearing geometry and
 * live RPM. These are overlaid on the FFT spectrum as ReferenceLines with
 * harmonics so the "abnormal frequency peaks" in the PS are backed by the
 * engineering math, not magic numbers.
 *
 *   BPFO = (N/2) · f_r · (1 − d/D · cos α)      ball pass frequency, outer race
 *   BPFI = (N/2) · f_r · (1 + d/D · cos α)      ball pass frequency, inner race
 *   BSF  = (D/2d) · f_r · (1 − (d/D · cos α)²)  ball spin frequency
 *   FTF  = (f_r/2) · (1 − d/D · cos α)          fundamental train frequency
 *
 *   f_r = RPM / 60 (rotating frequency)
 *   N   = number of rolling elements
 *   D   = pitch diameter, d = ball diameter, α = contact angle
 */

export interface BearingGeometry {
  balls: number;
  pitchDiameter: number; // mm
  ballDiameter: number;  // mm
  contactAngle: number;  // degrees
}

// 6205-class deep-groove ball bearing — matches the ML model's training geometry
export const DEFAULT_BEARING: BearingGeometry = {
  balls: 9,
  pitchDiameter: 39.04,
  ballDiameter: 7.94,
  contactAngle: 0,
};

export interface DefectFrequencies {
  fr: number;   // 1x rotating frequency (Hz)
  bpfo: number;
  bpfi: number;
  bsf: number;
  ftf: number;
}

export function computeDefectFrequencies(
  rpm: number,
  geometry: BearingGeometry = DEFAULT_BEARING,
): DefectFrequencies {
  const fr = rpm / 60;
  const c = Math.cos((geometry.contactAngle * Math.PI) / 180);
  const ratio = geometry.ballDiameter / geometry.pitchDiameter;
  return {
    fr,
    bpfo: (geometry.balls / 2) * fr * (1 - ratio * c),
    bpfi: (geometry.balls / 2) * fr * (1 + ratio * c),
    bsf: (geometry.pitchDiameter / (2 * geometry.ballDiameter)) * fr * (1 - (ratio * c) ** 2),
    ftf: (fr / 2) * (1 - ratio * c),
  };
}

export interface FrequencyLine {
  freq: number;
  label: string;
  color: string;
}

const COLORS = {
  bpfo: '#EA580C',
  bpfi: '#F59E0B',
  bsf: '#A855F7',
  ftf: '#3B82F6',
  rpm: '#10B981',
};

/**
 * Build ReferenceLine data for a spectrum: 1x/2x/3x RPM plus each defect
 * frequency and its harmonics (up to 3rd), so harmonic progression is visible.
 */
export function buildFrequencyOverlays(
  rpm: number,
  geometry: BearingGeometry = DEFAULT_BEARING,
  maxFreq = 2000,
): FrequencyLine[] {
  const df = computeDefectFrequencies(rpm, geometry);
  const lines: FrequencyLine[] = [];

  // Rotating speed harmonics
  for (const h of [1, 2, 3]) {
    const f = df.fr * h;
    if (f <= maxFreq) lines.push({ freq: +f.toFixed(1), label: h === 1 ? '1×RPM' : `${h}×RPM`, color: COLORS.rpm });
  }

  const add = (base: number, baseLabel: string, color: string) => {
    for (const h of [1, 2, 3]) {
      const f = base * h;
      if (f <= maxFreq) {
        lines.push({ freq: +f.toFixed(1), label: h === 1 ? baseLabel : `${baseLabel}×${h}`, color });
      }
    }
  };

  add(df.bpfo, 'BPFO', COLORS.bpfo);
  add(df.bpfi, 'BPFI', COLORS.bpfi);
  add(df.bsf, 'BSF', COLORS.bsf);
  add(df.ftf, 'FTF', COLORS.ftf);

  return lines;
}

/** Human-readable formula panel entries, e.g. "BPFO = 4.5·fr·(1−0.203) = 860.4 Hz @ 14,400 RPM". */
export function defectFormulaStrings(
  rpm: number,
  geometry: BearingGeometry = DEFAULT_BEARING,
): { key: string; name: string; formula: string; valueHz: number }[] {
  const df = computeDefectFrequencies(rpm, geometry);
  const ratio = (geometry.ballDiameter / geometry.pitchDiameter).toFixed(3);
  const fr = df.fr;
  return [
    { key: 'fr', name: 'Rotating freq (fᵣ)', formula: `RPM / 60 = ${rpm} / 60`, valueHz: +fr.toFixed(1) },
    { key: 'bpfo', name: 'BPFO', formula: `(N/2)·fᵣ·(1−d/D) = ${(geometry.balls / 2).toFixed(1)}·${fr.toFixed(1)}·(1−${ratio})`, valueHz: +df.bpfo.toFixed(1) },
    { key: 'bpfi', name: 'BPFI', formula: `(N/2)·fᵣ·(1+d/D) = ${(geometry.balls / 2).toFixed(1)}·${fr.toFixed(1)}·(1+${ratio})`, valueHz: +df.bpfi.toFixed(1) },
    { key: 'bsf', name: 'BSF', formula: `(D/2d)·fᵣ·(1−(d/D)²)`, valueHz: +df.bsf.toFixed(1) },
    { key: 'ftf', name: 'FTF', formula: `(fᵣ/2)·(1−d/D)`, valueHz: +df.ftf.toFixed(1) },
  ];
}
