import type { DiaryEntry } from '../types';

export interface Aggregate {
  valence: number;
  arousal: number;
}

/** Mean of all pins' x (valence) and y (arousal) for one session. Returns null for empty-pin entries. */
export function sessionAverage(entry: DiaryEntry): Aggregate | null {
  if (entry.pins.length === 0) return null;
  const valence = entry.pins.reduce((s, p) => s + p.x, 0) / entry.pins.length;
  const arousal = entry.pins.reduce((s, p) => s + p.y, 0) / entry.pins.length;
  return { valence, arousal };
}

/** ISO date string key YYYY-MM-DD for a given Date in local time. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Buckets entries by calendar day in one pass -- for callers that need every
 * day's sessions (e.g. a week of daily summary rows), so they don't call
 * sessionsForDay once per day and re-scan the full entry list each time.
 * The single canonical day-bucketing pass -- dailyAggregates and
 * distinctDayCount build on this rather than re-deriving their own key.
 */
export function groupByDay(entries: DiaryEntry[]): Map<string, DiaryEntry[]> {
  const buckets = new Map<string, DiaryEntry[]>();
  for (const entry of entries) {
    const key = dateKey(new Date(entry.timestamp));
    const existing = buckets.get(key);
    if (existing) existing.push(entry);
    else buckets.set(key, [entry]);
  }
  return buckets;
}

/**
 * Per-day aggregate across all sessions. Each day's value is the mean of
 * every pin across every session recorded on that calendar day.
 * Days with no sessions (or only zero-pin sessions) are absent from the map.
 */
export function dailyAggregates(entries: DiaryEntry[]): Map<string, Aggregate> {
  const result = new Map<string, Aggregate>();
  for (const [key, dayEntries] of groupByDay(entries)) {
    let vSum = 0, aSum = 0, count = 0;
    for (const entry of dayEntries) {
      for (const pin of entry.pins) {
        vSum += pin.x;
        aSum += pin.y;
        count += 1;
      }
    }
    if (count > 0) result.set(key, { valence: vSum / count, arousal: aSum / count });
  }
  return result;
}

/** Filter entries to those recorded on the same calendar day as `date` (local time). */
export function sessionsForDay(entries: DiaryEntry[], date: Date): DiaryEntry[] {
  const target = dateKey(date);
  return entries.filter(e => dateKey(new Date(e.timestamp)) === target);
}

/** Array of 7 Date objects: [today−6, …, today]. Index 6 is today. */
export function last7Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
}

/** Filter entries to those falling on one of the given days (by local calendar date). */
export function entriesInWindow(entries: DiaryEntry[], days: Date[]): DiaryEntry[] {
  const keys = new Set(days.map(dateKey));
  return entries.filter(e => keys.has(dateKey(new Date(e.timestamp))));
}

/** Count of distinct calendar days with at least one pin among the given entries. */
export function distinctDayCount(entries: DiaryEntry[]): number {
  const keys = new Set<string>();
  for (const entry of entries) {
    if (entry.pins.length === 0) continue;
    keys.add(dateKey(new Date(entry.timestamp)));
  }
  return keys.size;
}

/**
 * Below this many distinct days of coverage, a pattern claim is thin
 * evidence rather than a trend. Set relative to a 7-day window: 3 of 7
 * flags the sparse case (1-2 check-in days that week) without firing
 * on an ordinary every-2-to-3-days cadence.
 */
export const MIN_SPREAD_DAYS = 3;

/** Whether the given entries are spread across enough distinct days to support a pattern claim. */
export function hasSpreadCoverage(entries: DiaryEntry[], minDays: number = MIN_SPREAD_DAYS): boolean {
  return distinctDayCount(entries) >= minDays;
}

/**
 * Visual weight for a line segment spanning `gapMs`: full weight up to
 * `fullWeightMs`, decaying exponentially beyond it. Callers pick
 * `fullWeightMs`/`decayMs` for their own granularity (hours for an
 * intra-day chart, days for a multi-day one) — the decay shape is shared,
 * the scale is not.
 */
export function gapWeight(gapMs: number, fullWeightMs: number, decayMs: number): number {
  if (gapMs <= fullWeightMs) return 1;
  return Math.exp(-(gapMs - fullWeightMs) / decayMs);
}

/** Below this weight, a segment is not drawn at all rather than rendered near-invisibly. */
export const MIN_RENDER_WEIGHT = 0.08;

export interface WeightedSegment {
  i: number;
  j: number;
  weight: number;
}

/** Above this many dots in a daily summary row, the rest collapse into a "+k" overflow marker. */
export const MAX_ROW_DOTS = 5;

/** How many dots a count renders as, and how many are left over past the cap. */
export function capDots(count: number, cap: number = MAX_ROW_DOTS): { shown: number; overflow: number } {
  const shown = Math.min(count, cap);
  return { shown, overflow: count - shown };
}

/**
 * Connects each pair of consecutive present indices, weighting the
 * connection by the gap between them (via `gapMsBetween`) and dropping it
 * below `MIN_RENDER_WEIGHT`. Shared by DayChart (hour-scale gaps within a
 * day) and WeekChart (day-scale gaps across the week) -- only the index
 * source and gap measurement differ.
 */
export function buildWeightedSegments(
  presentIndices: number[],
  gapMsBetween: (i: number, j: number) => number,
  fullWeightMs: number,
  decayMs: number,
): WeightedSegment[] {
  const segments: WeightedSegment[] = [];
  for (let k = 1; k < presentIndices.length; k++) {
    const i = presentIndices[k - 1];
    const j = presentIndices[k];
    const weight = gapWeight(gapMsBetween(i, j), fullWeightMs, decayMs);
    if (weight > MIN_RENDER_WEIGHT) segments.push({ i, j, weight });
  }
  return segments;
}
