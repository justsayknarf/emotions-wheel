#!/usr/bin/env node
// Fails when any two emotion words would render as overlapping text at a
// desktop reference viewport. Guards src/data/emotions.ts against colliding
// coordinates — including edits saved through the admin editor.
//
// Overlap model (see docs/plans/2026-07-07-002-fix-emotion-word-spacing-plan.md):
// two words overlap when their horizontal gap is under half the sum of their
// estimated label widths (plus padding) AND their vertical gap is under one
// line height. Euclidean distance is the wrong check — labels need far more
// horizontal than vertical separation.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = join(ROOT, 'src/data/emotions.ts');

// Reference render metrics
const W = 1280;
const H = 800;
const PAD = 8; // px breathing room added to each pair's horizontal threshold
const LINE = 18; // px vertical overlap threshold (between text-xs 16 and text-sm 20)
const CHAR_W_SURFACE = 7.7; // px per char at 14px font
const CHAR_W_DEEP = 6.6; // px per char at 12px font

// Coordinate [-1,1] → pixel, matching EmotionWord.tsx toPercent (5%..95%)
const toPxX = (v) => (5 + ((v + 1) / 2) * 90) / 100 * W;
const toPxY = (v) => (5 + ((-v + 1) / 2) * 90) / 100 * H; // Y inverted in render
const labelWidth = (e) =>
  e.label.length * (e.depth === 'surface' ? CHAR_W_SURFACE : CHAR_W_DEEP);

function parseEmotions(src) {
  // Whitespace-tolerant: the data file is hand-formatted with column-aligned
  // padding today and serializer-formatted (single-space) after an admin save.
  const re =
    /id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+),\s*depth:\s*'(\w+)',\s*cluster:\s*'([^']+)'/g;
  const out = [];
  for (const m of src.matchAll(re)) {
    out.push({
      id: m[1],
      label: m[2],
      x: Number(m[3]),
      y: Number(m[4]),
      depth: m[5],
      cluster: m[6],
    });
  }
  return out;
}

function overlaps(a, b) {
  const dx = Math.abs(toPxX(a.x) - toPxX(b.x));
  const dy = Math.abs(toPxY(a.y) - toPxY(b.y));
  const hThreshold = (labelWidth(a) + labelWidth(b)) / 2 + PAD;
  return dx < hThreshold && dy < LINE;
}

const src = readFileSync(DATA_PATH, 'utf8');
const emotions = parseEmotions(src);

// R7 guard: fail loudly if the format drifted and the regex silently under-parsed
const rawCount = (src.match(/\{\s*id:\s*'/g) ?? []).length;
if (emotions.length === 0 || emotions.length < rawCount) {
  console.error(
    `Parse guard failed: matched ${emotions.length} of ${rawCount} entries in src/data/emotions.ts.`,
  );
  console.error(
    'The serializer line format likely drifted from the lint regex — fix the regex before trusting this check.',
  );
  process.exit(1);
}

const buckets = { 'surface-surface': [], 'surface-deep': [], 'deep-deep': [] };
for (let i = 0; i < emotions.length; i++) {
  for (let j = i + 1; j < emotions.length; j++) {
    const a = emotions[i];
    const b = emotions[j];
    if (!overlaps(a, b)) continue;
    const key =
      a.depth === 'surface' && b.depth === 'surface'
        ? 'surface-surface'
        : a.depth === 'deep' && b.depth === 'deep'
          ? 'deep-deep'
          : 'surface-deep';
    const dist = Math.hypot(a.x - b.x, a.y - b.y).toFixed(3);
    buckets[key].push(
      `  ${a.label} (${a.x}, ${a.y}) <-> ${b.label} (${b.x}, ${b.y})  [d=${dist}]`,
    );
  }
}

// Only surface-surface overlaps are fatal: every surface word paints in the
// idle field at all times, so two overlapping surface words are permanently
// illegible. Deep words render at most DEEP_REVEAL_CAP at a time near a
// dwell/pin and are transient — global deep non-overlap is both unachievable
// at the current vocabulary density and unnecessary once the reveal is capped,
// so deep-involving overlaps are reported as advisory, not failures.
const fatal = buckets['surface-surface'];
const advisory =
  buckets['surface-deep'].length + buckets['deep-deep'].length;

if (fatal.length > 0) {
  console.error(`surface-surface overlaps (${fatal.length}) — always co-visible:`);
  for (const row of fatal) console.error(row);
}
if (advisory > 0) {
  console.log(
    `emotion-spacing: advisory — ${buckets['surface-deep'].length} surface-deep, ` +
      `${buckets['deep-deep'].length} deep-deep overlaps (transient; capped on screen).`,
  );
}

if (fatal.length > 0) {
  console.error(
    `\nemotion-spacing: FAIL — ${fatal.length} surface-surface overlap(s) across ${emotions.length} words.`,
  );
  process.exit(1);
}

console.log(`emotion-spacing: OK — ${emotions.length} words, no surface-surface overlaps.`);
process.exit(0);
