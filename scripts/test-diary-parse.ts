// Behavioural check for the diary parser (src/data/diaryParse.ts).
// Run: npm run check:diary
//
// The parser decides whether stored history is safe to write over. The one
// outcome that must never happen is an unreadable diary classified as `empty`,
// because the next save would replace it. The localStorage wrapper in
// src/store/diary.ts is verified live in the app.
import { parseDiary } from '../src/data/diaryParse';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const entry = { id: 'a', timestamp: '2026-09-01T10:00:00.000Z', pins: [], sessionDurationMs: 1000 };

const cases: Array<[string, string | null, string]> = [
  ['missing key', null, 'empty'],
  ['empty string', '', 'empty'],
  ['empty array', '[]', 'empty'],
  ['one entry', JSON.stringify([entry]), 'ok'],
  ['truncated JSON', JSON.stringify([entry]).slice(0, 20), 'corrupt'],
  ['not JSON', 'not json', 'corrupt'],
  ['JSON object, not array', JSON.stringify({ entries: [entry] }), 'corrupt'],
  ['JSON null', 'null', 'corrupt'],
  ['array with a non-object', JSON.stringify([entry, 42]), 'corrupt'],
  ['array with null', JSON.stringify([null]), 'corrupt'],
  ['legacy emotions format', JSON.stringify([{ id: 'x', emotions: ['calm'] }]), 'legacy'],
];

for (const [name, raw, want] of cases) {
  const got = parseDiary(raw).status;
  check(name, got === want, `expected ${want}, got ${got}`);
}

{
  const result = parseDiary(JSON.stringify([entry, { ...entry, id: 'b' }]));
  check(
    'ok keeps every entry in order',
    result.status === 'ok' && result.entries.map((e) => e.id).join() === 'a,b',
    result.status === 'ok' ? result.entries.map((e) => e.id).join() : result.status,
  );
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
