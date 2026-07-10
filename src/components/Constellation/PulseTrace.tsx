import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toPercent } from '../../utils/fieldGeometry';
import { emotions } from '../../data/emotions';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];    // recent window, chronological (oldest first)
  onPointClick: (entry: DiaryEntry) => void;
}

const PER_HOP = 0.6;        // seconds the orb spends travelling each segment
const DISSIPATE = 1.4;      // seconds the trail takes to fade after the orb stops
const FADE_PER_FRAME = 0.08; // how much trail alpha is removed each frame (trail length)

const emotionById = new Map(emotions.map((e) => [e.id, e]));

// A soft radial glow blob, drawn additively to build the light trail.
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,250,240,${a})`);
  g.addColorStop(0.28, `rgba(219,193,152,${a * 0.45})`);
  g.addColorStop(1, 'rgba(201,168,124,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Draws the recent history as a constellation: a glowing orb races the route in
// time order, emitting a light trail that echoes its motion and dissipates once
// it stops. As it arrives at each check-in, that entry's recorded words ignite
// at their own coordinates. The final point is the most recent entry.
export function PulseTrace({ entries, onPointClick }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const arrival = (i: number) => (multi ? i * PER_HOP : 0);

  const { w, h } = size;
  const px = points.map((p) => ({ x: (p.lx / 100) * w, y: (p.ly / 100) * h }));
  const pathD = px.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  // Canvas motion-echo trail.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !multi || w === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const pts = points.map((p) => ({ x: (p.lx / 100) * w, y: (p.ly / 100) * h }));

    const posAt = (t: number) => {
      if (t >= total) return pts[pts.length - 1];
      const u = t / PER_HOP;
      const s = Math.floor(u);
      const f = u - s;
      const a = pts[s];
      const b = pts[Math.min(s + 1, pts.length - 1)];
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    };

    let raf = 0;
    const start = performance.now();
    let prev = posAt(0);

    const frame = (now: number) => {
      const t = (now - start) / 1000;

      // Fade the whole trail toward transparent — older glow dissipates.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${FADE_PER_FRAME})`;
      ctx.fillRect(0, 0, w, h);

      // While moving, emit glow at the orb's position (interpolated to avoid gaps).
      if (t <= total) {
        const cur = posAt(t);
        ctx.globalCompositeOperation = 'lighter';
        const STEPS = 5;
        for (let k = 1; k <= STEPS; k++) {
          const ix = prev.x + (cur.x - prev.x) * (k / STEPS);
          const iy = prev.y + (cur.y - prev.y) * (k / STEPS);
          glow(ctx, ix, iy, 11, 0.42);
        }
        glow(ctx, cur.x, cur.y, 20, 0.5); // bloom
        glow(ctx, cur.x, cur.y, 4.5, 0.95); // hot core
        prev = cur;
      }

      if (t < total + DISSIPATE) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, entries]);

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {/* Base hairline — the route the orb traces */}
      {multi && w > 0 && (
        <svg width={w} height={h} style={{ position: 'absolute', inset: 0 }}>
          <motion.path
            d={pathD}
            fill="none"
            stroke="rgba(201,168,124,0.3)"
            strokeWidth={1}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </svg>
      )}

      {/* Motion-echo light trail */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Words igniting at each check-in as the orb arrives */}
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

      {/* Points — revealed as the orb reaches each, with a one-shot arrival ring */}
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

      {/* Resting orb — the calm "now" glow left after the trail dissipates */}
      {multi && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0.65] }}
          transition={{ delay: total, duration: 1.3, times: [0, 0.45, 1], ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: `${points[n - 1].lx}%`,
            top: `${points[n - 1].ly}%`,
            width: 9,
            height: 9,
            margin: '-4.5px 0 0 -4.5px',
            borderRadius: '50%',
            background: 'rgba(255,252,246,0.95)',
            boxShadow: '0 0 12px 3px rgba(201,168,124,0.8)',
          }}
        />
      )}
    </div>
  );
}
