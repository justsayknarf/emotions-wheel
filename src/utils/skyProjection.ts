import { toPercent } from './fieldGeometry';

// The night-sky field (docs/plans/2026-09-28-001-feat-night-sky-field-plan.md).
// Field coordinates stay the datum; this module only decides where a coordinate
// draws. The centre is the zenith, intensity comes down toward the horizon and
// quality is the compass bearing. The camera never yaws: screen-right is always
// +x (Activated) and screen-up always +y (Positive), so the sky never mirrors.

export type Vec3 = [number, number, number];
export interface FieldCoord { x: number; y: number }
export interface ScreenPoint {
  x: number;
  y: number;
  // false when the direction is behind the camera; callers skip drawing it.
  visible: boolean;
  // 1 at the stage centre, falling off toward the edges; scales star size.
  scale: number;
}
// The camera behind a sky projection, for renderers that turn each pixel
// back into a dome direction themselves (the WebGL sky, SkyAurora.tsx).
export interface SkyFrame {
  f: Vec3;
  r: Vec3;
  u: Vec3;
  F: number;
  cx: number;
  cy: number;
}
export interface FieldProjection {
  kind: 'flat' | 'sky';
  // Present on sky projections only.
  frame?: SkyFrame;
  toPx(c: FieldCoord): ScreenPoint;
  // Stage-local px (0,0 = top-left) back to a field coordinate clamped to the
  // square, or null where nothing is pressable (below the horizon).
  fromPx(px: number, py: number): FieldCoord | null;
}

export const RMAX = Math.SQRT2;
export const ZEN_SPAN = (86 * Math.PI) / 180;
const HORIZON_MIN = (2 * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function elevationOf(r: number): number {
  return Math.PI / 2 - (Math.min(r, RMAX) / RMAX) * ZEN_SPAN;
}

// World axes: +x = Activated, +y = up (zenith), +z = Positive.
export function fieldToDir(c: FieldCoord): Vec3 {
  const az = Math.atan2(c.y, c.x);
  const el = elevationOf(Math.hypot(c.x, c.y));
  const ce = Math.cos(el);
  return [ce * Math.cos(az), Math.sin(el), ce * Math.sin(az)];
}

export function dirToField(d: Vec3): FieldCoord & { elevation: number } {
  const elevation = Math.asin(clamp(d[1], -1, 1));
  const r = ((Math.PI / 2 - elevation) / ZEN_SPAN) * RMAX;
  const az = Math.atan2(d[2], d[0]);
  return { x: r * Math.cos(az), y: r * Math.sin(az), elevation };
}

// Forward is the gaze; right and up are world +x and +z made orthonormal
// against it (Gram-Schmidt), which is what keeps the orientation fixed.
export function cameraBasis(look: FieldCoord): { f: Vec3; r: Vec3; u: Vec3 } {
  const f = fieldToDir(look);
  const X: Vec3 = [1, 0, 0];
  const Z: Vec3 = [0, 0, 1];
  const xf = dot(X, f);
  const r = norm([X[0] - xf * f[0], X[1] - xf * f[1], X[2] - xf * f[2]]);
  const zf = dot(Z, f);
  const zr = dot(Z, r);
  const u = norm([Z[0] - zf * f[0] - zr * r[0], Z[1] - zf * f[1] - zr * r[1], Z[2] - zf * f[2] - zr * r[2]]);
  return { f, r, u };
}

export function focalLength(fovDeg: number, width: number, height: number): number {
  return Math.max(width, height) / (2 * Math.tan((fovDeg * Math.PI) / 360));
}

// The part of the stage the viewer can actually see, in stage px: on a phone
// the bottom tray covers the lower part of the field, which still runs behind
// it. The gaze centres on this band and the field of view spans it.
export interface SkyViewport { top: number; height: number }

export function skyProjection(opts: {
  look: FieldCoord;
  fovDeg: number;
  width: number;
  height: number;
  // Defaults to the whole stage.
  viewport?: SkyViewport;
}): FieldProjection {
  const { f, r, u } = cameraBasis(opts.look);
  const band = opts.viewport ?? { top: 0, height: opts.height };
  const F = focalLength(opts.fovDeg, opts.width, band.height);
  const cx = opts.width / 2;
  const cy = band.top + band.height / 2;
  const projectDir = (d: Vec3): ScreenPoint => {
    const z = dot(d, f);
    if (z < 0.05) return { x: 0, y: 0, visible: false, scale: 0 };
    return { x: cx + (dot(d, r) / z) * F, y: cy - (dot(d, u) / z) * F, visible: true, scale: z };
  };
  return {
    kind: 'sky',
    frame: { f, r, u, F, cx, cy },
    toPx: (c) => projectDir(fieldToDir(c)),
    fromPx: (px, py) => {
      const sx = (px - cx) / F;
      const sy = -(py - cy) / F;
      const d = norm([f[0] + r[0] * sx + u[0] * sy, f[1] + r[1] * sx + u[1] * sy, f[2] + r[2] * sx + u[2] * sy]);
      const p = dirToField(d);
      if (p.elevation < HORIZON_MIN) return null;
      return { x: clamp(p.x, -1, 1), y: clamp(p.y, -1, 1) };
    },
  };
}

// The existing flat field, behind the same interface. Must agree exactly with
// toPercent (placement) and useFieldGesture's pixelToCoord (presses).
export function flatProjection(size: { width: number; height: number }): FieldProjection {
  return {
    kind: 'flat',
    toPx: (c) => ({
      x: (toPercent(c.x) / 100) * size.width,
      y: (toPercent(-c.y) / 100) * size.height,
      visible: true,
      scale: 1,
    }),
    fromPx: (px, py) => ({
      x: clamp(((px / size.width - 0.05) / 0.9) * 2 - 1, -1, 1),
      y: clamp(-(((py / size.height - 0.05) / 0.9) * 2 - 1), -1, 1),
    }),
  };
}

// Points along the great circle from a to b (unit vectors), inclusive.
export function greatCircle(a: Vec3, b: Vec3, steps: number): Vec3[] {
  const om = Math.acos(clamp(dot(a, b), -1, 1));
  if (om < 1e-5) return [a, b];
  const s = Math.sin(om);
  const out: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ka = Math.sin((1 - t) * om) / s;
    const kb = Math.sin(t * om) / s;
    out.push([a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb]);
  }
  return out;
}

// Deterministic PRNG so the starfield is the same sky on every load.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
