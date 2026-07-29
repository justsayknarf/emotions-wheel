// Behavioural check for the diary CSV export (src/utils/diaryCsv.ts).
// Run: pnpm check:csv
//
// Asserts the flattening, ordering, and RFC-4180 escaping invariants and exits
// non-zero on any violation (this repo has no test runner, so this is the only
// automated exercise of the export logic).
import { diaryToCsv, escapeCsvField, csvFilename } from '../src/utils/diaryCsv';
import type { DiaryEntry } from '../src/types';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const pin = (
  x: number,
  y: number,
  relational: string,
  narrative: string,
  words: string[],
) => ({ id: `p-${x}-${y}`, x, y, recognizedWords: words, regionDescription: { relational, narrative } });

// Later session listed first on purpose — output must reorder to oldest-first.
const entries: DiaryEntry[] = [
  {
    id: 'c3d4',
    timestamp: '2026-07-28T21:03:00.000Z',
    sessionDurationMs: 4000,
    pins: [pin(0.1, 0.3, 'near *content*', 'calm, settled', ['w-content', 'w-calm'])],
  },
  {
    id: 'a1b2',
    timestamp: '2026-07-28T09:14:00.000Z',
    sessionDurationMs: 8000,
    pins: [
      pin(0.42, 0.63, 'between *excited* and *enthusiastic*', 'stirred up', ['w-excited', 'w-hopeful']),
      pin(-0.2, -0.55, 'between *tense* and *anxious*', 'on edge', ['w-anxious']),
    ],
  },
];

const csv = diaryToCsv(entries);
const lines = csv.split('\r\n');

// One header row + one row per pin across all entries (2 + 1 = 3).
check('per-pin grain', lines.length === 4, `${lines.length} lines (want header + 3 rows)`);

// Oldest-first: the two a1b2 pins precede the c3d4 pin.
check(
  'chronological order',
  lines[1].startsWith('2026-07-28T09:14') &&
    lines[2].startsWith('2026-07-28T09:14') &&
    lines[3].startsWith('2026-07-28T21:03'),
  'rows run oldest → newest',
);

// Recognized words collapse into one semicolon-joined cell, not extra columns.
// (Unknown ids fall back to themselves, keeping this framework-independent.)
check('words joined in one cell', lines[1].includes('w-excited; w-hopeful'), lines[1]);

// Markdown emphasis is stripped from the region phrase.
check('region asterisks stripped', !csv.includes('*'), 'no * in output');

// A comma inside the narrative is quoted so the row does not split.
check(
  'narrative comma quoted',
  lines[3].includes('"calm, settled"'),
  lines[3],
);

// Header column count matches every data row's column count (RFC-4180 shape).
const cols = (line: string) => {
  // Count top-level commas (those outside double quotes).
  let n = 1, inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) n++;
  }
  return n;
};
const headerCols = cols(lines[0]);
check(
  'uniform column count',
  lines.every((l) => cols(l) === headerCols),
  `header has ${headerCols} columns`,
);

// Direct escaping unit checks.
check('escape: plain passthrough', escapeCsvField('excited') === 'excited', 'no quoting when unneeded');
check('escape: comma wrapped', escapeCsvField('a, b') === '"a, b"', 'comma triggers quoting');
check('escape: quote doubled', escapeCsvField('say "hi"') === '"say ""hi"""', 'internal quotes doubled');

// Filename is dated and .csv.
check(
  'filename dated',
  csvFilename(new Date('2026-07-29T00:00:00')) === 'emotions-wheel-checkins-2026-07-29.csv',
  csvFilename(new Date('2026-07-29T00:00:00')),
);

// Empty diary yields just the header (download path no-ops separately).
check('empty diary → header only', diaryToCsv([]).split('\r\n').length === 1, 'header row only');

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
