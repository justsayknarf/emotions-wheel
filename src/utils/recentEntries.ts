import type { DiaryEntry } from '../types';

// The "recent" window shared by the mirror's rhythm strip and the pulse-trace
// constellation, so the two surfaces never disagree on what recent means.
export const RECENT_WINDOW_DAYS = 14;

// When nothing falls inside the day window (sparse or long-dormant history),
// fall back to the most recent few entries so the surfaces still have content.
export const RECENT_WINDOW_FALLBACK = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns entries within the recent window, sorted chronologically (oldest
// first) so callers can draw or plot them in time order. Falls back to the
// most recent RECENT_WINDOW_FALLBACK entries when the window is empty.
export function recentWindow(
  entries: DiaryEntry[],
  now: number = Date.now(),
): DiaryEntry[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const cutoff = now - RECENT_WINDOW_DAYS * DAY_MS;
  const within = sorted.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
  return within.length > 0 ? within : sorted.slice(-RECENT_WINDOW_FALLBACK);
}
