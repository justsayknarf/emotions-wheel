// Behavioural check for weighted AxisSlider motion (src/utils/sliderWeight.ts).
// Run: npm run check:slider
import { stepWeighted, sliderWeightFrom, isGrab, flightDuration, flightValue, easeInOut } from '../src/utils/sliderWeight';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}
const DT = 1 / 60;
const W = sliderWeightFrom(0.6);

// AE6: dragging past the end and holding reaches the edge only deliberately.
{
  let v = 0;
  const at: Record<string, number> = {};
  for (let i = 1; i <= 180; i++) {
    v = stepWeighted(v, 1, DT, W);
    if (i === 60) at['1s'] = v;
    if (i === 120) at['2s'] = v;
  }
  at['3s'] = v;
  check('passes 0.3 within 1s', at['1s'] > 0.3, `v(1s) = ${at['1s'].toFixed(3)}`);
  check('still short of 0.9 at 2s', at['2s'] < 0.9, `v(2s) = ${at['2s'].toFixed(3)}`);
  check('arrives by 3s', at['3s'] > 0.97, `v(3s) = ${at['3s'].toFixed(3)}`);
}

// Heading back inward is not slowed by the edge resistance.
{
  const inward = stepWeighted(0.9, 0, DT, W) - 0.9;
  const outward = stepWeighted(0.9, 1, DT, W) - 0.9;
  check('inward is faster than outward near the edge', Math.abs(inward) > Math.abs(outward) * 2, `in ${inward.toFixed(4)} vs out ${outward.toFixed(4)}`);
}

// Never overshoots the pointer.
{
  let v = 0.4, over = false;
  for (let i = 0; i < 120; i++) { v = stepWeighted(v, 0.42, DT, W); if (v > 0.42 + 1e-12) over = true; }
  check('never passes the pointer', !over && Math.abs(v - 0.42) < 1e-4, `settled at ${v.toFixed(5)}`);
}

// Heavier weight is slower.
{
  const light = stepWeighted(0, 1, DT, sliderWeightFrom(0));
  const heavy = stepWeighted(0, 1, DT, sliderWeightFrom(1));
  check('heavy is slower than light', heavy < light, `light ${light.toFixed(4)} heavy ${heavy.toFixed(4)}`);
}

// R14/R16: the grab zone.
check('within 24px grabs', isGrab(124, 100, 24), '24px away');
check('beyond 24px flies', !isGrab(125, 100, 24), '25px away');

// R16: flight timing and easing.
{
  check('short hop is quick', Math.abs(flightDuration(0, 0.2, W) - 0.67) < 1e-9, `${flightDuration(0, 0.2, W).toFixed(2)}s`);
  check('edge to edge stays watchable', Math.abs(flightDuration(-1, 1, W) - 1.3) < 1e-9, `${flightDuration(-1, 1, W).toFixed(2)}s`);
  check('flight starts and ends at rest', easeInOut(0) === 0 && easeInOut(1) === 1 && easeInOut(0.02) < 0.002, `ease(0.02) = ${easeInOut(0.02).toFixed(5)}`);
  check('flight lands exactly', flightValue(-0.5, 0.8, 5, 1) === 0.8, 'elapsed past duration clamps');
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
