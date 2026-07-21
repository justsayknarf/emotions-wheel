import { motion, useReducedMotion } from 'framer-motion';

// A hairline from a displaced label back to its dot. When de-overlap pushes a
// label well off its coordinate, the tether keeps the true point visible and
// the "label is a callout for this point" grammar intact. Bone-toned to match
// the emotion dots (the user's gold pins own the gold thread). (U4 / KTD7)

export interface TetherSegment {
  id: string;
  // Dot (true coordinate) end.
  x1: number;
  y1: number;
  // Label end.
  x2: number;
  y2: number;
}

interface Props {
  segments: TetherSegment[];
}

export function WordTethers({ segments }: Props) {
  const reduce = useReducedMotion();
  if (segments.length === 0) return null;

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
          initial={{ pathLength: reduce ? 1 : 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.5, ease: 'easeOut' }}
        />
      ))}
    </svg>
  );
}
