// Behavioural regression check for the radial-fan reveal placement
// (src/components/EmotionField/radialFan.ts). Run: pnpm check:fan
//
// Asserts invariants — not exact pixels — so it survives tuning changes, and
// exits non-zero on any violation (this repo has no test runner, so this is the
// only automated exercise of the fan/collision/uncross logic).
import { computeRadialFan, type FanBox } from '../src/components/EmotionField/radialFan';

const W = 1130, H = 812, STANDOFF = 11;
const toPxX = (x: number) => (5 + ((x + 1) / 2) * 90) / 100 * W;
const toPxY = (y: number) => (5 + ((-y + 1) / 2) * 90) / 100 * H;
const CHAR_W_DEEP = 6.6, PAD = 4, LINE_H = 18;
const hw = (label: string) => (label.length * CHAR_W_DEEP + PAD) / 2;
const mag = (o: { dx: number; dy: number }) => Math.round(Math.hypot(o.dx, o.dy));
const fanBox = (id: string, label: string, x: number, y: number, movable: boolean): FanBox => {
  const dx = toPxX(x), dy = toPxY(y);
  return { id, dotX: dx, dotY: dy, cx: dx, cy: dy - STANDOFF, halfW: hw(label), halfH: LINE_H / 2, movable };
};

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// Dense reveal: six mutually-overlapping words around a central focus should all
// fan out (finite, non-zero offsets) across a wide arc.
{
  const words: Array<[string, string, number, number]> = [
    ['awe', 'Awe', 0.14, 0.11], ['interested', 'Interested', 0.14, 0.11], ['grounded', 'Grounded', 0.14, 0.12],
    ['renewed', 'Renewed', 0.11, 0.15], ['free', 'Free', 0.14, 0.18], ['worthy', 'Worthy', 0.15, 0.21],
  ];
  const boxes = words.map(([id, label, x, y]) => fanBox(id, label, x, y, true));
  const focus = { x: toPxX(0), y: toPxY(0) };
  const offsets = computeRadialFan(boxes, [focus]);
  const angs = boxes.map((b) => {
    const o = offsets.get(b.id)!;
    return Math.atan2((b.cy + o.dy) - focus.y, (b.cx + o.dx) - focus.x) * 180 / Math.PI;
  });
  const spread = Math.round(Math.max(...angs) - Math.min(...angs));
  const finite = boxes.every((b) => { const o = offsets.get(b.id)!; return Number.isFinite(o.dx) && Number.isFinite(o.dy); });
  const allMoved = boxes.every((b) => mag(offsets.get(b.id)!) > 0);
  check('dense: all offsets finite', finite, 'no NaN in any offset');
  check('dense: all words fan out', allMoved, 'every overlapping word has a non-zero offset');
  check('dense: wide arc', spread > 90, `angle spread ${spread} deg > 90`);
}

// A lone word in open space stays exactly in place (no spoke/tether).
{
  const anchor = fanBox('far', 'Peaceful', -0.66, 0.60, false);
  const lone = fanBox('lonely', 'Lonely', 0.20, -0.30, true);
  const o = computeRadialFan([anchor, lone], [{ x: toPxX(0.2), y: toPxY(-0.3) }]).get('lonely')!;
  check('sparse: lone word in place', mag(o) === 0, `|offset| ${mag(o)} === 0`);
}

// A lone word overlapping a surface anchor gets pushed just off it.
{
  const anchor = fanBox('anchor', 'Confident', 0.30, 0.30, false);
  const near = fanBox('near', 'Curious', 0.31, 0.30, true);
  const o = computeRadialFan([anchor, near], [{ x: toPxX(0.30), y: toPxY(0.30) }]).get('near')!;
  check('sparse: word on anchor pushed', mag(o) > 0, `|offset| ${mag(o)} > 0`);
}

// Two revealed words far apart with no overlap both stay in place.
{
  const a = fanBox('a', 'Brave', 0.5, 0.5, true);
  const b = fanBox('b', 'Weary', -0.5, -0.5, true);
  const off = computeRadialFan([a, b], [{ x: toPxX(0), y: toPxY(0) }]);
  const oa = off.get('a')!, ob = off.get('b')!;
  check('sparse: two far-apart in place', mag(oa) === 0 && mag(ob) === 0, `|offset| a ${mag(oa)}, b ${mag(ob)}`);
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
