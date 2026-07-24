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
  // Ids whose tether should persist regardless of `keep` — the two emotions the
  // selected card names ("between X and Y"). Kept so the phrase reads against
  // the geometry, and warmed toward gold to tie to their lifted labels.
  keepIds?: Set<string>;
}

export function WordTethers({ segments, duration = 1.5, keep = false, keepIds }: Props) {
  const reduce = useReducedMotion();
  if (segments.length === 0) return null;

  // Reduced motion: static, persistent. Keep-tethers: draw in, then hold.
  // Default: draw in, hold, fade out so the resting field stays clean.

  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {segments.map((s) => {
        // The pair's tethers stay put (and warm to gold); everyone else obeys
        // the global keep/fade behaviour.
        const pinned = keepIds?.has(s.id) ?? false;
        const held = keep || pinned;
        return (
          <motion.line
            key={s.id}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={pinned ? 'rgba(201, 168, 124, 0.5)' : 'rgba(237, 232, 223, 0.4)'}
            strokeWidth={1}
            strokeLinecap="round"
            initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
            animate={
              reduce
                ? { pathLength: 1, opacity: 1 }
                : held
                  ? { pathLength: [0, 1], opacity: [0, 1] }
                  : { pathLength: [0, 1, 1, 1], opacity: [0, 1, 1, 0] }
            }
            transition={
              reduce
                ? { duration: 0 }
                : held
                  ? { duration: duration * 0.38, delay: s.delay ?? 0, ease: 'easeOut' }
                  : {
                      duration,
                      delay: s.delay ?? 0,
                      times: [0, 0.38, 0.66, 1],
                      ease: 'easeOut',
                    }
            }
          />
        );
      })}
    </svg>
  );
}
