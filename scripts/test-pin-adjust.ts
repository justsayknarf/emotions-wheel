// Behavioural check for adjustable pins (src/data/pins.ts + src/data/regions.ts).
// Run: npm run check:pin
//
// Asserts that adjusting a pin recomputes its description, preserves its origin
// and recognized words, and that a dropped pin is stamped with its drop origin.
// This repo has no test runner, so this is the only automated exercise of the
// adjust logic. Exits non-zero on any violation.
import { adjustPin, withOrigin } from '../src/data/pins';
import { getRegionDescription, nearbyEmotions } from '../src/data/regions';
import { emotions } from '../src/data/emotions';
import type { PinEntry } from '../src/types';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const basePin = (x: number, y: number, words: string[] = []): PinEntry => ({
  id: 'p1',
  x,
  y,
  recognizedWords: words,
  regionDescription: getRegionDescription(x, y, emotions),
  origin: { x, y },
});

// --- adjustPin recomputes the description to match the new coordinate ---
const start = basePin(0.51, -0.30, ['w-anxious']);
const moved = adjustPin(start, -0.40, 0.50);
const expected = getRegionDescription(-0.40, 0.50, emotions);
check(
  'description recomputed on move',
  moved.regionDescription.relational === expected.relational &&
    moved.regionDescription.narrative === expected.narrative,
  `${moved.regionDescription.relational} / ${moved.regionDescription.narrative}`,
);
check(
  'coordinate moved',
  moved.x === -0.40 && moved.y === 0.50,
  `(${moved.x}, ${moved.y})`,
);
check(
  'description actually changed',
  moved.regionDescription.relational !== start.regionDescription.relational,
  `${start.regionDescription.relational} → ${moved.regionDescription.relational}`,
);

// --- adjustPin preserves secondary/user data ---
check(
  'origin preserved across adjust',
  moved.origin?.x === 0.51 && moved.origin?.y === -0.30,
  `origin (${moved.origin?.x}, ${moved.origin?.y})`,
);
check(
  'recognized words preserved across adjust',
  moved.recognizedWords.length === 1 && moved.recognizedWords[0] === 'w-anxious',
  moved.recognizedWords.join(', ') || '(none)',
);

// --- withOrigin stamps a fresh drop; is idempotent ---
const dropped = withOrigin({
  id: 'p2',
  x: 0.2,
  y: -0.1,
  recognizedWords: [],
  regionDescription: getRegionDescription(0.2, -0.1, emotions),
});
check(
  'drop stamped with origin = its coordinate',
  dropped.origin?.x === 0.2 && dropped.origin?.y === -0.1,
  `origin (${dropped.origin?.x}, ${dropped.origin?.y})`,
);
const restamped = withOrigin(adjustPin(dropped, 0.9, 0.9));
check(
  'origin is idempotent (not overwritten by a later re-stamp)',
  restamped.origin?.x === 0.2 && restamped.origin?.y === -0.1,
  `origin (${restamped.origin?.x}, ${restamped.origin?.y}) after move to (0.9, 0.9)`,
);

// --- nearbyEmotions: the caption's guesses + tags (U3 required coverage) ---
const emById = new Map(emotions.map((e) => [e.id, e]));
const distTo = (x: number, y: number, id: string) => {
  const e = emById.get(id)!;
  return Math.hypot(x - e.x, y - e.y);
};

const nb = nearbyEmotions(0.51, -0.30, emotions, 7);
check('nearbyEmotions: within range and capped at limit', nb.length > 0 && nb.length <= 7, `${nb.length} returned`);

const nbDists = nb.map((n) => distTo(0.51, -0.30, n.id));
check(
  'nearbyEmotions: sorted nearest-first',
  nbDists.every((d, i) => i === 0 || d >= nbDists[i - 1]),
  nbDists.map((d) => d.toFixed(2)).join(', '),
);

check('nearbyEmotions: limit 0 returns empty', nearbyEmotions(0.51, -0.30, emotions, 0).length === 0, 'empty');

// The caption's two guesses (nb[0], nb[1]) must be the same nearest pair that
// getRegionDescription names — the "guesses equal the two nearest" contract.
const rel = getRegionDescription(0.51, -0.30, emotions).relational;
check(
  'nearbyEmotions: two nearest match the region relational pair',
  nb.length >= 2 && rel.includes(nb[0].label) && rel.includes(nb[1].label),
  `${nb[0].label}, ${nb[1].label} vs "${rel}"`,
);

// A far corner has fewer neighbors than a populated zone.
check(
  'nearbyEmotions: sparse edge returns no more than a dense zone',
  nearbyEmotions(-0.98, -0.98, emotions, 7).length <= nb.length,
  'edge neighborhood is not denser than an interior one',
);

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
