import type { DiaryEntry } from '../types';
import { labelForId } from '../data/emotions';

// One row per pin. Columns chosen so every coordinate is a clean, chartable
// data point; the session is preserved as a shared id + timestamp across its
// pins. See docs/brainstorms/2026-07-29-diary-csv-export-requirements.md.
const HEADERS = [
  'timestamp',
  'session_id',
  'x_arousal',
  'y_valence',
  'region',
  'narrative',
  'recognized_words',
] as const;

// RFC 4180 field escaping: quote any field containing a comma, quote, CR, or
// LF, doubling internal quotes. The region narrative routinely contains commas
// (e.g. "calm, settled"), so this is load-bearing, not defensive.
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Strip the in-app markdown emphasis (*word*) from a region phrase so it reads
// cleanly in a spreadsheet.
function plainRegion(relational: string): string {
  return relational.replace(/\*/g, '');
}

// Flatten the diary into one row per pin (plus a header row), oldest entry
// first, so a spreadsheet reads top-to-bottom as time. Coordinates are emitted
// verbatim — no rounding that would distort a plotted point.
export function diaryToCsv(entries: DiaryEntry[]): string {
  const ordered = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const rows: string[][] = [[...HEADERS]];

  for (const entry of ordered) {
    for (const pin of entry.pins) {
      rows.push([
        entry.timestamp,
        entry.id,
        String(pin.x),
        String(pin.y),
        plainRegion(pin.regionDescription.relational),
        pin.regionDescription.narrative,
        pin.recognizedWords.map(labelForId).join('; '),
      ]);
    }
  }

  return rows.map((r) => r.map(escapeCsvField).join(',')).join('\r\n');
}

// Dated, collision-resistant download name,
// e.g. emotions-wheel-checkins-2026-07-29.csv
export function csvFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `emotions-wheel-checkins-${y}-${m}-${d}.csv`;
}

// Trigger a client-side download of the whole diary as CSV. No-op when there
// is nothing to export, so callers can wire it without guarding.
export function downloadDiaryCsv(entries: DiaryEntry[], now: Date = new Date()): void {
  if (entries.length === 0) return;

  const blob = new Blob([diaryToCsv(entries)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFilename(now);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
