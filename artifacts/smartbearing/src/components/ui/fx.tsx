import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';

/**
 * Magnetic — element gently pulls toward the cursor while hovered and
 * springs back on leave. Wraps children in a span; safe around Links.
 */
export function Magnetic({ children, strength = 0.35, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16 });

  return (
    <motion.span
      ref={ref}
      style={{ x, y, display: 'inline-flex' }}
      className={className}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.span>
  );
}

/**
 * TiltCard — subtle 3D perspective tilt following the cursor, with a moving
 * glare highlight. Pure transform-based; layout is untouched.
 */
export function TiltCard({ children, className, maxTilt = 8 }: { children: ReactNode; className?: string; maxTilt?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 });
  const ry = useSpring(useMotionValue(0), { stiffness: 180, damping: 18 });
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const [hover, setHover] = useState(false);
  const glare = useMotionTemplate`radial-gradient(420px circle at ${gx}% ${gy}%, rgba(255,255,255,0.07), transparent 60%)`;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900, position: 'relative' }}
      onMouseMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        ry.set((px - 0.5) * maxTilt * 2);
        rx.set(-(py - 0.5) * maxTilt * 2);
        gx.set(px * 100);
        gy.set(py * 100);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: glare, opacity: hover ? 1 : 0, transition: 'opacity 0.3s ease' }}
      />
    </motion.div>
  );
}

/**
 * CountUp — animates from 0 to `to` when scrolled into view.
 */
export function CountUp({ to, duration = 1600, prefix = '', suffix = '' }: { to: number; duration?: number; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started.current) return;
        started.current = true;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          setVal(Math.round(to * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {val.toLocaleString()}
      {suffix}
    </span>
  );
}
