import { useLayoutEffect, useRef, useState } from 'react';
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
      <style>{`
        .tether-path {
          stroke-dasharray: 600;
          stroke-dashoffset: 600;
          animation: tether-draw 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.18s forwards;
        }
        .tether-anchor { animation: tether-anchor 0.35s ease-out 0.9s both; }
        @keyframes tether-draw { to { stroke-dashoffset: 0; } }
        @keyframes tether-anchor { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .tether-path { animation: none; stroke-dashoffset: 0; }
          .tether-anchor { animation: none; opacity: 1; }
        }
      `}</style>
      <defs>
        <linearGradient id="tether-thread" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#C9A87C" stopOpacity="0.65" />
          <stop offset="1" stopColor="#C9A87C" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <path
        className="tether-path"
        d={d}
        fill="none"
        stroke="url(#tether-thread)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <circle className="tether-anchor" cx={ex} cy={ey} r="2.5" fill="#C9A87C" opacity="0.85" />
    </svg>
  );
}
