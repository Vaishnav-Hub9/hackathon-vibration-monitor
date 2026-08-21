import { useEffect, useRef } from 'react';

interface AmbientCanvasProps {
  /** Density of dust particles (default 60) */
  particles?: number;
  /** Overall opacity of the layer (default 1) */
  opacity?: number;
  className?: string;
}

interface Glow {
  hue: [number, number, number];
  baseX: number; // 0..1 relative
  baseY: number;
  radius: number; // px
  speed: number;
  phase: number;
}

interface Dust {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  tw: number; // twinkle phase
  amber: boolean;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1 remaining
  hue: string;
}

/**
 * Cinematic ambient background: slow-drifting colored energy glows composited
 * with `lighter` blending over a floating dust field. Pure canvas 2D — no
 * dependencies. Pauses when the tab is hidden and respects
 * prefers-reduced-motion (renders one static frame instead).
 */
export default function AmbientCanvas({ particles = 60, opacity = 1, className }: AmbientCanvasProps) {
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

    // Scroll-reactive energy: scrolling charges the field (glows flare,
    // particles streak) and it decays back to calm.
    let energy = 0;
    let lastScrollY = window.scrollY;
    const onScroll = () => {
      energy = Math.min(1.6, energy + Math.abs(window.scrollY - lastScrollY) * 0.012);
      lastScrollY = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const glows: Glow[] = [
      { hue: [245, 158, 11], baseX: 0.18, baseY: 0.25, radius: 340, speed: 0.00016, phase: 0 },
      { hue: [59, 130, 246], baseX: 0.82, baseY: 0.65, radius: 400, speed: 0.00012, phase: 2.1 },
      { hue: [139, 92, 246], baseX: 0.6, baseY: 0.2, radius: 280, speed: 0.0002, phase: 4.4 },
      { hue: [234, 88, 12], baseX: 0.35, baseY: 0.85, radius: 300, speed: 0.00014, phase: 1.2 },
    ];

    let dust: Dust[] = [];
    let comets: Comet[] = [];
    let nextCometAt = 1500;

    const seedDust = () => {
      dust = Array.from({ length: particles }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.5 + Math.random() * 1.6,
        vy: -(0.08 + Math.random() * 0.22),
        vx: (Math.random() - 0.5) * 0.12,
        tw: Math.random() * Math.PI * 2,
        amber: Math.random() < 0.55,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedDust();
    };

    const spawnComet = () => {
      const fromLeft = Math.random() < 0.5;
      comets.push({
        x: fromLeft ? -40 : w + 40,
        y: Math.random() * h * 0.5,
        vx: (fromLeft ? 1 : -1) * (5 + Math.random() * 4),
        vy: 1.5 + Math.random() * 2,
        life: 1,
        hue: Math.random() < 0.5 ? 'rgba(147,197,253,' : 'rgba(196,181,253,',
      });
    };

    const drawFrame = () => {
      ctx.clearRect(0, 0, w, h);

      // Constellation links between nearby dust motes
      ctx.lineWidth = 1;
      const linkDist = Math.min(130, w * 0.12);
      for (let i = 0; i < dust.length; i++) {
        const a = dust[i];
        for (let j = i + 1; j < dust.length; j++) {
          const b = dust[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            const alpha = (1 - Math.sqrt(d2) / linkDist) * (0.06 + energy * 0.1);
            ctx.strokeStyle = `rgba(148,180,255,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Shooting stars — occasional comets with fading tails
      if (!reduced) {
        nextCometAt -= 16;
        if (nextCometAt <= 0) {
          spawnComet();
          nextCometAt = 2500 + Math.random() * 4500;
        }
        comets = comets.filter((c) => c.life > 0);
        ctx.globalCompositeOperation = 'lighter';
        for (const c of comets) {
          c.x += c.vx;
          c.y += c.vy;
          c.life -= 0.008;
          const tail = 14;
          const grad = ctx.createLinearGradient(c.x, c.y, c.x - c.vx * tail, c.y - c.vy * tail);
          grad.addColorStop(0, `${c.hue}${0.8 * c.life})`);
          grad.addColorStop(1, `${c.hue}0)`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x - c.vx * tail, c.y - c.vy * tail);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = 1;
      }

      // Energy glows — additive light (alpha scales with scroll energy)
      ctx.globalCompositeOperation = 'lighter';
      for (const g of glows) {
        const gx = g.baseX * w + Math.sin(t * g.speed + g.phase) * w * 0.12;
        const gy = g.baseY * h + Math.cos(t * g.speed * 1.3 + g.phase) * h * 0.1 - energy * 40;
        const boost = 1 + energy;
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, g.radius);
        const [r, gc, b] = g.hue;
        grad.addColorStop(0, `rgba(${r},${gc},${b},${0.055 * boost})`);
        grad.addColorStop(0.5, `rgba(${r},${gc},${b},${0.02 * boost})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gx, gy, g.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dust field — twinkling drifting motes
      for (const p of dust) {
        if (!reduced) {
          p.y += p.vy - energy * 2.2; // streak upward when scrolling down
          p.x += p.vx + Math.sin(t * 0.0004 + p.tw) * 0.08;
          if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
          if (p.x < -8) p.x = w + 8;
          if (p.x > w + 8) p.x = -8;
        }
        const alpha = (0.14 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.0012 + p.tw))) * (1 + energy * 1.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.amber ? `rgba(251,191,36,${alpha})` : `rgba(148,197,255,${alpha * 0.8})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    resize();
    drawFrame();

    const loop = () => {
      if (!running) return;
      t += 16;
      energy *= 0.965; // decay back to calm
      drawFrame();
      raf = requestAnimationFrame(loop);
    };

    if (!reduced) raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      running = !document.hidden && !reduced;
      if (running) {
        t += 16;
        raf = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(raf);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
    };
  }, [particles]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity }}
    />
  );
}
