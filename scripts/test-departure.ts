// Behavioural check for the departure mark's pure logic (src/data/departure.ts).
// Run: npm run check:departure
//
// U1 (departure-mark plan) covers departureAnchor, relativeDayLabel, and
// describeDelta; that same plan's U2 adds the departure-mode predicate
// assertions. The desktop-check-in-focus plan's own U2
// (docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md) extends
// departureAnchor's signature with an `emotions` parameter and its
// null-previousCheckIn behavior (a synthetic neutral-center pin rather than
// null) — see the "departureAnchor: neutral-anchor synthetic pin" block
// below. This repo has no test runner, so this is the only automated
// exercise of the logic. Exits non-zero on any violation.
import {
  departureAnchor,
  relativeDayLabel,
  describeDelta,
  isDepartureEligible,
  hasNotableDelta,
  departureDragProgress,
} from '../src/data/departure';
import { emotions } from '../src/data/emotions';
import type { DiaryEntry, PinEntry } from '../src/types';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const pin = (id: string, x: number, y: number): PinEntry => ({
  id,
  x,
  y,
  recognizedWords: [],
  regionDescription: { relational: `near *${id}*`, narrative: `${id} narrative` },
});

const entry = (id: string, timestamp: string, pins: PinEntry[]): DiaryEntry => ({
  id,
  timestamp,
  pins,
  sessionDurationMs: 1000,
});

// --- departureAnchor: newest pin, matching resolveActiveSelection's case 4 ---
{
  const multi = entry('e1', '2026-08-20T09:00:00.000Z', [pin('p1', 0.1, 0.2), pin('p2', -0.3, 0.4)]);
  check(
    'returns the last pin of a multi-pin check-in',
    departureAnchor(multi, emotions)?.id === 'p2',
    `resolved to ${departureAnchor(multi, emotions)?.id}`,
  );

  // desktop-check-in-focus plan's U2: a real previousCheckIn's own anchor
  // pin is unchanged by the new `emotions` parameter — same pin, same id,
  // regardless of which emotions array is passed (it's only consulted for
  // the synthetic neutral-anchor case below).
  check(
    'a real previous check-in returns its own anchor pin, unaffected by `emotions`',
    departureAnchor(multi, emotions)?.id === 'p2' && departureAnchor(multi, [])?.id === 'p2',
    `resolved to ${departureAnchor(multi, emotions)?.id} / ${departureAnchor(multi, [])?.id}`,
  );

  const empty = entry('e2', '2026-08-20T09:00:00.000Z', []);
  check(
    'empty-pins check-in returns null (unreachable via the UI — Save is disabled at zero pins — but unchanged from before this unit)',
    departureAnchor(empty, emotions) === null,
    `resolved to ${departureAnchor(empty, emotions)}`,
  );
}

// --- departureAnchor: neutral-anchor synthetic pin (desktop-check-in-focus
// plan's U2) — no previousCheckIn at all now returns a synthetic (0, 0) pin
// instead of null, the first-time desktop landing's neutral-centered anchor
// (R2). A real previousCheckIn's own anchor pin (above) is unchanged. ---
{
  const neutral = departureAnchor(null, emotions);
  check(
    'null check-in returns a pin, not null',
    neutral !== null,
    `resolved to ${neutral}`,
  );
  check(
    'neutral anchor is centered at (0, 0)',
    neutral?.x === 0 && neutral?.y === 0,
    `resolved to (${neutral?.x}, ${neutral?.y})`,
  );
  check(
    'neutral anchor carries the "neutral-anchor" id',
    neutral?.id === 'neutral-anchor',
    `resolved to ${neutral?.id}`,
  );
  check(
    'neutral anchor has no recognized words',
    Array.isArray(neutral?.recognizedWords) && neutral?.recognizedWords.length === 0,
    JSON.stringify(neutral?.recognizedWords),
  );
  check(
    'neutral anchor carries a valid regionDescription',
    typeof neutral?.regionDescription?.relational === 'string' && (neutral?.regionDescription.relational.length ?? 0) > 0
      && typeof neutral?.regionDescription?.narrative === 'string' && (neutral?.regionDescription.narrative.length ?? 0) > 0,
    JSON.stringify(neutral?.regionDescription),
  );
}

// --- relativeDayLabel ---
{
  const now = new Date('2026-08-24T12:00:00.000Z');
  const WEEKDAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  check('same-day is TODAY', relativeDayLabel(daysAgo(0), now) === 'TODAY', relativeDayLabel(daysAgo(0), now));
  check('one day back is YESTERDAY', relativeDayLabel(daysAgo(1), now) === 'YESTERDAY', relativeDayLabel(daysAgo(1), now));

  for (const n of [2, 3, 4, 5, 6]) {
    const ts = daysAgo(n);
    const expected = WEEKDAY_ABBR[new Date(ts).getDay()];
    check(`${n} days back is a weekday (${expected})`, relativeDayLabel(ts, now) === expected, relativeDayLabel(ts, now));
  }

  for (const n of [8, 10, 30, 90, 400]) {
    const label = relativeDayLabel(daysAgo(n), now);
    check(
      `${n} days back is not a weekday abbreviation`,
      !WEEKDAY_ABBR.includes(label),
      label,
    );
  }

  // Month and year boundaries — must not throw, must not return a weekday.
  const acrossYear = relativeDayLabel('2025-12-15T00:00:00.000Z', new Date('2026-01-10T00:00:00.000Z'));
  check('across a year boundary does not throw', typeof acrossYear === 'string', acrossYear);
  check('across a year boundary is not a weekday', !WEEKDAY_ABBR.includes(acrossYear), acrossYear);

  const stale = relativeDayLabel('2024-01-01T00:00:00.000Z', now);
  check('a stale timestamp does not throw', typeof stale === 'string', stale);
  check('a stale timestamp is not a weekday', !WEEKDAY_ABBR.includes(stale), stale);
}

// --- describeDelta ---
{
  // Both axes under the 0.10 threshold — neutral phrasing, no axis named.
  const neutral = describeDelta({ x: 0.2, y: -0.1 }, { x: 0.25, y: -0.05 }, 'TUE');
  check(
    'both under threshold: neutral phrasing',
    neutral === 'About where you were on TUE.',
    neutral,
  );

  // Only the arousal (x) axis crosses into "much" — valence stays omitted.
  const arousalOnly = describeDelta({ x: 0, y: 0.3 }, { x: 0.8, y: 0.32 }, 'TUE');
  check(
    'arousal-only: names activated, omits valence',
    arousalOnly === 'Much more activated than TUE.' && !arousalOnly.includes('positive') && !arousalOnly.includes('negative'),
    arousalOnly,
  );

  // The calmer direction is named (not "more activated") when x decreases.
  const calmerOnly = describeDelta({ x: 0.5, y: 0 }, { x: 0.15, y: 0.01 }, 'TUE');
  check(
    'calmer direction is named, not "more activated"',
    calmerOnly.toLowerCase().includes('calmer') && !calmerOnly.toLowerCase().includes('activated'),
    calmerOnly,
  );

  // Band boundaries, both directions — just under/over each edge: 0.10
  // (named at all), 0.32 (little/plain), 0.62 (plain/much).
  const bandCases: Array<[number, 'omitted' | 'little' | 'plain' | 'much']> = [
    [0.09, 'omitted'], [0.11, 'little'],
    [0.31, 'little'], [0.33, 'plain'],
    [0.61, 'plain'], [0.63, 'much'],
  ];
  for (const [delta, expected] of bandCases) {
    for (const sign of [1, -1] as const) {
      const s = describeDelta({ x: 0, y: 0 }, { x: sign * delta, y: 0 }, 'TUE');
      if (expected === 'omitted') {
        check(
          `${sign > 0 ? '+' : '-'}${delta} is below the name threshold: neutral`,
          s === 'About where you were on TUE.',
          s,
        );
        continue;
      }
      const word = sign > 0 ? 'more activated' : 'calmer';
      const prefix = expected === 'little' ? 'a little ' : expected === 'much' ? 'much ' : '';
      const expectSubstr = `${prefix}${word}`;
      check(
        `${sign > 0 ? '+' : '-'}${delta} produces "${expectSubstr}"`,
        s.toLowerCase().includes(expectSubstr),
        s,
      );
    }
  }

  // Both axes over threshold, joined with "and".
  const both = describeDelta({ x: 0, y: 0 }, { x: 0.5, y: -0.5 }, 'TUE');
  check(
    'both axes named, joined with "and"',
    both === 'More activated and more negative than TUE.',
    both,
  );

  // Capitalisation + exactly one terminal period, regardless of clause count.
  for (const s of [neutral, arousalOnly, both]) {
    const periods = (s.match(/\./g) ?? []).length;
    check(`"${s}" is capitalised`, /^[A-Z]/.test(s), s);
    check(`"${s}" has exactly one terminal period`, periods === 1 && s.endsWith('.'), s);
  }

  // TODAY/YESTERDAY don't read as dates at all — "earlier"/"before".
  const today = describeDelta({ x: 0, y: 0 }, { x: 0, y: 0 }, 'TODAY');
  check('TODAY reads as "earlier" in the neutral tail', today === 'About where you were earlier.', today);
  const yesterday = describeDelta({ x: 0.5, y: 0 }, { x: 0, y: 0 }, 'YESTERDAY');
  check('YESTERDAY reads as "before" in a qualified tail', yesterday.endsWith('than before.'), yesterday);
}

// --- hasNotableDelta (U3) ---
{
  check(
    'both axes under threshold: not notable',
    hasNotableDelta({ x: 0.2, y: -0.1 }, { x: 0.25, y: -0.05 }) === false,
    'false expected',
  );
  check(
    'one axis at the threshold: notable',
    hasNotableDelta({ x: 0, y: 0 }, { x: 0.10, y: 0 }) === true,
    'true expected',
  );
  check(
    'identical coordinates: not notable',
    hasNotableDelta({ x: 0.4, y: -0.4 }, { x: 0.4, y: -0.4 }) === false,
    'false expected',
  );
}

// --- isDepartureEligible (U2) ---
{
  const prev = entry('e1', '2026-08-20T09:00:00.000Z', [pin('p1', 0.1, 0.2)]);

  check(
    'empty draft + previous check-in: eligible',
    isDepartureEligible(false, 0, prev) === true,
    String(isDepartureEligible(false, 0, prev)),
  );
  check(
    'non-empty draft: not eligible',
    isDepartureEligible(false, 1, prev) === false,
    String(isDepartureEligible(false, 1, prev)),
  );
  check(
    'no previous check-in: not eligible (first-run path unaffected)',
    isDepartureEligible(false, 0, null) === false,
    String(isDepartureEligible(false, 0, null)),
  );
  check(
    'mid-reopen: not eligible even with an empty draft and a previous check-in',
    isDepartureEligible(true, 0, prev) === false,
    String(isDepartureEligible(true, 0, prev)),
  );
}

// --- departureDragProgress (U3: drag-triggered progressive transition,
// docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md) ---
{
  check(
    'no travel from the origin: progress 0',
    departureDragProgress(0, 0, 1) === 0,
    String(departureDragProgress(0, 0, 1)),
  );
  check(
    'travel equal to fullTravel: progress 1',
    departureDragProgress(0, 1, 1) === 1,
    String(departureDragProgress(0, 1, 1)),
  );
  check(
    'travel in the opposite direction is treated the same (absolute distance)',
    departureDragProgress(0, -1, 1) === 1,
    String(departureDragProgress(0, -1, 1)),
  );
  check(
    'half the fullTravel: progress 0.5',
    departureDragProgress(0, 0.5, 1) === 0.5,
    String(departureDragProgress(0, 0.5, 1)),
  );
  check(
    'travel from a non-zero origin measures distance from THAT origin, not from 0',
    departureDragProgress(0.6, 0.6, 1) === 0 && departureDragProgress(0.6, 0.1, 1) === 0.5,
    `${departureDragProgress(0.6, 0.6, 1)} / ${departureDragProgress(0.6, 0.1, 1)}`,
  );
  check(
    'overshooting fullTravel clamps to 1, never exceeds it',
    departureDragProgress(0, 1, 0.4) === 1,
    String(departureDragProgress(0, 1, 0.4)),
  );
  check(
    'a non-positive fullTravel does not throw or return NaN/Infinity — any real movement is full progress',
    departureDragProgress(0, 0.01, 0) === 1 && Number.isFinite(departureDragProgress(0, 0.01, 0)),
    String(departureDragProgress(0, 0.01, 0)),
  );
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
