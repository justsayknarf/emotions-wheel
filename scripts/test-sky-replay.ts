// Behavioural check for the constellation replay in the night sky
// (src/components/Constellation/skyTour.ts): the tour's timing, the gaze's
// path between check-ins, and the lit constellation's pulse.
// Run: pnpm check:skyreplay
//
// SkyReplay's canvas is verified live in the app; this exercises the pure
// plan and exits non-zero on any violation.
import {
  skyReplayPlan,
  skyReplayFocus,
  skyReplayLook,
  skyReplayGlow,
  chainDraw,
  skyReplayPresence,
  hopMs,
  HOP_BASE_MS,
  HOP_MAX_MS,
  MAX_SKY_SPAN_MS,
  PULSE_FLOOR,
  skyReplayArrived,
  skyReplayCursor,
  skyOverview,
  OVERVIEW_FOV_MAX,
} from '../src/components/Constellation/skyTour';
import { skyProjection } from '../src/utils/skyProjection';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const LOOK_MAX = 1.2;

// Empty and single histories.
{
  const p0 = skyReplayPlan([], LOOK_MAX);
  check('empty tour has no length', p0.total === 0 && skyReplayFocus(p0, 0) === -1, `total ${p0.total}`);
  const look0 = skyReplayLook(p0, 0);
  check('empty tour looks straight up', look0.x === 0 && look0.y === 0, `look ${JSON.stringify(look0)}`);
  const p1 = skyReplayPlan([{ pin: { x: 0.3, y: -0.4 }, tags: 2 }], LOOK_MAX);
  check('one check-in lands at 0', p1.land[0] === 0 && p1.glideMs[0] === 0, `land ${p1.land[0]}`);
  check('one check-in still draws and pulses', p1.total >= p1.revealEnd[0] + p1.pulseMs, `total ${p1.total}`);
  check('the gaze starts on the first check-in', near(skyReplayLook(p1, 0).x, 0.3), `look ${JSON.stringify(skyReplayLook(p1, 0))}`);
}

// Hops: slower for longer distances, capped.
{
  const short = hopMs({ x: 0, y: 0 }, { x: 0.1, y: 0 });
  const long = hopMs({ x: -1, y: -1 }, { x: 1, y: 1 });
  check('a short hop is near the base', short >= HOP_BASE_MS && short < HOP_BASE_MS + 100, `${short.toFixed(0)}ms`);
  check('a long hop is slower but capped', long > short && long <= HOP_MAX_MS, `${long.toFixed(0)}ms`);
}

// A week: ordering, camera path and comet timing.
const week = [
  { pin: { x: 0.5, y: 0.5 }, tags: 2 },
  { pin: { x: -0.4, y: 0.2 }, tags: 0 },
  { pin: { x: -0.6, y: -0.7 }, tags: 3 },
  { pin: { x: 0.9, y: -0.9 }, tags: 1 },
];
{
  const p = skyReplayPlan(week, LOOK_MAX);
  check('a short history is not compressed', p.scale === 1, `scale ${p.scale}`);
  const ordered = week.every((w, i) =>
    p.glideStart[i] <= p.land[i]
    && p.land[i] < p.revealAt[i] && p.revealAt[i] < p.revealEnd[i]
    && p.revealEnd[i] < p.holdEnd[i]
    && (i === 0 || p.glideStart[i] === p.holdEnd[i - 1]));
  check('each check-in glides, lands, draws, then holds, in order', ordered, JSON.stringify({ land: p.land.map(Math.round), holdEnd: p.holdEnd.map(Math.round) }));
  check('a bare check-in holds more briefly', p.holdEnd[1] - p.revealEnd[1] < p.holdEnd[0] - p.revealEnd[0], `bare ${(p.holdEnd[1] - p.revealEnd[1]).toFixed(0)}ms`);

  // The gaze rests on each pin, clamped to the camera's reach.
  const rest = skyReplayLook(p, p.land[3] + 10);
  check('the gaze rests on a far pin at the reach limit', near(Math.hypot(rest.x, rest.y), LOOK_MAX), `|look| ${Math.hypot(rest.x, rest.y).toFixed(3)}`);
  const settled = skyReplayLook(p, p.land[1] + 5);
  check('the gaze rests on a near pin exactly', near(settled.x, -0.4) && near(settled.y, 0.2), `look ${JSON.stringify(settled)}`);
  // Mid-glide the gaze is between the two pins, and moves monotonically.
  let mono = true;
  let prevD = Infinity;
  for (let k = 0; k <= 40; k++) {
    const t = p.glideStart[2] + (p.glideMs[2] * k) / 40;
    const l = skyReplayLook(p, t);
    const d = Math.hypot(l.x - p.looks[2].x, l.y - p.looks[2].y);
    if (d > prevD + 1e-9) mono = false;
    prevD = d;
  }
  check('the gaze closes on the next pin without backtracking', mono && near(prevD, 0), `final distance ${prevD.toExponential(2)}`);

  // The comet into each check-in arrives exactly when its star lands.
  const before = chainDraw(p, 2, p.glideStart[2] - 1);
  const arrive = chainDraw(p, 2, p.land[2]);
  check('the comet waits for its glide', before === null, `${JSON.stringify(before)}`);
  check('the comet head arrives as the star lands', arrive !== null && near(arrive.head, 1), `head ${arrive?.head}`);
  check('the first check-in has no comet', chainDraw(p, 0, 1e6) === null, 'chainDraw(0) null');

  // The whole constellation fades in at once, rising monotonically from 0.
  let rising = true;
  let prevOn = 0;
  for (let k = 0; k <= 30; k++) {
    const on = skyReplayPresence(p, 2, p.revealAt[2] + (p.revealMs * k) / 30);
    if (on < prevOn - 1e-9) rising = false;
    prevOn = on;
  }
  check('the constellation fades in from dark to full', near(skyReplayPresence(p, 2, p.revealAt[2]), 0) && rising && near(prevOn, 1), `end ${prevOn}`);
  check('nothing shows between landing and the reveal', skyReplayPresence(p, 2, p.land[2] + 1) === 0, 'presence 0');
  const steady = skyReplayPresence(p, 2, p.revealEnd[2] + p.pulseMs / 2);
  check('presence holds steady through the pulse', near(steady, 1), `presence ${steady}`);

  // Focus follows the glides.
  check('focus moves on as the glide begins', skyReplayFocus(p, p.glideStart[2] - 1) === 1 && skyReplayFocus(p, p.glideStart[2]) === 2, 'focus 1 → 2');

  // Glow: dark before landing, full while drawing, breathes, fades, last stays lit.
  check('glow is dark before landing', skyReplayGlow(p, 2, p.land[2] - 1) === 0, 'glow 0');
  const mid = skyReplayGlow(p, 2, p.revealAt[2] + p.revealMs / 2);
  check('glow rises with the fade-in', mid > 0 && mid < 1, `glow ${mid.toFixed(2)}`);
  check('glow is full once faded in', near(skyReplayGlow(p, 2, p.revealEnd[2]), 1), 'glow 1');
  const trough = skyReplayGlow(p, 2, p.revealEnd[2] + p.pulseMs / 2);
  check('the pulse dips to its floor mid-pulse', near(trough, PULSE_FLOOR), `glow ${trough}`);
  const crest = skyReplayGlow(p, 2, p.holdEnd[2]);
  check('the hold ends on a crest', near(crest, 1), `glow ${crest}`);
  const fading = skyReplayGlow(p, 2, p.holdEnd[2] + p.fadeMs / 2);
  check('the constellation fades as the gaze moves on', fading > 0 && fading < 1, `glow ${fading.toFixed(2)}`);
  check('then it is gone', skyReplayGlow(p, 2, p.holdEnd[2] + p.fadeMs) === 0, 'glow 0');
  const end = skyReplayGlow(p, 3, p.total);
  check('the tour ends with the last constellation lit', near(end, 1), `glow ${end}`);
  check('only one constellation is fully lit at a time', week.every((_, i) => i === 2 || skyReplayGlow(p, i, p.revealEnd[2]) < 1), 'others below 1');
}

// Long histories compress to fit, keeping order.
for (const n of [30, 120, 500]) {
  const stops = Array.from({ length: n }, (_, i) => ({ pin: { x: Math.cos(i), y: Math.sin(i * 1.7) }, tags: i % 4 }));
  const p = skyReplayPlan(stops, LOOK_MAX);
  check(`n=${n} tour fits the span`, p.total <= MAX_SKY_SPAN_MS + 1e-6 && p.scale <= 1, `total ${p.total.toFixed(0)}ms, scale ${p.scale.toFixed(3)}`);
  const ordered = stops.every((_, i) => p.land[i] >= p.glideStart[i] && (i === 0 || p.land[i] > p.land[i - 1]));
  check(`n=${n} landings stay in order`, ordered, `last land ${p.land[n - 1].toFixed(0)}ms`);
}

// The reflection walk follows the tour: arrivals and the week strip's cursor.
{
  const p = skyReplayPlan(week, LOOK_MAX);
  check('nothing has arrived at the start', skyReplayArrived(p, 0) === -1, String(skyReplayArrived(p, 0)));
  check('the first check-in arrives as its constellation starts to show', skyReplayArrived(p, p.revealAt[0]) === 0, '');
  check('a landed check-in has not arrived until its reveal', skyReplayArrived(p, p.land[2]) === 1, String(skyReplayArrived(p, p.land[2])));
  check('the last check-in arrives', skyReplayArrived(p, p.total) === week.length - 1, '');
  const rest = skyReplayCursor(p, p.revealEnd[1]);
  check('cursor rests on the check-in in view', rest.from === 1 && rest.to === 1 && rest.along === 1, JSON.stringify(rest));
  const mid = skyReplayCursor(p, p.glideStart[2] + p.glideMs[2] / 2);
  check('cursor halfway along a glide, on the camera ease', mid.from === 1 && mid.to === 2 && near(mid.along, 0.5), JSON.stringify(mid));
  const start = skyReplayCursor(p, 0);
  check('cursor starts on the first check-in', start.from === 0 && start.to === 0 && start.along === 1, JSON.stringify(start));
  check('an empty tour has a resting cursor at 0', skyReplayCursor(skyReplayPlan([], LOOK_MAX), 0).to === 0, '');
}

// The walk's opening view: every check-in of the week in frame.
{
  const size = { width: 900, height: 800 };
  const margin = { x: 40, top: 60, bottom: 90 };
  // A typical week: spread over the sky, but not to opposite horizons.
  const pins = [{ x: 0.62, y: -0.48 }, { x: 0.1, y: 0.05 }, { x: -0.55, y: 0.6 }, { x: -0.4, y: -0.35 }, { x: 0.5, y: 0.7 }];
  const o = skyOverview(pins, LOOK_MAX, 84, size, margin);
  const proj = skyProjection({ look: o.look, fovDeg: o.fov, width: size.width, height: size.height });
  const inside = pins.every((p) => { const q = proj.toPx(p); return q.visible && q.x >= margin.x && q.x <= size.width - margin.x && q.y >= margin.top && q.y <= size.height - margin.bottom; });
  check('the opening view keeps every check-in in frame', inside && o.fov >= 84 && o.fov <= OVERVIEW_FOV_MAX, `fov ${o.fov.toFixed(1)}`);
  check('the opening view looks at the middle of the week', near(o.look.x, (0.62 + 0.1 - 0.55 - 0.4 + 0.5) / 5) && near(o.look.y, (-0.48 + 0.05 + 0.6 - 0.35 + 0.7) / 5), JSON.stringify(o.look));
  const tight = skyOverview(pins, LOOK_MAX, 84, size, margin);
  const narrower = skyProjection({ look: tight.look, fovDeg: Math.max(84, tight.fov - 2), width: size.width, height: size.height });
  const stillFits = tight.fov > 84 && pins.every((p) => { const q = narrower.toPx(p); return q.visible && q.x >= margin.x && q.x <= size.width - margin.x && q.y >= margin.top && q.y <= size.height - margin.bottom; });
  check('the opening view is no wider than it needs to be', !stillFits, `fov ${tight.fov.toFixed(1)}`);
  const one = skyOverview([{ x: 0.3, y: 0.2 }], LOOK_MAX, 84, size, margin);
  check('a single check-in opens at rest, looking at it', one.fov === 84 && near(one.look.x, 0.3) && near(one.look.y, 0.2), JSON.stringify(one));
  const spread = skyOverview([{ x: -1, y: -1 }, { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }], LOOK_MAX, 84, size, margin);
  check('a week too spread out to fit gets the widest view', spread.fov <= OVERVIEW_FOV_MAX, `fov ${spread.fov.toFixed(1)}`);
  check('no stage yet: rest', skyOverview(pins, LOOK_MAX, 84, { width: 0, height: 0 }, margin).fov === 84, '');
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll sky replay checks passed.');
