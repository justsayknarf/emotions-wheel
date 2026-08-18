import type { DiaryEntry, PinEntry } from '../types';

// Pure logic for the check-in model. This module is the runnable seam for
// scripts/test-check-in.ts: `npx tsx` has no `localStorage`, so a script that
// imports src/store/diary.ts's write paths directly would throw when they run.
// Keeping the logic here, with no storage access, lets it be asserted under
// Node while src/store/diary.ts stays a thin, try/catch-guarded wrapper over
// it (see updateEntry there).
//
// Named checkIn.ts rather than diaryUpdate.ts because later units add more
// pure check-in logic here — the previous-check-in derivation (U2) and the
// active-check-in/pin resolution (U3) — so this stays the single pure-logic
// module for the check-in feature as a whole.

// Replace the entry in `entries` whose id matches `updated.id`, in place at
// the same array index — every other entry, and their order, is untouched.
// The original entry's `timestamp` is kept rather than `updated.timestamp`:
// the timestamp records when the check-in happened, not when it was
// corrected, and sessionsForDay (src/utils/diaryAggregation.ts) and the CSV
// row sort (src/utils/diaryCsv.ts) both key on it. `sessionDurationMs` is
// preserved the same way (U7): a correction is not a new sitting, so the
// duration recorded stays how long the original check-in took, not how long
// the edit took. Together this means a caller re-saving a reopened check-in
// (App.tsx's handleRecord) never needs to look up or compute a "correct"
// timestamp or duration — it can pass placeholders for both, since this
// function discards them in favor of the original.
//
// A missing id is a no-op — the same entries are returned unchanged rather
// than `updated` being appended. An update for an entry that was pruned must
// not resurrect it.
export function updateEntryInList(entries: DiaryEntry[], updated: DiaryEntry): DiaryEntry[] {
  const index = entries.findIndex((entry) => entry.id === updated.id);
  if (index === -1) return entries;

  const original = entries[index];
  const next = [...entries];
  next[index] = { ...updated, timestamp: original.timestamp, sessionDurationMs: original.sessionDurationMs };
  return next;
}

// U2: the previous check-in. It is derived — never stored — from the diary's
// most recent entry, so recording (which clears the draft) turns the just-
// recorded entry into the previous check-in through this same function rather
// than through a second copy kept in app state. There is no age cutoff: a
// weeks-old entry is still "the previous check-in" if nothing more recent
// exists.
//
// `draftId` excludes the entry whose id the draft currently carries. This
// only matters once U7 adds reopen (a draft carrying a recorded entry's id
// while it's being edited) — while an entry is reopened, it must render once,
// as the draft, not also here. Nothing in the app passes a non-null draftId
// yet; U2's call site always passes null, which excludes nothing beyond
// naturally resolving to the single most recent entry.
export function derivePreviousCheckIn(entries: DiaryEntry[], draftId: string | null): DiaryEntry | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].id !== draftId) return entries[i];
  }
  return null;
}

// U3: which check-in is active, and which pin within it is selected — resolved
// as a pair, at render, rather than stored as two pieces of state. Pin ids are
// globally unique (uuid v4), so "which check-in is active" is derivable from
// which array the resolved pin belongs to: this keeps the render-time
// derivation shape the rest of the app already uses for selection (see
// App.tsx's old selectedPin/effectiveSelectedPinId), rather than introducing a
// second piece of state that could drift out of sync with the pin id.
//
// Cascade, in order:
//   1. selectedPinId matches a draft pin        -> draft active, that pin
//   2. selectedPinId matches a previous-check-in
//      pin                                       -> previous active, that pin
//   3. draft is non-empty (no match above)       -> draft active, its newest pin
//   4. previous check-in exists and has pins
//      (no match, empty draft)                   -> previous active, its newest pin
//   5. otherwise                                  -> nothing active
//
// This single function is what R12 (exactly one check-in active), R14 (one
// selected pin within it), R15 (selecting a field pin activates its check-in)
// and R16 (dropping a pin activates the draft) all fall out of — every caller
// reads the same resolved pair, so they cannot drift apart.
export function resolveActiveSelection(
  draftPins: PinEntry[],
  previousCheckIn: DiaryEntry | null,
  selectedPinId: string | null,
): { activeCheckIn: 'draft' | 'previous' | null; pin: PinEntry | null } {
  const draftMatch = draftPins.find((p) => p.id === selectedPinId);
  if (draftMatch) return { activeCheckIn: 'draft', pin: draftMatch };

  const prevMatch = previousCheckIn?.pins.find((p) => p.id === selectedPinId) ?? null;
  if (prevMatch) return { activeCheckIn: 'previous', pin: prevMatch };

  if (draftPins.length > 0) return { activeCheckIn: 'draft', pin: draftPins[draftPins.length - 1] };

  if (previousCheckIn && previousCheckIn.pins.length > 0) {
    return { activeCheckIn: 'previous', pin: previousCheckIn.pins[previousCheckIn.pins.length - 1] };
  }

  return { activeCheckIn: null, pin: null };
}

// U3: field-pin hit-testing (R15). Pin dots render with pointerEvents: 'none'
// (the whole field is the single pointer target), so "hit-testing" happens at
// release — before minting a new pin, EmotionField checks whether the release
// coordinate lands close enough to an existing pin to select it instead of
// dropping a new one. Pure math over plain {x,y} coordinates and pin objects,
// so it lives here rather than in EmotionField.tsx: it's importable and
// Node-testable the same way as the rest of this module, matching this
// module's own reason for existing (see the file header).
//
// The distance conversion mirrors useFieldGesture's pixelToCoord inverse: one
// unit of coord-space X is (0.9 * width) / 2 pixels (and symmetrically for Y),
// since pixelToCoord maps a relX/W fraction through `((relX/W - 0.05)/0.9)*2-1`.
export const TOUCH_RADIUS_PX = 26; // generous touch/click target, larger than the 4-12px visual dot

export function findNearbyPin(
  coord: { x: number; y: number },
  pins: PinEntry[],
  size: { width: number; height: number },
): PinEntry | null {
  let closest: PinEntry | null = null;
  let closestDist = Infinity;
  for (const pin of pins) {
    const dxPx = (coord.x - pin.x) * (0.9 * size.width) / 2;
    const dyPx = (coord.y - pin.y) * (0.9 * size.height) / 2;
    const dist = Math.sqrt(dxPx * dxPx + dyPx * dyPx);
    if (dist <= TOUCH_RADIUS_PX && dist < closestDist) {
      closest = pin;
      closestDist = dist;
    }
  }
  return closest;
}
