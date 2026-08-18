// Behavioural check for the check-in model's pure logic (src/data/checkIn.ts).
// Run: npm run check:checkin
//
// U1 covers updateEntryInList — replacing a recorded diary entry in place by
// id. Later units (U2's previous-check-in derivation, U3's active-check-in /
// pin resolution) add their assertions to this same script as they land in
// src/data/checkIn.ts. This repo has no test runner, so this is the only
// automated exercise of the logic. Exits non-zero on any violation.
import { updateEntryInList } from '../src/data/checkIn';
import { updateEntry } from '../src/store/diary';
import type { DiaryEntry, PinEntry } from '../src/types';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const pin = (id: string, x: number, y: number, words: string[] = []): PinEntry => ({
  id,
  x,
  y,
  recognizedWords: words,
  regionDescription: { relational: `near *${id}*`, narrative: `${id} narrative` },
});

const entry = (id: string, timestamp: string, pins: PinEntry[], durationMs = 1000): DiaryEntry => ({
  id,
  timestamp,
  pins,
  sessionDurationMs: durationMs,
});

// --- updateEntryInList: replaces pins, keeps id/position/original timestamp ---
{
  const original = entry('e2', '2026-08-01T10:00:00.000Z', [pin('p1', 0.1, 0.2, ['w-calm'])]);
  const before = [
    entry('e1', '2026-07-30T09:00:00.000Z', [pin('p0', -0.5, 0.5)]),
    original,
    entry('e3', '2026-08-05T09:00:00.000Z', [pin('p2', 0.9, -0.9)]),
  ];

  // Caller passes a "corrected" version of e2 — new pins, and (deliberately,
  // to prove it gets overridden) a bogus later timestamp.
  const correction = entry('e2', '2026-08-10T00:00:00.000Z', [
    pin('p1-new', -0.3, 0.4, ['w-content', 'w-relieved']),
  ]);

  const after = updateEntryInList(before, correction);

  check(
    'id unchanged',
    after[1].id === 'e2',
    after[1].id,
  );
  check(
    'position unchanged (still index 1)',
    after.length === 3 && after[1].id === 'e2',
    `length ${after.length}, entry at index 1 has id ${after[1]?.id}`,
  );
  check(
    'original timestamp preserved, not the update\'s',
    after[1].timestamp === '2026-08-01T10:00:00.000Z',
    after[1].timestamp,
  );
  check(
    'pins replaced with the update\'s pins',
    after[1].pins.length === 1 && after[1].pins[0].id === 'p1-new' &&
      after[1].pins[0].recognizedWords.join(',') === 'w-content,w-relieved',
    JSON.stringify(after[1].pins),
  );
  check(
    'every other entry preserved untouched',
    after[0] === before[0] && after[2] === before[2],
    `e1 identity ${after[0] === before[0]}, e3 identity ${after[2] === before[2]}`,
  );
  check(
    'source array not mutated in place',
    before[1].pins[0].id === 'p1',
    `before[1] still has original pin id ${before[1].pins[0].id}`,
  );
}

// --- updateEntryInList: missing id is a no-op, not an append ---
{
  const before = [
    entry('e1', '2026-07-30T09:00:00.000Z', [pin('p0', 0, 0)]),
    entry('e2', '2026-08-01T09:00:00.000Z', [pin('p1', 0.1, 0.1)]),
  ];
  const ghost = entry('does-not-exist', '2026-08-15T00:00:00.000Z', [pin('p9', 0.5, 0.5)]);
  const after = updateEntryInList(before, ghost);

  check(
    'missing id leaves diary unchanged',
    after.length === 2 && after === before,
    `length ${after.length}, same reference: ${after === before}`,
  );
  check(
    'missing id does not append',
    !after.some((e) => e.id === 'does-not-exist'),
    'no ghost entry present',
  );
}

// --- updateEntryInList: survives a diary at the prune ceiling ---
{
  // Mirrors src/store/diary.ts's MAX_ENTRIES (500) — appendEntry prunes once
  // the diary reaches this size. updateEntryInList itself never prunes or
  // appends; it only ever replaces in place, so a diary already at the
  // ceiling should come back at exactly the same length.
  const MAX_ENTRIES = 500;
  const before: DiaryEntry[] = Array.from({ length: MAX_ENTRIES }, (_, i) =>
    entry(`bulk-${i}`, `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.000Z`, [pin(`p-${i}`, 0, 0)]),
  );
  const targetIndex = 250;
  const targetId = before[targetIndex].id;
  const originalTimestamp = before[targetIndex].timestamp;
  const correction = entry(targetId, '2026-12-31T00:00:00.000Z', [pin('p-corrected', 0.7, -0.7)]);

  const after = updateEntryInList(before, correction);

  check(
    'diary at prune ceiling keeps its length after update',
    after.length === MAX_ENTRIES,
    `length ${after.length}`,
  );
  check(
    'no entries dropped at the ceiling',
    after.every((e, i) => e.id === before[i].id || e.id === targetId),
    'every id still present at its original index',
  );
  check(
    'targeted entry updated, original timestamp kept',
    after[targetIndex].pins[0].id === 'p-corrected' && after[targetIndex].timestamp === originalTimestamp,
    `pin ${after[targetIndex].pins[0].id}, timestamp ${after[targetIndex].timestamp}`,
  );
}

// --- src/store/diary.ts's updateEntry wrapper: degrades quietly ---
// `npx tsx` has no localStorage (verified: typeof localStorage === 'undefined'
// under this runner), so calling the storage-backed wrapper here exercises
// exactly the "store unavailable" path readDiary already degrades on. The
// assertion is simply that it does not throw — matching readDiary's
// try/catch-and-degrade posture rather than propagating the error.
{
  let threw = false;
  try {
    updateEntry(entry('any-id', '2026-08-01T00:00:00.000Z', [pin('p1', 0, 0)]));
  } catch {
    threw = true;
  }
  check(
    'updateEntry wrapper degrades quietly when the store is unavailable',
    !threw,
    threw ? 'threw instead of degrading' : 'did not throw',
  );
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
