// Shared label-box metrics for the emotion field.
//
// Every word anchors to a fixed coordinate (its dot); its label is a callout
// box sized by these metrics. The radial-fan placement (radialFan.ts) and the
// static spacing lint (scripts/lint-emotion-spacing.mjs) size labels the same
// way, so the runtime layout and the lint agree on how wide a label renders.

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
