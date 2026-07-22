// Radial-fan placement for revealed labels.
//
// Where computeDeoverlap separates labels by least-movement (which, for wide
// short labels, collapses to a vertical list), this lays the revealed deep
// labels out as a fan around the reveal focus: each label rides a ray out of
// the cursor/pin, so the reveal reads as a burst rather than a stack. A
// no-crossing 2-opt pass swaps the slots of any two words whose tethers cross
// (each word still tethers to its own dot), so the drawn-in tethers never
// tangle. Returns the same per-id pixel offset the de-overlap pass did, so the
// EmotionWord render path is unchanged.
//
// Box metrics mirror deoverlap.ts / lint-emotion-spacing.mjs.

import type { LabelBox, Offset } from './deoverlap';
import { DEFAULT_TUNING, type RevealTuning } from '../../config/revealTuning';

// A fan box adds the coordinate dot (the tether's fixed end) to a label box.
export interface FanBox extends LabelBox {
  dotX: number;
  dotY: number;
}

interface Focus { x: number; y: number }
type WorkBox = FanBox & { x: number; y: number; ang0: number; ang: number };

const circMean = (a: number[]) =>
  Math.atan2(
    a.reduce((s, v) => s + Math.sin(v), 0),
    a.reduce((s, v) => s + Math.cos(v), 0),
  );

// Signed angle of `a` relative to `mean`, wrapped to (-pi, pi]. Sorting by this
// preserves angular order around the focus, so the fan assignment is monotonic
// and its tethers start out (almost) non-crossing.
function relAngle(a: number, mean: number): number {
  let d = a - mean;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function overlaps(a: { x: number; y: number; halfW: number; halfH: number },
                  b: { x: number; y: number; halfW: number; halfH: number }): boolean {
  return Math.abs(a.x - b.x) < a.halfW + b.halfW + 2 &&
         Math.abs(a.y - b.y) < a.halfH + b.halfH + 2;
}

// Proper segment intersection, ignoring shared endpoints and collinearity.
function segCross(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
): boolean {
  const o = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
    Math.sign((by - ay) * (cx - bx) - (bx - ax) * (cy - by));
  const o1 = o(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const o2 = o(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const o3 = o(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const o4 = o(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

// No-crossing rule: while two tethers cross, swap the two words' label slots.
// Each word keeps its own dot; only which slot it occupies changes. Swapping
// two crossing segments always uncrosses them and shortens total length, so it
// converges.
function uncross(work: WorkBox[]): void {
  let changed = true, guard = 0;
  while (changed && guard++ < 60) {
    changed = false;
    for (let i = 0; i < work.length; i++) {
      for (let j = i + 1; j < work.length; j++) {
        const A = work[i], B = work[j];
        const ta = { x1: A.dotX, y1: A.dotY, x2: A.x, y2: A.y };
        const tb = { x1: B.dotX, y1: B.dotY, x2: B.x, y2: B.y };
        if (!segCross(ta, tb)) continue;
        const x = A.x, y = A.y; A.x = B.x; A.y = B.y; B.x = x; B.y = y;
        changed = true;
      }
    }
  }
}

/**
 * Fan the movable (revealed deep) labels out of their nearest reveal focus.
 * Fixed (surface) labels are immovable obstacles. Returns offsets keyed by id
 * for movable boxes only — the offset from each label's standoff home.
 */
export function computeRadialFan(
  boxes: FanBox[],
  foci: Focus[],
  tuning: RevealTuning = DEFAULT_TUNING,
): Map<string, Offset> {
  const offsets = new Map<string, Offset>();
  const movable = boxes.filter((b) => b.movable);
  if (movable.length === 0) return offsets;

  if (foci.length === 0) {
    for (const m of movable) offsets.set(m.id, { dx: 0, dy: 0 });
    return offsets;
  }

  // Assign each movable label to its nearest focus (by the label's dot).
  const groups = new Map<number, FanBox[]>();
  for (const m of movable) {
    let best = 0, bestD = Infinity;
    foci.forEach((f, i) => {
      const d = Math.hypot(m.dotX - f.x, m.dotY - f.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    const g = groups.get(best);
    if (g) g.push(m); else groups.set(best, [m]);
  }

  // Fixed labels are obstacles at their home positions.
  const placed: Array<{ x: number; y: number; halfW: number; halfH: number }> =
    boxes.filter((b) => !b.movable).map((b) => ({ x: b.cx, y: b.cy, halfW: b.halfW, halfH: b.halfH }));

  for (const [fi, group] of groups) {
    const f = foci[fi];
    const work: WorkBox[] = group.map((m) => ({
      ...m, x: m.cx, y: m.cy,
      ang0: Math.atan2(m.cy - f.y, m.cx - f.x), ang: 0,
    }));
    const mean = circMean(work.map((m) => m.ang0));
    work.sort((a, b) => relAngle(a.ang0, mean) - relAngle(b.ang0, mean));
    const n = work.length;
    const arc = Math.min(Math.PI * 1.6, (0.55 + n * 0.30) * tuning.arcScale);

    // Seat every label on one ring just outside the farthest revealed dot, so
    // the fan reads as an even arc around the focus rather than each label
    // clinging to its own dot at a different radius.
    const baseR =
      Math.max(tuning.ringBase, ...work.map((m) => Math.hypot(m.cx - f.x, m.cy - f.y))) +
      tuning.ringGap;

    work.forEach((m, k) => {
      m.ang = mean + (n === 1 ? 0 : (k / (n - 1) - 0.5) * arc);
      let r = baseR;
      for (let s = 0; s < 90; s++) {
        m.x = f.x + Math.cos(m.ang) * r;
        m.y = f.y + Math.sin(m.ang) * r;
        if (!placed.some((p) => overlaps(m, p))) break;
        r += 5;
      }
      placed.push(m);
    });

    uncross(work);
    for (const m of work) offsets.set(m.id, { dx: m.x - m.cx, dy: m.y - m.cy });
  }

  return offsets;
}
