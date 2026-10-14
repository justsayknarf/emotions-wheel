import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import { motion } from 'framer-motion';
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
  replayArrived,
  replayCursor,
} from './replaySchedule';
import {
  TAIL_MS,
  STREAK_GLOW_WIDTH,
  STREAK_GLOW_OPACITY,
  STREAK_CORE_WIDTH,
  GLOW_BLUR,
  HEAD_GLOW_R,
  HEAD_CORE_R,
  QUIET_LINE_WIDTH,
  QUIET_LINE_OPACITY,
  STREAK_STOPS,
} from './cometStyle';
import { ReplayControls } from './ReplayControls';
import { useReplayScrub } from './useReplayScrub';
import type { DiaryEntry } from '../../types';
import type { TourCursor } from '../../data/reflection';

interface Props {
  entries: DiaryEntry[];    // recent window, chronological (oldest first)
  // Omitted in the reflection walk: the stars are then plain marks, out of
  // the tab order, rather than buttons that do nothing.
  onPointClick?: (entry: DiaryEntry) => void;
  // The weekly reflection walk (docs/plans/2026-10-09-001-feat-weekly-
  // reflection-journal-plan.md, KTD9) drives the same replay through these;
  // every one defaults to the ordinary replay's behavior.
  /** A soft halo marks this check-in's star, gliding when it changes. */
  highlightEntryId?: string | null;
  /** The scrubber and play/pause. Hidden in the walk. */
  showControls?: boolean;
  /** Fires once when the drawing finishes, is skipped, or resolves for reduced motion. */
  onReplayEnd?: () => void;
  /** Flipping to true jumps the drawing to its end (tap to skip). */
  jumpToEnd?: boolean;
  // The walk's replay screen (title, header, week strip, Next) adds these,
  // matching SkyReplay's.
  /** Wait this long before the first star lands: the walk's title card. */
  startDelayMs?: number;
  /** Show the whole week faintly from the start, joined by a dotted path. */
  preview?: boolean;
  /** The small day label beside each check-in. The walk names the day in its header instead. */
  showDayLabels?: boolean;
  /** Move to this check-in now (Next, or the week strip); a new object asks again. */
  goTo?: { stop: number } | null;
  /** A check-in's index as its star arrives. */
  onStop?: (stop: number) => void;
  /** Where the drawing is between check-ins, written every frame for the week strip. */
  cursor?: RefObject<TourCursor | null>;
}

// Pause before the first star lands, so the overlay's own fade-in settles first.
const START_DELAY_MS = 400;
// Landing ring: final diameter (px). It grows from a fraction of this to 1×,
// so the border ends at a crisp 1px rather than a thickened stroke.
const RING_SIZE = 36;
const RING_FROM_SCALE = 0.2;
const RING_PEAK_OPACITY = 0.55;
// The streak riding each line takes its look from cometStyle (the departure
// comet's proportions), shared with the night sky's drag trail and tag lines.

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
export function DrawnConstellation({
  entries,
  onPointClick,
  highlightEntryId = null,
  showControls = true,
  onReplayEnd,
  jumpToEnd = false,
  startDelayMs = START_DELAY_MS,
  preview = false,
  showDayLabels = true,
  goTo = null,
  onStop,
  cursor,
}: Props) {
  // Read through refs so a new callback identity never rebuilds the timeline.
  const onReplayEndRef = useRef(onReplayEnd);
  const onStopRef = useRef(onStop);
  const cursorRef = useRef(cursor);
  const startDelayRef = useRef(startDelayMs);
  useEffect(() => {
    onReplayEndRef.current = onReplayEnd;
    onStopRef.current = onStop;
    cursorRef.current = cursor;
    startDelayRef.current = startDelayMs;
  }, [onReplayEnd, onStop, cursor, startDelayMs]);
  // The last star to arrive, so onStop fires once per arrival.
  const arrivedRef = useRef(-1);
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
  const { scrubRef, ended, syncScrub } = useReplayScrub();

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
      let endFired = false;
      const fireEnd = () => {
        if (endFired) return;
        endFired = true;
        onReplayEndRef.current?.();
      };
      // The walk follows the drawing: which star has arrived, and where the
      // line is between two of them.
      const track = (time: number) => {
        const arrived = replayArrived(s, n, time);
        if (arrived !== arrivedRef.current) {
          arrivedRef.current = arrived;
          if (arrived >= 0) onStopRef.current?.(arrived);
        }
        const c = cursorRef.current;
        if (c) c.current = replayCursor(s, n, time);
      };
      const tl = createTimeline({
        autoplay: false,
        onUpdate: (t) => {
          syncScrub(t.progress);
          track(t.progress * t.duration);
        },
        onPause: () => setPlaying(false),
        onComplete: () => {
          setPlaying(false);
          fireEnd();
        },
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
        if (dayLabels[i] && showDayLabels) {
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
      const start = { timer: undefined as number | undefined };

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
      self.add('skip', () => {
        window.clearTimeout(start.timer);
        toEnd();
        setPlaying(false);
        fireEnd();
      });
      // The walk's Next: land that star now and play on from there.
      self.add('playFrom', (ms: number) => {
        window.clearTimeout(start.timer);
        tl.seek(Math.min(ms, tl.duration));
        tl.play();
        setPlaying(true);
      });

      if (reduced) {
        toEnd();
        fireEnd();
        return;
      }
      tl.seek(0);
      start.timer = window.setTimeout(() => {
        tl.play();
        setPlaying(true);
      }, startDelayRef.current);
      return () => window.clearTimeout(start.timer);
    },
    [points, dayLabels, showDayLabels],
  );

  useEffect(() => {
    if (jumpToEnd) scope.current?.methods.skip();
  }, [jumpToEnd, scope]);

  // The walk's Next (or a tap on its week strip): that star lands now.
  useEffect(() => {
    if (!goTo || n === 0) return;
    const i = Math.max(0, Math.min(goTo.stop, n - 1));
    scope.current?.methods.playFrom(replaySchedule(n).starAt(i) + LABEL_DELAY_MS);
  }, [goTo, n, scope]);

  const highlighted = highlightEntryId ? points.find((p) => p.entry.id === highlightEntryId) ?? null : null;

  if (n === 0) return null;
  const last = n - 1;

  return (
    <div ref={root} style={{ position: 'absolute', inset: 0 }}>
      {/* The walk opens on the whole week, faint: every check-in and a dotted
          path through them in time order. */}
      {preview && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
          {points.slice(1).map((p, k) => (
            <line
              key={p.entry.id}
              x1={`${points[k].lx}%`}
              y1={`${points[k].ly}%`}
              x2={`${p.lx}%`}
              y2={`${p.ly}%`}
              style={{ stroke: 'rgb(var(--ui-recorded-rgb) / 0.4)', strokeWidth: 1, strokeDasharray: '2 6' }}
            />
          ))}
          {points.map((p) => (
            <g key={p.entry.id}>
              <circle cx={`${p.lx}%`} cy={`${p.ly}%`} r={2} style={{ fill: 'rgb(var(--ui-recorded-rgb) / 0.55)' }} />
              <circle cx={`${p.lx}%`} cy={`${p.ly}%`} r={6} style={{ fill: 'none', stroke: 'rgb(var(--ui-recorded-rgb) / 0.45)', strokeWidth: 1 }} />
            </g>
          ))}
        </svg>
      )}

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
              {STREAK_STOPS.map((st) => (
                <stop key={st.at} offset={`${st.at}`} style={{ stopColor: `rgb(var(--ui-${st.channel}-rgb))`, stopOpacity: st.alpha }} />
              ))}
            </linearGradient>
          ))}
          <filter id={`rc-blur-${uid}`} filterUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={`${GLOW_BLUR}`} />
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
                style={{ stroke: `rgb(var(--ui-recorded-rgb) / ${QUIET_LINE_OPACITY})`, strokeWidth: QUIET_LINE_WIDTH, strokeLinecap: 'round' }}
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
              <line className="replay-streak" {...ends} stroke={grad} strokeWidth={STREAK_CORE_WIDTH} strokeLinecap="round" />
              <circle data-head={k} r={HEAD_GLOW_R} filter={`url(#rc-blur-${uid})`} style={{ fill: 'rgb(var(--ui-text-rgb))', opacity: 0 }} />
              <circle data-head={k} r={HEAD_CORE_R} style={{ fill: 'rgb(var(--ui-text-rgb))', opacity: 0 }} />
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
              onClick={onPointClick ? () => onPointClick(p.entry) : undefined}
              tabIndex={onPointClick ? undefined : -1}
              aria-hidden={onPointClick ? undefined : true}
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
                cursor: onPointClick ? 'pointer' : 'inherit',
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
            {dayLabels[i] && showDayLabels && (
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

      {/* The walk's current moment: a halo that glides from star to star.
          Outside the timeline, so the drawing's inline styles never touch it. */}
      {highlighted && (
        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{ left: `${highlighted.lx}%`, top: `${highlighted.ly}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          style={{
            position: 'absolute',
            width: 30,
            height: 30,
            margin: '-15px 0 0 -15px',
            borderRadius: '50%',
            border: '1px solid rgb(var(--ui-gold-rgb) / 0.8)',
            boxShadow: '0 0 18px 4px rgb(var(--ui-gold-rgb) / 0.3)',
            pointerEvents: 'none',
          }}
        />
      )}

      {showControls && (
        <ReplayControls
          playing={playing}
          ended={ended}
          scrubRef={scrubRef}
          onToggle={() => scope.current?.methods.toggle()}
          onSeek={(progress) => scope.current?.methods.seek(progress)}
        />
      )}
    </div>
  );
}
