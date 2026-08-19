// Behavioural check for the check-in model's pure logic (src/data/checkIn.ts).
// Run: npm run check:checkin
//
// U1 covers updateEntryInList — replacing a recorded diary entry in place by
// id. U2 covers derivePreviousCheckIn — the most-recent-entry derivation that
// stands in for a second stored "previous check-in" copy. U3's active-check-in
// / pin resolution adds its assertions to this same script as it lands in
// src/data/checkIn.ts. This repo has no test runner, so this is the only
// automated exercise of the logic. Exits non-zero on any violation.
import { updateEntryInList, derivePreviousCheckIn, resolveActiveSelection, findNearbyPin } from '../src/data/checkIn';
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
  // to prove they get overridden) a bogus later timestamp and a bogus
  // sessionDurationMs.
  const correction = entry('e2', '2026-08-10T00:00:00.000Z', [
    pin('p1-new', -0.3, 0.4, ['w-content', 'w-relieved']),
  ], 999999);

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
    // U7: a correction is not a new sitting — the original entry's
    // sessionDurationMs (1000, from the `entry()` helper's default) is kept,
    // not the update's bogus 999999, mirroring the timestamp assertion above.
    'original sessionDurationMs preserved, not the update\'s',
    after[1].sessionDurationMs === 1000,
    String(after[1].sessionDurationMs),
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

// === U2: derivePreviousCheckIn ===
// App.tsx calls this at render, next to the `lastCoord` derivation, with
// `draftId` always null in this unit (there is no carried-draft-id concept
// until U7 wires reopen). These assertions exercise the function directly,
// including the non-null-draftId branch nothing calls yet.

// --- the most recent entry when several exist ---
{
  const e1 = entry('e1', '2026-06-01T09:00:00.000Z', [pin('p1', 0.1, 0.1)]);
  const e2 = entry('e2', '2026-07-15T09:00:00.000Z', [pin('p2', 0.2, 0.2)]);
  const e3 = entry('e3', '2026-08-10T09:00:00.000Z', [pin('p3', 0.3, 0.3)]);
  const previous = derivePreviousCheckIn([e1, e2, e3], null);

  check(
    'previous check-in is the most recent entry when several exist',
    previous?.id === 'e3',
    `resolved to ${previous?.id}`,
  );
}

// --- Covers AE6: a three-pin check-in surfaces all three pins ---
{
  const threePin = entry('e-three', '2026-08-12T09:00:00.000Z', [
    pin('p1', -0.4, 0.2),
    pin('p2', 0.1, -0.3),
    pin('p3', 0.6, 0.6),
  ]);
  const previous = derivePreviousCheckIn([threePin], null);

  check(
    'AE6: a check-in recorded with three pins surfaces all three as the previous check-in',
    previous?.pins.length === 3 && previous.pins.map((p) => p.id).join(',') === 'p1,p2,p3',
    JSON.stringify(previous?.pins.map((p) => p.id)),
  );
}

// --- excludes the entry whose id the draft carries ---
{
  const e1 = entry('e1', '2026-07-01T09:00:00.000Z', [pin('p1', 0, 0)]);
  const e2 = entry('e2', '2026-08-01T09:00:00.000Z', [pin('p2', 0.5, 0.5)]);
  // Nothing calls derivePreviousCheckIn with a non-null draftId yet — this
  // unit's own App.tsx call site always passes null (no carried-id concept
  // exists in the draft until U7 adds reopen). This proves the exclusion the
  // function is already built for, ahead of anything using it that way.
  const previousWhenE2Reopened = derivePreviousCheckIn([e1, e2], 'e2');
  const previousWithNoDraft = derivePreviousCheckIn([e1, e2], null);

  check(
    'previous check-in excludes the entry whose id the draft carries, so a reopened check-in resolves to exactly one group',
    previousWhenE2Reopened?.id === 'e1',
    `resolved to ${previousWhenE2Reopened?.id}`,
  );
  check(
    'with no carried id, the most recent entry resolves normally',
    previousWithNoDraft?.id === 'e2',
    `resolved to ${previousWithNoDraft?.id}`,
  );
}

// --- age does not retire a previous check-in ---
{
  const weeksOld = entry('e-old', '2026-06-01T09:00:00.000Z', [pin('p1', 0, 0)]);
  const previous = derivePreviousCheckIn([weeksOld], null);

  check(
    'a weeks-old entry still resolves as the previous check-in — age does not retire it',
    previous?.id === 'e-old',
    `resolved to ${previous?.id}`,
  );
}

// --- no history, no draft ---
{
  const previous = derivePreviousCheckIn([], null);

  check(
    'with no history and no draft, neither a previous check-in nor a draft is present',
    previous === null,
    `resolved to ${previous}`,
  );
}

// --- Covers AE1 (pure-logic half only — see report): recording a one-pin
// draft leaves the draft empty and one entry recorded. What this asserts is
// the derivation side: once a draft's pins are recorded into an entry,
// derivePreviousCheckIn resolves that entry as the previous check-in — the
// same derivation App.tsx's `previousCheckIn` reads after handleRecord's
// `setPins([])`. That the draft (`pins` state in App.tsx) actually empties on
// record is React state and cannot be asserted by this Node script — there is
// no component harness (AGENTS.md) and this script cannot import App.tsx
// (framer-motion, DOM-touching hooks, no DOM under `npx tsx`).
{
  const before: DiaryEntry[] = [];
  const recorded = entry('e-recorded', '2026-08-18T09:00:00.000Z', [pin('p1', 0.2, -0.2)]);
  const after = [...before, recorded]; // models appendEntry's effect

  const previous = derivePreviousCheckIn(after, null);

  check(
    'AE1 (pure-logic half): the just-recorded one-pin entry becomes the previous check-in',
    previous?.id === 'e-recorded' && previous.pins.length === 1,
    `resolved to ${previous?.id} with ${previous?.pins.length ?? 0} pin(s)`,
  );
}

// --- Covers AE2 (pure-logic half only — see report): with a draft cleared by
// recording, no further record call can produce a second entry for it.
// Pure-logic half: derivePreviousCheckIn is stable over an unchanged diary —
// deriving twice in a row (modeling "the draft has nothing left, so nothing
// gets appended between the two looks") still resolves to the same single
// entry, not a second one. The actual guard — handleDone's
// `pins.length > 0` check plus handleRecord's `setPins([])` — is React state
// and needs manual verification; see report.
{
  const recorded = entry('e-recorded', '2026-08-18T09:00:00.000Z', [pin('p1', 0, 0)]);
  const diary = [recorded];

  const firstLook = derivePreviousCheckIn(diary, null);
  const secondLook = derivePreviousCheckIn(diary, null);

  check(
    'AE2 (pure-logic half): re-deriving over an unchanged diary still resolves to exactly one entry',
    diary.length === 1 && firstLook?.id === 'e-recorded' && secondLook?.id === 'e-recorded',
    `diary length ${diary.length}, first ${firstLook?.id}, second ${secondLook?.id}`,
  );
}

// === U3: resolveActiveSelection ===
// App.tsx calls this at render (replacing the old flat
// selectedPin/effectiveSelectedPinId derivation) with the draft pins, the
// derived previousCheckIn, and the stored selectedPinId. These assertions
// exercise the cascade directly, including branches (a selectedPinId matching
// a previousCheckIn pin) that nothing in the UI can reach yet — no card or
// field pin exists for the previous check-in until U4/U6 land — same pattern
// U1/U2 used to prove a mechanism ahead of its UI wiring.

// --- Covers AE9: dropping a pin while the previous check-in is active makes
// the draft active and selects the new pin ---
{
  const previousCheckIn = entry('e-prev', '2026-08-10T09:00:00.000Z', [pin('p-prev', 0.1, 0.1)]);
  // Simulate handlePinRelease: a fresh id was just pushed onto the draft and
  // immediately passed as selectedPinId (App.tsx's handlePinRelease does both
  // in the same call).
  const freshPin = pin('p-fresh', -0.2, 0.6);
  const draftPins = [freshPin];
  const resolved = resolveActiveSelection(draftPins, previousCheckIn, 'p-fresh');

  check(
    'AE9: dropping a pin while the previous check-in is active makes the draft active and selects the new pin',
    resolved.activeCheckIn === 'draft' && resolved.pin?.id === 'p-fresh',
    `resolved to ${resolved.activeCheckIn}/${resolved.pin?.id}`,
  );
}

// --- selecting a previous check-in's pin activates that check-in and selects
// that pin ---
{
  const previousCheckIn = entry('e-prev', '2026-08-10T09:00:00.000Z', [
    pin('p-a', 0.1, 0.1),
    pin('p-b', -0.4, 0.3),
  ]);
  const resolved = resolveActiveSelection([], previousCheckIn, 'p-b');

  check(
    "selecting a previous check-in's pin activates that check-in and selects that pin",
    resolved.activeCheckIn === 'previous' && resolved.pin?.id === 'p-b',
    `resolved to ${resolved.activeCheckIn}/${resolved.pin?.id}`,
  );
}

// --- removing the selected pin falls back to the newest pin within the same
// check-in, not across check-ins ---
{
  const previousCheckIn = entry('e-prev', '2026-08-10T09:00:00.000Z', [pin('p-old', 0, 0)]);
  const draftPins = [pin('p1', 0.1, 0.1), pin('p2', 0.2, 0.2)];
  // selectedPinId matches neither remaining draft pin — as if the pin it
  // pointed to was just removed.
  const resolved = resolveActiveSelection(draftPins, previousCheckIn, 'p-removed');

  check(
    'removing the selected pin falls back to the newest pin within the same (draft) check-in, not across to the previous one',
    resolved.activeCheckIn === 'draft' && resolved.pin?.id === 'p2',
    `resolved to ${resolved.activeCheckIn}/${resolved.pin?.id}`,
  );
}

// --- at most one check-in is active, and exactly one whenever a draft or a
// previous check-in exists ---
{
  const previousCheckIn = entry('e-prev', '2026-08-10T09:00:00.000Z', [pin('p-prev', 0, 0)]);
  const draftPins = [pin('p1', 0.1, 0.1)];

  const bothPresent = resolveActiveSelection(draftPins, previousCheckIn, null);
  const onlyDraft = resolveActiveSelection(draftPins, null, null);
  const onlyPrevious = resolveActiveSelection([], previousCheckIn, null);
  const neither = resolveActiveSelection([], null, null);

  check(
    'both present: exactly one check-in active (draft, since it takes priority)',
    bothPresent.activeCheckIn === 'draft',
    `resolved to ${bothPresent.activeCheckIn}`,
  );
  check(
    'only draft present: draft active',
    onlyDraft.activeCheckIn === 'draft',
    `resolved to ${onlyDraft.activeCheckIn}`,
  );
  check(
    'only previous check-in present: previous active',
    onlyPrevious.activeCheckIn === 'previous',
    `resolved to ${onlyPrevious.activeCheckIn}`,
  );
  check(
    'neither present: no check-in active',
    neither.activeCheckIn === null && neither.pin === null,
    `resolved to ${neither.activeCheckIn}/${neither.pin}`,
  );
}

// --- recording while the previous check-in is active resolves the active
// check-in to the newly recorded entry rather than leaving the pair dangling
// ---
{
  // Post-record state: handleRecord clears the draft and selection; the just-
  // recorded entry is now what derivePreviousCheckIn resolves to.
  const justRecorded = entry('e-just-recorded', '2026-08-18T09:00:00.000Z', [pin('p-new', 0.3, -0.3)]);
  const resolved = resolveActiveSelection([], justRecorded, null);

  check(
    'recording while the previous check-in is active resolves to the newly recorded entry, not null',
    resolved.activeCheckIn === 'previous' && resolved.pin?.id === 'p-new',
    `resolved to ${resolved.activeCheckIn}/${resolved.pin?.id}`,
  );
}

// --- with an empty draft and a previous check-in present, the previous
// check-in is the active one (named explicitly, per the plan) ---
{
  const previousCheckIn = entry('e-prev', '2026-08-10T09:00:00.000Z', [pin('p-prev', 0, 0)]);
  const resolved = resolveActiveSelection([], previousCheckIn, null);

  check(
    'with an empty draft and a previous check-in present, the previous check-in is the active one',
    resolved.activeCheckIn === 'previous',
    `resolved to ${resolved.activeCheckIn}`,
  );
}

// === U3: findNearbyPin ===
// Pure hit-testing math over plain {x,y} coordinates — used by
// EmotionField.tsx's handleRelease before minting a new pin (R15). These
// assertions exercise the math directly; the actual pointer-release wiring
// (findNearbyPin called from a real gesture) cannot be scripted — see report.

{
  const size = { width: 800, height: 600 };
  const pins = [pin('p1', 0.0, 0.0), pin('p2', 0.5, 0.5)];

  // A release exactly on an existing pin's coordinate is a hit.
  const exact = findNearbyPin({ x: 0.0, y: 0.0 }, pins, size);
  check(
    'a release exactly on an existing pin coordinate hits that pin',
    exact?.id === 'p1',
    `resolved to ${exact?.id}`,
  );

  // A release a few pixels off (well within TOUCH_RADIUS_PX) still hits it.
  // 1 unit of coord-x = (0.9*800)/2 = 360px, so 10px ≈ 0.0278 coord units.
  const nearMiss = findNearbyPin({ x: 0.02, y: 0.0 }, pins, size);
  check(
    'a release a few pixels from an existing pin still hits it (within touch radius)',
    nearMiss?.id === 'p1',
    `resolved to ${nearMiss?.id}`,
  );

  // A release far from both pins is a miss.
  const farMiss = findNearbyPin({ x: -0.9, y: -0.9 }, pins, size);
  check(
    'a release far from any existing pin is a miss',
    farMiss === null,
    `resolved to ${farMiss?.id ?? null}`,
  );

  // A release equidistant-ish but closer to p2 than p1 picks the closest pin.
  const closerToP2 = findNearbyPin({ x: 0.48, y: 0.48 }, pins, size);
  check(
    'a release near two pins picks the closest one',
    closerToP2?.id === 'p2',
    `resolved to ${closerToP2?.id}`,
  );

  // An empty pin list is always a miss.
  const noPins = findNearbyPin({ x: 0, y: 0 }, [], size);
  check(
    'an empty pin list is always a miss',
    noPins === null,
    `resolved to ${noPins}`,
  );
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
