#!/usr/bin/env node
// Nudges overlapping emotion words apart until none collide at the desktop
// reference render, using the same bounding-box model as lint-emotion-spacing.
// Each word is clamped to within MAX_DISPLACEMENT of its starting position and
// never crosses a quadrant axis, so valence/arousal meaning and cluster layout
// are preserved. Coordinates are rewritten in place (per-line token swap), so
// the hand-formatted alignment and cluster comments in the base framework file
// survive. Targets the hand-authored base set (circumplex-custom), which the
// admin editor also maintains; the active framework may be generator-authored.
//
// Run: node scripts/relax-emotion-spacing.mjs
// Then verify: node scripts/lint-emotion-spacing.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = join(ROOT, 'src/data/frameworks/circumplex-custom.ts');

// Reference render metrics — must match lint-emotion-spacing.mjs.
// W is the desktop field plane width (viewport minus companion rail, ~870 at a
// 1280 desktop), not the viewport.
const W = 870;
const H = 800;
const PAD = 8;
const LINE = 18;
const CHAR_W_SURFACE = 7.7;
const CHAR_W_DEEP = 6.6;
const PX_PER_UNIT_X = (90 / 100) * W / 2; // 576 px per coord unit
const PX_PER_UNIT_Y = (90 / 100) * H / 2; // 360 px per coord unit

const MAX_DISPLACEMENT = 0.12; // coord units from original position. Raised
// from 0.10 for the narrower desktop plane, where horizontal clearance between
// wide labels costs more coordinate distance; keeps the dense clusters legible.
const EPS = 0.01; // extra push past the clearing threshold — also clears the
// float-fragile exactly-one-line vertical gap after rounding to 2 decimals
const MAX_ITER = 400;

// --surface-only: clear just the always-visible surface layer. Deep words are
// capped to DEEP_REVEAL_CAP on screen and cannot be made globally non-overlapping
// at the current vocabulary density, so the default (all words) will not converge.
const SURFACE_ONLY = process.argv.includes('--surface-only');

const toPxX = (v) => (5 + ((v + 1) / 2) * 90) / 100 * W;
const toPxY = (v) => (5 + ((-v + 1) / 2) * 90) / 100 * H;
const labelWidth = (e) =>
  e.label.length * (e.depth === 'surface' ? CHAR_W_SURFACE : CHAR_W_DEEP);

const src = readFileSync(DATA_PATH, 'utf8');
const re =
  /id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+),\s*depth:\s*'(\w+)',\s*cluster:\s*'([^']+)'/g;

const emotions = [];
for (const m of src.matchAll(re)) {
  emotions.push({
    id: m[1],
    label: m[2],
    x: Number(m[3]),
    y: Number(m[4]),
    ox: Number(m[3]),
    oy: Number(m[4]),
    depth: m[5],
  });
}
if (emotions.length === 0) {
  console.error('relax: parsed 0 entries — aborting.');
  process.exit(1);
}

function overlapPush(a, b) {
  // In surface-only mode, ignore any pair involving a deep word
  if (SURFACE_ONLY && (a.depth !== 'surface' || b.depth !== 'surface')) return null;
  let dxpx = toPxX(a.x) - toPxX(b.x);
  let dypx = toPxY(a.y) - toPxY(b.y);
  const hThr = (labelWidth(a) + labelWidth(b)) / 2 + PAD;
  if (Math.abs(dxpx) >= hThr || Math.abs(dypx) >= LINE) return null;
  // Identical or vertically-aligned points: seed a deterministic x direction
  if (dxpx === 0 && dypx === 0) dxpx = 1;
  const coordDefX = (hThr - Math.abs(dxpx)) / PX_PER_UNIT_X;
  const coordDefY = (LINE - Math.abs(dypx)) / PX_PER_UNIT_Y;
  // Push along whichever axis is cheaper to clear
  if (coordDefX <= coordDefY) {
    const half = coordDefX / 2 + EPS;
    const dir = dxpx >= 0 ? 1 : -1;
    return { ax: dir * half, ay: 0, bx: -dir * half, by: 0 };
  }
  const half = coordDefY / 2 + EPS;
  const dir = dypx >= 0 ? 1 : -1;
  return { ax: 0, ay: dir * half, bx: 0, by: -dir * half };
}

function clamp(e) {
  // Keep within the displacement budget of the original position
  e.x = Math.max(e.ox - MAX_DISPLACEMENT, Math.min(e.ox + MAX_DISPLACEMENT, e.x));
  e.y = Math.max(e.oy - MAX_DISPLACEMENT, Math.min(e.oy + MAX_DISPLACEMENT, e.y));
  // Never cross a quadrant axis
  if (e.ox > 0) e.x = Math.max(0.02, e.x);
  else if (e.ox < 0) e.x = Math.min(-0.02, e.x);
  if (e.oy > 0) e.y = Math.max(0.02, e.y);
  else if (e.oy < 0) e.y = Math.min(-0.02, e.y);
  // Stay on the field
  e.x = Math.max(-0.98, Math.min(0.98, e.x));
  e.y = Math.max(-0.98, Math.min(0.98, e.y));
}

// Gauss-Seidel: apply each pair's push immediately so later checks in the same
// sweep see updated positions. Converges far more stably than simultaneous
// (Jacobi) updates, which oscillate when a word is pushed by many neighbors.
let iter = 0;
for (; iter < MAX_ITER; iter++) {
  let overlaps = 0;
  for (let i = 0; i < emotions.length; i++) {
    for (let j = i + 1; j < emotions.length; j++) {
      const a = emotions[i];
      const b = emotions[j];
      const push = overlapPush(a, b);
      if (!push) continue;
      overlaps++;
      a.x += push.ax;
      a.y += push.ay;
      b.x += push.bx;
      b.y += push.by;
      clamp(a);
      clamp(b);
    }
  }
  if (overlaps === 0) break;
}

// Round to the serializer's 2-decimal precision, then re-check
for (const e of emotions) {
  e.x = Math.round(e.x * 100) / 100;
  e.y = Math.round(e.y * 100) / 100;
}

let residual = 0;
for (let i = 0; i < emotions.length; i++) {
  for (let j = i + 1; j < emotions.length; j++) {
    if (overlapPush(emotions[i], emotions[j])) {
      residual++;
      console.error(
        `  residual: ${emotions[i].label} <-> ${emotions[j].label}`,
      );
    }
  }
}

// Rewrite coordinates in place — swap only the numeric tokens on each entry's
// line so alignment padding and cluster comments are preserved.
const fmt = (n) => (n >= 0 ? ' ' : '') + n.toFixed(2);
let out = src;
let rewritten = 0;
for (const e of emotions) {
  if (e.x === e.ox && e.y === e.oy) continue;
  const lineRe = new RegExp(
    `(id: '${e.id}',[^\\n]*?x:)\\s*-?[\\d.]+(,\\s*y:)\\s*-?[\\d.]+`,
  );
  const before = out;
  out = out.replace(lineRe, `$1 ${fmt(e.x)}$2 ${fmt(e.y)}`);
  if (out !== before) rewritten++;
}

writeFileSync(DATA_PATH, out, 'utf8');
console.log(
  `relax: ${iter} iteration(s), moved ${rewritten} word(s), ${residual} residual overlap(s).`,
);
if (residual > 0) {
  console.error('relax: residual overlaps remain — hand-fix the pairs above.');
  process.exit(1);
}
