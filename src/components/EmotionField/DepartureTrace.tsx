import { useRef, useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Props {
  // Increments once per departure commit (U2's onDepart) — the one-shot
  // trigger, same shape as AxisRadiance's `play`. Geometry-only re-renders
  // (a resize recomputing px, an unrelated field re-render) leave this
  // unchanged and never retrigger the animation.
  play: number;
  from: { x: number; y: number } | null; // anchor, field-space [-1,1]
  to: { x: number; y: number } | null;   // the newly committed pin, field-space
  size: { width: number; height: number };
  toPx: (c: { x: number; y: number }) => { x: number; y: number };
  fadeIn: number;  // seconds
  hold: number;    // seconds
  fadeOut: number; // seconds
}

// The chevron backs off this many px from each mark so it touches neither —
// the shaft points at the pins, it never runs under them.
const BACKOFF = 15;
// Arrowhead geometry: arm length and half-angle (radians) off the shaft.
const HEAD_LEN = 9;
const HEAD_SPREAD = 0.45;

// Says "you moved from here" once, on commit, then dissolves — never a
// persistent stroke (KTD3/KTD4). The opacity lifecycle runs in a raw rAF
// loop started by the `play` effect, decoupled from React's render cycle —
// the same shape AxisRadiance uses for its one-shot pulse — so geometry
// (from/to → px, reactive every render) and lifecycle (imperative, one-shot
// per `play`) can never fight each other or restart one another.
export function DepartureTrace({ play, from, to, size, toPx, fadeIn, hold, fadeOut }: Props) {
  const groupRef = useRef<SVGGElement>(null);
  // The play value whose animation has finished — visibility is derived
  // (`play !== completedPlay`) below rather than toggled with its own on/off
  // state, so becoming visible needs no setState: a new `play` is visible
  // the instant it renders, for free. Only the animation's *end* (an async
  // rAF completion, not a synchronous effect-body call) sets this.
  const [completedPlay, setCompletedPlay] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (play === 0 || !from || !to || reducedMotion) return;
    const total = fadeIn + hold + fadeOut;
    const start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const t = (now - start) / 1000;
      let opacity: number;
      if (t < fadeIn) {
        opacity = fadeIn > 0 ? t / fadeIn : 1;
      } else if (t < fadeIn + hold) {
        opacity = 1;
      } else if (t < total) {
        opacity = fadeOut > 0 ? 1 - (t - fadeIn - hold) / fadeOut : 0;
      } else {
        opacity = 0;
      }
      if (groupRef.current) groupRef.current.style.opacity = String(Math.max(0, Math.min(1, opacity)));

      if (t < total) {
        raf = requestAnimationFrame(frame);
      } else {
        setCompletedPlay(play); // unmount — leaves no residual node once dissolved
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // Deliberately keyed on `play` alone — from/to/fadeIn/hold/fadeOut are
    // read once at the moment this specific commit's animation starts,
    // matching AxisRadiance's own precedent (PR #17: keying an animation
    // effect on values that change for unrelated reasons, like a resize
    // recomputing px, causes the exact restart/clear this avoids).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const isPlaying = play > 0 && play !== completedPlay && !reducedMotion;
  if (!isPlaying || !from || !to || size.width === 0) return null;

  const fromPx = toPx(from);
  const toPxPos = toPx(to);
  const dx = toPxPos.x - fromPx.x;
  const dy = toPxPos.y - fromPx.y;
  const dist = Math.hypot(dx, dy);
  // Too close to draw a meaningful shaft — suppress cleanly rather than
  // render a degenerate near-zero-length stroke.
  if (dist < BACKOFF * 2) return null;

  const ux = dx / dist;
  const uy = dy / dist;
  const startX = fromPx.x + ux * BACKOFF;
  const startY = fromPx.y + uy * BACKOFF;
  const endX = toPxPos.x - ux * BACKOFF;
  const endY = toPxPos.y - uy * BACKOFF;
  const angle = Math.atan2(uy, ux);
  const h1x = endX - HEAD_LEN * Math.cos(angle - HEAD_SPREAD);
  const h1y = endY - HEAD_LEN * Math.sin(angle - HEAD_SPREAD);
  const h2x = endX - HEAD_LEN * Math.cos(angle + HEAD_SPREAD);
  const h2y = endY - HEAD_LEN * Math.sin(angle + HEAD_SPREAD);

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: size.width, height: size.height, pointerEvents: 'none', zIndex: 8, overflow: 'visible' }}
      aria-hidden="true"
    >
      <g ref={groupRef} style={{ opacity: 0 }}>
        <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="var(--ui-recorded)" strokeWidth={1.25} />
        {/* Open chevron — a soft arrow, not a filled triangle */}
        <polyline
          points={`${h1x},${h1y} ${endX},${endY} ${h2x},${h2y}`}
          fill="none"
          stroke="var(--ui-recorded)"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
