import type { ThemeChannel } from '../../config/themeColor';
import { dirToField, fieldToDir, greatCircle, type FieldCoord, type FieldProjection, type Vec3 } from '../../utils/skyProjection';
import { GLOW_BLUR, HEAD_CORE_R, HEAD_GLOW_R, STREAK_STOPS } from '../Constellation/cometStyle';

// Canvas drawing shared by the night sky's layers: SkyBackdrop (tag lines,
// the departure comet) and the sky replay (SkyReplay). Everything takes a
// projection and draws in stage px, so a stroke stays on the dome however
// the camera moves.

export type Px = { x: number; y: number } | null;
export type Rgba = (ch: ThemeChannel, a: number) => string;

const ARC_STEPS = 24;

// Background stars and great-circle samples are dome directions, not field
// coordinates: map them back through dirToField (unclamped, so points beyond
// the square still draw), then project. Below the horizon draws nothing.
export function projectDir(proj: FieldProjection, d: Vec3) {
  const f = dirToField(d);
  if (f.elevation < 0) return null;
  const q = proj.toPx(f);
  return q.visible ? q : null;
}

// A segment's great circle as screen points; null where it is out of view.
export function arcPath(proj: FieldProjection, a: FieldCoord, b: FieldCoord): Px[] {
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
export function pointAt(pts: Px[], f: number): Px {
  if (pts.length === 1) return pts[0];
  return pts.length ? lerpAt(pts, f * (pts.length - 1)) : null;
}
export function pathEnds(pts: Px[]): [NonNullable<Px>, NonNullable<Px>] | null {
  const vis = pts.filter((p): p is NonNullable<Px> => p !== null);
  return vis.length >= 2 ? [vis[0], vis[vis.length - 1]] : null;
}

// Stroke the stretch f0..f1 of a sampled path, lifting the pen where a
// sample is out of view.
export function strokeRange(ctx: CanvasRenderingContext2D, pts: Px[], f0: number, f1: number, style: string | CanvasGradient, width: number, alpha = 1) {
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
export function streakGradient(ctx: CanvasRenderingContext2D, tail: NonNullable<Px>, head: NonNullable<Px>, rgba: Rgba): CanvasGradient | null {
  if (Math.hypot(head.x - tail.x, head.y - tail.y) < 0.5) return null;
  const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
  for (const st of STREAK_STOPS) g.addColorStop(st.at, rgba(st.channel, st.alpha));
  return g;
}

export function drawHead(ctx: CanvasRenderingContext2D, h: NonNullable<Px>, alpha: number, rgba: Rgba, blur: (fn: () => void) => void) {
  ctx.fillStyle = rgba('text', alpha);
  blur(() => { ctx.beginPath(); ctx.arc(h.x, h.y, HEAD_GLOW_R, 0, Math.PI * 2); ctx.fill(); });
  ctx.beginPath(); ctx.arc(h.x, h.y, HEAD_CORE_R, 0, Math.PI * 2); ctx.fill();
}

// The replay's feGaussianBlur(GLOW_BLUR) on canvas. Canvas blur lengths are
// bitmap pixels (the transform doesn't scale them), hence × dpr. Without
// ctx.filter (older Safari) a shadow of the same spread stands in.
export function blurrer(ctx: CanvasRenderingContext2D, dpr: number, rgba: Rgba) {
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
