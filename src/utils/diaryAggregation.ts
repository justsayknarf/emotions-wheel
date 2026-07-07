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
function dateKey(d: Date): string {
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
