import type { DiaryEntry, JournalNote } from '../types';
import { updateEntryInList } from '../data/checkIn';
import { pruneEntries, withEntryNotes } from '../data/journal';

const DIARY_KEY = 'emotion-selector-diary';

export function readDiary(): DiaryEntry[] {
  try {
    const raw = localStorage.getItem(DIARY_KEY);
    if (!raw) return [];
    const entries = JSON.parse(raw) as Array<Record<string, unknown>>;
    // Migrate: old entries have `emotions` field, not `pins` — clear and start fresh.
    if (entries.length > 0 && 'emotions' in entries[0] && !('pins' in entries[0])) {
      localStorage.removeItem(DIARY_KEY);
      return [];
    }
    return entries as unknown as DiaryEntry[];
  } catch {
    return [];
  }
}

// At the size cap, the oldest un-noted entries make room (pruneEntries in
// src/data/journal.ts); a check-in with a journal note is never pruned.
export function appendEntry(entry: DiaryEntry): void {
  const entries = pruneEntries(readDiary());
  localStorage.setItem(DIARY_KEY, JSON.stringify([...entries, entry]));
}

// Replace an existing entry in place by id, preserving array order and the
// original entry's timestamp (see updateEntryInList). A missing id is a
// no-op — it never appends. Wrapped in try/catch, matching readDiary's
// degrade-quietly posture: a corrupt or unavailable store leaves the diary
// as it was rather than throwing.
export function updateEntry(entry: DiaryEntry): void {
  try {
    const entries = readDiary();
    const next = updateEntryInList(entries, entry);
    localStorage.setItem(DIARY_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable or corrupt — degrade quietly, matching readDiary.
  }
}

// Write one entry's journal notes. `update` receives the entry as stored
// right now, not the caller's React snapshot, so a note saved in another tab
// since this one last read the diary is built on rather than overwritten.
// Unlike updateEntry, reports whether the write landed, so the note editor
// can say so instead of failing silently.
export function setEntryNotes(entryId: string, update: (entry: DiaryEntry) => JournalNote[]): boolean {
  try {
    const next = withEntryNotes(readDiary(), entryId, update);
    if (!next) return false;
    localStorage.setItem(DIARY_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function clearDiary(): void {
  localStorage.removeItem(DIARY_KEY);
}
