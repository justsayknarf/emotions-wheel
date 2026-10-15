import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'framer-motion';
import { createTimeline } from 'animejs';
import { useAnimeScope } from '../../hooks/useAnimeScope';
import { useRevealTuning, cameraParamsFrom } from '../../config/revealTuning';
import { themeRgba, type ThemeChannel } from '../../config/themeColor';
import { emotions } from '../../data/emotions';
import { skyProjection, type FieldCoord, type FieldProjection } from '../../utils/skyProjection';
import { easeInOut2, easeOut2, easeOut3 } from '../../utils/comet';
import { SkyBackdrop, type SkyDeparture, type SkyStar } from '../EmotionField/SkyBackdrop';
import { SkyAurora, type SkyAuroraInputs } from '../EmotionField/SkyAurora';
import { canUseWebGL } from '../EmotionField/skyShader';
import { arcPath, blurrer, drawHead, pathEnds, pointAt, streakGradient, strokeRange, type Px, type Rgba } from '../EmotionField/skyCanvas';
import { VISUALLY_HIDDEN } from '../visuallyHidden';
import { replayDayLabels, previewPulseAt, PREVIEW_PULSE_MS, STAR_MS, LABEL_DELAY_MS, LABEL_MS, RING_DELAY_MS, RING_MS } from './replaySchedule';
import {
  skyReplayPlan,
  skyReplayFocus,
  skyReplayGlow,
  skyReplayPresence,
  skyReplayArrived,
  skyReplayCursor,
  skyReplayCamera,
  frameConstellation,
  frameBand,
  chainDraw,
  hopMs,
  OVERVIEW_FOV_MAX,
  type CameraFrame,
  type SkyReplayPlan,
} from './skyTour';
import { QUIET_LINE_OPACITY, QUIET_LINE_WIDTH, STREAK_CORE_WIDTH, STREAK_GLOW_OPACITY, STREAK_GLOW_WIDTH } from './cometStyle';
import { ReplayControls } from './ReplayControls';
import { useReplayScrub } from './useReplayScrub';
import type { DiaryEntry } from '../../types';
import type { TourCursor } from '../../data/reflection';

interface Props {
  entries: DiaryEntry[];    // recent window, chronological (oldest first)
  // Omitted in the weekly reflection walk: the sky is then something to look
  // at, not to tap, and offers no check-in buttons.
  onPointClick?: (entry: DiaryEntry) => void;
  // The weekly reflection walk drives the same tour through these (the same
  // four props DrawnConstellation takes); each defaults to the replay's own
  // behavior. docs/plans/2026-10-09-001-feat-weekly-reflection-journal-plan.md
  /** After the tour, the gaze glides to this check-in and holds it lit. */
  highlightEntryId?: string | null;
  /** The scrubber and play/pause. Hidden in the walk. */
  showControls?: boolean;
  /** Fires once when the tour finishes, is skipped, or resolves for reduced motion. */
  onReplayEnd?: () => void;
  /** Flipping to true jumps the tour to its end (tap to skip). */
  jumpToEnd?: boolean;
  // The walk's replay screen (title, header, week strip, Next) adds these.
  /** Wait this long before the tour starts: the walk's title card. */
  startDelayMs?: number;
  /**
   * Open on the whole week: faint, joined by a dotted path, with the gaze
   * wide enough to take in every check-in until the tour glides in.
   */
  preview?: boolean;
  /** The small day label beside each check-in. The walk names the day in its header instead. */
  showDayLabels?: boolean;
  /**
   * How much of the stage's top and bottom other things cover (the walk's
   * header and week strip): each check-in is framed in the band between.
   */
  frameInset?: { top: number; bottom: number };
  /** Move to this check-in now (Next, or the week strip); a new object asks again. */
  goTo?: { stop: number } | null;
  /** A check-in's index as it arrives on the tour (its constellation starts to show). */
  onStop?: (stop: number) => void;
  /** Where the tour is between check-ins, written every frame for the week strip. */
  cursor?: RefObject<TourCursor | null>;
}

// The gaze's glide to the walk's held check-in (from the replay's last day
// to the first moment, and between moments): the tour's own pace for that
// distance, kept between these bounds, eased in and out.
const HIGHLIGHT_GLIDE_MIN_MS = 900;
const HIGHLIGHT_GLIDE_MAX_MS = 1800;
// The walk's Next: the gaze flies to the next check-in at this share of the
// tour's own glide, kept between these bounds, so stepping feels quick.
const FLIGHT_SHARE = 0.35;
const FLIGHT_MIN_MS = 280;
const FLIGHT_MAX_MS = 700;
// The faint whole week the walk opens on.
const PREVIEW_PIN_ALPHA = 0.55;
const PREVIEW_RING_R = 6;
// In the week view each check-in pulses once, in time order (previewPulseAt),
// and its day label arrives with the pulse; the label fades as the tour
// reaches that check-in, since the walk's header names the day by then.
const PULSE_RING_GROW = 14;
const PREVIEW_LABEL_ALPHA = 0.75;
const PREVIEW_LABEL_FADE_MS = 600;
/** Px over which a week-view label fades as it nears the band's top or bottom edge. */
const PREVIEW_LABEL_EDGE = 16;
// Each check-in is framed so its constellation (pin and tagged words) sits
// centred and fills about half the view, zooming between these bounds; one
// without tags rests at the usual view. The walk's opening view frames the
// whole week the same way, filling more of it.
const STOP_FILL = 0.5;
const STOP_FOV_MIN = 56;
const STOP_FOV_MAX = 100;
const OVERVIEW_FILL = 0.84;
const OPENING_GLIDE_MS = 1100;
const NO_INSET = { top: 0, bottom: 0 };

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

// The walk's held check-in changing (the replay's end to the first moment,
// moment to moment, the last moment to the closing card): over the glide,
// the constellation lit before fades out in the first half, and the held one
// (with its gold ring) fades in from a third of the way, arriving with the
// camera. Once the review has begun, the tour's own light stays off.
interface HeldMix {
  from: number;
  to: number;
  /** 0..1 through the change. */
  p: number;
  /** The change from the replay into the review: the tour's light fades out during it. */
  first: boolean;
}
const NO_MIX: HeldMix = { from: -1, to: -1, p: 1, first: false };
function heldLight(mix: HeldMix) {
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const outK = 1 - easeOut2(clamp01(mix.p / 0.5));
  const inK = easeOut2(clamp01((mix.p - 0.35) / 0.65));
  const reviewing = mix.first || mix.from >= 0 || mix.to >= 0;
  // The tour's light: full during the replay, fading as the review begins,
  // and off for the rest of the walk.
  const tourK = !reviewing ? 1 : mix.first ? outK : 0;
  return {
    inK,
    outK,
    /** How much of the tour's own light check-in i keeps; the held one keeps all it had. */
    keep: (i: number) => (i === mix.to ? 1 : tourK),
    /** How lit check-in i is as the held one, arriving or leaving. */
    held: (i: number) => (i === mix.to ? inK : i === mix.from ? outK : 0),
  };
}

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
export function SkyReplay({
  entries,
  onPointClick,
  highlightEntryId = null,
  showControls = true,
  onReplayEnd,
  jumpToEnd = false,
  startDelayMs = START_DELAY_MS,
  preview = false,
  showDayLabels = true,
  frameInset = NO_INSET,
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
  // The last check-in to arrive, so onStop fires once per arrival.
  const arrivedRef = useRef(-1);
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

  // The camera as last shown, and the walk's held view (see `hi`). Skipping
  // to the end of the tour mustn't jump the camera to the last check-in: it
  // holds where it is until the glide to the held check-in takes over.
  // A glide in flight (the opening, or Next) is cancelled too: its finish
  // would otherwise restart the tour behind the walk's moments.
  const [heldCam, setHeldCam] = useState<CameraFrame | null>(null);
  const [move, setMove] = useState<CameraFrame | null>(null);
  const moveRaf = useRef(0);
  const shownLook = useRef<FieldCoord>({ x: 0, y: 0 });
  const shownFov = useRef(params.fovRest);
  const holdCamera = useCallback(() => {
    cancelAnimationFrame(moveRaf.current);
    setMove(null);
    setHeldCam({ look: shownLook.current, fov: shownFov.current });
  }, []);

  // The walk opens on the whole week (see `overview`); the timeline's start
  // delay ending sets `begun`, and the gaze glides in before the tour plays.
  const [opening, setOpening] = useState(() => preview && !reducedMotion);
  const [begun, setBegun] = useState(false);
  const holdForOpening = useRef(opening);

  const { root, scope } = useAnimeScope<HTMLDivElement>(
    (self, reduced) => {
      if (plan.total === 0) return;
      const clock = { t: 0 };
      let endFired = false;
      const fireEnd = () => {
        if (endFired) return;
        endFired = true;
        onReplayEndRef.current?.();
      };
      // The walk follows the tour: which check-in has arrived, and where the
      // gaze is between two of them.
      const track = (at: number) => {
        const arrived = skyReplayArrived(plan, at);
        if (arrived !== arrivedRef.current) {
          arrivedRef.current = arrived;
          if (arrived >= 0) onStopRef.current?.(arrived);
        }
        const c = cursorRef.current;
        if (c) c.current = skyReplayCursor(plan, at);
      };
      const tl = createTimeline({
        autoplay: false,
        onUpdate: (tm) => {
          syncScrub(tm.progress);
          setT(tm.progress * plan.total);
          track(tm.progress * plan.total);
        },
        onPause: () => setPlaying(false),
        onComplete: () => {
          setPlaying(false);
          fireEnd();
        },
      });
      tl.add(clock, { t: [0, plan.total], duration: plan.total, ease: 'linear' }, 0);

      const toEnd = () => {
        tl.pause();
        tl.seek(tl.duration);
      };
      const start = { timer: undefined as number | undefined };
      self.add('skip', () => {
        window.clearTimeout(start.timer);
        holdCamera();
        toEnd();
        setPlaying(false);
        fireEnd();
      });
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
      // The walk's Next: hold the tour while the gaze flies, then play on.
      self.add('pause', () => {
        window.clearTimeout(start.timer);
        tl.pause();
      });
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
        // Opening on the whole week, the glide in comes first (see `begun`).
        if (holdForOpening.current) {
          setBegun(true);
          return;
        }
        tl.play();
        setPlaying(true);
      }, startDelayRef.current);
      return () => window.clearTimeout(start.timer);
    },
    [plan],
  );

  useEffect(() => {
    if (jumpToEnd) scope.current?.methods.skip();
  }, [jumpToEnd, scope]);

  // The stage's size, for the projection and the canvas.
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    obs.observe(el);
    return () => obs.disconnect();
  }, [root]);

  // The walk's current moment: once set, the gaze glides from wherever it is
  // to that check-in and holds there, its constellation lit.
  const hi = highlightEntryId ? points.findIndex((p) => p.entry.id === highlightEntryId) : -1;
  // Each check-in's framing: its constellation centred in the band the
  // walk's header and strip leave, zoomed to fill about half of it.
  const { top: insetTop, bottom: insetBottom } = frameInset;
  const stage = useMemo(
    () => ({ width: size.width, height: size.height, top: insetTop, bottom: insetBottom }),
    [size.width, size.height, insetTop, insetBottom],
  );
  const frames = useMemo<CameraFrame[]>(
    () =>
      points.map((p) =>
        frameConstellation([p.pin, ...p.words], params.lookMax, { min: STOP_FOV_MIN, max: STOP_FOV_MAX, single: params.fovRest }, stage, STOP_FILL),
      ),
    [points, params.lookMax, params.fovRest, stage],
  );

  // The held check-in changing: the gaze glides there (or, leaving for the
  // closing card, holds where it is) while the lights cross over (heldLight).
  const [mix, setMix] = useState<HeldMix>(NO_MIX);
  const lastHi = useRef(-1);
  const reviewed = useRef(false);
  useEffect(() => {
    const prev = lastHi.current;
    lastHi.current = hi;
    const changed = prev !== hi;
    const first = changed && hi >= 0 && !reviewed.current;
    if (hi >= 0) reviewed.current = true;
    const to = hi >= 0 ? frames[hi] ?? null : null;
    if (!changed && !to) return;
    const from = { look: shownLook.current, fov: shownFov.current };
    const ms = reducedMotion
      ? 0
      : to
        ? Math.max(HIGHLIGHT_GLIDE_MIN_MS, Math.min(HIGHLIGHT_GLIDE_MAX_MS, hopMs(from.look, to.look)))
        : HIGHLIGHT_GLIDE_MIN_MS;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = ms === 0 ? 1 : Math.min(1, (now - t0) / ms);
      if (to) {
        const k = easeInOut2(p);
        setHeldCam({
          look: { x: from.look.x + (to.look.x - from.look.x) * k, y: from.look.y + (to.look.y - from.look.y) * k },
          fov: from.fov + (to.fov - from.fov) * k,
        });
      }
      // A re-framing (a resize) re-glides without restarting the lights, but
      // still lets an interrupted cross-over finish.
      if (changed) setMix({ from: prev, to: hi, p, first });
      else if (p >= 1) setMix((m) => (m.p < 1 ? { ...m, p: 1 } : m));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [hi, frames, reducedMotion]);

  // The walk's camera moves that the tour's playhead doesn't cover: the
  // opening view of the whole week, the glide from it into the tour, and
  // Next's quick flights. While one runs it overrides the tour's camera.
  useEffect(() => () => cancelAnimationFrame(moveRaf.current), []);
  const glide = useCallback(
    (to: CameraFrame, ms: number, onFrame: (k: number) => void, done: () => void) => {
      cancelAnimationFrame(moveRaf.current);
      const from = { look: shownLook.current, fov: shownFov.current };
      const t0 = performance.now();
      const step = (now: number) => {
        const k = ms <= 0 ? 1 : Math.min(1, (now - t0) / ms);
        const e = easeInOut2(k);
        onFrame(e);
        if (k < 1) {
          setMove({
            look: { x: from.look.x + (to.look.x - from.look.x) * e, y: from.look.y + (to.look.y - from.look.y) * e },
            fov: from.fov + (to.fov - from.fov) * e,
          });
          moveRaf.current = requestAnimationFrame(step);
        } else {
          setMove(null);
          done();
        }
      };
      moveRaf.current = requestAnimationFrame(step);
    },
    [],
  );

  // The walk opens on the whole week: while its title shows, the gaze takes
  // in every check-in, then glides in to the first as the tour begins.
  const overview = useMemo(
    () =>
      preview && points.length > 1
        ? frameConstellation(points.map((p) => p.pin), params.lookMax, { min: params.fovRest, max: OVERVIEW_FOV_MAX, single: params.fovRest }, stage, OVERVIEW_FILL)
        : null,
    [preview, points, params.lookMax, params.fovRest, stage],
  );
  // The week view's one pulse: a clock that runs only while it plays, since
  // nothing else redraws the canvas while the view holds still.
  const hasOverview = overview !== null;
  const [pulseAt, setPulseAt] = useState(-1);
  useEffect(() => {
    if (!opening || !hasOverview || reducedMotion) return;
    const end = previewPulseAt(points.length - 1, points.length) + PREVIEW_PULSE_MS;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const e = now - t0;
      setPulseAt(Math.min(e, end));
      if (e < end) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [opening, hasOverview, reducedMotion, points.length]);

  // Glide in once, whatever else changes afterwards. The opening view stays
  // on screen until the glide takes over (the glide starts from it), and a
  // week with no opening view still passes through here, at no length, so
  // `opening` only ever ends inside an animation frame.
  const glidedIn = useRef(false);
  useEffect(() => {
    if (!begun || glidedIn.current || frames.length === 0) return;
    glidedIn.current = true;
    glide(frames[0], opening && overview ? OPENING_GLIDE_MS : 0, () => {}, () => {
      setOpening(false);
      scope.current?.methods.playFrom(0);
    });
  }, [begun, opening, overview, frames, glide, scope]);

  // The walk's Next (or a tap on its week strip): the gaze flies to that
  // check-in at a quick pace, then the tour plays on from its arrival. Each
  // request flies once: a re-framing (a resize) must not replay it, least of
  // all after Skip, when it would restart the tour under the moments.
  const flownTo = useRef<{ stop: number } | null>(null);
  useEffect(() => {
    if (!goTo || goTo === flownTo.current || plan.total === 0) return;
    flownTo.current = goTo;
    const i = Math.max(0, Math.min(goTo.stop, frames.length - 1));
    const to = frames[i];
    if (!to) return;
    scope.current?.methods.pause();
    const fromStop = Math.max(0, arrivedRef.current);
    const dur = reducedMotion ? 0 : Math.max(FLIGHT_MIN_MS, Math.min(FLIGHT_MAX_MS, hopMs(shownLook.current, to.look) * FLIGHT_SHARE));
    glide(
      to,
      dur,
      (e) => {
        const c = cursorRef.current;
        if (c) c.current = { from: fromStop, to: i, along: e };
      },
      () => {
        setOpening(false);
        scope.current?.methods.playFrom(plan.revealAt[i]);
      },
    );
  }, [goTo, plan, frames, reducedMotion, scope, glide]);

  const resting = opening && overview ? overview : null;
  const tourCam = skyReplayCamera(plan, frames, t);
  const cam: CameraFrame =
    heldCam ?? move ?? resting ?? tourCam ?? { look: { x: 0, y: 0 }, fov: params.fovRest };
  const look = cam.look;
  const fov = cam.fov;
  useLayoutEffect(() => {
    shownLook.current = look;
    shownFov.current = fov;
  });
  const proj = useMemo(
    () => skyProjection({ look: { x: look.x, y: look.y }, fovDeg: fov, width: size.width, height: size.height, viewport: frameBand(stage) }),
    [look.x, look.y, fov, size.width, size.height, stage],
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
  const light = heldLight(mix);
  const litKey = points.map((_, i) => (light.held(i) > 0.3 || skyReplayGlow(plan, i, t) * light.keep(i) > 0 ? '1' : '0')).join('');
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
    drawTour(ctx, { proj, plan, points, dayLabels, showDayLabels, t, mix, preview, pulseAt, band: frameBand(stage), rgba, blur: blurrer(ctx, dpr, rgba), font });
  }, [proj, plan, points, dayLabels, showDayLabels, t, mix, preview, pulseAt, stage, size]);

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
        onClick={onPointClick ? (e) => { const hit = hitAt(e); if (hit) onPointClick(hit); } : undefined}
        onPointerMove={onPointClick ? (e) => { e.currentTarget.style.cursor = hitAt(e) ? 'pointer' : 'default'; } : undefined}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
      />

      {/* The canvas can't be tabbed to: the same check-ins as buttons for
          keyboard and screen-reader users, in time order. */}
      {onPointClick && <div style={VISUALLY_HIDDEN}>
        {points.map((p, i) => (
          <button
            key={p.entry.id}
            onClick={() => onPointClick(p.entry)}
            aria-current={i === focus ? 'true' : undefined}
          >
            {`Check-in ${i + 1}${dayLabels[i] ? `, ${dayLabels[i]!.toLowerCase()}` : ''}${p.words.length ? `: ${p.words.map((w) => w.label).join(', ')}` : ''}${i === last ? ' (latest)' : ''}`}
          </button>
        ))}
      </div>}

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

function drawTour(
  ctx: CanvasRenderingContext2D,
  o: {
    proj: FieldProjection;
    plan: SkyReplayPlan;
    points: Point[];
    dayLabels: (string | null)[];
    /** The small day label beside each landed star. */
    showDayLabels: boolean;
    t: number;
    /** The walk's held check-in and the one before it, crossing over (heldLight). */
    mix: HeldMix;
    /** The whole week drawn faintly beneath the tour, labelled by day. */
    preview: boolean;
    /** Time into the week view's pulse, ms; -1 when it isn't playing (no pulse, labels shown). */
    pulseAt: number;
    /** The band the stage's overlays leave clear; week-view labels fade out at its edges. */
    band: { top: number; height: number };
    rgba: Rgba;
    blur: (fn: () => void) => void;
    font: string;
  },
) {
  const { proj, plan, points, dayLabels, showDayLabels, t, mix, preview, pulseAt, band, rgba, blur, font } = o;
  const light = heldLight(mix);
  const last = points.length - 1;

  // The walk opens on the whole week, faint: every check-in marked with a
  // small ring (a check-in, not one more star), each pulsing once in time
  // order with its day label arriving alongside. A label fades as the tour
  // reaches its check-in.
  if (preview) {
    points.forEach((p, i) => {
      const q = proj.toPx(p.pin);
      if (!q.visible) return;
      let swell = 0, ring = -1, labelIn = 1;
      if (pulseAt >= 0) {
        const u = (pulseAt - previewPulseAt(i, points.length)) / PREVIEW_PULSE_MS;
        labelIn = Math.max(0, Math.min(1, u * 2.5));
        if (u > 0 && u < 1) {
          swell = Math.sin(Math.PI * u);
          ring = easeOut3(u);
        }
      }
      ctx.fillStyle = rgba('recorded', Math.min(1, PREVIEW_PIN_ALPHA * (1 + swell)));
      ctx.beginPath(); ctx.arc(q.x, q.y, 2 + 1.2 * swell, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba('recorded', PREVIEW_PIN_ALPHA * 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, PREVIEW_RING_R, 0, Math.PI * 2); ctx.stroke();
      if (ring >= 0) {
        ctx.strokeStyle = rgba('recorded', 0.6 * (1 - ring));
        ctx.beginPath(); ctx.arc(q.x, q.y, PREVIEW_RING_R + PULSE_RING_GROW * ring, 0, Math.PI * 2); ctx.stroke();
      }
      const label = dayLabels[i];
      if (!label) return;
      const reviewed = t > plan.land[i] ? Math.min(1, (t - plan.land[i]) / PREVIEW_LABEL_FADE_MS) : 0;
      // Clear of the walk's header and strip, so a day still to come can't
      // read as part of the header naming the day in view.
      const labelY = q.y - PREVIEW_RING_R - 5;
      const clear = Math.min(
        Math.max(0, Math.min(1, (labelY - 10 - band.top) / PREVIEW_LABEL_EDGE)),
        Math.max(0, Math.min(1, (band.top + band.height - q.y) / PREVIEW_LABEL_EDGE)),
      );
      const a = PREVIEW_LABEL_ALPHA * labelIn * (1 - reviewed) * clear;
      if (a <= 0.01) return;
      ctx.font = `500 9px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      if ('letterSpacing' in ctx) (ctx as { letterSpacing: string }).letterSpacing = '0.12em';
      ctx.fillStyle = rgba('text', a);
      ctx.fillText(label, q.x, q.y - PREVIEW_RING_R - 5);
      if ('letterSpacing' in ctx) (ctx as { letterSpacing: string }).letterSpacing = '0px';
    });
  }

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
    const g = Math.max(skyReplayGlow(plan, i, t) * light.keep(i), light.held(i));
    const on = Math.max(skyReplayPresence(plan, i, t) * light.keep(i), light.held(i));
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

    const label = showDayLabels ? dayLabels[i] : null;
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

  // The walk's current moment: a soft gold ring around its star, fading in
  // with its constellation (and out with the one it replaces).
  for (const [i, a] of [[mix.to, light.inK], [mix.from, light.outK]] as const) {
    if (i < 0 || !points[i] || a <= 0.01) continue;
    const q = proj.toPx(points[i].pin);
    if (!q.visible) continue;
    blur(() => {
      ctx.strokeStyle = rgba('gold', 0.6 * a);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(q.x, q.y, 16, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.strokeStyle = rgba('gold', 0.85 * a);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(q.x, q.y, 16, 0, Math.PI * 2); ctx.stroke();
  }
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
