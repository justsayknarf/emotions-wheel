// De-overlap layout for revealed labels.
//
// The field anchors every word to a fixed coordinate (its dot). In a dense
// zone, the revealed deep labels would render on top of the always-present
// surface labels and each other. This pass nudges the *labels* apart while the
// dots stay home — surface labels are immovable reference landmarks, deep
// labels are movable (KTD5). It returns a per-deep-label pixel offset from the
// label's standoff home; the dot never moves, and a tether (U4) reconnects any
// label pushed far from its dot.
//
// Box metrics mirror scripts/lint-emotion-spacing.mjs so the runtime separation
// and the static spacing lint agree on how wide a label renders.

// Per-character label width, matching the lint's font metrics.
export const CHAR_W_SURFACE = 7.7; // px/char at the 14px surface size
export const CHAR_W_DEEP = 6.6; // px/char at the 12px deep size
export const LABEL_LINE_H = 18; // px vertical extent of one label line
const PAD = 4; // px breathing room added around each box

export interface LabelBox {
  id: string;
  /** Home center of the label in field-plane pixels (already lifted by the standoff). */
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
  /** Surface labels are fixed obstacles; deep labels are movable. */
  movable: boolean;
}

export interface Offset {
  dx: number;
  dy: number;
}

export function labelHalfWidth(label: string, depth: 'surface' | 'deep'): number {
  const charW = depth === 'surface' ? CHAR_W_SURFACE : CHAR_W_DEEP;
  return (label.length * charW + PAD) / 2;
}

/**
 * Iterative axis-aligned separation. Movable boxes are pushed off every box
 * they overlap (fixed or movable) along the axis of least penetration; fixed
 * boxes never move. Returns offsets keyed by id for movable boxes only.
 */
export function computeDeoverlap(
  boxes: LabelBox[],
  opts?: { iterations?: number },
): Map<string, Offset> {
  const iterations = opts?.iterations ?? 8;

  // Working positions; only movable boxes drift from their home center.
  const work = boxes.map((b) => ({ ...b, x: b.cx, y: b.cy }));

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < work.length; i++) {
      for (let j = i + 1; j < work.length; j++) {
        const a = work[i];
        const b = work[j];
        if (!a.movable && !b.movable) continue;

        let dx = b.x - a.x;
        let dy = b.y - a.y;
        // Break exact-coincidence symmetry deterministically by index.
        if (dx === 0 && dy === 0) {
          dx = (j - i) * 0.01;
          dy = 0.01;
        }

        const overlapX = a.halfW + b.halfW - Math.abs(dx);
        const overlapY = a.halfH + b.halfH - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue; // not overlapping

        // Resolve along the cheaper axis.
        if (overlapX < overlapY) {
          const dir = dx < 0 ? -1 : 1;
          applyPush(a, b, dir * overlapX, 0);
        } else {
          const dir = dy < 0 ? -1 : 1;
          applyPush(a, b, 0, dir * overlapY);
        }
      }
    }
  }

  const offsets = new Map<string, Offset>();
  for (const w of work) {
    if (!w.movable) continue;
    offsets.set(w.id, { dx: w.x - w.cx, dy: w.y - w.cy });
  }
  return offsets;
}

type WorkBox = LabelBox & { x: number; y: number };

// Push b away from a by (px, py). When both are movable, split the correction;
// when one is fixed, the movable box absorbs all of it.
function applyPush(a: WorkBox, b: WorkBox, px: number, py: number): void {
  if (a.movable && b.movable) {
    b.x += px / 2;
    b.y += py / 2;
    a.x -= px / 2;
    a.y -= py / 2;
  } else if (b.movable) {
    b.x += px;
    b.y += py;
  } else {
    // a is the movable one; it moves opposite the a→b direction.
    a.x -= px;
    a.y -= py;
  }
}
