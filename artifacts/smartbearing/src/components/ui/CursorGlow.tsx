import { useEffect, useRef, useState } from 'react';

/**
 * Cinematic pointer layer: a large lagging amber light that follows the cursor
 * plus a small crisp ring. Disabled on touch/coarse pointers and when the user
 * prefers reduced motion. Pure DOM/CSS — never intercepts clicks.
 */
export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;
    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const glow = { ...pos };
    const ring = { ...pos };
    let scaleRing = 1;
    const targetScale = { v: 1 };
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      const el = e.target as HTMLElement | null;
      const interactive = !!el?.closest('a, button, [role="button"], input, select, textarea, [data-cursor="hover"]');
      targetScale.v = interactive ? 1.9 : 1;
    };

    const loop = () => {
      // Ease each layer at a different rate for a trailing depth effect
      glow.x += (pos.x - glow.x) * 0.08;
      glow.y += (pos.y - glow.y) * 0.08;
      ring.x += (pos.x - ring.x) * 0.28;
      ring.y += (pos.y - ring.y) * 0.28;
      scaleRing += (targetScale.v - scaleRing) * 0.15;

      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${glow.x}px, ${glow.y}px, 0) translate(-50%, -50%)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%) scale(${scaleRing})`;
        ringRef.current.style.borderColor = targetScale.v > 1.2 ? 'rgba(245,158,11,0.9)' : 'rgba(245,158,11,0.45)';
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);

    let rippleId = 0;
    const onClick = (e: MouseEvent) => {
      const id = ++rippleId;
      setRipples((r) => [...r.slice(-4), { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => setRipples((r) => r.filter((p) => p.id !== id)), 700);
    };
    window.addEventListener('click', onClick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="fixed inset-0 z-[100] pointer-events-none hidden md:block">
      {/* Lagging warm light */}
      <div
        ref={glowRef}
        className="absolute top-0 left-0 w-[420px] h-[420px] rounded-full will-change-transform"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.075) 0%, rgba(245,158,11,0.03) 35%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />
      {/* Crisp trailing ring */}
      <div
        ref={ringRef}
        className="absolute top-0 left-0 w-8 h-8 rounded-full border-[1.5px] will-change-transform"
        style={{ borderColor: 'rgba(245,158,11,0.45)', boxShadow: '0 0 14px rgba(245,158,11,0.25), inset 0 0 8px rgba(245,158,11,0.12)' }}
      />
      {/* Click ripples — expanding light rings on every click */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="absolute w-10 h-10 rounded-full border border-blue-400/60 sb-click-ripple"
          style={{ left: r.x - 20, top: r.y - 20 }}
        />
      ))}
    </div>
  );
}
