// Behavioural check for the diary CSV export (src/utils/diaryCsv.ts).
// Run: pnpm check:csv
//
// Asserts the flattening, ordering, and RFC-4180 escaping invariants and exits
// non-zero on any violation (this repo has no test runner, so this is the only
// automated exercise of the export logic).
import { diaryToCsv, escapeCsvField, csvFilename } from '../src/utils/diaryCsv';
import { reflectionsToCsv, reflectionsCsvFilename } from '../src/utils/reflectionsCsv';
import type { DiaryEntry, Reflection } from '../src/types';

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

// --- Journal notes (docs/plans/2026-10-09-001-feat-weekly-reflection-journal-plan.md, U6) ---

// Minimal RFC-4180 reader, so quoted cells holding commas, quotes and
// newlines can be checked as cells rather than as raw text.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

{
  const tricky = 'met "J", talked a while,\nthen home';
  const noted: DiaryEntry[] = [
    {
      id: 'n1',
      timestamp: '2026-10-08T09:00:00.000Z',
      sessionDurationMs: 1000,
      pins: [pin(0.1, 0.2, 'near *calm*', 'calm', []), pin(0.3, 0.4, 'near *glad*', 'glad', [])],
      notes: [
        { id: 'a', kind: 'at-the-time', text: tricky, writtenAt: '2026-10-08T09:01:00.000Z' },
        { id: 'c', kind: 'looking-back', text: 'second look', writtenAt: '2026-10-16T12:00:00', walkId: 'w2' },
        { id: 'b', kind: 'looking-back', text: 'first look', writtenAt: '2026-10-09T12:00:00', walkId: 'w1' },
      ],
    },
    { id: 'plain', timestamp: '2026-10-09T09:00:00.000Z', sessionDurationMs: 1000, pins: [pin(0, 0, 'mid', 'mid', [])] },
  ];
  const table = parseCsv(diaryToCsv(noted));
  const head = table[0];
  const atCol = head.indexOf('note_at_the_time');
  const lbCol = head.indexOf('notes_looking_back');
  check('note columns present', atCol > -1 && lbCol > -1, head.join(','));
  check('at-the-time note on every pin row of its entry', table[1][atCol] === tricky && table[2][atCol] === tricky, JSON.stringify([table[1][atCol], table[2][atCol]]));
  check('commas, quotes and a newline round-trip through escaping', table[1][atCol] === tricky, JSON.stringify(table[1][atCol]));
  check(
    'looking-back notes join in one cell, oldest first, each dated',
    table[1][lbCol] === '2026-10-09: first look | 2026-10-16: second look',
    table[1][lbCol],
  );
  check('an entry without notes exports empty note cells', table[3][atCol] === '' && table[3][lbCol] === '', JSON.stringify(table[3]));
  check('column count stays constant', table.every((r) => r.length === head.length), table.map((r) => r.length).join(','));
}

// --- Reflections CSV ---
{
  const reflections: Reflection[] = [
    { id: 'r2', completedAt: '2026-10-16T20:00:00.000Z', windowEndKey: '2026-10-16', momentEntryIds: ['a', 'b'], opened: 'on-demand' },
    { id: 'r1', completedAt: '2026-10-09T20:00:00.000Z', windowEndKey: '2026-10-09', momentEntryIds: ['a', 'b', 'c'], opened: 'invite', openLine: 'slept badly, all week', weekName: 'the long one' },
  ];
  const table = parseCsv(reflectionsToCsv(reflections));
  check('one header + one row per reflection', table.length === 3, String(table.length));
  check('rows oldest first', table[1][0] === '2026-10-09T20:00:00.000Z', table[1][0]);
  check(
    'row carries week ending, opened, moment count, open line, week name',
    table[1].slice(1).join('|') === '2026-10-09|invite|3|slept badly, all week|the long one',
    table[1].join('|'),
  );
  check('blank open line and week name export as empty cells', table[2][4] === '' && table[2][5] === '', JSON.stringify(table[2]));
  check(
    'reflections filename dated',
    reflectionsCsvFilename(new Date('2026-10-09T00:00:00')) === 'emotions-wheel-reflections-2026-10-09.csv',
    reflectionsCsvFilename(new Date('2026-10-09T00:00:00')),
  );
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
