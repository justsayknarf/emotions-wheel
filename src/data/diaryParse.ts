import type { DiaryEntry } from '../types';

// Classifies the raw diary string from storage. Pure, so it runs under the
// check script (scripts/test-diary-parse.ts); src/store/diary.ts is the thin
// localStorage wrapper that acts on the result.
//
// The distinction that matters is `empty` vs. `corrupt`/`legacy`: an empty
// diary is safe to write over, but an unreadable one still holds someone's
// history, so the store sets it aside instead of letting the next save
// replace it with a one-entry list.
export type DiaryParse =
  | { status: 'empty' }
  | { status: 'ok'; entries: DiaryEntry[] }
  | { status: 'legacy' }   // pre-pins format (entries carry `emotions`, not `pins`)
  | { status: 'corrupt' }; // not JSON, or not an array of objects

export function parseDiary(raw: string | null): DiaryParse {
  if (raw === null || raw === '') return { status: 'empty' };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: 'corrupt' };
  }

  if (!Array.isArray(value)) return { status: 'corrupt' };
  if (!value.every((e) => typeof e === 'object' && e !== null && !Array.isArray(e))) {
    return { status: 'corrupt' };
  }
  if (value.length === 0) return { status: 'empty' };

  const first = value[0] as Record<string, unknown>;
  if ('emotions' in first && !('pins' in first)) return { status: 'legacy' };

  return { status: 'ok', entries: value as DiaryEntry[] };
}
