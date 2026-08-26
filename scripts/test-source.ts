// Behavioural check for the check-in source resolver (src/data/source.ts).
// Run: npm run check:source
// docs/plans/2026-08-25-001-feat-newtab-checkin-entry-plan.md, U1.
import { resolveEntrySource } from '../src/data/source';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

check(
  'recognized source=new-tab resolves to new-tab',
  resolveEntrySource('?source=new-tab') === 'new-tab',
  resolveEntrySource('?source=new-tab'),
);

check(
  'no query string resolves to web',
  resolveEntrySource('') === 'web',
  resolveEntrySource(''),
);

check(
  'unrelated param, no source key, resolves to web',
  resolveEntrySource('?foo=bar') === 'web',
  resolveEntrySource('?foo=bar'),
);

check(
  'unrecognized source value resolves to web, not the raw value',
  resolveEntrySource('?source=bogus') === 'web',
  resolveEntrySource('?source=bogus'),
);

check(
  'empty source value resolves to web',
  resolveEntrySource('?source=') === 'web',
  resolveEntrySource('?source='),
);

check(
  'source=new-tab alongside other params still resolves to new-tab',
  resolveEntrySource('?foo=bar&source=new-tab') === 'new-tab',
  resolveEntrySource('?foo=bar&source=new-tab'),
);

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
