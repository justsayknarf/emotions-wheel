// Behavioural check for the night sky's light trails (src/utils/comet.ts):
// the tag lines' replay timeline and the departure comet's timeline.
// Run: npm run check:comet
import { departureDraw, departureSizes, departureTailMs, segmentDone, segmentDraw, settleSpring } from '../src/utils/comet';
import { DEFAULT_TUNING } from '../src/config/revealTuning';
import { LINE_MS, TAIL_MS } from '../src/components/Constellation/replaySchedule';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

// The tag line's timeline: the replay's shape.
{
  const at0 = segmentDraw(0, LINE_MS, TAIL_MS);
  check('at 0 nothing has drawn', at0.head === 0 && at0.tail === 0 && at0.quiet === 0 && at0.headAlpha === 0, JSON.stringify(at0));
  const mid = segmentDraw(LINE_MS / 2, LINE_MS, TAIL_MS);
  check('halfway along the line the head is halfway (inOut(2)), no tail yet', near(mid.head, 0.5) && mid.tail === 0 && mid.quiet === mid.head && mid.headAlpha === 1,
    JSON.stringify(mid));
  const arrive = segmentDraw(LINE_MS, LINE_MS, TAIL_MS);
  check('at lineMs the head has arrived and the tail has not moved', arrive.head === 1 && arrive.tail === 0 && arrive.quiet === 1 && arrive.headAlpha < 1,
    JSON.stringify(arrive));
  const tailMid = segmentDraw(LINE_MS + TAIL_MS / 2, LINE_MS, TAIL_MS);
  check('the tail catches up on in(2)', near(tailMid.tail, 0.25), `tail ${tailMid.tail}`);
  const end = segmentDraw(LINE_MS + TAIL_MS, LINE_MS, TAIL_MS);
  check('at lineMs + tailMs: head 1, tail 1, quiet 1, head gone', end.head === 1 && end.tail === 1 && end.quiet === 1 && end.headAlpha === 0, JSON.stringify(end));
  check('and the segment is done', segmentDone(LINE_MS + TAIL_MS, LINE_MS, TAIL_MS) && !segmentDone(LINE_MS, LINE_MS, TAIL_MS), 'done at lineMs + tailMs, not at lineMs');

  let prev = segmentDraw(0, LINE_MS, TAIL_MS), mono = true, ordered = true;
  for (let t = 1; t <= LINE_MS + TAIL_MS + 100; t++) {
    const d = segmentDraw(t, LINE_MS, TAIL_MS);
    if (d.head < prev.head || d.tail < prev.tail || d.quiet < prev.quiet) mono = false;
    if (d.tail > d.head) ordered = false;
    prev = d;
  }
  check('head, tail and quiet never go backwards', mono, 'monotone over 0..lineMs+tailMs+100ms');
  check('the tail never passes the head', ordered, 'tail ≤ head throughout');
}

// The departure comet: DepartureTrace's anime.js timeline, at the shipped tuning.
{
  const tu = DEFAULT_TUNING;
  const T = tu.departureTravel * 1000;
  const timing = { travelMs: T, tailMs: departureTailMs(tu.departureTrail), holdMs: tu.departureHold * 1000, fadeMs: tu.departureFadeOut * 1000 };
  const at0 = departureDraw(0, timing);
  check('departure at 0: nothing drawn yet', at0.head === 0 && at0.tail === 0 && at0.headAlpha === 0 && at0.bloomAlpha === 0 && at0.haloFade === 0 && !at0.done, JSON.stringify(at0));
  const mid = departureDraw(T / 2, timing);
  check('departure halfway: head halfway (inOut(2)), fully lit, no bloom', near(mid.head, 0.5) && mid.tail === 0 && mid.headAlpha === 1 && mid.bloomAlpha === 0, JSON.stringify(mid));
  const arrived = departureDraw(T + 200, timing);
  check('after arrival: the bloom is up and the halo spreading', arrived.head === 1 && arrived.bloomAlpha > 0.8 && arrived.bloomScale > 0.8 && arrived.haloFade > 0 && arrived.haloScale > 0.3, JSON.stringify(arrived));
  const s = settleSpring(2000);
  let over = 0;
  for (let t = 0; t <= 2000; t += 5) over = Math.max(over, settleSpring(t) - 1);
  check('the bloom spring settles firmly (no visible bounce)', near(s, 1, 1e-3) && over < 0.02, `settles at ${s.toFixed(4)}, overshoot ${(over * 100).toFixed(2)}%`);
  const end = T - 50 + timing.holdMs + timing.fadeMs;
  check('departure is done once the bloom has dissolved', departureDraw(end, timing).done && !departureDraw(end - 50, timing).done && departureDraw(end, timing).bloomAlpha < 1e-9, `done at ${end}ms`);
  check('tail catch-up keeps the admin meaning: higher trail → shorter', departureTailMs(0.2) < departureTailMs(0.05) && departureTailMs(0.001) === departureTailMs(0.01) && departureTailMs(0.9) >= 150, `${departureTailMs(0.05).toFixed(0)}ms at 0.05`);
  const z = departureSizes(0.4);
  check('strength 0.40 reproduces the sketch sizes', z.glowWidth === 7 && z.headR === 4.5 && near(z.coreR, 2.2) && z.bloomR === 6 && z.haloR === 16, JSON.stringify(z));
  let prev = departureDraw(0, timing), mono = true;
  for (let t = 1; t <= end; t += 3) {
    const d = departureDraw(t, timing);
    if (d.head < prev.head || d.tail < prev.tail || d.tail > d.head) mono = false;
    prev = d;
  }
  check('departure head and tail never go backwards, tail ≤ head', mono, 'monotone over the whole flight');
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
