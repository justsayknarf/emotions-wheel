import type { Reflection } from '../types';
import { escapeCsvField } from './diaryCsv';

// The weekly reflections as their own CSV (docs/plans/2026-10-09-001-feat-
// weekly-reflection-journal-plan.md, KTD13): one row per completed
// reflection, so every row of the check-in export stays one plotted point.

const HEADERS = ['completed_at', 'week_ending', 'opened', 'moment_count', 'open_line', 'week_name'] as const;

/** Oldest first, header row included. */
export function reflectionsToCsv(reflections: Reflection[]): string {
  const ordered = [...reflections].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const rows: string[][] = [[...HEADERS]];
  for (const r of ordered) {
    rows.push([
      r.completedAt,
      r.windowEndKey,
      r.opened,
      String(r.momentEntryIds.length),
      r.openLine ?? '',
      r.weekName ?? '',
    ]);
  }
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

// e.g. emotions-wheel-reflections-2026-10-09.csv
export function reflectionsCsvFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `emotions-wheel-reflections-${y}-${m}-${d}.csv`;
}

/** Download every reflection as CSV. No-op when there are none. */
export function downloadReflectionsCsv(reflections: Reflection[], now: Date = new Date()): void {
  if (reflections.length === 0) return;
  const blob = new Blob([reflectionsToCsv(reflections)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = reflectionsCsvFilename(now);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
