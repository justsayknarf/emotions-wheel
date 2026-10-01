import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { createTimeline } from 'animejs';
import { useAnimeScope } from '../../hooks/useAnimeScope';
import { useRevealTuning, cameraParamsFrom } from '../../config/revealTuning';
import { themeRgba, type ThemeChannel } from '../../config/themeColor';
import { emotions } from '../../data/emotions';
import { skyProjection, type FieldCoord, type FieldProjection } from '../../utils/skyProjection';
import { easeOut2, easeOut3 } from '../../utils/comet';
import { SkyBackdrop, type SkyDeparture, type SkyStar } from '../EmotionField/SkyBackdrop';
import { SkyAurora, type SkyAuroraInputs } from '../EmotionField/SkyAurora';
import { canUseWebGL } from '../EmotionField/skyShader';
import { arcPath, blurrer, drawHead, pathEnds, pointAt, streakGradient, strokeRange, type Px, type Rgba } from '../EmotionField/skyCanvas';
import { VISUALLY_HIDDEN } from '../visuallyHidden';
import { replayDayLabels, STAR_MS, LABEL_DELAY_MS, LABEL_MS, RING_DELAY_MS, RING_MS } from './replaySchedule';
import { skyReplayPlan, skyReplayFocus, skyReplayLook, skyReplayGlow, skyReplayPresence, chainDraw, type SkyReplayPlan } from './skyTour';
import { QUIET_LINE_OPACITY, QUIET_LINE_WIDTH, STREAK_CORE_WIDTH, STREAK_GLOW_OPACITY, STREAK_GLOW_WIDTH } from './cometStyle';
import { ReplayControls } from './ReplayControls';
import { useReplayScrub } from './useReplayScrub';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];    // recent window, chronological (oldest first)
  onPointClick: (entry: DiaryEntry) => void;
}

// Pause before the tour starts, so the overlay's own fade-in settles first.
const START_DELAY_MS = 400;
// A tap within this many px of a landed check-in opens it.
const HIT_PX = 20;
// The landing ring's final radius (px); it grows from RING_FROM of it.
const RING_R = 18;
const RING_FROM = 0.2;
const RING_PEAK_ALPHA = 0.55;
// A lit constellation: its lines and the halos on its tagged stars, at full
// glow. The pulse (skyReplayGlow) scales all of them together.
const LIT_LINE_WIDTH = 1.5;
const LIT_LINE_ALPHA = 0.9;
const LIT_GLOW_WIDTH = 6;
const LIT_GLOW_ALPHA = 0.45;
const LIT_HALO_R = 16;
const LIT_HALO_ALPHA = 0.55;
const PIN_HALO_R = 22;

const NO_DEPARTURE: SkyDeparture = { play: 0, from: null, to: null, travel: 0, trail: 0, hold: 0, fadeOut: 0, strength: 0 };
const emotionById = new Map(emotions.map((e) => [e.id, e]));

interface Point {
  entry: DiaryEntry;
  pin: FieldCoord;
  words: Array<FieldCoord & { id: string; label: string }>;
}

// The constellation replay in the night sky: the same sky the field draws
// (SkyAurora + SkyBackdrop), toured one check-in at a time. The gaze glides
// from each check-in to the next with the replay's comet riding the great
// circle between them; the star lands and its tagged words fade in together,
// every line at once, as a constellation (pin → tag → tag, the field's own
// chain), so each check-in reads as a different constellation in the sky.
// It pulses while it is the one in view, then fades as the gaze moves on. The tour ends on the newest check-in, lit.
//
// One anime.js timeline drives a playhead; everything on screen, the camera
// included, is a pure function of it (skyReplay.ts), so the scrubber seeks
// exactly. Reduced motion shows the end of the tour; the scrubber can still
// seek it.
export function SkyReplay({ entries, onPointClick }: Props) {
  const tuning = useRevealTuning();
  const params = useMemo(() => cameraParamsFrom(tuning), [tuning]);
  const reducedMotion = !!useReducedMotion();

  const points = useMemo<Point[]>(
    () =>
      entries
        .map((entry) => {
          const pin = entry.pins.at(-1);
          if (!pin) return null;
          const wordIds = [...new Set(entry.pins.flatMap((p) => p.recognizedWords))];
          const words = wordIds
            .map((id) => emotionById.get(id))
            .filter((e): e is NonNullable<typeof e> => Boolean(e))
            .map((e) => ({ id: e.id, label: e.label, x: e.x, y: e.y }));
          return { entry, pin: { x: pin.x, y: pin.y }, words };
        })
        .filter((p): p is Point => p !== null),
    [entries],
  );
  const dayLabels = useMemo(
    () => replayDayLabels(points.map((p) => p.entry.timestamp), new Date()),
    [points],
  );
  const plan = useMemo(
    () => skyReplayPlan(points.map((p) => ({ pin: p.pin, tags: p.words.length })), params.lookMax),
    [points, params.lookMax],
  );

  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { scrubRef, ended, syncScrub } = useReplayScrub();

  const { root, scope } = useAnimeScope<HTMLDivElement>(
    (self, reduced) => {
      if (plan.total === 0) return;
      const clock = { t: 0 };
      const tl = createTimeline({
        autoplay: false,
        onUpdate: (tm) => {
          syncScrub(tm.progress);
          setT(tm.progress * plan.total);
        },
        onPause: () => setPlaying(false),
        onComplete: () => setPlaying(false),
      });
      tl.add(clock, { t: [0, plan.total], duration: plan.total, ease: 'linear' }, 0);

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
    [plan],
  );

  // The stage's size, for the projection and the canvas.
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    obs.observe(el);
    return () => obs.disconnect();
  }, [root]);

  const look = skyReplayLook(plan, t);
  const proj = useMemo(
    () => skyProjection({ look: { x: look.x, y: look.y }, fovDeg: params.fovRest, width: size.width, height: size.height }),
    [look.x, look.y, params.fovRest, size.width, size.height],
  );

  // The WebGL sky beneath, as the field draws it; without WebGL the 2D
  // backdrop paints the sky instead.
  const [webgl, setWebgl] = useState(() => canUseWebGL());
  const onAuroraUnavailable = useCallback(() => setWebgl(false), []);
  const auroraInputs = useRef<SkyAuroraInputs>({ proj, moving: false, swell: 0 });
  const auroraInvalidate = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (auroraInputs.current.proj === proj) return;
    auroraInputs.current.proj = proj;
    if (reducedMotion) auroraInvalidate.current?.();
  });

  // Every emotion is a star; a lit constellation's words turn the recorded
  // teal, as tagged words do on the field. Keyed on which check-ins are lit
  // so a frame of playback doesn't rebuild the list.
  const litKey = points.map((_, i) => (skyReplayGlow(plan, i, t) > 0 ? '1' : '0')).join('');
  const stars = useMemo<SkyStar[]>(() => {
    const lit = new Set<string>();
    points.forEach((p, i) => {
      if (litKey[i] === '1') for (const w of p.words) lit.add(w.id);
    });
    return emotions.map((e) => ({ id: e.id, x: e.x, y: e.y, surface: e.depth === 'surface', tagged: lit.has(e.id), revealed: lit.has(e.id) }));
  }, [points, litKey]);

  // The tour itself, redrawn whenever the playhead or the camera moves.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const cv = canvasRef.current;
    if (!cv || size.width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(size.width * dpr) || cv.height !== Math.round(size.height * dpr)) {
      cv.width = Math.round(size.width * dpr);
      cv.height = Math.round(size.height * dpr);
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    const base: Partial<Record<ThemeChannel, string>> = {};
    const rgba: Rgba = (ch, a) => `${(base[ch] ??= themeRgba(ch, 1).slice(0, -2))}${a})`;
    const font = getComputedStyle(cv).fontFamily;
    drawTour(ctx, { proj, plan, points, dayLabels, t, rgba, blur: blurrer(ctx, dpr, rgba), font });
  }, [proj, plan, points, dayLabels, t, size]);

  // Tapping near a landed check-in opens it.
  const hitAt = (e: React.PointerEvent | React.MouseEvent): DiaryEntry | null => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best: DiaryEntry | null = null, bestD = HIT_PX;
    points.forEach((p, i) => {
      if (t < plan.land[i]) return;
      const q = proj.toPx(p.pin);
      const d = q.visible ? Math.hypot(q.x - x, q.y - y) : Infinity;
      if (d < bestD) { bestD = d; best = p.entry; }
    });
    return best;
  };

  if (points.length === 0) return null;
  const last = points.length - 1;
  const focus = skyReplayFocus(plan, t);

  return (
    <div ref={root} style={{ position: 'absolute', inset: 0 }}>
      {webgl && <SkyAurora inputs={auroraInputs} invalidateRef={auroraInvalidate} reducedMotion={reducedMotion} onUnavailable={onAuroraUnavailable} />}
      <SkyBackdrop
        proj={proj}
        size={size}
        stars={stars}
        constellation={[]}
        departure={NO_DEPARTURE}
        reducedMotion={reducedMotion}
        paintSky={!webgl}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        onClick={(e) => { const hit = hitAt(e); if (hit) onPointClick(hit); }}
        onPointerMove={(e) => { e.currentTarget.style.cursor = hitAt(e) ? 'pointer' : 'default'; }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
      />

      {/* The canvas can't be tabbed to: the same check-ins as buttons for
          keyboard and screen-reader users, in time order. */}
      <div style={VISUALLY_HIDDEN}>
        {points.map((p, i) => (
          <button
            key={p.entry.id}
            onClick={() => onPointClick(p.entry)}
            aria-current={i === focus ? 'true' : undefined}
          >
            {`Check-in ${i + 1}${dayLabels[i] ? `, ${dayLabels[i]!.toLowerCase()}` : ''}${p.words.length ? `: ${p.words.map((w) => w.label).join(', ')}` : ''}${i === last ? ' (latest)' : ''}`}
          </button>
        ))}
      </div>

      <ReplayControls
        playing={playing}
        ended={ended}
        scrubRef={scrubRef}
        onToggle={() => scope.current?.methods.toggle()}
        onSeek={(progress) => scope.current?.methods.seek(progress)}
      />
    </div>
  );
}

function drawTour(
  ctx: CanvasRenderingContext2D,
  o: {
    proj: FieldProjection;
    plan: SkyReplayPlan;
    points: Point[];
    dayLabels: (string | null)[];
    t: number;
    rgba: Rgba;
    blur: (fn: () => void) => void;
    font: string;
  },
) {
  const { proj, plan, points, dayLabels, t, rgba, blur, font } = o;
  const last = points.length - 1;

  // The chain between check-ins: the replay's comet rides each hop in with
  // the gaze, leaving the quiet line behind.
  for (let i = 1; i < points.length; i++) {
    const d = chainDraw(plan, i, t);
    if (!d) break;
    const path = arcPath(proj, points[i - 1].pin, points[i].pin);
    strokeRange(ctx, path, 0, d.quiet, rgba('recorded', QUIET_LINE_OPACITY), QUIET_LINE_WIDTH);
    drawStreak(ctx, path, d, rgba, blur);
  }

  // Lit constellations: pin → tag → tag, every line at once, fading in
  // together as the check-in lands so each one reads as its own
  // constellation in the sky. The light (lines, halos) pulses with
  // skyReplayGlow; the words and star cores hold steady on presence.
  points.forEach((p, i) => {
    const g = skyReplayGlow(plan, i, t);
    const on = skyReplayPresence(plan, i, t);
    if (on <= 0) return;
    const chain: FieldCoord[] = [p.pin, ...p.words];
    const pinPx = proj.toPx(p.pin);
    if (pinPx.visible) {
      // The check-in itself breathes with its constellation.
      const halo = ctx.createRadialGradient(pinPx.x, pinPx.y, 0, pinPx.x, pinPx.y, PIN_HALO_R);
      const ch: ThemeChannel = i === last ? 'gold' : 'recorded';
      halo.addColorStop(0, rgba(ch, 0.4 * g));
      halo.addColorStop(1, rgba(ch, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(pinPx.x - PIN_HALO_R, pinPx.y - PIN_HALO_R, PIN_HALO_R * 2, PIN_HALO_R * 2);
    }
    for (let k = 0; k + 1 < chain.length; k++) {
      const path = arcPath(proj, chain[k], chain[k + 1]);
      blur(() => strokeRange(ctx, path, 0, 1, rgba('recorded', 1), LIT_GLOW_WIDTH, LIT_GLOW_ALPHA * g));
      strokeRange(ctx, path, 0, 1, rgba('recorded', LIT_LINE_ALPHA * g), LIT_LINE_WIDTH);
    }
    ctx.font = `400 12px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const w of p.words) {
      const q = proj.toPx(w);
      if (!q.visible) continue;
      const halo = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, LIT_HALO_R);
      halo.addColorStop(0, rgba('recorded', LIT_HALO_ALPHA * g));
      halo.addColorStop(1, rgba('recorded', 0));
      ctx.fillStyle = halo;
      ctx.fillRect(q.x - LIT_HALO_R, q.y - LIT_HALO_R, LIT_HALO_R * 2, LIT_HALO_R * 2);
      ctx.fillStyle = rgba('text', on);
      ctx.beginPath(); ctx.arc(q.x, q.y, 1.6 + 0.6 * g, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgba('recorded', on);
      ctx.shadowColor = rgba('recorded', 0.55 * g);
      ctx.shadowBlur = 10;
      ctx.fillText(w.label, q.x, q.y + 7);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }
  });

  // The check-in stars, each landing as its comet arrives: a quick swell (no
  // overshoot), a ring pulsing out once, then its day label.
  points.forEach((p, i) => {
    const at = plan.land[i];
    if (t < at) return;
    const q = proj.toPx(p.pin);
    if (!q.visible) return;
    const isNow = i === last;
    const ch: ThemeChannel = isNow ? 'gold' : 'recorded';
    const grow = easeOut3(Math.min(1, (t - at) / STAR_MS));
    const r = (isNow ? 4.5 : 3) * grow;
    const glowR = (isNow ? 14 : 9) * grow;
    if (glowR > 0) {
      const halo = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, glowR);
      halo.addColorStop(0, rgba(ch, 0.55 * grow));
      halo.addColorStop(1, rgba(ch, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(q.x - glowR, q.y - glowR, glowR * 2, glowR * 2);
    }
    ctx.fillStyle = rgba(ch, isNow ? grow : 0.9 * grow);
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();

    const ru = (t - at - RING_DELAY_MS) / RING_MS;
    if (ru > 0 && ru < 1) {
      const e = easeOut3(ru);
      ctx.strokeStyle = rgba(ch, RING_PEAK_ALPHA * (1 - e));
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, RING_R * (RING_FROM + (1 - RING_FROM) * e), 0, Math.PI * 2); ctx.stroke();
    }

    const label = dayLabels[i];
    const lu = (t - at - LABEL_DELAY_MS) / LABEL_MS;
    if (label && lu > 0) {
      ctx.font = `500 8px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if ('letterSpacing' in ctx) (ctx as { letterSpacing: string }).letterSpacing = '0.12em';
      ctx.fillStyle = isNow ? rgba('gold', 0.7 * easeOut2(Math.min(1, lu))) : rgba('text', 0.55 * easeOut2(Math.min(1, lu)));
      ctx.fillText(label, q.x, q.y - 22);
      if ('letterSpacing' in ctx) (ctx as { letterSpacing: string }).letterSpacing = '0px';
    }
  });
}

// The departure comet's look riding a path: the streak and its glow over
// tail..head, and the head itself.
function drawStreak(
  ctx: CanvasRenderingContext2D,
  path: Px[],
  d: { head: number; tail: number; headAlpha: number },
  rgba: Rgba,
  blur: (fn: () => void) => void,
) {
  const ends = pathEnds(path);
  if (ends && d.head > d.tail) {
    const grad = streakGradient(ctx, ends[0], ends[1], rgba);
    if (grad) {
      blur(() => strokeRange(ctx, path, d.tail, d.head, grad, STREAK_GLOW_WIDTH, STREAK_GLOW_OPACITY));
      strokeRange(ctx, path, d.tail, d.head, grad, STREAK_CORE_WIDTH);
    }
  }
  const h = pointAt(path, d.head);
  if (h && d.headAlpha > 0) drawHead(ctx, h, d.headAlpha, rgba, blur);
}
