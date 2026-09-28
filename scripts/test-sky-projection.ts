// Behavioural check for the night-sky projection (src/utils/skyProjection.ts).
// Run: npm run check:sky
import { skyProjection, flatProjection, fieldToDir, dirToField, greatCircle, mulberry32 } from '../src/utils/skyProjection';
import { pixelToCoord } from '../src/hooks/useFieldGesture';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}
const W = 900, H = 700;

// AE1: zenith gaze, centre at centre, Activated right, Positive up.
{
  const p = skyProjection({ look: { x: 0, y: 0 }, fovDeg: 84, width: W, height: H });
  const c = p.toPx({ x: 0, y: 0 });
  check('zenith draws at stage centre', Math.abs(c.x - W / 2) < 0.01 && Math.abs(c.y - H / 2) < 0.01, `${c.x.toFixed(2)},${c.y.toFixed(2)}`);
  const right = p.toPx({ x: 0.5, y: 0 });
  const up = p.toPx({ x: 0, y: 0.5 });
  check('Activated draws right of centre', right.x > W / 2 + 50 && Math.abs(right.y - H / 2) < 0.01, `${right.x.toFixed(1)},${right.y.toFixed(1)}`);
  check('Positive draws above centre', up.y < H / 2 - 50 && Math.abs(up.x - W / 2) < 0.01, `${up.x.toFixed(1)},${up.y.toFixed(1)}`);
}

// AE2: orientation holds wherever the gaze tilts.
for (const look of [{ x: -0.9, y: -0.8 }, { x: 1.1, y: 0.3 }, { x: 0.2, y: 1.15 }, { x: -1.2, y: 0 }]) {
  const p = skyProjection({ look, fovDeg: 64, width: W, height: H });
  const a = p.toPx(look);
  const r = p.toPx({ x: look.x + 0.1, y: look.y });
  const u = p.toPx({ x: look.x, y: look.y + 0.1 });
  check(`orientation fixed at look ${look.x},${look.y}`, r.x > a.x && u.y < a.y, `dx=${(r.x - a.x).toFixed(1)} dy=${(u.y - a.y).toFixed(1)}`);
}

// AE3: press -> coordinate -> px round-trips within 1px across the stage.
{
  let worst = 0;
  for (const look of [{ x: 0, y: 0 }, { x: -0.9, y: -0.8 }, { x: 0.6, y: 0.9 }]) {
    const p = skyProjection({ look, fovDeg: 84, width: W, height: H });
    for (let px = 20; px < W; px += 110) for (let py = 20; py < H; py += 110) {
      const c = p.fromPx(px, py);
      if (!c || Math.abs(c.x) >= 0.999 || Math.abs(c.y) >= 0.999) continue; // clamped to the square
      const q = p.toPx(c);
      worst = Math.max(worst, Math.hypot(q.x - px, q.y - py));
    }
  }
  check('fromPx inverts toPx', worst < 1, `worst ${worst.toFixed(3)}px`);
}

// R4: nothing below the horizon is pressable.
{
  const p = skyProjection({ look: { x: 0, y: -1.2 }, fovDeg: 84, width: W, height: H });
  check('press below the horizon is ignored', p.fromPx(W / 2, H - 1) === null, 'bottom edge while looking low toward Negative');
}

// Direction mapping round-trips, and the corners stay above the horizon.
{
  let worst = 0;
  for (const c of [{ x: 0.3, y: -0.7 }, { x: -1, y: 1 }, { x: 0.99, y: 0.01 }]) {
    const back = dirToField(fieldToDir(c));
    worst = Math.max(worst, Math.hypot(back.x - c.x, back.y - c.y));
  }
  check('fieldToDir / dirToField round-trip', worst < 1e-9, `worst ${worst.toExponential(2)}`);
  const corner = dirToField(fieldToDir({ x: 1, y: 1 }));
  check('corner sits just above the horizon', Math.abs((corner.elevation * 180) / Math.PI - 4) < 0.01, `${((corner.elevation * 180) / Math.PI).toFixed(2)}°`);
}

// Behind-camera directions are reported invisible, never drawn mirrored.
{
  const p = skyProjection({ look: { x: -1.2, y: 0 }, fovDeg: 84, width: W, height: H });
  check('direction behind the gaze is invisible', !p.toPx({ x: 1, y: 0 }).visible, 'looking low toward Calm, Activated horizon behind');
}

// R21: the flat projection is exactly today's geometry.
{
  const flat = flatProjection({ width: W, height: H });
  const q = flat.toPx({ x: 0.4, y: -0.2 });
  check('flat toPx matches toPercent', Math.abs(q.x - (5 + (1.4 / 2) * 90) / 100 * W) < 1e-9 && Math.abs(q.y - (5 + (1.2 / 2) * 90) / 100 * H) < 1e-9, `${q.x},${q.y}`);
  const rect = { left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  let worst = 0;
  for (const [px, py] of [[10, 10], [450, 350], [880, 690], [123, 456]]) {
    const a = flat.fromPx(px, py)!;
    const b = pixelToCoord(px, py, rect, W, H);
    worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
  }
  check('flat fromPx matches pixelToCoord', worst < 1e-12, `worst ${worst}`);
}

// Great circles stay on the unit sphere and end where they should.
{
  const a = fieldToDir({ x: 0.2, y: 0.3 }), b = fieldToDir({ x: -0.5, y: 0.6 });
  const path = greatCircle(a, b, 24);
  const off = Math.max(...path.map((d) => Math.abs(Math.hypot(...d) - 1)));
  check('great circle stays on the dome', off < 1e-9 && path.length === 25, `max radius error ${off.toExponential(2)}`);
}

// Seeded stars are the same sky every load.
{
  const a = mulberry32(7), b = mulberry32(7);
  const same = Array.from({ length: 5 }, () => a() === b()).every(Boolean);
  check('starfield seed is deterministic', same, 'two generators, same seed');
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
