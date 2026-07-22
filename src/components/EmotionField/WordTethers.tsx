import { motion, useReducedMotion } from 'framer-motion';

// A hairline from a fanned label back to its dot. On reveal it draws itself out
// from the coordinate, holds briefly, then fades — so the "label is a callout
// for this point" attachment is shown in the moment rather than kept as a
// permanent line. Once faded, only the word remains and the field stays clean.
// Bone-toned to match the emotion dots (the user's gold pins own the gold
// thread). Under reduced motion the tether stays static and persistent, so the
// attachment cue survives without animation. (Q3 radial-fan reveal)

export interface TetherSegment {
  id: string;
  // Dot (true coordinate) end.
  x1: number;
  y1: number;
  // Label end.
  x2: number;
  y2: number;
  // Stagger, in seconds, so nearer words draw first.
  delay?: number;
}

interface Props {
  segments: TetherSegment[];
  // Total draw + hold + fade time (seconds).
  duration?: number;
  // Keep the tether on screen instead of fading it after the draw.
  keep?: boolean;
}

export function WordTethers({ segments, duration = 1.5, keep = false }: Props) {
  const reduce = useReducedMotion();
  if (segments.length === 0) return null;

  // Reduced motion: static, persistent. Keep-tethers: draw in, then hold.
  // Default: draw in, hold, fade out so the resting field stays clean.

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {segments.map((s) => (
        <motion.line
          key={s.id}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke="rgba(237, 232, 223, 0.4)"
          strokeWidth={1}
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
          animate={
            reduce
              ? { pathLength: 1, opacity: 1 }
              : keep
                ? { pathLength: [0, 1], opacity: [0, 1] }
                : { pathLength: [0, 1, 1, 1], opacity: [0, 1, 1, 0] }
          }
          transition={
            reduce
              ? { duration: 0 }
              : keep
                ? { duration: duration * 0.38, delay: s.delay ?? 0, ease: 'easeOut' }
                : {
                    duration,
                    delay: s.delay ?? 0,
                    times: [0, 0.38, 0.66, 1],
                    ease: 'easeOut',
                  }
          }
        />
      ))}
    </svg>
  );
}
