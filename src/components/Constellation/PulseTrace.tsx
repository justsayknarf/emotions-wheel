import { motion } from 'framer-motion';
import { toPercent } from '../../utils/fieldGeometry';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];    // recent window, chronological (oldest first)
  onPointClick: (entry: DiaryEntry) => void;
}

const PER_HOP = 0.55;       // seconds the pulse spends travelling each segment

// Draws the recent history as a constellation: an electric pulse bounces from
// point to point in time order, revealing each point as it arrives and leaving
// the connecting trail behind it. The final point is the most recent entry —
// the same coordinate as the mirror's ghost pin.
export function PulseTrace({ entries, onPointClick }: Props) {
  const points = entries
    .map((entry) => {
      const pin = entry.pins.at(-1);
      return pin ? { entry, lx: toPercent(pin.x), ly: toPercent(-pin.y) } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const n = points.length;
  const multi = n > 1;
  const total = Math.max(0.6, PER_HOP * (n - 1));
  const times = multi ? points.map((_, i) => i / (n - 1)) : [0, 1];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Trail line — draws progressively in step with the pulse */}
      {multi && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <motion.polyline
            points={points.map((p) => `${p.lx},${p.ly}`).join(' ')}
            fill="none"
            stroke="rgba(201,168,124,0.5)"
            strokeWidth={0.4}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: total, ease: 'linear' }}
          />
        </svg>
      )}

      {/* Points — revealed as the pulse reaches each */}
      {points.map((p, i) => (
        <motion.button
          key={p.entry.id}
          onClick={() => onPointClick(p.entry)}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: multi ? i * PER_HOP : 0, duration: 0.35, ease: 'easeOut' }}
          aria-label={`Check-in ${i + 1}`}
          style={{
            position: 'absolute',
            left: `${p.lx}%`,
            top: `${p.ly}%`,
            width: 22,
            height: 22,
            margin: '-11px 0 0 -11px',
            padding: 0,
            border: 'none',
            borderRadius: '50%',
            background: 'transparent',
            cursor: 'pointer',
            pointerEvents: 'auto',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'rgba(201,168,124,0.85)',
              boxShadow: '0 0 6px rgba(201,168,124,0.6)',
            }}
          />
        </motion.button>
      ))}

      {/* Travelling pulse — the electric spark bouncing point to point */}
      {multi && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            left: points.map((p) => `${p.lx}%`),
            top: points.map((p) => `${p.ly}%`),
            opacity: [1, ...Array(n - 1).fill(1)],
          }}
          transition={{ duration: total, times, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: 9,
            height: 9,
            margin: '-4.5px 0 0 -4.5px',
            borderRadius: '50%',
            background: 'rgba(240,225,200,0.95)',
            boxShadow: '0 0 12px 3px rgba(201,168,124,0.85)',
          }}
        />
      )}
    </div>
  );
}
