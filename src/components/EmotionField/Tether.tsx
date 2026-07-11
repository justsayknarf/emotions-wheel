import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PinEntry } from '../../types';

// Maps coordinate [-1, 1] to [5%, 95%] — matches EmotionField/EmotionWord.
function toPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}

interface Props {
  // The selected pin the thread connects to.
  pin: PinEntry;
  // The left field plane, used to map the pin coordinate to pixels.
  fieldPlaneRef: React.RefObject<HTMLDivElement | null>;
  // The rail's scroll container. The selected card is found inside it by
  // data-pin-id, so the endpoint tracks the actual selected card and its scroll
  // position rather than a stale ref.
  railRef: React.RefObject<HTMLDivElement | null>;
  selectedPinId: string | null;
}

interface Geo {
  px: number;
  py: number;
  ex: number;
  ey: number;
}

// A soft gold thread from the active pin to its card in the rail, so the card
// reads as a margin note on a point in emotional space rather than a panel.
export function Tether({ pin, fieldPlaneRef, railRef, selectedPinId }: Props) {
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
      // Endpoint x is the rail's left edge (the field plane's right edge).
      const ex = rect.width;
      let ey = rect.height * 0.3;
      const rail = railRef.current;
      const card = rail?.querySelector(`[data-pin-id="${selectedPinId}"]`) as HTMLElement | null;
      if (rail && card) {
        const c = card.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();
        const raw = c.top - rect.top + c.height / 2;
        // Clamp to the rail's visible range so a scrolled-out selected card
        // pulls the thread to the top/bottom edge instead of off-screen.
        const top = railRect.top - rect.top + 10;
        const bottom = railRect.bottom - rect.top - 10;
        ey = Math.max(top, Math.min(bottom, raw));
      }
      setGeo({ px, py, ex, ey });
    };

    const schedule = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };

    schedule();
    const plane = fieldPlaneRef.current;
    const rail = railRef.current;
    const ro = new ResizeObserver(schedule);
    if (plane) ro.observe(plane);
    if (rail) ro.observe(rail);
    rail?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      rail?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [pin.x, pin.y, pin.id, selectedPinId, railRef, fieldPlaneRef]);

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
