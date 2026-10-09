import type { DiaryEntry, JournalNote } from '../types';

// Pure logic for the private journal: notes on check-ins and the pruning
// policy that protects them. No storage access, so scripts/test-journal.ts
// can run it under Node; src/store/diary.ts is the thin wrapper.
// docs/plans/2026-10-09-001-feat-weekly-reflection-journal-plan.md, U1.

/** True when the entry carries at least one note. An emptied `[]` doesn't count. */
export function hasNotes(entry: DiaryEntry): boolean {
  return (entry.notes?.length ?? 0) > 0;
}

/** The entry's single at-the-time note, if any. */
export function atTimeNote(entry: DiaryEntry): JournalNote | null {
  return entry.notes?.find((n) => n.kind === 'at-the-time') ?? null;
}

/** The entry's looking-back notes, oldest first. */
export function lookingBackNotes(entry: DiaryEntry): JournalNote[] {
  return (entry.notes ?? [])
    .filter((n) => n.kind === 'looking-back')
    .sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
}

/** The looking-back note one walk wrote on this entry, if any. */
export function walkNote(entry: DiaryEntry, walkId: string): JournalNote | null {
  return entry.notes?.find((n) => n.kind === 'looking-back' && n.walkId === walkId) ?? null;
}

// Replace (or add, or remove) the note matching `match`. Blank text removes
// it. An edit keeps the note's id and its first-written date, since the label
// it's shown under is "written on". Always returns an explicit array, so a
// cleared journal is written back as `[]` rather than left out (KTD2: a
// missing key would carry the old notes forward through updateEntryInList).
function replaceNote(
  entry: DiaryEntry,
  match: (n: JournalNote) => boolean,
  text: string,
  make: () => JournalNote,
): JournalNote[] {
  const notes = entry.notes ?? [];
  const trimmed = text.trim();
  const existing = notes.find(match);
  if (!trimmed) return notes.filter((n) => !match(n));
  if (existing) return notes.map((n) => (n === existing ? { ...n, text: trimmed } : n));
  return [...notes, { ...make(), text: trimmed }];
}

/** Set the entry's at-the-time note. Blank text removes it. */
export function withAtTimeNote(
  entry: DiaryEntry,
  text: string,
  now: Date,
  newId: () => string,
): JournalNote[] {
  return replaceNote(
    entry,
    (n) => n.kind === 'at-the-time',
    text,
    () => ({ id: newId(), kind: 'at-the-time', text: '', writtenAt: now.toISOString() }),
  );
}

/**
 * Set the looking-back note one walk wrote on this entry: one per walk, so
 * revisiting a moment (Back) or editing from History replaces it. Blank text
 * removes it, leaving other walks' notes alone.
 */
export function withLookingBackNote(
  entry: DiaryEntry,
  walkId: string,
  text: string,
  now: Date,
  newId: () => string,
): JournalNote[] {
  return replaceNote(
    entry,
    (n) => n.kind === 'looking-back' && n.walkId === walkId,
    text,
    () => ({ id: newId(), kind: 'looking-back', text: '', writtenAt: now.toISOString(), walkId }),
  );
}

export const MAX_ENTRIES = 500;
export const PRUNE_COUNT = 50;

/**
 * The diary's size cap, with notes protected: once the diary holds `max`
 * entries, drop up to `count` of the oldest entries that have no notes.
 * A check-in with a note is never removed (R19). Below the cap, unchanged.
 * `entries` is in insertion order (oldest first), as the store keeps it.
 */
export function pruneEntries(
  entries: DiaryEntry[],
  max: number = MAX_ENTRIES,
  count: number = PRUNE_COUNT,
): DiaryEntry[] {
  if (entries.length < max) return entries;
  let toDrop = count;
  return entries.filter((e) => {
    if (toDrop > 0 && !hasNotes(e)) {
      toDrop--;
      return false;
    }
    return true;
  });
}
