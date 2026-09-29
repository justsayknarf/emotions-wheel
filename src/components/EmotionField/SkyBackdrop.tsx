import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { themeRgba, type ThemeChannel } from '../../config/themeColor';
import { dirToField, fieldToDir, greatCircle, mulberry32, type FieldCoord, type FieldProjection, type Vec3 } from '../../utils/skyProjection';
import { pruneTrail, segmentDone, segmentDraw, trailWindow, type TrailPoint } from '../../utils/comet';
import {
  GLOW_BLUR,
  HEAD_CORE_R,
  HEAD_GLOW_R,
  LINE_MS,
  QUIET_LINE_OPACITY,
  QUIET_LINE_WIDTH,
  STREAK_CORE_WIDTH,
  STREAK_GLOW_OPACITY,
  STREAK_GLOW_WIDTH,
  STREAK_STOPS,
  TAIL_MS,
} from '../Constellation/cometStyle';

export interface SkyStar {
  id: string;
  x: number;
  y: number;
  surface: boolean;
  tagged: boolean;
  revealed: boolean;
}

interface Props {
  proj: FieldProjection;
  size: { width: number; height: number };
  stars: SkyStar[];
  // Pin first, then its recognized words in tag order (R8). `key` names each
  // star (`pin:<id>` for the pin, the emotion id for a word), so a segment is
  // known by its two ends across renders.
  constellation: ConstellationStar[];
  liveDraft: FieldCoord | null;
  reducedMotion: boolean;
  // Paint the soft sky (gradient, horizon haze, band) here. False when the
  // WebGL SkyAurora layer beneath paints it instead; this canvas then only
  // clears and draws the crisp layers on top.
  paintSky: boolean;
}

// The night sky behind the words: a seeded starfield, every emotion as a star,
// the constellation chain and the live draft's comet trail. Words themselves
// stay DOM (EmotionWord). The soft sky (gradient deepest at the zenith, warm
// horizon glow, milky way, aurora) is SkyAurora's WebGL shader beneath this
// canvas; only without WebGL (`paintSky`) does this canvas paint a 2D
// stand-in: an opaque gradient, a warm glow hugging the horizon and a
// barely-there band of faint dots along a tilted great circle.
export function SkyBackdrop({ proj, size, stars, constellation, liveDraft, reducedMotion, paintSky }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // The live draft's recent positions, one per change (ms, rAF clock).
  const trail = useRef<TrailPoint[]>([]);

  // The constellation's segments by `from→to` key. `born` is when an animated
  // segment appeared (performance.now clock, which rAF shares); null draws it
  // at rest. Removed segments fade out from `gone`.
  const segs = useRef(new Map<string, Segment>());
  const gone = useRef<Array<Segment & { at: number }>>([]);
  const owner = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    const now = performance.now();
    const nextOwner = constellation[0]?.key ?? null;
    // Only a change to the chain already on screen animates: a first render,
    // a reopened check-in or switching to another pin's chain draws at rest.
    const live = owner.current !== undefined && owner.current !== null && owner.current === nextOwner && !reducedMotion;
    owner.current = nextOwner;
    const next = new Map<string, Segment>();
    for (let i = 1; i < constellation.length; i++) {
      const a = constellation[i - 1], b = constellation[i];
      const key = `${a.key}→${b.key}`;
      const had = segs.current.get(key);
      next.set(key, { a, b, born: had ? had.born : live ? now : null });
    }
    for (const [key, sg] of segs.current) if (!next.has(key) && live) gone.current.push({ ...sg, at: now });
    if (!live) gone.current = [];
    segs.current = next;
  }, [constellation, reducedMotion]);

  // A fixed sky: same stars on every load (R5).
  const field = useMemo(() => {
    const rnd = mulberry32(20260928);
    return Array.from({ length: 1100 }, () => {
      const u = rnd() * 1.08 - 0.08, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      return { d: [s * Math.cos(a), u, s * Math.sin(a)] as Vec3, a: rnd() ** 3 * 0.55 + 0.06, big: rnd() > 0.93, ph: rnd() * 6.283 };
    });
  }, []);

  // The band (R5): faint dots scattered around a tilted great circle with a
  // triangular spread (±BAND_SPREAD rad, densest on the spine); every 9th
  // sample is a soft haze puff instead of a dot. Same recipe as the approved
  // mock (shape study).
  const band = useMemo(() => {
    const rnd = mulberry32(19690720);
    const n = norm([0.42, 0.62, -0.66]);
    const a = norm([n[1], -n[0], 0]);
    const b = cross(n, a);
    const out: Array<{ d: Vec3; a: number; puff: boolean }> = [];
    for (let i = 0; i < 2600; i++) {
      const th = rnd() * Math.PI * 2;
      const off = ((rnd() + rnd() + rnd()) / 1.5 - 1) * BAND_SPREAD;
      const c = Math.cos(th), sn = Math.sin(th);
      const d = norm([a[0] * c + b[0] * sn + n[0] * off, a[1] * c + b[1] * sn + n[1] * off, a[2] * c + b[2] * sn + n[2] * off]);
      if (d[1] < -0.1) continue;
      out.push({ d, a: (rnd() * 0.16 + 0.03) * (1 - Math.abs(off) * 3) * 0.8, puff: i % 9 === 0 });
    }
    return out;
  }, []);
  // One pre-drawn puff, stamped with drawImage rather than ~290 gradients a
  // frame. Rebuilt only when the theme's text channel changes.
  const puff = useRef<{ key: string; cv: HTMLCanvasElement } | null>(null);

  useEffect(() => {
    let raf = 0;
    const draw = (now: number) => {
      raf = 0;
      const cv = ref.current;
      if (!cv || size.width === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(size.width * dpr) || cv.height !== Math.round(size.height * dpr)) {
        cv.width = Math.round(size.width * dpr);
        cv.height = Math.round(size.height * dpr);
      }
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The gradient's outer stop is translucent: without a clear, frames
      // stack there until the horizon floods solid teal.
      ctx.clearRect(0, 0, size.width, size.height);
      const t = now / 1000;
      const tw = (ph: number, rate: number) => (reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * rate + ph));
      // themeRgba reads computed style; resolve each channel once per frame
      // (a theme switch still lands on the next frame) rather than ~1300 times.
      const base: Partial<Record<ThemeChannel, string>> = {};
      const rgba = (ch: ThemeChannel, a: number) => {
        const b = (base[ch] ??= themeRgba(ch, 1).slice(0, -2));
        return `${b}${a})`;
      };

      if (paintSky) {
        // Sky: deepest at the zenith, lifting toward the horizon. Every stop is
        // opaque: the sky never turns see-through, however low the gaze.
        const zen = proj.toPx({ x: 0, y: 0 });
        const R = Math.max(size.width, size.height) * 1.6;
        const g = ctx.createRadialGradient(zen.x, zen.y, 0, zen.x, zen.y, R);
        g.addColorStop(0, rgba('bg', 1));
        g.addColorStop(1, rgba('surface', 1));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size.width, size.height);

        // Warm horizon glow: thin rings of sky from the horizon up to
        // HAZE_TOP, each a single filled path (no overlap, so nothing stacks),
        // fading out with height. Only visible when the gaze tilts low.
        ctx.fillStyle = rgba('gold', 1);
        for (let k = 0; k < HAZE_RINGS; k++) {
          const e0 = (k / HAZE_RINGS) * HAZE_TOP, e1 = ((k + 1) / HAZE_RINGS) * HAZE_TOP;
          ctx.beginPath();
          let any = false;
          for (let i = 0; i < HAZE_STEPS; i++) {
            const z0 = (i / HAZE_STEPS) * Math.PI * 2, z1 = ((i + 1) / HAZE_STEPS) * Math.PI * 2;
            const p = [ringPx(proj, e0, z0), ringPx(proj, e0, z1), ringPx(proj, e1, z1), ringPx(proj, e1, z0)];
            if (p.some((q) => !q)) continue;
            ctx.moveTo(p[0]!.x, p[0]!.y);
            for (let j = 1; j < 4; j++) ctx.lineTo(p[j]!.x, p[j]!.y);
            ctx.closePath();
            any = true;
          }
          if (!any) continue;
          const f = 1 - k / HAZE_RINGS;
          ctx.globalAlpha = HAZE_ALPHA * f * f;
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // The band: barely there, beneath the stars.
        const tb = themeRgba('text', 1);
        if (!puff.current || puff.current.key !== tb) {
          const pc = document.createElement('canvas');
          pc.width = pc.height = PUFF * 2;
          const pctx = pc.getContext('2d');
          if (pctx) {
            const pg = pctx.createRadialGradient(PUFF, PUFF, 0, PUFF, PUFF, PUFF);
            pg.addColorStop(0, rgba('text', 1));
            pg.addColorStop(1, rgba('text', 0));
            pctx.fillStyle = pg;
            pctx.fillRect(0, 0, PUFF * 2, PUFF * 2);
          }
          puff.current = { key: tb, cv: pc };
        }
        ctx.fillStyle = rgba('text', 1);
        for (const s of band) {
          const q = projectDir(proj, s.d);
          if (!q) continue;
          if (s.puff) {
            const r = PUFF * q.scale;
            ctx.globalAlpha = PUFF_ALPHA;
            ctx.drawImage(puff.current.cv, q.x - r, q.y - r, r * 2, r * 2);
          } else {
            ctx.globalAlpha = s.a;
            ctx.fillRect(q.x, q.y, 0.8, 0.8);
          }
        }
        ctx.globalAlpha = 1;
      }

      // Background stars.
      for (const s of field) {
        const q = projectDir(proj, s.d);
        if (!q) continue;
        ctx.fillStyle = rgba('text', s.a * tw(s.ph, 1.3));
        ctx.fillRect(q.x, q.y, s.big ? 1.5 : 0.9, s.big ? 1.5 : 0.9);
      }

      // Constellation: pin → tagged words, along great circles (R8), in the
      // replay's recipe. A segment already there draws at rest: the quiet
      // line. A new one animates once: a head rides in over LINE_MS with the
      // streak and glow drawing behind it, the tail catches up over TAIL_MS,
      // and the quiet line draws in with the head and stays.
      let busy = false;
      const blur = blurrer(ctx, dpr, rgba);
      for (const sg of segs.current.values()) {
        const path = arcPath(proj, sg.a, sg.b);
        if (sg.born === null || reducedMotion) {
          strokeRange(ctx, path, 0, 1, rgba('recorded', QUIET_LINE_OPACITY), QUIET_LINE_WIDTH);
          continue;
        }
        const el = now - sg.born;
        if (segmentDone(el, LINE_MS, TAIL_MS)) {
          sg.born = null;
          strokeRange(ctx, path, 0, 1, rgba('recorded', QUIET_LINE_OPACITY), QUIET_LINE_WIDTH);
          continue;
        }
        busy = true;
        const d = segmentDraw(el, LINE_MS, TAIL_MS);
        strokeRange(ctx, path, 0, d.quiet, rgba('recorded', QUIET_LINE_OPACITY), QUIET_LINE_WIDTH);
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
      // A removed segment's quiet line fades out over GONE_MS.
      gone.current = reducedMotion ? [] : gone.current.filter((g) => now - g.at < GONE_MS);
      for (const g of gone.current) {
        busy = true;
        const k = Math.max(0, 1 - (now - g.at) / GONE_MS);
        strokeRange(ctx, arcPath(proj, g.a, g.b), 0, 1, rgba('recorded', QUIET_LINE_OPACITY * k), QUIET_LINE_WIDTH);
      }

      // Live draft trail (R19), in the replay's look: the streak trails the
      // moving pin over the last TAIL_MS of its path, a head rides at the
      // pin, and once it stops the tail catches up and both are gone.
      // Reduced motion draws no trail: it is motion by definition.
      if (reducedMotion) trail.current = [];
      else {
        const last = trail.current[trail.current.length - 1];
        if (liveDraft && (!last || last.x !== liveDraft.x || last.y !== liveDraft.y)) trail.current.push({ x: liveDraft.x, y: liveDraft.y, t: now });
        trail.current = pruneTrail(trail.current, now, TAIL_MS);
        const w = trailWindow(trail.current, now, TAIL_MS);
        if (w.head > 0) {
          busy = true;
          const pts = w.points.map((p) => { const q = proj.toPx(p); return q.visible ? q : null; });
          const ends = pathEnds(pts);
          if (ends) {
            const grad = streakGradient(ctx, ends[0], ends[1], rgba);
            if (grad) {
              blur(() => strokeRange(ctx, pts, 0, 1, grad, STREAK_GLOW_WIDTH, STREAK_GLOW_OPACITY));
              strokeRange(ctx, pts, 0, 1, grad, STREAK_CORE_WIDTH);
            }
          }
          const h = pts[pts.length - 1];
          if (h) drawHead(ctx, h, w.head, rgba, blur);
        } else if (!liveDraft) trail.current = [];
      }

      // Every emotion is a star (R6).
      for (const s of stars) {
        const q = proj.toPx(s);
        if (!q.visible) continue;
        const bright = (s.surface ? 1 : s.revealed ? 0.8 : 0.4) * tw(s.x * 7 + s.y * 13, 1.1);
        const channel = s.tagged ? 'recorded' : 'text';
        const rad = s.surface ? 1.9 : s.revealed ? 1.5 : 1.1;
        const halo = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad * 5);
        halo.addColorStop(0, rgba(channel, 0.28 * bright));
        halo.addColorStop(1, rgba(channel, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(q.x - rad * 5, q.y - rad * 5, rad * 10, rad * 10);
        ctx.fillStyle = rgba(channel, Math.min(1, bright + 0.1));
        ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2); ctx.fill();
      }

      // Reduced motion: one frame per prop change, then idle — unless
      // something is still animating (nothing does today: under reduced
      // motion every segment draws at rest and there is no trail).
      if (!reducedMotion || busy) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [proj, size, stars, constellation, liveDraft, reducedMotion, paintSky, field, band]);

  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

const BAND_SPREAD = 0.24; // rad: the triangular spread's reach (3 × ±0.08)
const PUFF = 22;          // px radius of a band haze puff at the stage centre
const PUFF_ALPHA = 0.028;
const HAZE_TOP = (9 * Math.PI) / 180; // the warm glow fades out by 9° up
const HAZE_RINGS = 12; // fine enough that the steps sit about one 8-bit level apart
const HAZE_STEPS = 64;
const HAZE_ALPHA = 0.07;  // at the horizon itself

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };

// A point `el` rad above the horizon at azimuth `az` (y is up on the dome).
function ringPx(proj: FieldProjection, el: number, az: number) {
  const c = Math.cos(el);
  return projectDir(proj, [c * Math.cos(az), Math.sin(el), c * Math.sin(az)]);
}

// Background stars and great-circle samples are dome directions, not field
// coordinates: map them back through dirToField (unclamped, so points beyond
// the square still draw), then project. Below the horizon draws nothing.
function projectDir(proj: FieldProjection, d: Vec3) {
  const f = dirToField(d);
  if (f.elevation < 0) return null;
  const q = proj.toPx(f);
  return q.visible ? q : null;
}

export interface ConstellationStar extends FieldCoord {
  key: string;
}
interface Segment {
  a: ConstellationStar;
  b: ConstellationStar;
  born: number | null;
}
type Px = { x: number; y: number } | null;
type Rgba = (ch: ThemeChannel, a: number) => string;

const GONE_MS = 300; // a removed tag line's fade-out
const ARC_STEPS = 24;

// A segment's great circle as screen points; null where it is out of view.
function arcPath(proj: FieldProjection, a: FieldCoord, b: FieldCoord): Px[] {
  return greatCircle(fieldToDir(a), fieldToDir(b), ARC_STEPS).map((d) => projectDir(proj, d));
}

// The point `f` (0..1) of the way along a sampled path, by sample index —
// great-circle samples are evenly spaced in angle, so this is arc length.
function lerpAt(pts: Px[], s: number): Px {
  const n = pts.length - 1;
  const i = Math.min(n - 1, Math.max(0, Math.floor(s)));
  const a = pts[i], b = pts[i + 1];
  if (!a || !b) return null;
  const k = Math.max(0, Math.min(1, s - i));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}
function pointAt(pts: Px[], f: number): Px {
  if (pts.length === 1) return pts[0];
  return pts.length ? lerpAt(pts, f * (pts.length - 1)) : null;
}
function pathEnds(pts: Px[]): [NonNullable<Px>, NonNullable<Px>] | null {
  const vis = pts.filter((p): p is NonNullable<Px> => p !== null);
  return vis.length >= 2 ? [vis[0], vis[vis.length - 1]] : null;
}

// Stroke the stretch f0..f1 of a sampled path, lifting the pen where a
// sample is out of view.
function strokeRange(ctx: CanvasRenderingContext2D, pts: Px[], f0: number, f1: number, style: string | CanvasGradient, width: number, alpha = 1) {
  if (f1 <= f0 || pts.length < 2 || alpha <= 0) return;
  const n = pts.length - 1;
  const s0 = f0 * n, s1 = f1 * n;
  ctx.beginPath();
  let pen = false, any = false;
  for (let i = Math.floor(s0); i < Math.min(n, Math.ceil(s1)); i++) {
    const p0 = lerpAt(pts, Math.max(i, s0)), p1 = lerpAt(pts, Math.min(i + 1, s1));
    if (!p0 || !p1) { pen = false; continue; }
    if (!pen) ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    pen = any = true;
  }
  if (!any) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = style;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// The replay's streak gradient, tail → head (cometStyle's STREAK_STOPS).
function streakGradient(ctx: CanvasRenderingContext2D, tail: NonNullable<Px>, head: NonNullable<Px>, rgba: Rgba): CanvasGradient | null {
  if (Math.hypot(head.x - tail.x, head.y - tail.y) < 0.5) return null;
  const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
  for (const st of STREAK_STOPS) g.addColorStop(st.at, rgba(st.channel, st.alpha));
  return g;
}

function drawHead(ctx: CanvasRenderingContext2D, h: NonNullable<Px>, alpha: number, rgba: Rgba, blur: (fn: () => void) => void) {
  ctx.fillStyle = rgba('text', alpha);
  blur(() => { ctx.beginPath(); ctx.arc(h.x, h.y, HEAD_GLOW_R, 0, Math.PI * 2); ctx.fill(); });
  ctx.beginPath(); ctx.arc(h.x, h.y, HEAD_CORE_R, 0, Math.PI * 2); ctx.fill();
}

// The replay's feGaussianBlur(GLOW_BLUR) on canvas. Canvas blur lengths are
// bitmap pixels (the transform doesn't scale them), hence × dpr. Without
// ctx.filter (older Safari) a shadow of the same spread stands in.
function blurrer(ctx: CanvasRenderingContext2D, dpr: number, rgba: Rgba) {
  const hasFilter = typeof (ctx as { filter?: unknown }).filter === 'string';
  return (fn: () => void) => {
    if (hasFilter) {
      ctx.filter = `blur(${GLOW_BLUR * dpr}px)`;
      fn();
      ctx.filter = 'none';
    } else {
      ctx.shadowBlur = GLOW_BLUR * 2 * dpr;
      ctx.shadowColor = rgba('gold', 0.6);
      fn();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }
  };
}
