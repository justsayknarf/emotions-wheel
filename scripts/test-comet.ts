// Behavioural check for the night sky's light trails (src/utils/comet.ts):
// the slider-drag trail's window and the tag lines' replay timeline.
// Run: npm run check:comet
import { pruneTrail, segmentDone, segmentDraw, trailWindow, type TrailPoint } from '../src/utils/comet';
import { LINE_MS, TAIL_MS } from '../src/components/Constellation/replaySchedule';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

// A pin sliding right at 1 field unit per second, one point per 16ms frame.
const moving: TrailPoint[] = Array.from({ length: 101 }, (_, i) => ({ x: i * 0.016, y: 0, t: 1000 + i * 16 }));
const lastT = moving[moving.length - 1].t; // 2600

// The window only reaches TAIL_MS back from now.
{
  const w = trailWindow(moving, lastT, TAIL_MS);
  const oldest = w.points[0].t;
  check('drops points older than tailMs', oldest >= lastT - TAIL_MS - 1e-9 && w.points.every((p) => p.t >= lastT - TAIL_MS - 1e-9),
    `oldest kept t=${oldest} (cut ${lastT - TAIL_MS})`);
  check('the tail edge sits exactly on the cut, interpolated', near(oldest, lastT - TAIL_MS) && near(w.points[0].x, (lastT - TAIL_MS - 1000) / 1000),
    `x=${w.points[0].x.toFixed(4)}`);
  check('ends at the head', w.points[w.points.length - 1] === moving[moving.length - 1], `head x=${w.points[w.points.length - 1].x}`);
  check('head intensity is 1 while moving', w.head === 1, `head ${w.head}`);
}

// Stillness: the tail catches up and the streak is gone after tailMs.
{
  const mid = trailWindow(moving, lastT + TAIL_MS / 2, TAIL_MS);
  check('half a tail after stopping, the head is fading and the streak shorter', mid.head > 0 && mid.head < 1 && mid.points.length > 1 && mid.points.length < trailWindow(moving, lastT, TAIL_MS).points.length,
    `head ${mid.head.toFixed(3)}, ${mid.points.length} points`);
  const gone = trailWindow(moving, lastT + TAIL_MS, TAIL_MS);
  check('head intensity is 0 after tailMs of stillness, nothing to draw', gone.head === 0 && gone.points.length === 0, `head ${gone.head}, ${gone.points.length} points`);
  const later = trailWindow(moving, lastT + 5000, TAIL_MS);
  check('stays gone', later.head === 0 && later.points.length === 0, 'now + 5s');
}

// Degenerate histories.
{
  const empty = trailWindow([], 1000, TAIL_MS);
  check('empty history draws nothing', empty.points.length === 0 && empty.head === 0, JSON.stringify(empty));
  const one = trailWindow([{ x: 0.3, y: 0.2, t: 1000 }], 1000, TAIL_MS);
  check('one point: a head, no streak', one.points.length === 1 && one.head === 1, `${one.points.length} point, head ${one.head}`);
  const oneOld = trailWindow([{ x: 0.3, y: 0.2, t: 1000 }], 1000 + TAIL_MS, TAIL_MS);
  check('one stale point: nothing', oneOld.points.length === 0 && oneOld.head === 0, `head ${oneOld.head}`);
}

// Pruning keeps exactly what the window can still use.
{
  const pruned = pruneTrail(moving, lastT, TAIL_MS);
  const a = trailWindow(moving, lastT, TAIL_MS), b = trailWindow(pruned, lastT, TAIL_MS);
  check('pruning never changes the window', pruned.length < moving.length && a.points.length === b.points.length && a.points.every((p, i) => near(p.x, b.points[i].x) && p.t === b.points[i].t),
    `${moving.length} → ${pruned.length} points kept`);
}

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

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
