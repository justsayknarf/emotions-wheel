// Behavioural check for the night-sky opening pan (src/utils/skyIntro.ts).
// Run: npm run check:intro
import { clampIntroDuration, introLook, introPeakSpeed, introStart, type IntroSpec } from '../src/utils/skyIntro';
import { degToField, DEFAULT_CAMERA_PARAMS as P } from '../src/utils/skyCamera';
import { skyProjection } from '../src/utils/skyProjection';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}
const spec: IntroSpec = { from: introStart(P.lookMax), to: { x: 0, y: 0 }, delayS: 0.2, durationS: 3.0 };
// The opening pan's own ceiling (skyIntroMaxDeg's default), not the camera's pan cap.
const INTRO_CAP = degToField(45);

// Starts on the horizon side the screen calls "down".
{
  const s = introStart(P.lookMax);
  check('starts over the Negative horizon', s.x === 0 && s.y === -P.lookMax, `${s.x},${s.y}`);
  const proj = skyProjection({ look: s, fovDeg: P.fovRest, width: 900, height: 700 });
  const horizon = proj.toPx({ x: 0, y: -Math.SQRT2 });
  check('the horizon is in view at the start', horizon.visible && horizon.y > 350 && horizon.y < 700, `horizon at y=${horizon.y.toFixed(1)} of 700`);
}

// Holds still through the delay, then lands exactly on the still point.
{
  const a = introLook(0, spec), b = introLook(spec.delayS, spec);
  check('holds at the horizon during the delay', a.look.y === spec.from.y && b.look.y === spec.from.y && !b.done, `y=${b.look.y}`);
  const end = introLook(spec.delayS + spec.durationS, spec);
  check('lands exactly on the still point', end.look.x === 0 && end.look.y === 0 && end.done, `${end.look.x},${end.look.y}`);
  const late = introLook(60, spec);
  check('stays landed afterwards', late.look.y === 0 && late.done, 'elapsed 60s');
}

// Rises monotonically, starts and ends at rest, and never outruns its ceiling.
{
  const DT = 1 / 60;
  let prev = introLook(0, spec).look.y, mono = true, peak = 0, first = -1, last = -1;
  for (let t = DT; t <= spec.delayS + spec.durationS + 0.5; t += DT) {
    const y = introLook(t, spec).look.y;
    if (y < prev - 1e-12) mono = false;
    const v = (y - prev) / DT;
    peak = Math.max(peak, v);
    if (first < 0 && t > spec.delayS) first = v;
    prev = y; last = v;
  }
  check('rises without dipping back', mono, 'monotone');
  check('starts and ends at rest', first < 0.01 && last < 1e-9, `first-frame speed ${first.toFixed(4)}, last ${last}`);
  const cap = INTRO_CAP;
  check('never faster than the intro ceiling (45°/s)', peak <= cap && introPeakSpeed(spec) <= cap, `peak ${peak.toFixed(3)} (analytic ${introPeakSpeed(spec).toFixed(3)}) ≤ cap ${cap.toFixed(3)} field/s`);
}

// Any admin duration is clamped to the ceiling (R13): a too-short one is
// lengthened until it isn't too fast, and one already under it is untouched.
{
  const cap = INTRO_CAP;
  const fast: IntroSpec = { ...spec, durationS: 0.5 };
  check('a too-short duration is over the cap before clamping', introPeakSpeed(fast) > cap, `peak ${introPeakSpeed(fast).toFixed(3)} > cap ${cap.toFixed(3)}`);
  const clamped = clampIntroDuration(fast, cap);
  const DT = 1 / 240;
  let prev = introLook(0, clamped).look.y, peak = 0;
  for (let t = DT; t <= clamped.delayS + clamped.durationS + 0.5; t += DT) {
    const y = introLook(t, clamped).look.y;
    peak = Math.max(peak, (y - prev) / DT);
    prev = y;
  }
  check('after clamping it stays under the cap', introPeakSpeed(clamped) <= cap && peak <= cap && clamped.durationS > fast.durationS,
    `duration ${fast.durationS}s → ${clamped.durationS.toFixed(3)}s, peak ${peak.toFixed(3)} (analytic ${introPeakSpeed(clamped).toFixed(3)}) ≤ cap ${cap.toFixed(3)}`);
  check('clamping still lands on the still point', introLook(clamped.delayS + clamped.durationS, clamped).look.y === 0, 'y=0');
  check('an in-cap duration is left alone', clampIntroDuration(spec, cap) === spec, `${spec.durationS}s`);
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
