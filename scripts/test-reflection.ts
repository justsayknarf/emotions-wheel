// Behavioural check for the weekly reflection's pure logic
// (src/data/reflection.ts, src/data/reflectionPrompts.ts).
// Run: npm run check:reflection
// docs/plans/2026-10-09-001-feat-weekly-reflection-journal-plan.md, U2.
// All dates are local-time constructors so calendar-day math matches the app.
// Exits non-zero on any violation.
import {
  reflectionWindow,
  pickMoments,
  inviteStatus,
  laterUntil,
  canLookBack,
  momentPoint,
  latestReflectionIn,
  withWeekName,
  weekRangeLabel,
  stopHeading,
  weekFraction,
  stripPlayhead,
} from '../src/data/reflection';
import { PROMPT_TEMPLATES, momentPrompt, positionPhrase, dayPhrase } from '../src/data/reflectionPrompts';
import type { DiaryEntry, PinEntry, Reflection } from '../src/types';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// Friday 2026-10-09, 15:00 local.
const NOW = new Date(2026, 9, 9, 15, 0, 0);
const daysAgo = (d: number, hour = 10) => new Date(2026, 9, 9 - d, hour, 0, 0);

const pin = (x: number, y: number, id = `p${x}_${y}`): PinEntry => ({
  id, x, y, recognizedWords: [], regionDescription: { relational: '', narrative: '' },
});
const entry = (id: string, when: Date, pins: PinEntry[]): DiaryEntry => ({
  id, timestamp: when.toISOString(), pins, sessionDurationMs: 1000,
});
const ids = (es: DiaryEntry[]) => es.map((e) => e.id).join(',');
const reflection = (completedAt: Date, opened: Reflection['opened']): Reflection => ({
  id: `r-${completedAt.getTime()}`, completedAt: completedAt.toISOString(), windowEndKey: '', momentEntryIds: [], opened,
});

// --- reflectionWindow ---
{
  const es = [
    entry('old', daysAgo(7), [pin(0, 0)]),
    entry('b', daysAgo(1), [pin(0, 0)]),
    entry('a', daysAgo(6), [pin(0, 0)]),
    entry('today', daysAgo(0, 9), [pin(0, 0)]),
  ];
  check('window holds today and the six days before it, oldest first', ids(reflectionWindow(es, NOW)) === 'a,b,today', ids(reflectionWindow(es, NOW)));
}

// --- pickMoments ---
{
  const two = [entry('a', daysAgo(3), [pin(0.1, 0.1)]), entry('b', daysAgo(1), [pin(-0.2, 0.3)])];
  check('AE4: a 2-check-in week pauses on both', ids(pickMoments(two)) === 'a,b', ids(pickMoments(two)));

  // Nine check-ins. Highest y = h, lowest y = l, furthest from the mean = far.
  const nine = [
    entry('m1', daysAgo(6), [pin(0.0, 0.1)]),
    entry('h', daysAgo(6, 15), [pin(0.1, 0.8)]),
    entry('m2', daysAgo(5), [pin(0.1, 0.0)]),
    entry('far', daysAgo(4), [pin(0.95, 0.2)]),
    entry('m3', daysAgo(3), [pin(-0.1, 0.1)]),
    entry('l', daysAgo(2), [pin(0.0, -0.7)]),
    entry('m4', daysAgo(2, 18), [pin(0.05, 0.05)]),
    entry('m5', daysAgo(1), [pin(0.0, 0.2)]),
    entry('m6', daysAgo(0, 9), [pin(-0.05, 0.0)]),
  ];
  check(
    'AE4: a 9-check-in week pauses on most pleasant, least pleasant, and most distinct, in time order',
    ids(pickMoments(nine)) === 'h,far,l',
    ids(pickMoments(nine)),
  );

  // "Most pleasant" is the highest y (valence), not the highest x (arousal).
  const axes = [
    entry('hiY', daysAgo(5), [pin(0.0, 0.9)]),
    entry('hiX', daysAgo(4), [pin(0.9, 0.1)]),
    entry('loY', daysAgo(3), [pin(0.0, -0.9)]),
    entry('mid1', daysAgo(2), [pin(0.0, 0.0)]),
    entry('mid2', daysAgo(1), [pin(0.05, 0.0)]),
  ];
  const picked = pickMoments(axes).map((e) => e.id);
  check('most pleasant picks the highest y, not the highest x', picked.includes('hiY') && picked.includes('loY'), picked.join(','));

  // One entry is both the most pleasant and the furthest: it fills one slot.
  const overlap = [
    entry('top', daysAgo(5), [pin(0.9, 0.95)]),
    entry('a', daysAgo(4), [pin(0.0, 0.0)]),
    entry('low', daysAgo(3), [pin(0.0, -0.3)]),
    entry('next', daysAgo(2), [pin(-0.6, 0.1)]),
    entry('b', daysAgo(1), [pin(0.05, 0.05)]),
  ];
  const ov = pickMoments(overlap);
  check(
    'an entry that is both most pleasant and furthest fills one slot; the next-furthest fills the third',
    ov.length === 3 && ids(ov) === 'top,low,next',
    ids(ov),
  );

  // first and second tie on y; f is the clear outlier, so second is never picked.
  const tie = [
    entry('first', daysAgo(5), [pin(0.0, 0.5)]),
    entry('second', daysAgo(4), [pin(0.0, 0.5)]),
    entry('c', daysAgo(3), [pin(0.0, -0.5)]),
    entry('f', daysAgo(2), [pin(0.95, 0.0)]),
  ];
  check('equal y picks the earlier check-in', ids(pickMoments(tie)) === 'first,c,f', ids(pickMoments(tie)));

  const legacy = entry('legacy', daysAgo(2), [pin(-0.9, -0.9, 'old'), pin(0.4, 0.6, 'last')]);
  const lp = momentPoint(legacy);
  check('a legacy multi-pin entry is placed by its last pin, as the replay draws it', lp?.x === 0.4 && lp?.y === 0.6, JSON.stringify(lp));

  const empty = [entry('none', daysAgo(1), []), entry('one', daysAgo(1), [pin(0, 0)])];
  check('an entry with no pins is never a moment', ids(pickMoments(empty)) === 'one', ids(pickMoments(empty)));
}

// --- inviteStatus ---
{
  const recent = [entry('a', daysAgo(20), [pin(0, 0)]), entry('b', daysAgo(2), [pin(0, 0)]), entry('c', daysAgo(1), [pin(0, 0)])];

  check('AE1: skip 4 days ago → hidden', inviteStatus(recent, [], { lastSkippedAt: daysAgo(4, 15).toISOString() }, NOW) === 'hidden', '');
  check('AE1: skip 7 days ago, 2 recent check-ins → due', inviteStatus(recent, [], { lastSkippedAt: daysAgo(7, 15).toISOString() }, NOW) === 'due', '');

  const stale = [entry('a', daysAgo(20), [pin(0, 0)]), entry('b', daysAgo(8), [pin(0, 0)])];
  check(
    'AE3: 9 days since the last reflection but nothing in the last 7 days → hidden',
    inviteStatus(stale, [reflection(daysAgo(9), 'invite')], {}, NOW) === 'hidden',
    '',
  );

  const afternoon = new Date(2026, 9, 9, 15, 0, 0);
  const snoozed = { lastSkippedAt: daysAgo(10).toISOString(), snoozedUntil: laterUntil(afternoon).toISOString() };
  check('AE2: Later hides it the same afternoon', inviteStatus(recent, [], snoozed, new Date(2026, 9, 9, 18, 0, 0)) === 'hidden', '');
  check('AE2: it shows again after midnight', inviteStatus(recent, [], snoozed, new Date(2026, 9, 10, 0, 5, 0)) === 'due', '');

  const fresh = [entry('first', daysAgo(6, 15), [pin(0, 0)]), entry('b', daysAgo(1), [pin(0, 0)])];
  check('no reflections or skips: 6 days after the first check-in → hidden', inviteStatus(fresh, [], {}, NOW) === 'hidden', '');
  const fresh7 = [entry('first', daysAgo(7, 15), [pin(0, 0)]), entry('b', daysAgo(1), [pin(0, 0)])];
  check('no reflections or skips: 7 days after the first check-in → due', inviteStatus(fresh7, [], {}, NOW) === 'due', '');

  check(
    'an invited reflection 3 days ago → hidden, even with an older skip',
    inviteStatus(recent, [reflection(daysAgo(3), 'invite')], { lastSkippedAt: daysAgo(12).toISOString() }, NOW) === 'hidden',
    '',
  );
  check(
    'an on-demand reflection 3 days ago does not move the timer → due',
    inviteStatus(recent, [reflection(daysAgo(8), 'invite'), reflection(daysAgo(3), 'on-demand')], {}, NOW) === 'due',
    '',
  );
  check('no check-ins → hidden', inviteStatus([], [], {}, NOW) === 'hidden', '');

  const lu = laterUntil(afternoon);
  check('laterUntil is the next local midnight', lu.getDate() === 10 && lu.getHours() === 0 && lu.getMinutes() === 0, lu.toString());
}

// --- canLookBack ---
check('AE7: 1 check-in → no look back', !canLookBack([entry('a', daysAgo(1), [pin(0, 0)])]), '');
check('AE7: 2 check-ins → look back', canLookBack([entry('a', daysAgo(1), [pin(0, 0)]), entry('b', daysAgo(0), [pin(0, 0)])]), '');

// --- prompts ---
{
  const phrases = [positionPhrase(0.5, 0.5), positionPhrase(-0.5, -0.5), positionPhrase(0, 0), positionPhrase(0, 0.5), positionPhrase(0.5, 0)];
  const all = PROMPT_TEMPLATES.flatMap((t) => phrases.flatMap((p) => ['today', 'yesterday', 'Thursday'].map((d) => t(d, p))));
  check('no prompt asks "why"', all.every((s) => !/\bwhy\b/i.test(s)), all.find((s) => /\bwhy\b/i.test(s)) ?? 'none');
  check('every prompt asks a question', all.every((s) => s.trim().endsWith('?')), all.find((s) => !s.trim().endsWith('?')) ?? 'all');

  check('position: pleasant and calm', positionPhrase(-0.5, 0.5) === 'pleasant and calm', positionPhrase(-0.5, 0.5));
  check('position: unpleasant and activated', positionPhrase(0.5, -0.5) === 'unpleasant and activated', positionPhrase(0.5, -0.5));
  check('position: middle', positionPhrase(0.05, -0.05) === 'near the middle', positionPhrase(0.05, -0.05));

  check('day: today', dayPhrase(daysAgo(0, 9).toISOString(), NOW) === 'today', dayPhrase(daysAgo(0, 9).toISOString(), NOW));
  check('day: yesterday', dayPhrase(daysAgo(1).toISOString(), NOW) === 'yesterday', dayPhrase(daysAgo(1).toISOString(), NOW));
  check('day: weekday name', dayPhrase(daysAgo(2).toISOString(), NOW) === 'Wednesday', dayPhrase(daysAgo(2).toISOString(), NOW));

  const ts = daysAgo(1).toISOString();
  const p = { x: 0.5, y: 0.5 };
  check('different seeds give different wording for the same moment', momentPrompt(p, ts, 0, 0, NOW) !== momentPrompt(p, ts, 0, 1, NOW), '');
  const walk = [0, 1, 2].map((i) => momentPrompt(p, ts, i, 7, NOW));
  check('one walk never repeats a template across its three moments', new Set(walk).size === 3, walk.join(' | '));
}

// --- position phrases: every branch and the band edge ---
check('position: on the pleasant side', positionPhrase(0, 0.5) === 'on the pleasant side', positionPhrase(0, 0.5));
check('position: on the unpleasant side', positionPhrase(0, -0.5) === 'on the unpleasant side', positionPhrase(0, -0.5));
check('position: even and activated', positionPhrase(0.5, 0) === 'even and activated', positionPhrase(0.5, 0));
check('position: even and calm', positionPhrase(-0.5, 0) === 'even and calm', positionPhrase(-0.5, 0));
check('position: the band edge (0.2) names both axes', positionPhrase(0.2, 0.2) === 'pleasant and activated', positionPhrase(0.2, 0.2));
check('position: just inside the band is the middle', positionPhrase(0.19, 0.19) === 'near the middle', positionPhrase(0.19, 0.19));

// --- the week name History shows ---
{
  const named = (id: string, at: Date, weekName?: string): Reflection => ({
    ...reflection(at, 'invite'), id, ...(weekName ? { weekName } : {}),
  });
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => daysAgo(d)).reverse();
  const older = named('older', daysAgo(5), 'the long one');
  const newer = named('newer', daysAgo(1), 'the quiet one');
  const outside = named('outside', daysAgo(9), 'last week');

  check('latest reflection in the window wins', latestReflectionIn([older, newer, outside], days)?.id === 'newer', String(latestReflectionIn([older, newer, outside], days)?.id));
  check('a reflection outside the window is ignored', latestReflectionIn([outside], days) === null, 'null');
  check('two on the same day: the later one wins', latestReflectionIn([named('a', daysAgo(1, 9), 'a'), named('b', daysAgo(1, 20), 'b')], days)?.id === 'b', '');

  const cleared = withWeekName([older, newer], 'newer', '   ');
  check('blank rename removes the name key', !('weekName' in cleared[1]), JSON.stringify(cleared[1]));
  check('blank rename leaves other reflections alone', cleared[0].weekName === 'the long one', String(cleared[0].weekName));
  check(
    'after clearing the newest name, History still titles the week with it (no older name resurfaces)',
    latestReflectionIn(cleared, days)?.id === 'newer' && latestReflectionIn(cleared, days)?.weekName === undefined,
    JSON.stringify(latestReflectionIn(cleared, days)),
  );
  check('rename trims and replaces', withWeekName([newer], 'newer', '  the turning one ')[0].weekName === 'the turning one', '');
}

// --- the walk's replay: title, header, week strip ---
{
  check('title range within one month', weekRangeLabel(NOW) === 'Oct 3 – 9', weekRangeLabel(NOW));
  const early = new Date(2026, 9, 3, 12);
  check('title range across two months', weekRangeLabel(early) === 'Sep 27 – Oct 3', weekRangeLabel(early));

  const today = stopHeading(daysAgo(0, 8).toISOString(), NOW);
  check('header names today', today.day === 'Today' && today.detail === '8:00 AM · Oct 9', JSON.stringify(today));
  check('header names yesterday', stopHeading(daysAgo(1, 20).toISOString(), NOW).day === 'Yesterday', stopHeading(daysAgo(1, 20).toISOString(), NOW).day);
  const sat = stopHeading(new Date(2026, 9, 3, 19, 0).toISOString(), NOW);
  check('header names an earlier day by weekday, with time and date', sat.day === 'Saturday' && sat.detail === '7:00 PM · Oct 3', JSON.stringify(sat));

  const startOfWindow = new Date(2026, 9, 3, 0, 0).toISOString();
  check('strip: the window opens at 0', weekFraction(startOfWindow, NOW) === 0, String(weekFraction(startOfWindow, NOW)));
  const midWeek = weekFraction(new Date(2026, 9, 6, 12, 0).toISOString(), NOW);
  check('strip: noon on the fourth day sits at 3.5 / 7', Math.abs(midWeek - 3.5 / 7) < 1e-9, String(midWeek));
  check('strip: before the window clamps to 0', weekFraction(daysAgo(9).toISOString(), NOW) === 0, '');
  check('strip: a check-in later today stays below 1', weekFraction(daysAgo(0, 23).toISOString(), NOW) < 1, '');

  const fr = [0.1, 0.4, 0.9];
  check('playhead rests on a check-in', stripPlayhead(fr, { from: 1, to: 1, along: 1 }) === 0.4, '');
  check('playhead halfway along a glide', Math.abs(stripPlayhead(fr, { from: 1, to: 2, along: 0.5 }) - 0.65) < 1e-9, String(stripPlayhead(fr, { from: 1, to: 2, along: 0.5 })));
  check('playhead jumping back runs backwards', Math.abs(stripPlayhead(fr, { from: 2, to: 0, along: 0.25 }) - 0.7) < 1e-9, String(stripPlayhead(fr, { from: 2, to: 0, along: 0.25 })));
  check('playhead with no check-ins is 0', stripPlayhead([], { from: 0, to: 0, along: 1 }) === 0, '');
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll reflection checks passed');
