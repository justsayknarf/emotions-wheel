// Behavioural check for the sparse-check-in-legibility pure logic
// (src/utils/diaryAggregation.ts: gapWeight, hasSpreadCoverage, entriesInWindow).
// Run: npm run check:density
//
// This repo has no test runner, so this is the only automated exercise of
// this logic. Exits non-zero on any violation.
import {
  gapWeight,
  hasSpreadCoverage,
  entriesInWindow,
  distinctDayCount,
  dailyAggregates,
  MIN_SPREAD_DAYS,
} from '../src/utils/diaryAggregation';
import type { DiaryEntry, PinEntry } from '../src/types';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const HOUR = 60 * 60 * 1000;

// --- gapWeight ---
check('gapWeight: full weight at the boundary', gapWeight(6 * HOUR, 6 * HOUR, 24 * HOUR) === 1, 'weight at gap === fullWeightMs');
check('gapWeight: full weight below the boundary', gapWeight(2 * HOUR, 6 * HOUR, 24 * HOUR) === 1, 'weight at gap < fullWeightMs');

const w1 = gapWeight(12 * HOUR, 6 * HOUR, 24 * HOUR);
const w2 = gapWeight(48 * HOUR, 6 * HOUR, 24 * HOUR);
const w3 = gapWeight(240 * HOUR, 6 * HOUR, 24 * HOUR);
check('gapWeight: decreases monotonically past the boundary', w1 > w2 && w2 > w3, `${w1.toFixed(4)} > ${w2.toFixed(4)} > ${w3.toFixed(4)}`);
check('gapWeight: never negative, approaches 0 for very large gaps', w3 >= 0 && w3 < 0.01, `w3=${w3.toFixed(6)}`);

// --- hasSpreadCoverage / distinctDayCount ---
function mkEntry(daysAgo: number, hour: number, pins: PinEntry[] = [samplePin()]): DiaryEntry {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return { id: `e-${daysAgo}-${hour}`, timestamp: d.toISOString(), pins, sessionDurationMs: 1000 };
}
function samplePin(x = 0, y = 0): PinEntry {
  return { id: `p-${x}-${y}-${Math.random()}`, x, y, recognizedWords: [], regionDescription: { relational: 'r', narrative: 'n' } };
}

const twoDays = [mkEntry(0, 9), mkEntry(1, 9)];
check(
  'hasSpreadCoverage: false below MIN_SPREAD_DAYS',
  hasSpreadCoverage(twoDays, MIN_SPREAD_DAYS) === false,
  `${distinctDayCount(twoDays)} distinct days vs threshold ${MIN_SPREAD_DAYS}`,
);

const threeDaysAtThreshold = [...twoDays, mkEntry(2, 9)];
check(
  'hasSpreadCoverage: true at exactly MIN_SPREAD_DAYS',
  hasSpreadCoverage(threeDaysAtThreshold, MIN_SPREAD_DAYS) === true,
  `${distinctDayCount(threeDaysAtThreshold)} distinct days vs threshold ${MIN_SPREAD_DAYS}`,
);

const sameDayTriple = [mkEntry(0, 8), mkEntry(0, 12), mkEntry(0, 20)];
check(
  'distinctDayCount: three same-day entries count as one distinct day',
  distinctDayCount(sameDayTriple) === 1,
  `${distinctDayCount(sameDayTriple)} distinct day(s)`,
);

// --- entriesInWindow ---
const windowDays = [0, 1, 2].map(i => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - i);
  return d;
});
const inWindow = mkEntry(1, 9);
const oneOutside = mkEntry(3, 9);
const boundary = mkEntry(2, 9);
const filtered = entriesInWindow([inWindow, oneOutside, boundary], windowDays);
check(
  'entriesInWindow: excludes an entry one day outside the range',
  !filtered.some(e => e.id === oneOutside.id),
  `filtered ids: ${filtered.map(e => e.id).join(', ')}`,
);
check(
  'entriesInWindow: includes entries inside and on the boundary of the range',
  filtered.some(e => e.id === inWindow.id) && filtered.some(e => e.id === boundary.id),
  `filtered ids: ${filtered.map(e => e.id).join(', ')}`,
);

// --- Regression: dailyAggregates unchanged by the dateKey export ---
const mixed: DiaryEntry[] = [
  mkEntry(0, 8, [samplePin(0.5, -0.5)]),
  mkEntry(0, 20, [samplePin(-0.5, 0.5)]),
  mkEntry(1, 9, [samplePin(1, 1)]),
];
const agg = dailyAggregates(mixed);
check('dailyAggregates: still buckets by calendar day after dateKey export', agg.size === 2, `${agg.size} day bucket(s)`);
const day0 = [...agg.values()][0];
check(
  'dailyAggregates: day-0 bucket averages both same-day entries',
  Math.abs(day0.valence) < 1e-9 && Math.abs(day0.arousal) < 1e-9,
  `valence=${day0.valence}, arousal=${day0.arousal} (expected ~0,~0 — the two pins cancel out)`,
);

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
