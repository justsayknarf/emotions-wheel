// Placement for the previous check-in's anchor-mark label ("TODAY").
//
// The label normally rides just above its ring. Surface labels never move,
// though, so a check-in recorded among them can land its label on a word. This
// picks the first side of the ring that clears every obstacle — above (the
// resting spot), then below, right, left — and stays above when none do.
// Pure geometry, so scripts/test-anchor-label.ts can exercise it under Node.

export interface ObstacleBox {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

export interface AnchorLabelPlacement {
  side: 'above' | 'below' | 'right' | 'left';
  /** Label centre relative to the ring centre (px). */
  dx: number;
  dy: number;
  halfW: number;
  halfH: number;
}

export const ANCHOR_LABEL_H = 10; // px line box of the 8px label
const GAP = 3; // px between the ring's edge and the label's box

// Same +2 breathing room as radialFan.ts's overlap test.
function overlaps(a: ObstacleBox, b: ObstacleBox): boolean {
  return Math.abs(a.x - b.x) < a.halfW + b.halfW + 2 &&
         Math.abs(a.y - b.y) < a.halfH + b.halfH + 2;
}

export function placeAnchorLabel(
  ring: { x: number; y: number; size: number },
  labelHalfW: number,
  obstacles: ObstacleBox[],
): AnchorLabelPlacement {
  const halfH = ANCHOR_LABEL_H / 2;
  const r = ring.size / 2 + GAP;
  const sides: AnchorLabelPlacement[] = [
    { side: 'above', dx: 0, dy: -(r + halfH), halfW: labelHalfW, halfH },
    { side: 'below', dx: 0, dy: r + halfH, halfW: labelHalfW, halfH },
    { side: 'right', dx: r + labelHalfW, dy: 0, halfW: labelHalfW, halfH },
    { side: 'left', dx: -(r + labelHalfW), dy: 0, halfW: labelHalfW, halfH },
  ];
  const clear = sides.find((s) => {
    const box = { x: ring.x + s.dx, y: ring.y + s.dy, halfW: s.halfW, halfH: s.halfH };
    return !obstacles.some((o) => overlaps(box, o));
  });
  return clear ?? sides[0];
}
