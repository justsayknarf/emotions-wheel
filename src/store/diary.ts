import type { DiaryEntry } from '../types';
import { updateEntryInList } from '../data/checkIn';
import { parseDiary } from '../data/diaryParse';

const DIARY_KEY = 'emotion-selector-diary';
// Where an unreadable diary is moved so a later save can't overwrite it.
// Suffixed with a timestamp so repeated incidents never collide.
const UNREADABLE_PREFIX = `${DIARY_KEY}-unreadable-`;

// Reads the diary and reports whether it is safe to write back over.
// A corrupt or legacy-format diary is copied to its own key before the main
// key is cleared; if that copy fails (quota, storage disabled), the diary is
// reported unwritable so callers leave the original bytes alone.
function loadDiary(): { entries: DiaryEntry[]; writable: boolean } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DIARY_KEY);
  } catch {
    return { entries: [], writable: false };
  }

  const parsed = parseDiary(raw);
  if (parsed.status === 'ok') return { entries: parsed.entries, writable: true };
  if (parsed.status === 'empty') return { entries: [], writable: true };

  try {
    localStorage.setItem(`${UNREADABLE_PREFIX}${Date.now()}`, raw as string);
    localStorage.removeItem(DIARY_KEY);
    console.error(`Diary could not be read (${parsed.status}); set aside under ${UNREADABLE_PREFIX}*.`);
    return { entries: [], writable: true };
  } catch {
    return { entries: [], writable: false };
  }
}

function writeDiary(entries: DiaryEntry[]): boolean {
  try {
    localStorage.setItem(DIARY_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export function readDiary(): DiaryEntry[] {
  return loadDiary().entries;
}

// Appends without pruning: the diary is the user's whole record, and at a few
// hundred bytes per entry localStorage holds years of check-ins. Returns false
// when the entry could not be saved (storage unavailable, full, or holding an
// unreadable diary that couldn't be set aside).
export function appendEntry(entry: DiaryEntry): boolean {
  const { entries, writable } = loadDiary();
  if (!writable) return false;
  return writeDiary([...entries, entry]);
}

// Replace an existing entry in place by id, preserving array order and the
// original entry's timestamp (see updateEntryInList). A missing id is a
// no-op — it never appends. Returns false when the write didn't happen.
export function updateEntry(entry: DiaryEntry): boolean {
  const { entries, writable } = loadDiary();
  if (!writable) return false;
  return writeDiary(updateEntryInList(entries, entry));
}

export function clearDiary(): void {
  localStorage.removeItem(DIARY_KEY);
}

// Asks the browser not to evict this site's storage under pressure or after
// inactivity. Called after a save, once there is a record worth keeping.
// Browsers decide silently (Chrome, Safari) or may ask the user (Firefox);
// either way a refusal changes nothing, so the result is ignored.
let persistenceRequested = false;
export function requestPersistentStorage(): void {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try {
    const storage = navigator.storage;
    if (!storage?.persisted || !storage.persist) return;
    void storage
      .persisted()
      .then((already) => (already ? true : storage.persist()))
      .catch(() => {});
  } catch {
    // Storage API unavailable — nothing to request.
  }
}
