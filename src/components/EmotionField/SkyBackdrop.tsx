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
}

// The night sky behind the words: gradient, seeded starfield, a faint band,
// horizon haze, every emotion as a star, the constellation chain and the live
// draft's comet trail. Words themselves stay DOM (EmotionWord).
export function SkyBackdrop({ proj, size, stars, constellation, liveDraft, reducedMotion }: Props) {
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

      // Sky: deepest at the zenith, lifting toward the horizon.
      const zen = proj.toPx({ x: 0, y: 0 });
      const R = Math.max(size.width, size.height) * 1.6;
      const g = ctx.createRadialGradient(zen.x, zen.y, 0, zen.x, zen.y, R);
      g.addColorStop(0, rgba('bg', 1));
      g.addColorStop(0.6, rgba('surface', 1));
      g.addColorStop(1, rgba('recorded', 0.16));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size.width, size.height);

      // Horizon haze where the gaze tilts far enough to see it.
      for (let i = 0; i < 48; i++) {
        const az = (i / 48) * Math.PI * 2;
        const q = proj.toPx({ x: Math.SQRT2 * Math.cos(az), y: Math.SQRT2 * Math.sin(az) });
        if (!q.visible) continue;
        const rad = Math.max(size.width, size.height) * 0.28;
        const hg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
        hg.addColorStop(0, rgba('gold', 0.05));
        hg.addColorStop(1, rgba('gold', 0));
        ctx.fillStyle = hg;
        ctx.fillRect(q.x - rad, q.y - rad, rad * 2, rad * 2);
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
  }, [proj, size, stars, constellation, liveDraft, reducedMotion, field]);

  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
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
