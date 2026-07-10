import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toPercent } from '../../utils/fieldGeometry';
import { emotions } from '../../data/emotions';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];    // recent window, chronological (oldest first)
  onPointClick: (entry: DiaryEntry) => void;
}

const PER_HOP = 0.6;        // seconds the comet spends travelling each segment

// Layers of the light trail. Each is a stroke of a given length that ends at the
// comet head; stacking short-bright over long-dim makes the tail taper — hot at
// the tip, fading into a soft glow behind. Lengths clamp so the effect holds for
// both short and long journeys.
const TRAIL_LAYERS = [
  { frac: 0.34, max: 280, width: 13, color: 'rgba(201,168,124,0.13)', filter: 'url(#trailGlowStrong)' },
  { frac: 0.2, max: 180, width: 7, color: 'rgba(219,193,152,0.34)', filter: 'url(#trailGlowStrong)' },
  { frac: 0.11, max: 100, width: 3.6, color: 'rgba(244,232,210,0.75)', filter: 'url(#trailGlowSoft)' },
  { frac: 0.05, max: 46, width: 1.6, color: 'rgba(255,252,246,0.95)', filter: undefined },
];

const emotionById = new Map(emotions.map((e) => [e.id, e]));

// Draws the recent history as a constellation: a glowing comet with a tapering
// light trail traces a hairline path from point to point in time order. As it
// arrives at each check-in, that entry's recorded words ignite at their own
// coordinates. The final point is the most recent entry — the ghost-pin spot.
export function PulseTrace({ entries, onPointClick }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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

  // Pixel geometry for the SVG path + traveling light trail.
  const { w, h } = size;
  const px = points.map((p) => ({ x: (p.lx / 100) * w, y: (p.ly / 100) * h }));
  const cum = px.reduce<number[]>((acc, p, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p.x - px[i - 1].x, p.y - px[i - 1].y));
    return acc;
  }, []);
  const L = cum[cum.length - 1] || 1;
  const pathD = px.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {w > 0 && (
        <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <filter id="trailGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id="trailGlowSoft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
          </defs>

          {/* Base hairline — the path the comet traces */}
          {multi && (
            <motion.path
              d={pathD}
              fill="none"
              stroke="rgba(201,168,124,0.32)"
              strokeWidth={1}
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          )}

          {/* Glowing light trail — layered traveling strokes sharing the head */}
          {multi &&
            TRAIL_LAYERS.map((layer, k) => {
              const len = Math.min(layer.frac * L, layer.max);
              return (
                <motion.path
                  key={k}
                  d={pathD}
                  fill="none"
                  stroke={layer.color}
                  strokeWidth={layer.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={layer.filter}
                  style={{ strokeDasharray: `${len} ${L * 4}` }}
                  initial={{ strokeDashoffset: len - cum[0] }}
                  animate={{ strokeDashoffset: cum.map((c) => len - c) }}
                  transition={{ duration: total, times, ease: 'linear' }}
                />
              );
            })}
        </svg>
      )}

      {/* Words igniting at each check-in as the comet arrives */}
      {points.map((p, i) =>
        p.words.map((word, j) => (
          <motion.span
            key={`${p.entry.id}-${word.label}-${j}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: [0, 1, 0.4], scale: [0.85, 1.05, 1] }}
            transition={{ delay: arrival(i), duration: 1.3, times: [0, 0.35, 1], ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: `${word.wx}%`,
              top: `${word.wy}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: 'var(--oura-gold)',
              textShadow: '0 0 10px rgba(201,168,124,0.55)',
              whiteSpace: 'nowrap',
            }}
          >
            {word.label}
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

      {/* Comet head — the hot bright tip */}
      {multi && (
        <motion.div
          animate={{ left: lefts, top: tops }}
          transition={{ duration: total, times, ease: 'linear' }}
          style={{
            position: 'absolute',
            width: 11,
            height: 11,
            margin: '-5.5px 0 0 -5.5px',
            borderRadius: '50%',
            background: 'rgba(255,252,246,0.98)',
            boxShadow: '0 0 16px 5px rgba(201,168,124,0.9)',
          }}
        />
      )}
    </div>
  );
}
