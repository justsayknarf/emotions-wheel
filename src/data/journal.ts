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
// it's shown under is "written on".
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
/** Check-ins this recent are never pruned: they are next week's reflection. */
export const PRUNE_PROTECT_DAYS = 7;

/**
 * The diary's size cap, with the journal protected: once the diary holds
 * `max` entries, drop up to `count` of the oldest entries that have no notes
 * and are older than PRUNE_PROTECT_DAYS. A check-in with a note is never
 * removed (R19), and neither is a recent one, so a mostly-annotated diary
 * grows past the cap instead of eating this week's check-ins.
 * `entries` is in insertion order (oldest first), as the store keeps it.
 */
export function pruneEntries(
  entries: DiaryEntry[],
  max: number = MAX_ENTRIES,
  count: number = PRUNE_COUNT,
  now: Date = new Date(),
): DiaryEntry[] {
  if (entries.length < max) return entries;
  const protectFrom = now.getTime() - PRUNE_PROTECT_DAYS * 24 * 60 * 60 * 1000;
  let toDrop = count;
  return entries.filter((e) => {
    if (toDrop > 0 && !hasNotes(e) && Date.parse(e.timestamp) < protectFrom) {
      toDrop--;
      return false;
    }
    return true;
  });
}

/**
 * Write one entry's notes, built by `update` from that entry as it is in
 * `entries` (the store passes a fresh read, never a React snapshot).
 * Returns null when the id isn't in the diary, so a pruned entry is never
 * resurrected. Notes are written here and only here: updateEntryInList
 * always keeps an entry's stored notes.
 */
export function withEntryNotes(
  entries: DiaryEntry[],
  entryId: string,
  update: (entry: DiaryEntry) => JournalNote[],
): DiaryEntry[] | null {
  const index = entries.findIndex((e) => e.id === entryId);
  if (index === -1) return null;
  const next = [...entries];
  next[index] = { ...entries[index], notes: update(entries[index]) };
  return next;
}
