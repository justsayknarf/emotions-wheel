import type { DiaryEntry } from '../types';

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
// row sort (src/utils/diaryCsv.ts) both key on it.
//
// A missing id is a no-op — the same entries are returned unchanged rather
// than `updated` being appended. An update for an entry that was pruned must
// not resurrect it.
export function updateEntryInList(entries: DiaryEntry[], updated: DiaryEntry): DiaryEntry[] {
  const index = entries.findIndex((entry) => entry.id === updated.id);
  if (index === -1) return entries;

  const original = entries[index];
  const next = [...entries];
  next[index] = { ...updated, timestamp: original.timestamp };
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
