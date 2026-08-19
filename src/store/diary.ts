import type { DiaryEntry } from '../types';
import { updateEntryInList } from '../data/checkIn';

const DIARY_KEY = 'emotion-selector-diary';
const MAX_ENTRIES = 500;
const PRUNE_COUNT = 50;

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

export function appendEntry(entry: DiaryEntry): void {
  const entries = readDiary();
  const next = [...entries, entry];
  const pruned = entries.length >= MAX_ENTRIES
    ? next.slice(PRUNE_COUNT)    // remove oldest PRUNE_COUNT, then append
    : next;
  localStorage.setItem(DIARY_KEY, JSON.stringify(pruned));
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

export function clearDiary(): void {
  localStorage.removeItem(DIARY_KEY);
}
