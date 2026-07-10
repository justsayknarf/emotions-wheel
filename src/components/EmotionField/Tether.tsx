import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PinEntry } from '../../types';

// Maps coordinate [-1, 1] to [5%, 95%] — matches EmotionField/EmotionWord.
function toPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}

interface Props {
  // The active (most recent) pin the thread connects to.
  pin: PinEntry;
  // The left field plane, used to map the pin coordinate to pixels.
  fieldPlaneRef: React.RefObject<HTMLDivElement | null>;
  // The active card element in the rail, used for the thread's endpoint height.
  cardEl: HTMLDivElement | null;
}

interface Geo {
  px: number;
  py: number;
  ex: number;
  ey: number;
}

// A soft gold thread from the active pin to its card in the rail, so the card
// reads as a margin note on a point in emotional space rather than a panel.
export function Tether({ pin, fieldPlaneRef, cardEl }: Props) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const rafRef = useRef<number | null>(null);
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const measure = () => {
      const plane = fieldPlaneRef.current;
      if (!plane) return;
      const rect = plane.getBoundingClientRect();
      const px = (toPercent(pin.x) / 100) * rect.width;
      const py = (toPercent(-pin.y) / 100) * rect.height;
      // Endpoint x is the rail's left edge (the field plane's right edge), which
      // is stable while the card springs in horizontally — so the thread never
      // lags the animation. Endpoint y is the card's vertical center.
      const ex = rect.width;
      let ey = rect.height * 0.3;
      if (cardEl) {
        const c = cardEl.getBoundingClientRect();
        ey = c.top - rect.top + c.height / 2;
      }
      setGeo({ px, py, ex, ey });
    };

    const schedule = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };

    schedule();
    const plane = fieldPlaneRef.current;
    const ro = plane ? new ResizeObserver(schedule) : null;
    if (plane && ro) ro.observe(plane);
    window.addEventListener('resize', schedule);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [pin.x, pin.y, pin.id, cardEl, fieldPlaneRef]);

  if (!geo) return null;

  const { px, py, ex, ey } = geo;
  const dx = ex - px;
  const c1x = px + dx * 0.45;
  const c1y = py + (ey - py) * 0.06;
  const c2x = ex - dx * 0.14;
  const c2y = ey;
  const d = `M ${px} ${py} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tether-thread" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C9A87C" stopOpacity="0.65" />
          <stop offset="1" stopColor="#C9A87C" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      {/* pathLength normalizes to the real path length, so the draw reaches the
          card at any distance (a fixed dash array truncated long threads). */}
      <motion.path
        d={d}
        fill="none"
        stroke="url(#tether-thread)"
        strokeWidth="1.1"
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduce ? 0 : 0.8, ease: [0.22, 1, 0.36, 1], delay: reduce ? 0 : 0.18 }}
      />
      <motion.circle
        cx={ex}
        cy={ey}
        r="2.5"
        fill="#C9A87C"
        initial={{ opacity: reduce ? 0.85 : 0 }}
        animate={{ opacity: 0.85 }}
        transition={{ duration: 0.35, delay: reduce ? 0 : 0.9 }}
      />
    </svg>
  );
}
