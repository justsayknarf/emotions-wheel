import type { Emotion } from '../data/emotions';
import { toPercent } from '../utils/fieldGeometry';

// The landing page's fixed background is the app's own field, stretched across
// the viewport: every word sits at its real coordinate, and the pins the page
// "plants" as you scroll sit at viewport positions that map back to real
// coordinates through the same toPercent the app uses. Keeping the positions
// in viewport percentages (not coordinates) lets the two layouts below place
// pins where the copy is not; the inverse mapping then tells us which words
// each pin is genuinely nearest to.

export interface SkyPoint {
  left: number; // % of viewport width
  top: number;  // % of viewport height
}

export interface SkyPin {
  wide: SkyPoint;
  narrow: SkyPoint;
}

// Pin 1 is the hero's. Each later pin belongs to the section that plants it.
// All five sit in the field's upper half on purpose: the words they light are
// the ones a visitor reads first, and a soft first impression should not open
// on the field's harshest corner. The lower half is the same field, and every
// word in it is still one press away in the app.
export const SKY_PINS: SkyPin[] = [
  { wide: { left: 58, top: 44 }, narrow: { left: 72, top: 24 } },
  { wide: { left: 66, top: 26 }, narrow: { left: 95, top: 34 } },
  { wide: { left: 78, top: 36 }, narrow: { left: 94, top: 46 } },
  { wide: { left: 90, top: 26 }, narrow: { left: 96, top: 58 } },
  { wide: { left: 86, top: 46 }, narrow: { left: 94, top: 70 } },
];

// Which pins each line joins, 1-based. A line draws once both ends are planted;
// the last one closes the loop.
export const SKY_LINES: Array<[number, number]> = [
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 1],
];

// Inverse of toPercent on both axes: a viewport position back to the field
// coordinate the app would record for a press there. y is inverted because
// the field draws +y upward.
export function pointToCoord(p: SkyPoint): { x: number; y: number } {
  const unit = (pct: number) => ((pct - 5) / 90) * 2 - 1;
  return { x: unit(p.left), y: -unit(p.top) };
}

// The n words nearest a coordinate, nearest first. Pure distance, no radius:
// the sky always has something to light, even on the field's sparse edges.
export function nearestWordIds(
  x: number,
  y: number,
  emotions: Emotion[],
  n: number,
): string[] {
  return emotions
    .map((e) => ({ id: e.id, d: Math.hypot(e.x - x, e.y - y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(0, n))
    .map((e) => e.id);
}

export interface LitWord {
  pin: number;  // 1-based pin that lights it
  slot: number; // 0 = nearest that pin lit, 1 = next, ...
}

// word id -> the pin that lights it and its rank there. A word nearest to two
// pins belongs to the earlier one, so nothing lights, dims, and lights again as
// you scroll. The rank lets the page stagger a pin's labels instead of stacking
// them on the same spot.
export function litWordPins(
  pins: SkyPoint[],
  emotions: Emotion[],
  perPin: number,
): Map<string, LitWord> {
  const owner = new Map<string, LitWord>();
  pins.forEach((p, i) => {
    const { x, y } = pointToCoord(p);
    let slot = 0;
    for (const id of nearestWordIds(x, y, emotions, perPin)) {
      if (!owner.has(id)) owner.set(id, { pin: i + 1, slot: slot++ });
    }
  });
  return owner;
}

// Where a word sits on the viewport, matching EmotionWord's own placement.
export function wordPosition(e: Emotion): SkyPoint {
  return { left: toPercent(e.x), top: toPercent(-e.y) };
}
