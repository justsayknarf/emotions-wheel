import { motion } from 'framer-motion';
import { toPercent } from '../../utils/fieldGeometry';
import { emotions } from '../../data/emotions';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];    // recent window, chronological (oldest first)
  onPointClick: (entry: DiaryEntry) => void;
}

const PER_HOP = 0.6;        // seconds the comet spends travelling each segment

// One radial trail behind the comet head — each dot lags a little more and
// dims, so together they read as a fading light trail hugging the path.
const TRAIL = [
  { lag: 0.05, size: 8, opacity: 0.5 },
  { lag: 0.1, size: 7, opacity: 0.38 },
  { lag: 0.16, size: 6, opacity: 0.28 },
  { lag: 0.22, size: 5, opacity: 0.2 },
  { lag: 0.29, size: 4, opacity: 0.13 },
  { lag: 0.37, size: 3, opacity: 0.08 },
];

const emotionById = new Map(emotions.map((e) => [e.id, e]));

// Draws the recent history as a constellation: a glowing comet traces a hairline
// path from point to point in time order. As it arrives at each check-in, that
// entry's recorded words ignite at their own coordinates on the circumplex. The
// final point is the most recent entry — the mirror's ghost-pin coordinate.
export function PulseTrace({ entries, onPointClick }: Props) {
  const points = entries
    .map((entry) => {
      const pin = entry.pins.at(-1);
      if (!pin) return null;
      const wordIds = [...new Set(entry.pins.flatMap((p) => p.recognizedWords))];
      const words = wordIds
        .map((id) => emotionById.get(id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .map((e) => ({ label: e.label, wx: toPercent(e.x), wy: toPercent(-e.y) }));
      return { entry, lx: toPercent(pin.x), ly: toPercent(-pin.y), words };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const n = points.length;
  const multi = n > 1;
  const total = Math.max(0.6, PER_HOP * (n - 1));
  const times = multi ? points.map((_, i) => i / (n - 1)) : [0, 1];
  const arrival = (i: number) => (multi ? i * PER_HOP : 0);

  const lefts = points.map((p) => `${p.lx}%`);
  const tops = points.map((p) => `${p.ly}%`);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Hairline trail line — draws in step with the comet */}
      {multi && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        >
          <motion.polyline
            points={points.map((p) => `${p.lx},${p.ly}`).join(' ')}
            fill="none"
            stroke="rgba(201,168,124,0.38)"
            strokeWidth={1}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </svg>
      )}

      {/* Words igniting at each check-in as the comet arrives */}
      {points.map((p, i) =>
        p.words.map((w, j) => (
          <motion.span
            key={`${p.entry.id}-${w.label}-${j}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0, 1, 0.4], scale: [0.85, 1.05, 1] }}
            transition={{ delay: arrival(i), duration: 1.3, times: [0, 0.35, 1], ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: `${w.wx}%`,
              top: `${w.wy}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: 'var(--oura-gold)',
              textShadow: '0 0 10px rgba(201,168,124,0.55)',
              whiteSpace: 'nowrap',
            }}
          >
            {w.label}
          </motion.span>
        )),
      )}

      {/* Points — revealed as the comet reaches each, with a one-shot arrival ring */}
      {points.map((p, i) => (
        <div key={p.entry.id}>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 3.2], opacity: [0, 0.55, 0] }}
            transition={{ delay: arrival(i), duration: 1, times: [0, 0.25, 1], ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: `${p.lx}%`,
              top: `${p.ly}%`,
              width: 12,
              height: 12,
              margin: '-6px 0 0 -6px',
              borderRadius: '50%',
              border: '1px solid rgba(201,168,124,0.6)',
            }}
          />
          <motion.button
            onClick={() => onPointClick(p.entry)}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: arrival(i), duration: 0.35, ease: 'easeOut' }}
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
                background: 'rgba(201,168,124,0.9)',
                boxShadow: '0 0 6px rgba(201,168,124,0.6)',
              }}
            />
          </motion.button>
        </div>
      ))}

      {/* Comet — a lagging light trail plus the bright head */}
      {multi && (
        <>
          {TRAIL.map((t, k) => (
            <motion.div
              key={k}
              animate={{ left: lefts, top: tops }}
              transition={{ duration: total, times, ease: 'linear', delay: t.lag }}
              style={{
                position: 'absolute',
                width: t.size,
                height: t.size,
                margin: `${-t.size / 2}px 0 0 ${-t.size / 2}px`,
                borderRadius: '50%',
                background: `rgba(201,168,124,${t.opacity})`,
                filter: 'blur(0.5px)',
              }}
            />
          ))}
          <motion.div
            animate={{ left: lefts, top: tops }}
            transition={{ duration: total, times, ease: 'linear' }}
            style={{
              position: 'absolute',
              width: 10,
              height: 10,
              margin: '-5px 0 0 -5px',
              borderRadius: '50%',
              background: 'rgba(244,232,210,0.98)',
              boxShadow: '0 0 14px 4px rgba(201,168,124,0.85)',
            }}
          />
        </>
      )}
    </div>
  );
}
