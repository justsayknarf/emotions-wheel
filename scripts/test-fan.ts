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
