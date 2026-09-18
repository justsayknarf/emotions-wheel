// Behavioural check for the daily-summary tag list (src/utils/dayTags.ts).
// Run: npm run check:tags
//
// This repo has no test runner, so this is the only automated exercise of
// this logic. Exits non-zero on any violation.
import { dayTags } from '../src/utils/dayTags';
import type { DiaryEntry, PinEntry } from '../src/types';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const labelFor = (id: string) => id.toUpperCase();

function pin(words: string[] = [], relational = 'between *hopeful* and *touched*'): PinEntry {
  return {
    id: `p-${Math.random()}`,
    x: 0,
    y: 0,
    recognizedWords: words,
    regionDescription: { relational, narrative: 'n' },
  };
}
function entry(hour: number, pins: PinEntry[]): DiaryEntry {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return { id: `e-${hour}-${Math.random()}`, timestamp: d.toISOString(), pins, sessionDurationMs: 1000 };
}
const texts = (r: ReturnType<typeof dayTags>) => r.shown.map(t => t.text);

// --- named words ---
const named = dayTags([entry(9, [pin(['calm', 'hopeful'])])], labelFor);
check(
  'named words render as tags via the injected label resolver',
  named.shown.length === 2 && named.shown.every(t => t.kind === 'tag') && texts(named).join() === 'CALM,HOPEFUL',
  JSON.stringify(named),
);

// --- fallback ---
const fallback = dayTags([entry(9, [pin([])])], labelFor);
check(
  'a check-in with no words falls back to its region description, asterisks stripped',
  fallback.shown.length === 1 && fallback.shown[0].kind === 'region' && fallback.shown[0].text === 'between hopeful and touched',
  JSON.stringify(fallback),
);

// --- cap ---
const four = dayTags([entry(9, [pin(['a', 'b', 'c', 'd'])])], labelFor);
check('four tags cap at three with one overflowing', four.shown.length === 3 && four.overflow === 1, JSON.stringify(four));

const exactlyThree = dayTags([entry(9, [pin(['a', 'b', 'c'])])], labelFor);
check('exactly three tags shows all, no overflow', exactlyThree.shown.length === 3 && exactlyThree.overflow === 0, JSON.stringify(exactlyThree));

// --- the fallback counts as one tag toward the cap ---
const twoPlusDefault = dayTags([entry(9, [pin(['a', 'b'])]), entry(12, [pin([])])], labelFor);
check(
  'the fallback counts as one tag: two words + one fallback fills the cap with no overflow',
  twoPlusDefault.shown.length === 3 && twoPlusDefault.overflow === 0 && twoPlusDefault.shown[2].kind === 'region',
  JSON.stringify(twoPlusDefault),
);

const threePlusDefault = dayTags([entry(9, [pin(['a', 'b', 'c'])]), entry(12, [pin([])])], labelFor);
check('three words + one fallback overflows by exactly one', threePlusDefault.overflow === 1, JSON.stringify(threePlusDefault));

// --- dedupe / merge ---
const dupes = dayTags([entry(9, [pin(['a'])]), entry(12, [pin(['a', 'b'])])], labelFor);
check('the same word across check-ins collapses to one tag', texts(dupes).join() === 'A,B', JSON.stringify(dupes));

const dupeFallback = dayTags([entry(9, [pin([])]), entry(12, [pin([])])], labelFor);
check('identical fallbacks across check-ins collapse to one', dupeFallback.shown.length === 1, JSON.stringify(dupeFallback));

const multiPin = dayTags([entry(9, [pin(['a']), pin(['a', 'b'])])], labelFor);
check('words across one check-in\'s pins merge and dedupe', texts(multiPin).join() === 'A,B', JSON.stringify(multiPin));

// --- ordering / edge cases ---
const shuffled = dayTags([entry(15, [pin(['late'])]), entry(8, [pin(['early'])])], labelFor);
check('tags order chronologically regardless of input order', texts(shuffled).join() === 'EARLY,LATE', JSON.stringify(shuffled));

const zeroPin = dayTags([entry(9, [])], labelFor);
check('a zero-pin check-in contributes nothing', zeroPin.shown.length === 0 && zeroPin.overflow === 0, JSON.stringify(zeroPin));

const none = dayTags([], labelFor);
check('no check-ins yields no tags', none.shown.length === 0 && none.overflow === 0, JSON.stringify(none));

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
