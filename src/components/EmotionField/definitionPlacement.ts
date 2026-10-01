// Where the field's definition tooltip sits and what the pointer is over
// (docs/brainstorms/2026-09-30-word-definition-tooltips-requirements.md,
// R4/R13/R14). Pure px geometry in the field's layout space; the field
// supplies positions from its projection, so the flat field and the night
// sky share this.

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
// Something the tooltip should not cover; heavier weighs more.
export interface Obstacle extends Box { weight: number }

// A word as it draws: its dot (the true coordinate) and its label box.
export interface WordTarget {
  id: string;
  dotX: number;
  dotY: number;
  labelX: number;
  labelY: number;
  halfW: number;
  halfH: number;
}

export type TipLayout = 'tethered' | 'band';

export const TIP_WIDTH = 236;
export const TIP_STANDOFF = 95;
export const BAND_GUTTER = 12;
export const LABEL_OBSTACLE_WEIGHT = 30;
export const MARK_OBSTACLE_WEIGHT = 80;

// The dot is tiny; this is how close counts as "on it".
const DOT_HIT_RADIUS = 10;
// Labels get a few px of slack so a hover doesn't flicker at the glyph edge.
const LABEL_HIT_PAD = 3;
// Keep the card this far off the field edge.
const EDGE_MARGIN = 8;
// Per px outside the field: far heavier than any label overlap.
const OVERFLOW_WEIGHT = 6;
// Band: if the star is within this much of where the top card would end, the
// card moves to the bottom of the band instead.
const BAND_CLEARANCE = 44;
// Band tether: keep its end this far inside the card's corners.
const BAND_TETHER_INSET = 18;
// Candidate directions (deg, screen space: -90 is straight up), in order of
// preference. Ties go to the earlier one, so upward wins in open sky.
const ANGLES = [-90, -55, -125, -25, -155, 0, 180, 25, 155, 55, 125, 90];

export function hitTestWord(p: Point, targets: WordTarget[]): string | null {
  let best: { id: string; d: number } | null = null;
  for (const t of targets) {
    const onLabel =
      Math.abs(p.x - t.labelX) <= t.halfW + LABEL_HIT_PAD &&
      Math.abs(p.y - t.labelY) <= t.halfH + LABEL_HIT_PAD;
    const onDot = Math.hypot(p.x - t.dotX, p.y - t.dotY) <= DOT_HIT_RADIUS;
    if (!onLabel && !onDot) continue;
    const d = Math.min(Math.hypot(p.x - t.labelX, p.y - t.labelY), Math.hypot(p.x - t.dotX, p.y - t.dotY));
    if (!best || d < best.d) best = { id: t.id, d };
  }
  return best?.id ?? null;
}

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function placeTethered(
  star: Point,
  size: { w: number; h: number },
  obstacles: Obstacle[],
  bounds: Box,
  standoff = TIP_STANDOFF,
): Box {
  let best: { score: number; box: Box } | null = null;
  ANGLES.forEach((deg, i) => {
    const r = (deg * Math.PI) / 180;
    const dx = Math.cos(r);
    const dy = Math.sin(r);
    // The card's near edge sits `standoff` from the star along this ray.
    const cx = star.x + dx * standoff + dx * size.w / 2;
    const cy = star.y + dy * standoff + dy * size.h / 2;
    const box = { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h };
    let score = i * 0.5;
    const left = bounds.x + EDGE_MARGIN - box.x;
    const right = box.x + box.w - (bounds.x + bounds.w - EDGE_MARGIN);
    const top = bounds.y + EDGE_MARGIN - box.y;
    const bottom = box.y + box.h - (bounds.y + bounds.h - EDGE_MARGIN);
    score += OVERFLOW_WEIGHT * (Math.max(0, left) + Math.max(0, right) + Math.max(0, top) + Math.max(0, bottom));
    for (const o of obstacles) if (overlap(box, o)) score += o.weight;
    if (!best || score < best.score) best = { score, box };
  });
  return best!.box;
}

export function placeBand(star: Point, height: number, bounds: Box): Box {
  const w = bounds.w - 2 * BAND_GUTTER;
  const x = bounds.x + BAND_GUTTER;
  const topY = bounds.y + BAND_GUTTER;
  const starUnderTop = star.y < topY + height + BAND_CLEARANCE;
  const y = starUnderTop ? bounds.y + bounds.h - BAND_GUTTER - height : topY;
  return { x, y, w, h: height };
}

export function tetherEnd(star: Point, box: Box, layout: TipLayout): Point {
  if (layout === 'band') {
    const x = Math.max(box.x + BAND_TETHER_INSET, Math.min(box.x + box.w - BAND_TETHER_INSET, star.x));
    const y = box.y > star.y ? box.y : box.y + box.h;
    return { x, y };
  }
  // Where the ray from the card's centre to the star leaves the card.
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = star.x - cx;
  const dy = star.y - cy;
  const kx = Math.abs(dx) > 1e-6 ? box.w / 2 / Math.abs(dx) : Infinity;
  const ky = Math.abs(dy) > 1e-6 ? box.h / 2 / Math.abs(dy) : Infinity;
  const k = Math.min(kx, ky, 1);
  return { x: cx + dx * k, y: cy + dy * k };
}

// "calm · pleasant · mild": the word's region and intensity, from its
// coordinate (x arousal, y valence) and radius (radial-intensity: radius is
// intensity).
export function describeWordRegion(x: number, y: number): string {
  const arousal = x < -0.15 ? 'calm' : x > 0.15 ? 'activated' : 'steady';
  const valence = y > 0.15 ? 'pleasant' : y < -0.15 ? 'unpleasant' : 'neutral';
  const r = Math.hypot(x, y);
  const intensity = r < 0.45 ? 'mild' : r < 0.75 ? 'moderate' : 'intense';
  return `${arousal} · ${valence} · ${intensity}`;
}

export function nearestWordId(
  c: Point,
  words: Array<{ id: string; x: number; y: number }>,
  radius: number,
): string | null {
  let best: { id: string; d: number } | null = null;
  for (const w of words) {
    const d = Math.hypot(w.x - c.x, w.y - c.y);
    if (d <= radius && (!best || d < best.d)) best = { id: w.id, d };
  }
  return best?.id ?? null;
}
