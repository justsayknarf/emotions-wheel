// Behavioural check for the landing page's sky geometry (src/landing/sky.ts).
// Run: npm run check:landing
//
// Asserts that viewport positions round-trip through the app's toPercent, that
// nearest-word lookup is a true distance order, and that a word two pins both
// reach is lit by the earlier one only. Exits non-zero on any violation.
import { emotions } from '../src/data/emotions';
import { toPercent } from '../src/utils/fieldGeometry';
import { SKY_PINS, SKY_LINES, litWordPins, nearestWordIds, pointToCoord } from '../src/landing/sky';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// --- round trip through toPercent ---
const rt = pointToCoord({ left: toPercent(0.3), top: toPercent(-0.5) });
check('round trip', Math.abs(rt.x - 0.3) < 1e-9 && Math.abs(rt.y - 0.5) < 1e-9, `x=${rt.x.toFixed(3)} y=${rt.y.toFixed(3)}`);

// --- field center is the viewport center ---
const mid = pointToCoord({ left: 50, top: 50 });
check('center', Math.abs(mid.x) < 1e-9 && Math.abs(mid.y) < 1e-9, `x=${mid.x} y=${mid.y}`);

// --- nearest is a true distance order ---
const probe = { x: -0.4, y: 0.4 };
const ids = nearestWordIds(probe.x, probe.y, emotions, 4);
const dist = (id: string) => {
  const e = emotions.find((w) => w.id === id)!;
  return Math.hypot(e.x - probe.x, e.y - probe.y);
};
const sorted = ids.every((id, i) => i === 0 || dist(ids[i - 1]) <= dist(id));
const bestOverall = Math.min(...emotions.map((e) => Math.hypot(e.x - probe.x, e.y - probe.y)));
check('nearest order', ids.length === 4 && sorted && Math.abs(dist(ids[0]) - bestOverall) < 1e-9, `${ids.join(', ')}`);

// --- earlier pin owns a shared word ---
const same = { left: 40, top: 40 };
const owner = litWordPins([same, same], emotions, 3);
check('earlier pin owns', [...owner.values()].every((w) => w.pin === 1), `owners=${[...new Set([...owner.values()].map((w) => w.pin))].join(',')}`);
check('slots rank from zero', [...owner.values()].map((w) => w.slot).sort().join('') === '012', `slots=${[...owner.values()].map((w) => w.slot).join(',')}`);

// --- every pin lights something, and lines reference real pins ---
for (const layout of ['wide', 'narrow'] as const) {
  const lit = litWordPins(SKY_PINS.map((p) => p[layout]), emotions, 3);
  const perPin = new Set([...lit.values()].map((w) => w.pin));
  check(`${layout} lights every pin`, perPin.size === SKY_PINS.length, `pins lit=${[...perPin].sort().join(',')}`);
}
check('lines valid', SKY_LINES.every(([a, b]) => a >= 1 && b >= 1 && a <= SKY_PINS.length && b <= SKY_PINS.length && a !== b), `${SKY_LINES.length} lines`);

process.exit(failures ? 1 : 0);
