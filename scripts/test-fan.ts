import { computeRadialFan, type FanBox } from '../src/components/EmotionField/radialFan';

const W = 1130, H = 812, STANDOFF = 11;
const toPxX = (x: number) => (5 + ((x + 1) / 2) * 90) / 100 * W;
const toPxY = (y: number) => (5 + ((-y + 1) / 2) * 90) / 100 * H;
const CHAR_W_DEEP = 6.6, PAD = 4, LINE_H = 18;
const hw = (label: string) => (label.length * CHAR_W_DEEP + PAD) / 2;

// A representative center reveal: nearest deep words to (0,0), which happen to
// cluster in the positive-activated inner ring (all up-right of center).
const words = [
  { id: 'awe', label: 'Awe', x: 0.14, y: 0.11 },
  { id: 'interested', label: 'Interested', x: 0.14, y: 0.11 },
  { id: 'grounded', label: 'Grounded', x: 0.14, y: 0.12 },
  { id: 'renewed', label: 'Renewed', x: 0.11, y: 0.15 },
  { id: 'free', label: 'Free', x: 0.14, y: 0.18 },
  { id: 'worthy', label: 'Worthy', x: 0.15, y: 0.21 },
];

const focus = { x: toPxX(0), y: toPxY(0) };

const boxes: FanBox[] = words.map((w) => {
  const dotX = toPxX(w.x), dotY = toPxY(w.y);
  return { id: w.id, dotX, dotY, cx: dotX, cy: dotY - STANDOFF, halfW: hw(w.label), halfH: LINE_H / 2, movable: true };
});

const offsets = computeRadialFan(boxes, [focus]);

console.log('focus px:', Math.round(focus.x), Math.round(focus.y));
console.log('\nword         dot(px)         label(px)        angleFromFocus  dist  |offset|');
for (const w of words) {
  const b = boxes.find((x) => x.id === w.id)!;
  const o = offsets.get(w.id)!;
  const lx = b.cx + o.dx, ly = b.cy + o.dy;
  const ang = Math.round(Math.atan2(ly - focus.y, lx - focus.x) * 180 / Math.PI);
  const dist = Math.round(Math.hypot(lx - focus.x, ly - focus.y));
  const mag = Math.round(Math.hypot(o.dx, o.dy));
  console.log(
    w.label.padEnd(12),
    `(${Math.round(b.dotX)},${Math.round(b.dotY)})`.padEnd(14),
    `(${Math.round(lx)},${Math.round(ly)})`.padEnd(16),
    String(ang).padStart(6) + '°',
    String(dist).padStart(7),
    String(mag).padStart(7),
  );
}
const angs = words.map((w) => {
  const b = boxes.find((x) => x.id === w.id)!; const o = offsets.get(w.id)!;
  return Math.atan2((b.cy + o.dy) - focus.y, (b.cx + o.dx) - focus.x) * 180 / Math.PI;
});
console.log('\nangle spread:', Math.round(Math.max(...angs) - Math.min(...angs)) + '°');

// --- Sparse checks (collision-driven placement) ---
function fanBox(id: string, label: string, x: number, y: number, movable: boolean): FanBox {
  const dx = toPxX(x), dy = toPxY(y);
  return { id, dotX: dx, dotY: dy, cx: dx, cy: dy - STANDOFF, halfW: hw(label), halfH: LINE_H / 2, movable };
}
const mag = (o: { dx: number; dy: number }) => Math.round(Math.hypot(o.dx, o.dy));

// (a) lone revealed word in open space (nearest surface anchor far away)
{
  const anchor = fanBox('far', 'Peaceful', -0.66, 0.60, false); // top-left, far
  const lone = fanBox('lonely', 'Lonely', 0.20, -0.30, true);
  const o = computeRadialFan([anchor, lone], [{ x: toPxX(0.2), y: toPxY(-0.3) }]).get('lonely')!;
  console.log('\n(a) lone word, open space  -> |offset|', mag(o), '(expect 0 = in place)');
}

// (b) lone revealed word whose home overlaps a surface anchor
{
  const anchor = fanBox('anchor', 'Confident', 0.30, 0.30, false);
  const near = fanBox('near', 'Curious', 0.31, 0.30, true); // basically on top of the anchor
  const o = computeRadialFan([anchor, near], [{ x: toPxX(0.30), y: toPxY(0.30) }]).get('near')!;
  console.log('(b) lone word on an anchor -> |offset|', mag(o), '(expect > 0, small push)');
}

// (c) two revealed words far apart, no overlap
{
  const a = fanBox('a', 'Brave', 0.5, 0.5, true);
  const b = fanBox('b', 'Weary', -0.5, -0.5, true);
  const oa = computeRadialFan([a, b], [{ x: toPxX(0), y: toPxY(0) }]).get('a')!;
  const ob = computeRadialFan([a, b], [{ x: toPxX(0), y: toPxY(0) }]).get('b')!;
  console.log('(c) two words far apart    -> |offset| a', mag(oa), 'b', mag(ob), '(expect 0, 0)');
}
