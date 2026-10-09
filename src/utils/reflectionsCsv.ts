import type { Reflection } from '../types';
import { datedCsvName, downloadCsv, escapeCsvField } from './diaryCsv';

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
  return datedCsvName('emotions-wheel-reflections', now);
}

/** Download every reflection as CSV. No-op when there are none. */
export function downloadReflectionsCsv(reflections: Reflection[], now: Date = new Date()): void {
  if (reflections.length === 0) return;
  downloadCsv(reflectionsToCsv(reflections), reflectionsCsvFilename(now));
}
