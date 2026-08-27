import { useEffect, useRef } from 'react';

interface WaveFieldProps {
  /** Number of layered waves (default 3) */
  layers?: number;
  /** Stroke opacity multiplier (default 1) */
  opacity?: number;
  className?: string;
}

/**
 * WaveField — layered oscillating sine waves drawn on canvas. A nod to the
 * vibration signals the product monitors: slow phase drift + gentle amplitude
 * breathing, with additive glow. Respects prefers-reduced-motion and pauses
 * when the tab is hidden.
 */
export default function WaveField({ layers = 3, opacity = 1, className }: WaveFieldProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const colors = [
      '96, 165, 250',  // blue
      '139, 92, 246',  // violet
      '245, 158, 11',  // amber
      '52, 211, 153',  // emerald
    ];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 1.4;

      for (let l = 0; l < layers; l++) {
        const phase = t * 0.0006 * (1 + l * 0.35) + l * 2.1;
        const amp = h * 0.16 * (1 - l * 0.22) * (0.85 + 0.15 * Math.sin(t * 0.0004 + l));
        const yBase = h * (0.55 + l * 0.12);
        const freq = 0.008 + l * 0.003;

        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const y =
            yBase +
            Math.sin(x * freq + phase) * amp +
            Math.sin(x * freq * 2.7 + phase * 1.6) * amp * 0.25;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        const c = colors[l % colors.length];
        ctx.strokeStyle = `rgba(${c},${0.28 - l * 0.06})`;
        ctx.stroke();

        // Soft glow pass
        ctx.strokeStyle = `rgba(${c},${0.08 - l * 0.015})`;
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.lineWidth = 1.4;
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    resize();
    drawFrame();

    const loop = () => {
      if (!running) return;
      t += 16;
      drawFrame();
      raf = requestAnimationFrame(loop);
    };
    if (!reduced) raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      running = !document.hidden && !reduced;
      if (running) raf = requestAnimationFrame(loop);
      else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVisibility);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
    };
  }, [layers]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity }}
    />
  );
}
