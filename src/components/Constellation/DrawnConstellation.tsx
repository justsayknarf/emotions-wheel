import { useId, useMemo, useRef, useState } from 'react';
import { createDrawable, createTimeline, utils } from 'animejs';
import { useAnimeScope } from '../../hooks/useAnimeScope';
import { toPercent } from '../../utils/fieldGeometry';
import { emotions } from '../../data/emotions';
import {
  replaySchedule,
  replayDayLabels,
  STAR_MS,
  LABEL_DELAY_MS,
  LABEL_MS,
  WORD_DELAY_MS,
  WORD_MS,
  RING_DELAY_MS,
  RING_MS,
  TAIL_MS,
} from './replaySchedule';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];    // recent window, chronological (oldest first)
  onPointClick: (entry: DiaryEntry) => void;
}

// Pause before the first star lands, so the overlay's own fade-in settles first.
const START_DELAY_MS = 400;
// Scrubber resolution: the range input runs 0..SCRUB_STEPS.
const SCRUB_STEPS = 1000;
// Landing ring: final diameter (px). It grows from a fraction of this to 1×,
// so the border ends at a crisp 1px rather than a thickened stroke.
const RING_SIZE = 36;
const RING_FROM_SCALE = 0.2;
const RING_PEAK_OPACITY = 0.55;
// The streak riding each line: the departure comet's proportions (its glow
// width and opacity at the default strength) so the two trails read as one.
const STREAK_GLOW_WIDTH = 5;
const STREAK_GLOW_OPACITY = 0.35;

const emotionById = new Map(emotions.map((e) => [e.id, e]));

// "A week, drawn in": the recent history replayed as one anime.js timeline.
// Check-ins land one by one in time order, each joined to the one before by a
// line that finishes drawing as the star lands; the first check-in of each day
// gets a small day label and every check-in's recorded words ignite at their
// own coordinates, then settle to a faint glow. A scrubber seeks the timeline
// (and pauses it); play/pause/replay sit beside it. The newest check-in is the
// gold star — "now" — the rest keep the recorded teal the field uses for a
// past pin. Reduced motion shows the finished constellation; the scrubber can
// still seek it.
export function DrawnConstellation({ entries, onPointClick }: Props) {
  const points = useMemo(
    () =>
      entries
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
        .filter((p): p is NonNullable<typeof p> => p !== null),
    [entries],
  );
  const dayLabels = useMemo(
    () => replayDayLabels(points.map((p) => p.entry.timestamp), new Date()),
    [points],
  );

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const scrubRef = useRef<HTMLInputElement>(null);

  // Written straight to the input every frame rather than through state, so
  // playback doesn't re-render the whole sky 60 times a second. `ended` only
  // changes at the edges, so it's cheap to keep in state for the button icon.
  const syncScrub = (progress: number) => {
    const el = scrubRef.current;
    if (el) {
      el.value = String(Math.round(progress * SCRUB_STEPS));
      el.style.setProperty('--p', `${(progress * 100).toFixed(2)}%`);
    }
    const isEnd = progress >= 1;
    if (isEnd !== endedRef.current) {
      endedRef.current = isEnd;
      setEnded(isEnd);
    }
  };

  const n = points.length;
  const uid = useId().replace(/:/g, '');

  const { root, scope } = useAnimeScope<HTMLDivElement>(
    (self, reduced) => {
      if (n === 0) return;
      const s = replaySchedule(n);
      // Pin the start state explicitly rather than trusting the inline
      // `opacity: 0` React rendered: a previous scope's revert (StrictMode's
      // double effect, a reduced-motion flip) can strip it, and the timeline
      // doesn't render a child's from-values until the playhead reaches it —
      // so without this, later words sat fully visible before their star.
      utils.set('[data-star]', { opacity: 0, scale: 0 });
      utils.set('[data-day], [data-words], [data-ring]', { opacity: 0 });
      const lines = createDrawable('.replay-line');
      const streaks = createDrawable('.replay-streak');
      const glows = createDrawable('.replay-glow');
      utils.set([...lines, ...streaks, ...glows], { draw: '0 0' });
      utils.set('[data-head]', { opacity: 0 });
      const tl = createTimeline({
        autoplay: false,
        onUpdate: (t) => syncScrub(t.progress),
        onPause: () => setPlaying(false),
        onComplete: () => setPlaying(false),
      });

      points.forEach((p, i) => {
        const at = s.starAt(i);
        if (i > 0) {
          const k = i - 1;
          const start = s.lineAt(i);
          // The quiet constellation line draws in under the head and stays.
          tl.add(lines[k], { draw: ['0 0', '0 1'], duration: s.lineMs, ease: 'inOut(2)' }, start);
          // Over it, the departure comet's look: a bright streak and its glow
          // draw in behind a head riding the line, then the tail catches up
          // and they're gone.
          tl.add([streaks[k], glows[k]], {
            draw: [
              { from: '0 0', to: '0 1', duration: s.lineMs, ease: 'inOut(2)' },
              { to: '1 1', duration: TAIL_MS, ease: 'in(2)' },
            ],
          }, start);
          const el = self.root instanceof Element ? self.root : null;
          const line = el?.querySelector<SVGLineElement>(`[data-line="${k}"]`);
          const heads = el ? [...el.querySelectorAll<SVGCircleElement>(`[data-head="${k}"]`)] : [];
          if (line && heads.length) {
            // Read the line at render time, not at build time, so the head
            // stays on it through a resize (its ends are in %) — and a scrub
            // backwards puts it back where the draw is.
            const ride = { p: 0 };
            tl.add(ride, {
              p: [0, 1],
              duration: s.lineMs,
              ease: 'inOut(2)',
              onRender: () => {
                const pt = line.getPointAtLength(line.getTotalLength() * ride.p);
                for (const h of heads) {
                  h.setAttribute('cx', `${pt.x}`);
                  h.setAttribute('cy', `${pt.y}`);
                }
              },
            }, start);
            tl.add(heads, { opacity: [0, 1], duration: Math.min(120, s.lineMs * 0.3) }, start);
            tl.add(heads, { opacity: 0, duration: 300, ease: 'out(2)' }, at - 40);
          }
        }
        tl.add(`[data-star="${i}"]`, {
            scale: [0, 1],
            // The overshoot belongs to the scale; opacity just arrives.
            opacity: { from: 0, to: 1, ease: 'out(2)' },
            duration: STAR_MS,
            ease: 'outBack(2)',
          }, at);
        tl.add(`[data-ring="${i}"]`, {
            scale: [RING_FROM_SCALE, 1],
            opacity: [RING_PEAK_OPACITY, 0],
            duration: RING_MS,
            ease: 'out(3)',
          }, at + RING_DELAY_MS);
        if (dayLabels[i]) {
          tl.add(`[data-day="${i}"]`, { opacity: [0, 1], duration: LABEL_MS, ease: 'out(2)' }, at + LABEL_DELAY_MS);
        }
        if (p.words.length > 0) {
          tl.add(
            `[data-words="${i}"]`,
            {
              opacity: [
                { from: 0, to: 1, duration: WORD_MS * 0.35, ease: 'out(2)' },
                { to: 0.4, duration: WORD_MS * 0.65, ease: 'inOut(2)' },
              ],
            },
            at + WORD_DELAY_MS,
          );
        }
      });

      const toEnd = () => {
        tl.pause();
        tl.seek(tl.duration);
      };

      self.add('toggle', () => {
        if (!tl.paused) {
          tl.pause();
          return;
        }
        if (reduced) {
          toEnd();
          return;
        }
        if (tl.progress >= 1) tl.restart();
        else tl.play();
        setPlaying(true);
      });
      self.add('replay', () => {
        if (reduced) {
          toEnd();
          return;
        }
        tl.restart();
        setPlaying(true);
      });
      self.add('seek', (progress: number) => {
        tl.pause();
        tl.seek(progress * tl.duration);
      });

      if (reduced) {
        toEnd();
        return;
      }
      tl.seek(0);
      const start = window.setTimeout(() => {
        tl.play();
        setPlaying(true);
      }, START_DELAY_MS);
      return () => window.clearTimeout(start);
    },
    [points, dayLabels],
  );

  if (n === 0) return null;
  const last = n - 1;

  return (
    <div ref={root} style={{ position: 'absolute', inset: 0 }}>
      {/* Lines between consecutive check-ins, with the departure comet's
          streak riding each one in. Percentage coordinates keep them on
          their stars through any resize without re-measuring. */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          {points.slice(1).map((p, k) => (
            // Teal tail → gold → a text-white head, as DepartureTrace.
            <linearGradient
              key={p.entry.id}
              id={`rc-grad-${uid}-${k}`}
              gradientUnits="userSpaceOnUse"
              x1={`${points[k].lx}%`}
              y1={`${points[k].ly}%`}
              x2={`${p.lx}%`}
              y2={`${p.ly}%`}
            >
              <stop offset="0" style={{ stopColor: 'rgb(var(--ui-recorded-rgb))', stopOpacity: 0.25 }} />
              <stop offset="0.55" style={{ stopColor: 'rgb(var(--ui-recorded-rgb))', stopOpacity: 0.8 }} />
              <stop offset="0.85" style={{ stopColor: 'rgb(var(--ui-gold-rgb))', stopOpacity: 0.95 }} />
              <stop offset="1" style={{ stopColor: 'rgb(var(--ui-text-rgb))', stopOpacity: 1 }} />
            </linearGradient>
          ))}
          <filter id={`rc-blur-${uid}`} filterUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {points.slice(1).map((p, k) => {
          const ends = { x1: `${points[k].lx}%`, y1: `${points[k].ly}%`, x2: `${p.lx}%`, y2: `${p.ly}%` };
          const grad = `url(#rc-grad-${uid}-${k})`;
          return (
            <g key={p.entry.id}>
              <line
                className="replay-line"
                data-line={k}
                {...ends}
                style={{ stroke: 'rgb(var(--ui-recorded-rgb) / 0.45)', strokeWidth: 1.2, strokeLinecap: 'round' }}
              />
              <line
                className="replay-glow"
                {...ends}
                stroke={grad}
                strokeWidth={STREAK_GLOW_WIDTH}
                strokeLinecap="round"
                opacity={STREAK_GLOW_OPACITY}
                filter={`url(#rc-blur-${uid})`}
              />
              <line className="replay-streak" {...ends} stroke={grad} strokeWidth={1.75} strokeLinecap="round" />
              <circle data-head={k} r={4.5} filter={`url(#rc-blur-${uid})`} style={{ fill: 'rgb(var(--ui-text-rgb))', opacity: 0 }} />
              <circle data-head={k} r={2.2} style={{ fill: 'rgb(var(--ui-text-rgb))', opacity: 0 }} />
            </g>
          );
        })}
      </svg>

      {/* Recorded words, igniting at their own coordinates as their check-in lands */}
      {points.map((p, i) =>
        p.words.length > 0 ? (
          <div key={p.entry.id} data-words={i} style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}>
            {p.words.map((word, j) => (
              <span
                key={`${word.label}-${j}`}
                style={{
                  position: 'absolute',
                  left: `${word.wx}%`,
                  top: `${word.wy}%`,
                  transform: 'translate(-50%, -50%)',
                  fontSize: 12,
                  fontWeight: 400,
                  letterSpacing: '0.02em',
                  color: 'var(--ui-gold)',
                  textShadow: '0 0 10px rgb(var(--ui-gold-rgb) / 0.55)',
                  whiteSpace: 'nowrap',
                }}
              >
                {word.label}
              </span>
            ))}
          </div>
        ) : null,
      )}

      {/* Stars — each a tap target that opens its check-in */}
      {points.map((p, i) => {
        const isNow = i === last;
        const size = isNow ? 9 : 6;
        return (
          <div key={p.entry.id}>
            <button
              onClick={() => onPointClick(p.entry)}
              aria-label={`Check-in ${i + 1}${dayLabels[i] ? `, ${dayLabels[i]!.toLowerCase()}` : ''}`}
              style={{
                position: 'absolute',
                left: `${p.lx}%`,
                top: `${p.ly}%`,
                width: 24,
                height: 24,
                margin: '-12px 0 0 -12px',
                padding: 0,
                border: 'none',
                borderRadius: '50%',
                background: 'transparent',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <span
                data-ring={i}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: RING_SIZE,
                  height: RING_SIZE,
                  margin: `${-RING_SIZE / 2}px 0 0 ${-RING_SIZE / 2}px`,
                  borderRadius: '50%',
                  border: `1px solid ${isNow ? 'var(--ui-gold)' : 'var(--ui-recorded)'}`,
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
              <span
                data-star={i}
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  opacity: 0,
                  background: isNow ? 'var(--ui-gold)' : 'rgb(var(--ui-recorded-rgb) / 0.9)',
                  boxShadow: isNow
                    ? '0 0 10px 2px rgb(var(--ui-gold-rgb) / 0.55)'
                    : '0 0 6px rgb(var(--ui-recorded-rgb) / 0.5)',
                }}
              />
            </button>
            {dayLabels[i] && (
              <span
                data-day={i}
                style={{
                  position: 'absolute',
                  left: `${p.lx}%`,
                  top: `${p.ly}%`,
                  transform: 'translate(-50%, 11px)',
                  opacity: 0,
                  pointerEvents: 'none',
                  fontSize: 8,
                  fontWeight: 500,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: isNow ? 'var(--ui-gold-dim)' : 'var(--ui-text-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                {dayLabels[i]}
              </span>
            )}
          </div>
        );
      })}

      {/* Scrubber + play/pause/replay */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 40,
          transform: 'translateX(-50%)',
          width: 'min(420px, calc(100% - 32px))',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '9px 16px 9px 10px',
          borderRadius: 999,
          background: 'rgb(var(--ui-surface-rgb) / 0.8)',
          border: '1px solid var(--ui-border)',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => scope.current?.methods.toggle()}
          aria-label={playing ? 'Pause' : ended ? 'Replay' : 'Play'}
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            padding: 0,
            border: 'none',
            borderRadius: '50%',
            background: 'rgb(var(--ui-gold-rgb) / 0.1)',
            color: 'var(--ui-gold)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <ControlIcon kind={playing ? 'pause' : ended ? 'replay' : 'play'} />
        </button>
        <input
          ref={scrubRef}
          type="range"
          className="replay-scrubber"
          min={0}
          max={SCRUB_STEPS}
          step={1}
          defaultValue={0}
          aria-label="Replay position"
          onPointerDown={() => scope.current?.methods.seek(Number(scrubRef.current?.value ?? 0) / SCRUB_STEPS)}
          onInput={(e) => scope.current?.methods.seek(Number(e.currentTarget.value) / SCRUB_STEPS)}
        />
      </div>
    </div>
  );
}

function ControlIcon({ kind }: { kind: 'play' | 'pause' | 'replay' }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" style={{ display: 'block' }}>
      {kind === 'play' && <path d="M3.5 2.2 L10 6 L3.5 9.8 Z" fill="currentColor" />}
      {kind === 'pause' && (
        <>
          <rect x={3} y={2.5} width={2} height={7} rx={0.6} fill="currentColor" />
          <rect x={7} y={2.5} width={2} height={7} rx={0.6} fill="currentColor" />
        </>
      )}
      {kind === 'replay' && (
        <>
          <path d="M9.6 6 A3.6 3.6 0 1 1 8.5 3.4" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
          <path d="M9.2 1.4 L9.2 4 L6.6 4" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}
