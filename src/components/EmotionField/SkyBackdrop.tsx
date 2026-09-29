import { useEffect, useMemo, useRef } from 'react';
import { themeRgba, type ThemeChannel } from '../../config/themeColor';
import { dirToField, fieldToDir, greatCircle, mulberry32, type FieldCoord, type FieldProjection, type Vec3 } from '../../utils/skyProjection';

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
  // Pin first, then its recognized words in tag order (R8).
  constellation: FieldCoord[];
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
  const trail = useRef<Array<{ c: FieldCoord; t: number }>>([]);

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

      // Constellation: pin → tagged words, along great circles (R8).
      if (constellation.length > 1) {
        ctx.strokeStyle = rgba('gold', 0.5);
        ctx.lineWidth = 1.2;
        for (let i = 1; i < constellation.length; i++) {
          const path = greatCircle(fieldToDir(constellation[i - 1]), fieldToDir(constellation[i]), 24);
          ctx.beginPath();
          let pen = false;
          for (const d of path) {
            const q = projectDir(proj, d);
            if (!q) { pen = false; continue; }
            if (pen) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
            pen = true;
          }
          ctx.stroke();
        }
      }

      // Live draft comet trail (R19). Reduced motion draws no trail: it is
      // motion by definition, and keeping one would keep the loop alive.
      if (liveDraft && !reducedMotion) trail.current.push({ c: liveDraft, t });
      trail.current = reducedMotion ? [] : trail.current.filter((p) => t - p.t < 1.6);
      for (let i = 1; i < trail.current.length; i++) {
        const a = proj.toPx(trail.current[i - 1].c), b = proj.toPx(trail.current[i].c);
        if (!a.visible || !b.visible) continue;
        const life = 1 - (t - trail.current[i].t) / 1.6;
        ctx.strokeStyle = rgba('gold', 0.45 * life * life);
        ctx.lineWidth = 0.6 + 2.2 * life;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
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

      // Reduced motion: one frame per prop change, then idle.
      if (!reducedMotion) raf = requestAnimationFrame(draw);
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
