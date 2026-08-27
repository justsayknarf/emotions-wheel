// Behavioural check for gesture-time coordinate normalization
// (src/hooks/useFieldGesture.ts's pixelToCoord). Run: npm run check:gesture
//
// U1 (docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md): once
// the field's wrapper carries a CSS `transform: scale()` recede treatment,
// ResizeObserver's cached size no longer matches the transform-aware
// getBoundingClientRect() used for the pointer offset — dividing by the
// stale cached size would misplace a press at any partial recede (the PR #16
// dead-zone bug class). This script proves the fix (normalize by the SAME
// rect's live width/height) stays correct under a transform, and reproduces
// the bug it replaces (normalizing by a stale pre-transform size) so a
// regression here fails loud.
//
// This repo has no test runner beyond these pure-logic scripts (AGENTS.md) —
// pixelToCoord is exported specifically so this math can be exercised
// without mounting the DOM-driven hook itself.
import { pixelToCoord } from '../src/hooks/useFieldGesture';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

function closeTo(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) <= eps;
}

// pixelToCoord only reads left/top/width/height, but its param type wants a
// full DOMRect shape.
function mockRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

// --- Baseline: unscaled field (recedeProgress = 0) — a 900x900 box at the
// origin. pixelToCoord's own 0.05..0.95 inset maps to field-space [-1, 1]. ---
const FULL = 900;
const fullRect = mockRect(0, 0, FULL, FULL);
const topLeftInset = FULL * 0.05;
const bottomRightInset = FULL * 0.95;
const center = FULL * 0.5;

const tl = pixelToCoord(topLeftInset, topLeftInset, fullRect, FULL, FULL);
check(
  'unscaled: top-left inset maps to (-1, 1)',
  closeTo(tl.x, -1) && closeTo(tl.y, 1),
  JSON.stringify(tl),
);

const br = pixelToCoord(bottomRightInset, bottomRightInset, fullRect, FULL, FULL);
check(
  'unscaled: bottom-right inset maps to (1, -1)',
  closeTo(br.x, 1) && closeTo(br.y, -1),
  JSON.stringify(br),
);

const ctr = pixelToCoord(center, center, fullRect, FULL, FULL);
check(
  'unscaled: field center maps to (0, 0)',
  closeTo(ctr.x, 0) && closeTo(ctr.y, 0),
  JSON.stringify(ctr),
);

// --- Receded field: transform: scale(0.5) (transform-origin top left, to
// keep this rect's own math simple — the origin choice doesn't matter to
// what's under test). The rendered box — and what getBoundingClientRect
// reports — is now 450x450 at (0,0). A press at the same *visual*
// right-edge-inset position as the unscaled case above now lands at half the
// pixel distance from the origin. ---
const SCALE = 0.5;
const RECEDED = FULL * SCALE; // 450
const recededRect = mockRect(0, 0, RECEDED, RECEDED);
const recededInsetPx = RECEDED * 0.95; // visual right-edge inset at this scale

// The fix under test: normalize by the SAME rect's live width/height — what
// useFieldGesture.ts's getCoord does post-U1 (rect.width/rect.height, not
// the cached ResizeObserver `size`).
const liveResult = pixelToCoord(recededInsetPx, recededInsetPx, recededRect, RECEDED, RECEDED);
check(
  'receded + live dimensions: right-edge inset still maps to (1, -1)',
  closeTo(liveResult.x, 1) && closeTo(liveResult.y, -1),
  JSON.stringify(liveResult),
);

// The bug this unit fixes: normalizing by the STALE, pre-transform cached
// size (900 — what ResizeObserver reported before the scale() was ever
// applied, since ResizeObserver's contentRect never reflects a transform on
// the observed element or an ancestor of it) while the offset still comes
// from the transform-aware rect above.
const staleResult = pixelToCoord(recededInsetPx, recededInsetPx, recededRect, FULL, FULL);
check(
  'receded + stale cached dimensions: right-edge inset badly undershoots (regression guard)',
  !closeTo(staleResult.x, 1, 0.3) && !closeTo(staleResult.y, -1, 0.3),
  `${JSON.stringify(staleResult)} — must NOT be near (1, -1)`,
);

// --- Field center stays (0, 0) under live dimensions at any scale (a
// origin-anchored transform is center-invariant, and this must hold once
// U2-U5 start driving recedeProgress continuously mid-gesture). ---
const recededCenterPx = RECEDED * 0.5;
const centerLive = pixelToCoord(recededCenterPx, recededCenterPx, recededRect, RECEDED, RECEDED);
check(
  'receded + live dimensions: field center still maps to (0, 0)',
  closeTo(centerLive.x, 0) && closeTo(centerLive.y, 0),
  JSON.stringify(centerLive),
);

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
