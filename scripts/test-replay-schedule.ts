// Behavioural check for the constellation replay's timing and day labels
// (src/components/Constellation/replaySchedule.ts).
// Run: pnpm check:replay
//
// The anime.js timeline built from this schedule is verified live in the app;
// this exercises the pure spacing and labelling rules and exits non-zero on
// any violation.
import {
  replaySchedule,
  replayDayLabels,
  STEP_MS,
  LINE_MS,
  STAR_MS,
  MAX_SPAN_MS,
  LABEL_DELAY_MS,
  replayArrived,
  replayCursor,
} from '../src/components/Constellation/replaySchedule';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// Empty and single histories.
{
  const s0 = replaySchedule(0);
  check('empty history has no length', s0.total === 0, `total ${s0.total}`);
  const s1 = replaySchedule(1);
  check('one star lands at 0', s1.starAt(0) === 0 && s1.step === 0, `starAt(0) ${s1.starAt(0)}, step ${s1.step}`);
  check('one star still plays its landing', s1.total >= STAR_MS, `total ${s1.total}`);
}

// A week keeps the relaxed spacing and full line draw.
{
  const s = replaySchedule(7);
  check('short history keeps STEP_MS', s.step === STEP_MS, `step ${s.step}`);
  check('short history keeps LINE_MS', s.lineMs === LINE_MS, `lineMs ${s.lineMs}`);
  check('each line finishes as its star lands', [1, 2, 6].every((i) => s.lineAt(i) + s.lineMs === s.starAt(i)), 'lineAt + lineMs === starAt');
}

// Long histories compress to fit MAX_SPAN_MS, never going negative or
// overlapping a line onto the previous star's own landing start.
for (const n of [15, 40, 200, 500]) {
  const s = replaySchedule(n);
  const span = s.starAt(n - 1);
  check(`n=${n} arrivals fit the span`, span <= MAX_SPAN_MS + 1e-6, `span ${span.toFixed(0)}ms`);
  check(`n=${n} spacing only shrinks`, s.step <= STEP_MS && s.step > 0, `step ${s.step.toFixed(1)}ms`);
  check(`n=${n} lines start after the previous star`, s.lineAt(1) > s.starAt(0) && s.lineMs < s.step, `lineAt(1) ${s.lineAt(1).toFixed(1)}, lineMs ${s.lineMs.toFixed(1)}`);
  check(`n=${n} total covers the last landing`, s.total >= span + STAR_MS, `total ${s.total.toFixed(0)}`);
}

// Day labels: one per day, relativeDayLabel's vocabulary, runs collapsed.
{
  const now = new Date(2026, 8, 24, 20, 0); // Thu 24 Sep 2026, local time
  const at = (d: number, h: number) => new Date(2026, 8, d, h, 0).toISOString();
  const ts = [at(12, 9), at(14, 9), at(16, 9), at(20, 8), at(20, 21), at(22, 9), at(23, 9), at(24, 7), at(24, 19)];
  const labels = replayDayLabels(ts, now);
  // 12, 14 and 16 Sep are all 8–12 days back, so all "1 WK": only the first is
  // labelled. The two 20 Sep check-ins share SUN; 24 Sep's share TODAY.
  const want = ['1 WK', null, null, 'SUN', null, 'TUE', 'YESTERDAY', 'TODAY', null];
  check('labels collapse same-label runs', JSON.stringify(labels) === JSON.stringify(want), JSON.stringify(labels));
  check('labels line up with timestamps', labels.length === ts.length, `${labels.length} / ${ts.length}`);
}

// The reflection walk follows the drawing: arrivals and the week strip's cursor.
{
  const s = replaySchedule(4);
  check('nothing has arrived at the start', replayArrived(s, 4, 0) === -1, String(replayArrived(s, 4, 0)));
  check('a star arrives just after it starts landing', replayArrived(s, 4, s.starAt(2) + LABEL_DELAY_MS) === 2, '');
  check('the last star arrives by the end', replayArrived(s, 4, s.total) === 3, '');
  const mid = replayCursor(s, 4, s.lineAt(2) + s.lineMs / 2);
  check('cursor halfway along the line into the next star', mid.from === 1 && mid.to === 2 && Math.abs(mid.along - 0.5) < 1e-9, JSON.stringify(mid));
  const rest = replayCursor(s, 4, s.starAt(1) + LABEL_DELAY_MS + 1);
  check('cursor rests on the star that arrived', rest.from === 1 && rest.to === 1 && rest.along === 1, JSON.stringify(rest));
  const one = replayCursor(replaySchedule(1), 1, 0);
  check('a single star rests at 0', one.from === 0 && one.to === 0, JSON.stringify(one));
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll replay-schedule checks passed');
