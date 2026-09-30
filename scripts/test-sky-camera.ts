// Behavioural check for the night-sky camera (src/utils/skyCamera.ts).
// Run: npm run check:camera
import { stepCamera, initialCamera, isSettled, cameraTarget, degToField, DEFAULT_CAMERA_PARAMS as P, type CameraState } from '../src/utils/skyCamera';
import { skyProjection } from '../src/utils/skyProjection';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}
const DT = 1 / 60;

// AE4: a jump glides under the speed cap and never passes its target.
{
  let s: CameraState = initialCamera({ x: 0, y: 0 }, true, P);
  const target = { x: 1, y: 1 }; // clamps to lookMax along the diagonal
  const goal = { x: P.lookMax / Math.SQRT2, y: P.lookMax / Math.SQRT2 };
  let maxSpeed = 0, passed = false, t = 0;
  let prev = s.look;
  while (t < 12) {
    s = stepCamera(s, { target, prevTarget: target, lean: true, reduced: false }, DT, P);
    maxSpeed = Math.max(maxSpeed, Math.hypot(s.look.x - prev.x, s.look.y - prev.y) / DT);
    if ((goal.x - s.look.x) * goal.x + (goal.y - s.look.y) * goal.y < -1e-9) passed = true;
    prev = s.look; t += DT;
  }
  const cap = degToField(P.maxDegPerSec);
  check('jump never exceeds the pan cap', maxSpeed <= cap + 1e-9, `peak ${maxSpeed.toFixed(3)} ≤ cap ${cap.toFixed(3)} field/s`);
  check('jump never overshoots', !passed, 'monotone approach');
  check('jump settles', isSettled(s, target, true, P), `look ${s.look.x.toFixed(3)},${s.look.y.toFixed(3)}`);
}

// AE5: a continuous 1s flight carries the gaze, so the pin barely moves on screen.
{
  let s: CameraState = initialCamera({ x: -0.6, y: 0 }, true, P);
  const from = { x: -0.6, y: 0 }, to = { x: 0.8, y: 0.2 };
  let prevTarget = from, worst = 0;
  let prevPx = skyProjection({ look: s.look, fovDeg: s.fovDeg, width: 900, height: 700 }).toPx(from);
  for (let t = DT; t <= 1 + 1e-9; t += DT) {
    const k = 0.5 - 0.5 * Math.cos(Math.PI * t);
    const target = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
    s = stepCamera(s, { target, prevTarget, lean: true, reduced: false }, DT, P);
    const px = skyProjection({ look: s.look, fovDeg: s.fovDeg, width: 900, height: 700 }).toPx(target);
    worst = Math.max(worst, Math.hypot(px.x - prevPx.x, px.y - prevPx.y));
    prevPx = px; prevTarget = target;
  }
  check('flight keeps the pin steady on screen', worst < 2, `worst frame-to-frame move ${worst.toFixed(2)}px`);
}

// Carry stops at the tilt limit instead of pushing the gaze past it.
{
  let s: CameraState = initialCamera({ x: 1.1, y: 0 }, true, P);
  let prevTarget = { x: 1.1, y: 0 };
  for (let i = 1; i <= 30; i++) {
    const target = { x: 1.1 + i * 0.01, y: 0 };
    s = stepCamera(s, { target, prevTarget, lean: true, reduced: false }, DT, P);
    prevTarget = target;
  }
  check('gaze respects lookMax', Math.hypot(s.look.x, s.look.y) <= P.lookMax + 1e-9, `|look| = ${Math.hypot(s.look.x, s.look.y).toFixed(4)}`);
}

// R13: reduced motion snaps.
{
  const s = stepCamera(initialCamera({ x: 0, y: 0 }, false, P), { target: { x: 0.5, y: -0.5 }, prevTarget: null, lean: true, reduced: true }, DT, P);
  check('reduced motion snaps look and fov', s.look.x === 0.5 && s.look.y === -0.5 && s.fovDeg === P.fovLean, `${s.look.x},${s.look.y} fov ${s.fovDeg}`);
}

// R11: target preference order.
{
  const a = { x: 0.1, y: 0 }, b = { x: 0.2, y: 0 }, c = { x: 0.3, y: 0 }, d = { x: 0.4, y: 0 };
  check('live draft wins', cameraTarget({ liveDraft: a, emphasizedPin: b, newestDraftPin: c, recordedAnchor: d }) === a, 'liveDraft');
  check('then the emphasized pin', cameraTarget({ liveDraft: null, emphasizedPin: b, newestDraftPin: c, recordedAnchor: d }) === b, 'emphasizedPin');
  check('then the newest draft pin', cameraTarget({ liveDraft: null, emphasizedPin: null, newestDraftPin: c, recordedAnchor: d }) === c, 'newestDraftPin');
  check('then the previous check-in', cameraTarget({ liveDraft: null, emphasizedPin: null, newestDraftPin: null, recordedAnchor: d }) === d, 'recordedAnchor');
  const z = cameraTarget({ liveDraft: null, emphasizedPin: null, newestDraftPin: null, recordedAnchor: null });
  check('else the zenith', z.x === 0 && z.y === 0, 'zenith');
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
