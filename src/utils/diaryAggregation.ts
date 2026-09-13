import type { DiaryEntry, PinEntry } from '../types';

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
 * Per-day aggregate across all sessions. Each day's value is the mean of
 * every pin across every session recorded on that calendar day.
 * Days with no sessions are absent from the map.
 */
export function dailyAggregates(entries: DiaryEntry[]): Map<string, Aggregate> {
  const buckets = new Map<string, { vSum: number; aSum: number; count: number }>();

  for (const entry of entries) {
    if (entry.pins.length === 0) continue;
    const key = dateKey(new Date(entry.timestamp));
    const existing = buckets.get(key) ?? { vSum: 0, aSum: 0, count: 0 };
    for (const pin of entry.pins) {
      existing.vSum += pin.x;
      existing.aSum += pin.y;
      existing.count += 1;
    }
    buckets.set(key, existing);
  }

  const result = new Map<string, Aggregate>();
  for (const [key, { vSum, aSum, count }] of buckets) {
    result.set(key, { valence: vSum / count, arousal: aSum / count });
  }
  return result;
}

/** Filter entries to those recorded on the same calendar day as `date` (local time). */
export function sessionsForDay(entries: DiaryEntry[], date: Date): DiaryEntry[] {
  const target = date.toDateString();
  return entries.filter(e => new Date(e.timestamp).toDateString() === target);
}

/** Array of 30 Date objects: [today−29, …, today]. Index 29 is today. */
export function last30Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
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

/** Below this many distinct days of coverage, a pattern claim is thin evidence rather than a trend. */
export const MIN_SPREAD_DAYS = 4;

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

/**
 * Tap-disambiguation radius in the app's (x, y) pin-coordinate space
 * (each axis −1..1), not pixels — independent of how large the panel
 * that renders these pins happens to be. Roughly two dot-widths at the
 * point-cloud panel's suggested ~112px size; tune alongside that size.
 */
export const PIN_OVERLAP_RADIUS = 0.12;

/** Every pin (including `target`) within `radius` of `target`, for resolving an ambiguous tap. */
export function nearestPins(pins: PinEntry[], target: PinEntry, radius: number = PIN_OVERLAP_RADIUS): PinEntry[] {
  return pins.filter(p => Math.hypot(p.x - target.x, p.y - target.y) <= radius);
}
