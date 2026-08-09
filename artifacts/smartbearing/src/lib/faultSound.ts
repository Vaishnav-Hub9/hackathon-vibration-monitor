import { useCallback, useEffect, useRef, useState } from 'react';
import { computeDefectFrequencies } from './defectFrequencies';

/**
 * "Hear the fault" — shared Web Audio synthesis of bearing fault signatures.
 *
 * Every fault class is synthesized live from the bearing-geometry physics
 * (BPFO / BPFI / BSF / 1× / 2× RPM via computeDefectFrequencies), NOT from
 * canned audio files. Harmonics + load-zone amplitude modulation (AM at 1×
 * rotor rate) give the classic bearing-fault texture, so evaluators can
 * listen to exactly what the ML model detects.
 */

/** Representative spindle speed used for auditioning fault sounds. */
export const AUDITION_RPM = 14400;

export type FaultKey =
  | 'Healthy'
  | 'Imbalance'
  | 'Misalignment'
  | 'Ball'
  | 'Inner Race'
  | 'Outer Race';

/** Map a machine status to the fault class a user should hear for it. */
export function toneForStatus(status?: string): FaultKey {
  switch (status) {
    case 'critical':
      return 'Outer Race';
    case 'warning':
      return 'Inner Race';
    default:
      return 'Healthy';
  }
}

/** Characteristic base frequency (Hz) for a fault class at a given RPM. */
export function faultBaseFrequency(key: string, rpm: number): number {
  const df = computeDefectFrequencies(rpm);
  switch (key) {
    case 'Healthy':
      return 0;
    case 'Imbalance':
      return df.fr;
    case 'Misalignment':
      return df.fr * 2;
    case 'Ball':
      return df.bsf;
    case 'Inner Race':
      return df.bpfi;
    case 'Outer Race':
      return df.bpfo;
    default:
      return 0;
  }
}

export interface FaultAudioControls {
  /** Key of the fault clip currently playing, or null. */
  playingKey: string | null;
  play: (key: string, rpm: number) => void;
  stop: () => void;
}

/**
 * Synthesize + play a fault signature on demand. One AudioContext at a time;
 * calling play() again replaces the current clip.
 */
export function useFaultAudio(): FaultAudioControls {
  const ctxRef = useRef<AudioContext | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    setPlayingKey(null);
  }, []);

  const play = useCallback(
    (key: string, rpm: number) => {
      stop();
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      ctxRef.current = ctx;
      setPlayingKey(key);

      const base = faultBaseFrequency(key, rpm);
      const df = computeDefectFrequencies(rpm);

      const dur = 1.8;
      const master = ctx.createGain();
      master.connect(ctx.destination);

      const t0 = ctx.currentTime;
      // Envelope: quick attack, sustain, release.
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.3, t0 + 0.08);
      master.gain.setValueAtTime(0.3, t0 + dur - 0.15);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      if (base > 0) {
        // Fundamental + harmonics; AM at 1× rotor rate = load-zone pulsing.
        [1, 2, 3, 4].forEach((h, i) => {
          const osc = ctx.createOscillator();
          osc.type = i === 0 ? 'sawtooth' : 'triangle';
          osc.frequency.value = base * h;

          const g = ctx.createGain();
          g.gain.value = 1 / (i + 1);

          const lfo = ctx.createOscillator();
          lfo.frequency.value = df.fr;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = g.gain.value * 0.7;
          lfo.connect(lfoGain);
          lfoGain.connect(g.gain);

          osc.connect(g);
          g.connect(master);
          osc.start(t0);
          osc.stop(t0 + dur);
          lfo.start(t0);
          lfo.stop(t0 + dur);
        });
      }

      // Broadband noise floor — faint for healthy, rougher for faults.
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      const noiseAmp = key === 'Healthy' ? 0.02 : 0.08;
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * noiseAmp;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.4;
      noise.connect(noiseGain);
      noiseGain.connect(master);
      noise.start(t0);

      // Auto-stop after the clip; only if this context is still current.
      setTimeout(() => {
        if (ctxRef.current === ctx) stop();
      }, (dur + 0.3) * 1000);
    },
    [stop],
  );

  // Cleanup on unmount — never leave an open AudioContext behind.
  useEffect(() => {
    return () => {
      if (ctxRef.current) ctxRef.current.close().catch(() => {});
    };
  }, []);

  return { playingKey, play, stop };
}
