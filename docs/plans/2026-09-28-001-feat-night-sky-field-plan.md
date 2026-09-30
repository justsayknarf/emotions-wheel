---
title: "feat: Night-sky field behind a flag, with weighted sliders and tap-to-fly"
type: feat
date: 2026-09-28
origin: docs/brainstorms/2026-09-28-night-sky-field-requirements.md
---

# Night-Sky Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the emotion field as the inside of a night-sky dome, behind a `skyField` flag. The flat (x, y) datum is unchanged. The card's sliders gain weight and tap-to-fly.

**Architecture:** One `FieldProjection` interface (field coordinate ↔ stage px) replaces the ~15 inline `toPercent` placements in the field. The flat implementation is today's geometry exactly, and the sky implementation is a fixed-orientation perspective projection of the dome. A pure camera stepper (carry continuous motion, spring-glide jumps) drives the sky projection from a rAF hook local to `EmotionField`, so `App` never re-renders per frame. A new canvas layer paints the sky, every word as a star, and the constellation lines. The DOM words, reveal rules, radial fan and tethers are reused as they are, only positioned through the projection. `AxisSlider` gains an opt-in weighted mode backed by a pure stepper.

**Tech Stack:** React 19, TypeScript, Vite, framer-motion, Canvas 2D, pure-logic check scripts run with `npx tsx` (no component test harness; see AGENTS.md).

**Spec:** `docs/brainstorms/2026-09-28-night-sky-field-requirements.md` (R1–R21, AE1–AE8). Feel-tested mock: https://claude.ai/artifact/XX25pz9Gyk2UCwdzRo8h9D

## Global Constraints

- The datum does not change. `PinEntry`, `DiaryEntry`, reveal radius (`VISIBILITY_RADIUS`), `DEEP_REVEAL_CAP`, tag suggestion and CSV all stay in flat field coordinates.
- With `skyField` off, behaviour and appearance match `main` exactly (R21). Every existing `check:*` script must keep passing unchanged.
- Colours come from theme tokens only: `themeRgba(channel, alpha)` in canvas code, `var(--ui-*)` / `rgb(var(--ui-*-rgb) / a)` in DOM. Never paste a hex. `npm run check:theme` enforces this.
- Motion has no bounce (springs at or near critical damping). Every rAF loop added here honours reduced motion.
- `pnpm` for installs. The dev server serves under `/emotions-wheel/`.
- New pure logic gets a `check:<name>` script and a row in the AGENTS.md table.
- `npm run lint` has five known errors on `main` (AGENTS.md). Don't add to them.
- Work on `feat/night-sky-field`, branched from `origin/main` in a worktree. The shared checkout usually has another session's uncommitted work.

## Key Technical Decisions

- **Projection interface, not a second field component.** A parallel `SkyField` would fork the reveal and fan logic (`EmotionField.tsx:229-560`), which already runs in coordinate space and only turns into px at the edges. Routing those edges through `proj.toPx` keeps a single code path for both views and makes the flag a one-line switch.
- **The camera lives in `EmotionField`, not `App`.** Per-frame `App` re-renders caused the drag-perf regressions fixed in `e209c75` / `70a9b4d` / `4ef369f`. A local `useSkyCamera` hook re-renders only the field, only while the camera is unsettled (`isSettled`), and sleeps otherwise.
- **Carry beats chase.** A target that moves by ≤ 0.12 field units per frame (a weighted drag or a flight) moves the gaze by the same delta, so the star stays put on screen. Anything larger (a field press elsewhere, a card reselect) closes on a critically damped spring capped at 25°/s. This replaces the mock's special-casing of flights with one rule that `check:camera` can prove (AE4, AE5).
- **Canvas draws light, DOM draws words.** The sky, all 188 stars and the constellation lines are one canvas (`SkyBackdrop`). Labels stay `EmotionWord`, reusing the letter reveal, tag pulse, fan offsets and memo. In sky mode `EmotionWord` hides its own dot so each star isn't drawn twice.
- **Weighted slider is opt-in per call site.** `AxisSlider` takes a `weight?: SliderWeight` prop. `CoordinateCard` and `DepartureFloat` pass it only when `skyField` is on. The landing page keeps the direct slider.
- **The flag lives in `RevealTuning`.** It gets the existing sanitising, cross-tab sync and admin page for free. A `?field=sky|flat` query parameter persists it on deployed builds, where the admin page doesn't exist.
- **The card tether reads the rendered pin.** `Tether.tsx` currently recomputes the pin's px from `toPercent`, which is wrong under the sky projection. It will read the `[data-field-pin]` element's own rect, which `EmotionField` already renders (`EmotionField.tsx:738`).

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/utils/skyProjection.ts` | create | `FieldProjection` interface, flat and sky projections, dome direction maths, great circles, seeded PRNG |
| `src/utils/skyCamera.ts` | create | Camera state, `stepCamera`, `isSettled`, `cameraTarget` |
| `src/utils/sliderWeight.ts` | create | Weighted stepping, grab test, flight timing and easing |
| `scripts/test-sky-projection.ts` | create | `check:sky` |
| `scripts/test-sky-camera.ts` | create | `check:camera` |
| `scripts/test-slider-weight.ts` | create | `check:slider` |
| `src/config/revealTuning.ts` | modify | `skyField` flag and sky/slider knobs |
| `src/main.tsx` | modify | `?field=` query parameter persists the flag |
| `src/admin/components/AdminRevealTuning.tsx` | modify | Sky knob group and flag toggle |
| `src/components/EmotionField/useSkyCamera.ts` | create | rAF hook: steps the camera, returns the live projection |
| `src/components/EmotionField/SkyBackdrop.tsx` | create | Canvas: sky, stars, constellation lines, draft trail |
| `src/components/EmotionField/EmotionField.tsx` | modify | All placements through `proj`; sky-mode layer swaps |
| `src/components/EmotionField/EmotionWord.tsx` | modify | Takes px position; `hideDot` |
| `src/components/EmotionField/usePinLanding.ts` | modify | Word hit-test through `proj` |
| `src/hooks/useFieldGesture.ts` | modify | Optional `toCoord` override for presses |
| `src/data/checkIn.ts` | modify | `findNearbyPinPx` (px-space hit test) |
| `src/components/EmotionField/Tether.tsx` | modify | Pin endpoint from the rendered pin element |
| `src/components/EmotionPreview/AxisSlider.tsx` | modify | Weighted drag, tap-to-fly, pull ring |
| `src/components/EmotionPreview/CoordinateCard.tsx`, `DepartureFloat.tsx` | modify | Pass `weight` in sky mode |
| `src/App.tsx` | modify | Skip `ShaderBackground` in sky mode |
| `package.json`, `AGENTS.md` | modify | Register the three checks |

---

### Task 1: Sky projection module (`check:sky`)

**Covers:** R1, R2, R4, R21 (flat parity); AE1–AE3.

**Files:**
- Create: `src/utils/skyProjection.ts`
- Create: `scripts/test-sky-projection.ts`
- Modify: `package.json` (scripts), `AGENTS.md` (check table)

**Interfaces:**
- Produces: `FieldCoord`, `ScreenPoint`, `FieldProjection { kind; toPx(c): ScreenPoint; fromPx(px, py): FieldCoord | null }`, `skyProjection({ look, fovDeg, width, height })`, `flatProjection({ width, height })`, `fieldToDir(c): Vec3`, `dirToField(d)`, `greatCircle(a, b, steps): Vec3[]`, `mulberry32(seed): () => number`, `RMAX`, `ZEN_SPAN`.

- [ ] **Step 1: Write the check script** at `scripts/test-sky-projection.ts`:

```ts
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
```

- [ ] **Step 2: Register it and watch it fail.** Add `"check:sky": "npx tsx scripts/test-sky-projection.ts",` to `package.json` scripts after `check:replay`.

Run: `npm run check:sky`
Expected: FAIL, `Cannot find module '../src/utils/skyProjection'`.

- [ ] **Step 3: Implement** `src/utils/skyProjection.ts`:

```ts
import { toPercent } from './fieldGeometry';

// The night-sky field (docs/plans/2026-09-28-001-feat-night-sky-field-plan.md).
// Field coordinates stay the datum; this module only decides where a coordinate
// draws. The centre is the zenith, intensity comes down toward the horizon and
// quality is the compass bearing. The camera never yaws: screen-right is always
// +x (Activated) and screen-up always +y (Positive), so the sky never mirrors.

export type Vec3 = [number, number, number];
export interface FieldCoord { x: number; y: number }
export interface ScreenPoint {
  x: number;
  y: number;
  // false when the direction is behind the camera; callers skip drawing it.
  visible: boolean;
  // 1 at the stage centre, falling off toward the edges; scales star size.
  scale: number;
}
export interface FieldProjection {
  kind: 'flat' | 'sky';
  toPx(c: FieldCoord): ScreenPoint;
  // Stage-local px (0,0 = top-left) back to a field coordinate clamped to the
  // square, or null where nothing is pressable (below the horizon).
  fromPx(px: number, py: number): FieldCoord | null;
}

export const RMAX = Math.SQRT2;
export const ZEN_SPAN = (86 * Math.PI) / 180;
const HORIZON_MIN = (2 * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function elevationOf(r: number): number {
  return Math.PI / 2 - (Math.min(r, RMAX) / RMAX) * ZEN_SPAN;
}

// World axes: +x = Activated, +y = up (zenith), +z = Positive.
export function fieldToDir(c: FieldCoord): Vec3 {
  const az = Math.atan2(c.y, c.x);
  const el = elevationOf(Math.hypot(c.x, c.y));
  const ce = Math.cos(el);
  return [ce * Math.cos(az), Math.sin(el), ce * Math.sin(az)];
}

export function dirToField(d: Vec3): FieldCoord & { elevation: number } {
  const elevation = Math.asin(clamp(d[1], -1, 1));
  const r = ((Math.PI / 2 - elevation) / ZEN_SPAN) * RMAX;
  const az = Math.atan2(d[2], d[0]);
  return { x: r * Math.cos(az), y: r * Math.sin(az), elevation };
}

// Forward is the gaze; right and up are world +x and +z made orthonormal
// against it (Gram-Schmidt), which is what keeps the orientation fixed.
export function cameraBasis(look: FieldCoord): { f: Vec3; r: Vec3; u: Vec3 } {
  const f = fieldToDir(look);
  const X: Vec3 = [1, 0, 0];
  const Z: Vec3 = [0, 0, 1];
  const xf = dot(X, f);
  const r = norm([X[0] - xf * f[0], X[1] - xf * f[1], X[2] - xf * f[2]]);
  const zf = dot(Z, f);
  const zr = dot(Z, r);
  const u = norm([Z[0] - zf * f[0] - zr * r[0], Z[1] - zf * f[1] - zr * r[1], Z[2] - zf * f[2] - zr * r[2]]);
  return { f, r, u };
}

export function focalLength(fovDeg: number, width: number, height: number): number {
  return Math.max(width, height) / (2 * Math.tan((fovDeg * Math.PI) / 360));
}

export function skyProjection(opts: { look: FieldCoord; fovDeg: number; width: number; height: number }): FieldProjection {
  const { f, r, u } = cameraBasis(opts.look);
  const F = focalLength(opts.fovDeg, opts.width, opts.height);
  const cx = opts.width / 2;
  const cy = opts.height / 2;
  const projectDir = (d: Vec3): ScreenPoint => {
    const z = dot(d, f);
    if (z < 0.05) return { x: 0, y: 0, visible: false, scale: 0 };
    return { x: cx + (dot(d, r) / z) * F, y: cy - (dot(d, u) / z) * F, visible: true, scale: z };
  };
  return {
    kind: 'sky',
    toPx: (c) => projectDir(fieldToDir(c)),
    fromPx: (px, py) => {
      const sx = (px - cx) / F;
      const sy = -(py - cy) / F;
      const d = norm([f[0] + r[0] * sx + u[0] * sy, f[1] + r[1] * sx + u[1] * sy, f[2] + r[2] * sx + u[2] * sy]);
      const p = dirToField(d);
      if (p.elevation < HORIZON_MIN) return null;
      return { x: clamp(p.x, -1, 1), y: clamp(p.y, -1, 1) };
    },
  };
}

// The existing flat field, behind the same interface. Must agree exactly with
// toPercent (placement) and useFieldGesture's pixelToCoord (presses).
export function flatProjection(size: { width: number; height: number }): FieldProjection {
  return {
    kind: 'flat',
    toPx: (c) => ({
      x: (toPercent(c.x) / 100) * size.width,
      y: (toPercent(-c.y) / 100) * size.height,
      visible: true,
      scale: 1,
    }),
    fromPx: (px, py) => ({
      x: clamp(((px / size.width - 0.05) / 0.9) * 2 - 1, -1, 1),
      y: clamp(-(((py / size.height - 0.05) / 0.9) * 2 - 1), -1, 1),
    }),
  };
}

// Points along the great circle from a to b (unit vectors), inclusive.
export function greatCircle(a: Vec3, b: Vec3, steps: number): Vec3[] {
  const om = Math.acos(clamp(dot(a, b), -1, 1));
  if (om < 1e-5) return [a, b];
  const s = Math.sin(om);
  const out: Vec3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ka = Math.sin((1 - t) * om) / s;
    const kb = Math.sin(t * om) / s;
    out.push([a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb]);
  }
  return out;
}

// Deterministic PRNG so the starfield is the same sky on every load.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run it.**

Run: `npm run check:sky`
Expected: 16 PASS lines, then `all passed`.

- [ ] **Step 5: Add the AGENTS.md row** under the check table: `| \`npm run check:sky\` | night-sky projection: orientation, press round-trip, horizon, flat parity (\`src/utils/skyProjection.ts\`) |`

- [ ] **Step 6: Commit.**

```bash
git add src/utils/skyProjection.ts scripts/test-sky-projection.ts package.json AGENTS.md
git commit -m "feat(sky): add the night-sky field projection"
```

---

### Task 2: Sky camera stepper (`check:camera`)

**Covers:** R3, R11, R12, R13; AE4, AE5.

**Files:**
- Create: `src/utils/skyCamera.ts`
- Create: `scripts/test-sky-camera.ts`
- Modify: `package.json`, `AGENTS.md`

**Interfaces:**
- Consumes: `RMAX`, `ZEN_SPAN`, `FieldCoord`, `skyProjection` (Task 1).
- Produces: `CameraState { look; vel; fovDeg }`, `CameraParams`, `DEFAULT_CAMERA_PARAMS`, `clampLook(c, max)`, `degToField(deg)`, `initialCamera(target, lean, p)`, `stepCamera(s, { target, prevTarget, lean, reduced }, dt, p)`, `isSettled(s, target, lean, p)`, `cameraTarget({ liveDraft, emphasizedPin, newestDraftPin, recordedAnchor })`.

- [ ] **Step 1: Write the check script** at `scripts/test-sky-camera.ts`:

```ts
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
```

- [ ] **Step 2: Register and watch it fail.** Add `"check:camera": "npx tsx scripts/test-sky-camera.ts",`.

Run: `npm run check:camera`
Expected: FAIL, `Cannot find module '../src/utils/skyCamera'`.

- [ ] **Step 3: Implement** `src/utils/skyCamera.ts`:

```ts
import { RMAX, ZEN_SPAN, type FieldCoord } from './skyProjection';

// The sky field's camera (docs/plans/2026-09-28-001-feat-night-sky-field-plan.md).
// Continuous target motion (a weighted drag, a flight) carries the gaze
// one-for-one; whatever offset remains closes on a critically damped spring
// with a speed ceiling, so a jump glides and never lurches or overshoots.

export interface CameraState {
  look: FieldCoord;
  vel: FieldCoord;
  fovDeg: number;
}

export interface CameraParams {
  lookMax: number;      // field units from the zenith the gaze may tilt
  omega: number;        // spring stiffness, 1/s
  maxDegPerSec: number; // pan speed ceiling for the spring, degrees of sky/s
  carryStep: number;    // a per-frame target move at or under this is "continuous"
  fovRest: number;      // degrees across the larger stage dimension
  fovLean: number;      // narrower field of view while a draft pin exists
  fovRate: number;      // 1/s, exponential ease of the field of view
}

export const DEFAULT_CAMERA_PARAMS: CameraParams = {
  lookMax: 1.2,
  omega: 1.6,
  maxDegPerSec: 25,
  carryStep: 0.12,
  fovRest: 84,
  fovLean: 64,
  fovRate: 0.9,
};

export function clampLook(c: FieldCoord, max: number): FieldCoord {
  const r = Math.hypot(c.x, c.y);
  return r > max ? { x: (c.x * max) / r, y: (c.y * max) / r } : { x: c.x, y: c.y };
}

// Degrees of sky -> field units, via the zenith-span mapping in skyProjection.
export function degToField(deg: number): number {
  return ((deg * Math.PI) / 180) * (RMAX / ZEN_SPAN);
}

export function initialCamera(target: FieldCoord, lean: boolean, p: CameraParams): CameraState {
  return { look: clampLook(target, p.lookMax), vel: { x: 0, y: 0 }, fovDeg: lean ? p.fovLean : p.fovRest };
}

export function stepCamera(
  s: CameraState,
  input: { target: FieldCoord; prevTarget: FieldCoord | null; lean: boolean; reduced: boolean },
  dt: number,
  p: CameraParams,
): CameraState {
  const fovGoal = input.lean ? p.fovLean : p.fovRest;
  const goal = clampLook(input.target, p.lookMax);
  if (input.reduced) return { look: goal, vel: { x: 0, y: 0 }, fovDeg: fovGoal };

  let look = s.look;
  if (input.prevTarget) {
    const dx = input.target.x - input.prevTarget.x;
    const dy = input.target.y - input.prevTarget.y;
    if (Math.hypot(dx, dy) <= p.carryStep) look = clampLook({ x: look.x + dx, y: look.y + dy }, p.lookMax);
  }

  const w = p.omega;
  let vx = s.vel.x + (w * w * (goal.x - look.x) - 2 * w * s.vel.x) * dt;
  let vy = s.vel.y + (w * w * (goal.y - look.y) - 2 * w * s.vel.y) * dt;
  const vmax = degToField(p.maxDegPerSec);
  const sp = Math.hypot(vx, vy);
  if (sp > vmax) { vx *= vmax / sp; vy *= vmax / sp; }

  let next = { x: look.x + vx * dt, y: look.y + vy * dt };
  // Never pass the goal: if this step crossed it, land on it and stop.
  if ((goal.x - next.x) * (goal.x - look.x) + (goal.y - next.y) * (goal.y - look.y) < 0) {
    next = goal; vx = 0; vy = 0;
  }
  const fovDeg = s.fovDeg + (fovGoal - s.fovDeg) * (1 - Math.exp(-dt * p.fovRate));
  return { look: next, vel: { x: vx, y: vy }, fovDeg };
}

// True once nothing would visibly move, so the animation loop can sleep.
export function isSettled(s: CameraState, target: FieldCoord, lean: boolean, p: CameraParams): boolean {
  const goal = clampLook(target, p.lookMax);
  return (
    Math.hypot(goal.x - s.look.x, goal.y - s.look.y) < 1e-3 &&
    Math.hypot(s.vel.x, s.vel.y) < 1e-3 &&
    Math.abs((lean ? p.fovLean : p.fovRest) - s.fovDeg) < 0.05
  );
}

// Where the gaze should rest: the thing the user is moving, else the thing
// they're looking at, else where they were last time, else straight up.
export function cameraTarget(opts: {
  liveDraft: FieldCoord | null;
  emphasizedPin: FieldCoord | null;
  newestDraftPin: FieldCoord | null;
  recordedAnchor: FieldCoord | null;
}): FieldCoord {
  return opts.liveDraft ?? opts.emphasizedPin ?? opts.newestDraftPin ?? opts.recordedAnchor ?? { x: 0, y: 0 };
}
```

- [ ] **Step 4: Run it.**

Run: `npm run check:camera`
Expected: 11 PASS lines. The cap line reads `peak 0.411 ≤ cap 0.411 field/s` and the flight line reads `worst frame-to-frame move 0.00px`.

- [ ] **Step 5: AGENTS.md row:** `| \`npm run check:camera\` | night-sky camera: pan cap, no overshoot, carry during flights, tilt limit, target order (\`src/utils/skyCamera.ts\`) |`

- [ ] **Step 6: Commit.**

```bash
git add src/utils/skyCamera.ts scripts/test-sky-camera.ts package.json AGENTS.md
git commit -m "feat(sky): add the camera stepper with carry and capped glide"
```

---

### Task 3: Weighted slider stepper (`check:slider`)

**Covers:** R14, R16; AE6.

**Files:**
- Create: `src/utils/sliderWeight.ts`
- Create: `scripts/test-slider-weight.ts`
- Modify: `package.json`, `AGENTS.md`

**Interfaces:**
- Produces: `SliderWeight { speed; edge; gain; grabPx; flightBase; flightPerUnit }`, `sliderWeightFrom(weight, grabPx?, flightBase?, flightPerUnit?)`, `stepWeighted(v, target, dt, w)`, `isGrab(pointerX, thumbX, grabPx)`, `flightDuration(from, to, w)`, `easeInOut(k)`, `flightValue(from, to, elapsed, duration)`.

- [ ] **Step 1: Write the check script** at `scripts/test-slider-weight.ts`:

```ts
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
```

- [ ] **Step 2: Register and watch it fail.** Add `"check:slider": "npx tsx scripts/test-slider-weight.ts",`.

Run: `npm run check:slider`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `src/utils/sliderWeight.ts`:

```ts
// Weighted AxisSlider motion (docs/plans/2026-09-28-001-feat-night-sky-field-plan.md).
// Grabbing the thumb pulls it toward the pointer at a capped speed that
// tightens as it heads outward; tapping the track further away flies it there
// on an eased curve. Values are field units in [-1, 1].

export interface SliderWeight {
  speed: number;         // field units/s near the middle
  edge: number;          // 0..1, how much outward speed drops at the ends
  gain: number;          // 1/s, proportional pull before the speed cap bites
  grabPx: number;        // a press this close to the thumb grabs it
  flightBase: number;    // seconds, the shortest flight
  flightPerUnit: number; // seconds added per field unit travelled
}

// `weight` is the single Light(0) - Heavy(1) knob from the tuning page.
export function sliderWeightFrom(weight: number, grabPx = 24, flightBase = 0.6, flightPerUnit = 0.35): SliderWeight {
  return { speed: 1 - 0.8 * weight, edge: 0.75, gain: 3.5, grabPx, flightBase, flightPerUnit };
}

export function stepWeighted(v: number, target: number, dt: number, w: SliderWeight): number {
  const d = target - v;
  if (Math.abs(d) < 1e-4) return target;
  const outward = Math.sign(d) === Math.sign(v) ? Math.abs(v) : 0;
  const vmax = w.speed * (1 - w.edge * outward * outward) * dt;
  return v + Math.max(-vmax, Math.min(vmax, d * w.gain * dt));
}

export function isGrab(pointerX: number, thumbX: number, grabPx: number): boolean {
  return Math.abs(pointerX - thumbX) <= grabPx;
}

export function flightDuration(from: number, to: number, w: SliderWeight): number {
  return w.flightBase + w.flightPerUnit * Math.abs(to - from);
}

export function easeInOut(k: number): number {
  const c = Math.max(0, Math.min(1, k));
  return 0.5 - 0.5 * Math.cos(Math.PI * c);
}

export function flightValue(from: number, to: number, elapsed: number, duration: number): number {
  return from + (to - from) * easeInOut(elapsed / duration);
}
```

- [ ] **Step 4: Run it.**

Run: `npm run check:slider`
Expected: 12 PASS lines. The hold curve reads `v(1s) = 0.488`, `v(2s) = 0.829` and `v(3s) = 0.989`.

- [ ] **Step 5: AGENTS.md row:** `| \`npm run check:slider\` | weighted slider: edge resistance, no overshoot, grab zone, flight timing (\`src/utils/sliderWeight.ts\`) |`

- [ ] **Step 6: Commit.**

```bash
git add src/utils/sliderWeight.ts scripts/test-slider-weight.ts package.json AGENTS.md
git commit -m "feat(slider): add the weighted slider stepper"
```

---

### Task 4: `skyField` flag and tuning knobs

**Covers:** R20.

**Files:**
- Modify: `src/config/revealTuning.ts`
- Modify: `src/main.tsx`
- Modify: `src/admin/components/AdminRevealTuning.tsx`

**Interfaces:**
- Produces on `RevealTuning`: `skyField: boolean`, `skyFovRest: number`, `skyFovLean: number`, `skyPanMaxDeg: number`, `skyPanOmega: number`, `sliderWeight: number`, `sliderGrabPx: number`, `flightBase: number`, `flightPerUnit: number`. Also `cameraParamsFrom(t: RevealTuning): CameraParams` and `sliderWeightFromTuning(t): SliderWeight`, both exported from `revealTuning.ts`.

- [ ] **Step 1: Extend the interface and defaults.** Append to `RevealTuning` in `src/config/revealTuning.ts`:

```ts
  /**
   * Night-sky field (docs/plans/2026-09-28-001-feat-night-sky-field-plan.md).
   * Off by default until it has been lived with; ?field=sky / ?field=flat on
   * any app URL persists a choice (src/main.tsx).
   */
  skyField: boolean;
  /** Degrees across the larger stage dimension at rest / with a draft pin. */
  skyFovRest: number;
  skyFovLean: number;
  /** Ceiling on how fast the sky glides over a jump, degrees per second. */
  skyPanMaxDeg: number;
  /** Stiffness of that glide, 1/s (critically damped, never bounces). */
  skyPanOmega: number;
  /** Light (0) to Heavy (1) weighting of the card's sliders in sky mode. */
  sliderWeight: number;
  /** A slider press this close (px) to the thumb grabs it; further out flies. */
  sliderGrabPx: number;
  /** Seconds for the shortest flight, and added per field unit travelled. */
  flightBase: number;
  flightPerUnit: number;
```

and to `DEFAULT_TUNING`:

```ts
  // Night-sky field — values feel-tested in the 2026-09-28 mock.
  skyField: false,
  skyFovRest: 84,
  skyFovLean: 64,
  skyPanMaxDeg: 25,
  skyPanOmega: 1.6,
  sliderWeight: 0.6,
  sliderGrabPx: 24,
  flightBase: 0.6,
  flightPerUnit: 0.35,
```

Then add the two adapters at the bottom of the file:

```ts
import { DEFAULT_CAMERA_PARAMS, type CameraParams } from '../utils/skyCamera';
import { sliderWeightFrom, type SliderWeight } from '../utils/sliderWeight';

export function cameraParamsFrom(t: RevealTuning): CameraParams {
  return { ...DEFAULT_CAMERA_PARAMS, fovRest: t.skyFovRest, fovLean: t.skyFovLean, maxDegPerSec: t.skyPanMaxDeg, omega: t.skyPanOmega };
}

export function sliderWeightFromTuning(t: RevealTuning): SliderWeight {
  return sliderWeightFrom(t.sliderWeight, t.sliderGrabPx, t.flightBase, t.flightPerUnit);
}
```

(Move the two `import` lines to the top of the file with the existing React import.) `sanitize` already accepts new number and boolean keys, so nothing else changes there.

- [ ] **Step 2: Persist `?field=` before mount.** In `src/main.tsx`, after `applyThemeVars(...)`:

```ts
import { loadTuning, saveTuning } from './config/revealTuning'

// ?field=sky or ?field=flat persists the field view on deployed builds,
// where the admin tuning page isn't served.
const fieldParam = new URLSearchParams(window.location.search).get('field')
if (fieldParam === 'sky' || fieldParam === 'flat') {
  saveTuning({ ...loadTuning(), skyField: fieldParam === 'sky' })
}
```

(Put the import with the others at the top.)

- [ ] **Step 3: Admin controls.** In `AdminRevealTuning.tsx`, add a knob group after `DEPARTURE_KNOBS`:

```ts
// Night-sky field: camera and slider feel. Only read while skyField is on.
const SKY_KNOBS: Knob[] = [
  { key: 'skyFovRest', label: 'Sky FOV at rest', min: 60, max: 110, step: 1, fmt: (v) => `${v}°` },
  { key: 'skyFovLean', label: 'Sky FOV leaning in', min: 40, max: 100, step: 1, fmt: (v) => `${v}°` },
  { key: 'skyPanMaxDeg', label: 'Pan speed cap', min: 5, max: 90, step: 1, fmt: (v) => `${v}°/s` },
  { key: 'skyPanOmega', label: 'Pan stiffness', min: 0.5, max: 5, step: 0.1, fmt: (v) => v.toFixed(1) },
  { key: 'sliderWeight', label: 'Slider weight', min: 0, max: 1, step: 0.05, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'sliderGrabPx', label: 'Grab zone', min: 8, max: 60, step: 1, fmt: (v) => `${v}px` },
  { key: 'flightBase', label: 'Flight base', min: 0.2, max: 2, step: 0.05, fmt: (v) => `${v.toFixed(2)}s` },
  { key: 'flightPerUnit', label: 'Flight per unit', min: 0, max: 1.5, step: 0.05, fmt: (v) => `${v.toFixed(2)}s` },
];
```

Render it with the same section component the other groups use, under a heading "Night sky". Add a checkbox bound to `skyField`, following the existing boolean control for `showTethers` in the same file. Its label is "Night-sky field".

- [ ] **Step 4: Verify.**

Run: `npm run build && npm run check:theme`
Expected: build succeeds; check:theme passes.

Then in the dev server, open `http://localhost:5173/emotions-wheel/?field=sky`. The next check is in the browser console:

```js
JSON.parse(localStorage.getItem('reveal-tuning')).skyField
```

Expected: `true`. Load `?field=flat` and it becomes `false`. Nothing looks different yet.

- [ ] **Step 5: Commit.**

```bash
git add src/config/revealTuning.ts src/main.tsx src/admin/components/AdminRevealTuning.tsx
git commit -m "feat(sky): add the skyField flag and sky/slider tuning knobs"
```

---

### Task 5: Route every field placement through a projection (flat only)

A pure refactor. With `skyField` off nothing changes, and this task never turns it on. This is the riskiest diff, so it lands alone.

**Covers:** R21; enables R7, R10.

**Files:**
- Modify: `src/components/EmotionField/EmotionField.tsx` (every `toPercent` / `toFieldPx` site: lines ~155, 395, 432–440, 457, 502, 613, 641–654, 731, 853)
- Modify: `src/components/EmotionField/EmotionWord.tsx:76,114-115`
- Modify: `src/components/EmotionField/usePinLanding.ts:121-122,158-159`
- Modify: `src/hooks/useFieldGesture.ts:108-131`
- Modify: `src/data/checkIn.ts:125-142`
- Modify: `src/components/EmotionField/Tether.tsx:40-42`

**Interfaces:**
- Consumes: `FieldProjection`, `flatProjection` (Task 1).
- Produces:
  - `EmotionWord` props `x: number; y: number` (stage px of the dot) replace `containerWidth` / `containerHeight`, and an optional `hideDot?: boolean`.
  - `useFieldGesture({ ..., toCoord?: (localX: number, localY: number, rect: DOMRect) => FieldCoord | null })`.
  - `findNearbyPinPx(px: { x: number; y: number }, pins: PinEntry[], proj: FieldProjection): PinEntry | null`.
  - `usePinLanding(pins, size, surfaceEmotions, proj)`.

- [ ] **Step 1: Make one projection per render in `EmotionField`.** Replace the `toFieldPx` helper (lines 152–158) with:

```ts
  // Every coordinate → px placement in this field goes through `proj`, so
  // the flat field and the night-sky field (Task 6) share one code path.
  const proj: FieldProjection = useMemo(() => flatProjection(size), [size]);
  const toFieldPx = (c: { x: number; y: number }) => proj.toPx(c);
```

Import `flatProjection` and `type FieldProjection` from `../../utils/skyProjection`, and drop the `toPercent` import once nothing uses it.

- [ ] **Step 2: Replace each inline conversion.** Every `(toPercent(a.x) / 100) * size.width` / `(toPercent(-a.y) / 100) * size.height` pair becomes `const p = proj.toPx(a); p.x / p.y`. That covers the `toPx` in `fociPx`, `anchorMark`'s `x`/`y` and its surface-word obstacles, `fanBox`'s `dotX`/`dotY`, `wordTethers`' `cx`/`cyCoord`, and the draft- and recorded-pin blocks. Add `proj` to each `useMemo` dependency list that used `size.width`/`size.height` for this purpose. The two percentage-string sites for the reveal-centre edge ticks (`left: \`${toPercent(revealCenter.x)}%\``, `top: ...`) stay as they are: those ticks are flat-only and get hidden in sky mode (Task 6).

- [ ] **Step 3: `EmotionWord` takes px.** In `EmotionWord.tsx`, delete the local `toPercent` (line 76). Replace the props `containerWidth, containerHeight` with `x, y`, and use them for `left` / `top` (lines 114–115). In the memo comparator, treat `x` and `y` like any primitive key (the existing `Object.is` branch already does). Add `hideDot?: boolean`: when true, render the dot `span` with `opacity: 0` and keep its layout, so the fan and landing measurements don't shift. At both call sites in `EmotionField` (lines ~686 and ~711), pass `x={proj.toPx(emotion).x} y={proj.toPx(emotion).y}`, computed once into a local.

- [ ] **Step 4: `usePinLanding` uses the projection.** Add a fourth parameter `proj: FieldProjection`. Replace lines 121–122 with `const w = proj.toPx(e); const dx = px - w.x; const dy = py - (w.y - LABEL_STANDOFF);`. Replace the fallback at 158–159 with `proj.toPx(pin).x` / `.y`. Update the call at `EmotionField.tsx:207`.

- [ ] **Step 5: Presses go through the projection.** In `useFieldGesture.ts`, add to the options type:

```ts
  // Converts a press, in container-local px, to a field coordinate. Defaults
  // to the flat mapping (pixelToCoord). The night-sky field passes its
  // projection's fromPx, where null means "not pressable here" (below the horizon).
  toCoord?: (localX: number, localY: number, rect: DOMRect) => { x: number; y: number } | null;
```

Then in `getCoord`, after the `rect` guard:

```ts
    if (toCoord) return toCoord(e.clientX - rect.left, e.clientY - rect.top, rect);
    return pixelToCoord(e.clientX, e.clientY, rect, rect.width, rect.height);
```

Keep the transform comment above it. `rect` stays the only size source, so the recede-transform fix is preserved. Callers of `getCoord` already handle `null`. In `EmotionField`, pass `toCoord: (lx, ly, rect) => proj.fromPx(lx * (size.width / rect.width), ly * (size.height / rect.height))`. This rescales from the transformed rect to layout px, which is the space `proj` works in.

- [ ] **Step 6: Pin hit test in px.** In `src/data/checkIn.ts`, add beside `findNearbyPin`:

```ts
// Same rule as findNearbyPin, measured where pins actually draw — needed once
// the field can be drawn through a non-flat projection (night sky).
export function findNearbyPinPx(
  press: { x: number; y: number },
  pins: PinEntry[],
  proj: { toPx(c: { x: number; y: number }): { x: number; y: number; visible: boolean } },
): PinEntry | null {
  let closest: PinEntry | null = null;
  let closestDist = Infinity;
  for (const pin of pins) {
    const p = proj.toPx(pin);
    if (!p.visible) continue;
    const dist = Math.hypot(press.x - p.x, press.y - p.y);
    if (dist <= TOUCH_RADIUS_PX && dist < closestDist) {
      closest = pin;
      closestDist = dist;
    }
  }
  return closest;
}
```

In `handleRelease`, replace `findNearbyPin(center, [...pins, ...recordedPins], size)` with `findNearbyPinPx(proj.toPx(center), [...pins, ...recordedPins], proj)`. Under the flat projection this is the same distance `findNearbyPin` computes, since `0.9 · size / 2` is exactly `toPercent`'s px-per-unit. Leave `findNearbyPin` exported: `check:checkin` covers it.

- [ ] **Step 7: The tether reads the rendered pin.** In `Tether.tsx`, replace lines 40–42's `toPercent` maths with the pin element's own centre:

```ts
      const rect = plane.getBoundingClientRect();
      // The pin's drawn position, not a recomputed one: the field may be
      // drawn through the night-sky projection, which only EmotionField knows.
      const pinEl = plane.querySelector(`[data-field-pin="${pin.id}"]`) as HTMLElement | null;
      const pr = pinEl?.getBoundingClientRect();
      const px = pr ? pr.left - rect.left : 0;
      const py = pr ? pr.top - rect.top : 0;
      if (!pinEl) return;
```

and delete the local `toPercent`. The pin wrapper is a 0×0 box at the pin centre, so its `left`/`top` are the centre.

- [ ] **Step 8: Verify nothing moved.**

Run: `npm run build && npm run lint && npm run check:gesture && npm run check:checkin && npm run check:anchor && npm run check:fan && npm run check:sky`
Expected: build succeeds, lint shows only the five known errors, and every check passes.

In the browser (flag off), compare against `main` in a second tab:
- Words sit in the same places.
- A press plants the pin under the cursor, and a release on an existing pin selects it.
- The fan and tethers look the same.
- The desktop card tether meets the pin.
- In the new-tab view with the field receded, presses still land correctly.

- [ ] **Step 9: Commit.**

```bash
git add src/components/EmotionField src/hooks/useFieldGesture.ts src/data/checkIn.ts
git commit -m "refactor(field): route every placement through a FieldProjection"
```

---

### Task 6: Sky camera and projection in the field

**Covers:** R2, R3, R4, R9, R10, R11, R12, R13.

**Files:**
- Create: `src/components/EmotionField/useSkyCamera.ts`
- Modify: `src/components/EmotionField/EmotionField.tsx`
- Modify: `src/App.tsx:1039`

**Interfaces:**
- Consumes: `skyProjection`, `flatProjection` (Task 1); `stepCamera`, `initialCamera`, `isSettled`, `cameraTarget` (Task 2); `cameraParamsFrom` (Task 4).
- Produces: `useSkyCamera({ enabled, target, lean, params, size }): { proj: FieldProjection; look: FieldCoord; fovDeg: number }`.

- [ ] **Step 1: Write the hook** `src/components/EmotionField/useSkyCamera.ts`:

```ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { flatProjection, skyProjection, type FieldCoord, type FieldProjection } from '../../utils/skyProjection';
import { initialCamera, isSettled, stepCamera, type CameraParams, type CameraState } from '../../utils/skyCamera';

// Steps the night-sky camera toward `target` on requestAnimationFrame and
// hands back the projection for this frame. Local to EmotionField on purpose:
// a camera frame re-renders the field only, never App. The loop sleeps once
// the camera settles and wakes when the target or lean changes.
export function useSkyCamera(opts: {
  enabled: boolean;
  target: FieldCoord;
  lean: boolean;
  params: CameraParams;
  size: { width: number; height: number };
}): { proj: FieldProjection; look: FieldCoord; fovDeg: number } {
  const { enabled, target, lean, params, size } = opts;
  const reduced = !!useReducedMotion();
  const [cam, setCam] = useState<CameraState>(() => initialCamera(target, lean, params));
  const camRef = useRef(cam);
  const targetRef = useRef(target);
  const prevTargetRef = useRef<FieldCoord | null>(null);
  targetRef.current = target;

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const next = stepCamera(camRef.current, { target: targetRef.current, prevTarget: prevTargetRef.current, lean, reduced }, dt, params);
      prevTargetRef.current = targetRef.current;
      camRef.current = next;
      setCam(next);
      if (!isSettled(next, targetRef.current, lean, params)) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // target.x/y wake the loop; the loop itself reads targetRef.
  }, [enabled, target.x, target.y, lean, reduced, params]);

  const proj = useMemo(
    () => (enabled ? skyProjection({ look: cam.look, fovDeg: cam.fovDeg, width: size.width, height: size.height }) : flatProjection(size)),
    [enabled, cam.look, cam.fovDeg, size],
  );
  return { proj, look: cam.look, fovDeg: cam.fovDeg };
}
```

`params` must be referentially stable. `EmotionField` memoises `cameraParamsFrom(tuning)` on the tuning object.

- [ ] **Step 2: Use it in `EmotionField`.** Replace Task 5's `proj` memo with:

```ts
  const sky = tuning.skyField;
  const cameraParams = useMemo(() => cameraParamsFrom(tuning), [tuning]);
  const newestDraftPin = pins.length ? pins[pins.length - 1] : null;
  const emphasizedAny = emphasizedPinId
    ? pins.find((p) => p.id === emphasizedPinId) ?? recordedPins.find((p) => p.id === emphasizedPinId) ?? null
    : null;
  const skyTarget = cameraTarget({
    liveDraft: departureDraft ?? adjustDraft,
    emphasizedPin: emphasizedAny,
    newestDraftPin,
    recordedAnchor: recordedPins.length ? recordedPins[recordedPins.length - 1] : null,
  });
  const { proj } = useSkyCamera({ enabled: sky, target: skyTarget, lean: pins.length > 0 || departureDraft !== null, params: cameraParams, size });
```

This must sit after `adjustDraft` and `departureDraft` are destructured, and before `handleRelease`, which now reads `proj`. `liveDraft` is defined later in the file with the same expression. Leave that definition in place.

- [ ] **Step 3: Hide the flat-only layers in sky mode (R9).** Wrap `<FieldAura />`, `<FieldSignal />`, both crosshair `div`s, `<AxisRadiance ... />` and the two reveal-centre edge-tick blocks in `{!sky && (...)}`. Leave the four axis labels alone: they're already at the stage edges.

- [ ] **Step 4: Words behind the camera don't render.** In both word maps, skip a word whose `proj.toPx(emotion).visible` is false. For surface words, return `null` from the map. For deep words, filter them out of `revealedDeep` inside its `useMemo`, and add `proj` to its dependencies. Pins and recorded pins with `!visible` also return `null`.

- [ ] **Step 5: Skip the shader behind the sky.** In `App.tsx:1039`, render `<ShaderBackground />` only when `!tuning.skyField`. `App` already reads tuning. If it doesn't, add `const tuning = useRevealTuning();` next to the other hooks.

- [ ] **Step 6: Verify in the browser** with `?field=sky`. The sky backdrop doesn't exist yet, so the stage shows `--ui-bg`.
  - At rest, surface words sit round the centre with perspective spacing, and Calm/Activated/Positive/Negative stay at the edges.
  - Press anywhere: the pin lands under the cursor, and the view narrows (84° → 64°) and glides to it with no bounce.
  - Drag a card slider (still unweighted until Task 8): the sky carries along, and the pin holds still on screen.
  - Pick a far corner on the sliders: the view tilts until the pin is on screen, and it stops at the 1.2 limit.
  - Reselect the previous check-in's card: the view glides there at the capped speed.
  - Reduced motion (emulate in DevTools): each change snaps with no glide.
  - `?field=flat` looks identical to `main`.

Run: `npm run build && npm run lint`
Expected: build succeeds; only the five known lint errors.

- [ ] **Step 7: Profile a slider drag (sky mode).** Follow the drag-perf method (GPU Chrome via Playwright plus the CDP profiler; the in-app pane throttles rAF). Expected: `App` doesn't re-render per camera frame, `ShaderBackground` doesn't mount, and field frames stay under 16ms on the reference laptop. If `computeRadialFan` dominates, memoise `deepLabelOffsets` on the rounded `look` (to 0.002) rather than the raw value.

- [ ] **Step 8: Commit.**

```bash
git add src/components/EmotionField/useSkyCamera.ts src/components/EmotionField/EmotionField.tsx src/App.tsx
git commit -m "feat(sky): drive the field through the night-sky camera behind skyField"
```

---

### Task 7: Sky backdrop, stars and constellation lines

**Covers:** R5, R6, R7 (dot handoff), R8, R19.

**Files:**
- Create: `src/components/EmotionField/SkyBackdrop.tsx`
- Modify: `src/components/EmotionField/EmotionField.tsx`

**Interfaces:**
- Consumes: `FieldProjection`, `fieldToDir`, `greatCircle`, `mulberry32` (Task 1); `themeRgba` (`src/config/themeColor.ts`); the `emotions` list.
- Produces: `<SkyBackdrop proj size stars constellation liveDraft reducedMotion />` and the `SkyStar` type.

- [ ] **Step 1: Write the component** `src/components/EmotionField/SkyBackdrop.tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react';
import { themeRgba } from '../../config/themeColor';
import { dirToField, fieldToDir, greatCircle, mulberry32, type FieldCoord, type FieldProjection, type Vec3 } from '../../utils/skyProjection';

export interface SkyStar {
  id: string;
  x: number;
  y: number;
  surface: boolean;
  tagged: boolean;
  revealed: boolean;
}

interface Props {
  proj: FieldProjection;
  size: { width: number; height: number };
  stars: SkyStar[];
  // Pin first, then its recognized words in tag order (R8).
  constellation: FieldCoord[];
  liveDraft: FieldCoord | null;
  reducedMotion: boolean;
}

// The night sky behind the words: gradient, seeded starfield, a faint band,
// horizon haze, every emotion as a star, the constellation chain and the live
// draft's comet trail. Words themselves stay DOM (EmotionWord).
export function SkyBackdrop({ proj, size, stars, constellation, liveDraft, reducedMotion }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const trail = useRef<Array<{ c: FieldCoord; t: number }>>([]);

  // A fixed sky: same stars on every load (R5).
  const field = useMemo(() => {
    const rnd = mulberry32(20260928);
    return Array.from({ length: 1100 }, () => {
      const u = rnd() * 1.08 - 0.08, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      return { d: [s * Math.cos(a), u, s * Math.sin(a)] as Vec3, a: rnd() ** 3 * 0.55 + 0.06, big: rnd() > 0.93, ph: rnd() * 6.283 };
    });
  }, []);

  useEffect(() => {
    let raf = 0;
    const draw = (now: number) => {
      const cv = ref.current;
      if (!cv || size.width === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(size.width * dpr)) { cv.width = Math.round(size.width * dpr); cv.height = Math.round(size.height * dpr); }
      const ctx = cv.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = now / 1000;
      const tw = (ph: number, rate: number) => (reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(t * rate + ph));

      // Sky: deepest at the zenith, lifting toward the horizon.
      const zen = proj.toPx({ x: 0, y: 0 });
      const R = Math.max(size.width, size.height) * 1.6;
      const g = ctx.createRadialGradient(zen.x, zen.y, 0, zen.x, zen.y, R);
      g.addColorStop(0, themeRgba('bg', 1));
      g.addColorStop(0.6, themeRgba('surface', 1));
      g.addColorStop(1, themeRgba('recorded', 0.16));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size.width, size.height);

      // Horizon haze where the gaze tilts far enough to see it.
      for (let i = 0; i < 48; i++) {
        const az = (i / 48) * Math.PI * 2;
        const q = proj.toPx({ x: Math.SQRT2 * Math.cos(az), y: Math.SQRT2 * Math.sin(az) });
        if (!q.visible) continue;
        const rad = Math.max(size.width, size.height) * 0.28;
        const hg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
        hg.addColorStop(0, themeRgba('gold', 0.05));
        hg.addColorStop(1, themeRgba('gold', 0));
        ctx.fillStyle = hg;
        ctx.fillRect(q.x - rad, q.y - rad, rad * 2, rad * 2);
      }

      // Background stars.
      for (const s of field) {
        const q = projectDir(proj, s.d);
        if (!q) continue;
        ctx.fillStyle = themeRgba('text', s.a * tw(s.ph, 1.3));
        ctx.fillRect(q.x, q.y, s.big ? 1.5 : 0.9, s.big ? 1.5 : 0.9);
      }

      // Constellation: pin → tagged words, along great circles (R8).
      if (constellation.length > 1) {
        ctx.strokeStyle = themeRgba('gold', 0.5);
        ctx.lineWidth = 1.2;
        for (let i = 1; i < constellation.length; i++) {
          const path = greatCircle(fieldToDir(constellation[i - 1]), fieldToDir(constellation[i]), 24);
          ctx.beginPath();
          let pen = false;
          for (const d of path) {
            const q = projectDir(proj, d);
            if (!q) { pen = false; continue; }
            if (pen) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
            pen = true;
          }
          ctx.stroke();
        }
      }

      // Live draft comet trail (R19).
      if (liveDraft) trail.current.push({ c: liveDraft, t });
      trail.current = trail.current.filter((p) => t - p.t < 1.6);
      for (let i = 1; i < trail.current.length; i++) {
        const a = proj.toPx(trail.current[i - 1].c), b = proj.toPx(trail.current[i].c);
        if (!a.visible || !b.visible) continue;
        const life = 1 - (t - trail.current[i].t) / 1.6;
        ctx.strokeStyle = themeRgba('gold', 0.45 * life * life);
        ctx.lineWidth = 0.6 + 2.2 * life;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // Every emotion is a star (R6).
      for (const s of stars) {
        const q = proj.toPx(s);
        if (!q.visible) continue;
        const bright = (s.surface ? 1 : s.revealed ? 0.8 : 0.4) * tw(s.x * 7 + s.y * 13, 1.1);
        const channel = s.tagged ? 'recorded' : 'text';
        const rad = s.surface ? 1.9 : s.revealed ? 1.5 : 1.1;
        const halo = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad * 5);
        halo.addColorStop(0, themeRgba(channel, 0.28 * bright));
        halo.addColorStop(1, themeRgba(channel, 0));
        ctx.fillStyle = halo;
        ctx.fillRect(q.x - rad * 5, q.y - rad * 5, rad * 10, rad * 10);
        ctx.fillStyle = themeRgba(channel, Math.min(1, bright + 0.1));
        ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, Math.PI * 2); ctx.fill();
      }

      if (!reducedMotion || trail.current.length) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [proj, size, stars, constellation, liveDraft, reducedMotion, field]);

  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

// Background stars and great-circle samples are dome directions, not field
// coordinates: map them back through dirToField (unclamped, so points beyond
// the square still draw), then project. Below the horizon draws nothing.
function projectDir(proj: FieldProjection, d: Vec3) {
  const f = dirToField(d);
  if (f.elevation < 0) return null;
  const q = proj.toPx(f);
  return q.visible ? q : null;
}
```

`themeRgba` takes the channels `bg | surface | gold | recorded | text`. If `check:theme` flags the gradient stops, swap them for the nearest channel rather than adding a hex.

- [ ] **Step 2: Mount it and hand over the dots.** In `EmotionField`, as the first child of the container in sky mode:

```tsx
      {sky && (
        <SkyBackdrop
          proj={proj}
          size={size}
          stars={skyStars}
          constellation={constellation}
          liveDraft={liveDraft}
          reducedMotion={!!reducedMotion}
        />
      )}
```

with, near the other memos:

```ts
  const revealedIds = useMemo(() => new Set(revealedDeep.map((e) => e.id)), [revealedDeep]);
  const skyStars = useMemo(
    () => emotions.map((e) => ({ id: e.id, x: e.x, y: e.y, surface: e.depth === 'surface', tagged: selectedIds.has(e.id), revealed: revealedIds.has(e.id) })),
    [selectedIds, revealedIds],
  );
  // The chain for the pin the user is looking at: the emphasized pin, else the
  // only draft pin. Tag order is recognizedWords order.
  const constellationPin = emphasizedAny ?? (pins.length === 1 ? pins[0] : null);
  const constellation = useMemo(() => {
    if (!constellationPin) return [];
    const byId = new Map(emotions.map((e) => [e.id, e]));
    return [constellationPin, ...constellationPin.recognizedWords.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => !!e)];
  }, [constellationPin]);
```

and pass `hideDot={sky}` to both `EmotionWord` call sites.

- [ ] **Step 3: Verify in the browser** with `?field=sky`:
  - The whole sky is present at rest: named surface stars, dim nameless deep stars, background stars and a gradient deepest at the zenith.
  - Hover still for 1.2s: the nearby deep stars take names (existing dwell), and their stars brighten.
  - Tag three words on the card: they turn teal on the sky, and a gold chain draws pin → first → second → third along curved paths.
  - Tap a slider track far from the thumb (after Task 8), or drag: a fading gold trail follows the pin.
  - Reduced motion: no twinkle, and the canvas stops redrawing when idle.
  - Switch themes in admin: sky colours follow the theme.

Run: `npm run build && npm run lint && npm run check:theme`
Expected: build succeeds; only the five known lint errors; theme check passes.

- [ ] **Step 4: Commit.**

```bash
git add src/components/EmotionField/SkyBackdrop.tsx src/components/EmotionField/EmotionField.tsx
git commit -m "feat(sky): paint the night sky, word stars and constellation lines"
```

---

### Task 8: Weighted `AxisSlider` with tap-to-fly

**Covers:** R14–R18; AE6, AE7.

**Files:**
- Modify: `src/components/EmotionPreview/AxisSlider.tsx`
- Modify: `src/components/EmotionPreview/CoordinateCard.tsx:420-445`
- Modify: `src/components/EmotionPreview/DepartureFloat.tsx:219-240`

**Interfaces:**
- Consumes: `SliderWeight`, `stepWeighted`, `isGrab`, `flightDuration`, `flightValue` (Task 3); `sliderWeightFromTuning`, `useRevealTuning` (Task 4).
- Produces: `AxisSlider` prop `weight?: SliderWeight`. When it's omitted, behaviour is byte-for-byte today's.

- [ ] **Step 1: Add the weighted path to `AxisSlider`.** Add `weight?: SliderWeight` to the props. Keep the current handlers as the `!weight` branch. Add this state machine for the weighted branch:

```tsx
  // Weighted mode (night sky): the shown value chases the pointer instead of
  // jumping to it, and a tap away from the thumb flies there. `shown` is what
  // the thumb, fill and onDrag report; `value` from the parent stays the
  // committed value between gestures.
  const [shown, setShown] = useState(value);
  const [pull, setPull] = useState<number | null>(null); // pointer's value while held
  const motion = useRef<
    | { kind: 'idle' }
    | { kind: 'held'; target: number }
    | { kind: 'flight'; from: number; to: number; t0: number; dur: number }
  >({ kind: 'idle' });
  const shownRef = useRef(value);
  const rafRef = useRef(0);
  // The frame loop outlives the render that started it, so it calls the
  // parent through a ref and never holds a stale onDrag/onCommit/onCancel.
  const cb = useRef({ onDrag, onCommit, onCancel });
  cb.current = { onDrag, onCommit, onCancel };

  // Follow the parent's value while idle (a field press moved the pin).
  useEffect(() => {
    if (motion.current.kind === 'idle') { shownRef.current = value; setShown(value); }
  }, [value]);

  const run = () => {
    cancelAnimationFrame(rafRef.current);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = motion.current;
      if (!weight || m.kind === 'idle') return;
      let v = shownRef.current;
      if (m.kind === 'held') v = stepWeighted(v, m.target, dt, weight);
      else v = flightValue(m.from, m.to, (now - m.t0) / 1000, m.dur);
      shownRef.current = v;
      setShown(v);
      cb.current.onDrag(v);
      if (m.kind === 'flight' && now - m.t0 >= m.dur * 1000) {
        motion.current = { kind: 'idle' };
        cb.current.onCommit(m.to);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Unmount mid-gesture reverts rather than commits (R17).
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (motion.current.kind !== 'idle') cb.current.onCancel();
  }, []);

  const thumbPx = (v: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    return r ? r.left + ((v + 1) / 2) * r.width : 0;
  };
```

The weighted handlers on the track:

```tsx
  const weightedHandlers = weight ? {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation(); e.preventDefault();
      onGrab?.();
      const v = valueAt(e.clientX);
      if (isGrab(e.clientX, thumbPx(shownRef.current), weight.grabPx)) {
        // Grabbing mid-flight stops the flight where it is (R17).
        motion.current = { kind: 'held', target: v };
        trackRef.current?.setPointerCapture(e.pointerId);
        draggingRef.current = true;
        setPull(v);
      } else {
        const from = shownRef.current;
        motion.current = { kind: 'flight', from, to: v, t0: performance.now(), dur: flightDuration(from, v, weight) };
      }
      run();
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || motion.current.kind !== 'held') return;
      const v = valueAt(e.clientX);
      motion.current = { kind: 'held', target: v };
      setPull(v);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      trackRef.current?.releasePointerCapture(e.pointerId);
      setPull(null);
      motion.current = { kind: 'idle' };
      cancelAnimationFrame(rafRef.current);
      cb.current.onCommit(shownRef.current); // where the thumb is, not the pointer (R15)
    },
    onPointerCancel: () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setPull(null);
      motion.current = { kind: 'idle' };
      cancelAnimationFrame(rafRef.current);
      cb.current.onCancel();
    },
  } : null;
```

Spread `weightedHandlers ?? { ...existing four handlers }` onto the track `div`. Replace `value` with `const drawn = weight ? shown : value;` for the fill and the thumb (`p = pct(drawn)`). Then add the pull marker (R18) inside the track, after the thumb:

```tsx
        {pull !== null && (
          <>
            <div style={{ position: 'absolute', top: '50%', height: 1, marginTop: -0.5, left: `${Math.min(pct(drawn), pct(pull))}%`, width: `${Math.abs(pct(pull) - pct(drawn))}%`, background: 'rgb(var(--ui-gold-rgb) / 0.4)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '50%', width: 11, height: 11, marginTop: -5.5, marginLeft: -5.5, left: `${pct(pull)}%`, borderRadius: '50%', border: '1px solid rgb(var(--ui-gold-rgb) / 0.55)', pointerEvents: 'none' }} />
          </>
        )}
```

Import `useEffect, useState` and the Task 3 helpers. Keep the existing module-private helpers module-private (the file's react-refresh note).

- [ ] **Step 2: Opt in from the card.** In `CoordinateCard.tsx` and `DepartureFloat.tsx`, read `const tuning = useRevealTuning();` and `const weight = useMemo(() => (tuning.skyField ? sliderWeightFromTuning(tuning) : undefined), [tuning]);`. Pass `weight={weight}` to each `AxisSlider`. `Landing.tsx` is unchanged.

- [ ] **Step 3: Verify in the browser** with `?field=sky` (AE6, AE7):
  - Grab the Calm–Activated thumb, drag past the right end and hold. The thumb lags with a gold ring and tether at the pointer, it's past a third of the way in under a second, and it only nears the end after about 3s.
  - Release at about 1.5s. The saved check-in shows the value the thumb had, not 100.
  - Tap about 80% along the track. The thumb and pin fly there with ease-in-out in about 0.8s (0.6s + 0.35s × 0.6), the sky carries along with the pin steady on screen, a comet trail fades behind, and exactly one commit happens (the card's words re-resolve once).
  - Tap far away, then grab the thumb mid-flight. The flight stops where it is and nothing commits until you release.
  - Switch to the new-tab departure float: the same behaviour, with the recorded accent.
  - `?field=flat`: sliders jump to the pointer exactly as on `main`, and so does the landing page's slider.

Run: `npm run build && npm run lint && npm run check:slider`
Expected: build succeeds; only the five known lint errors; 12 PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/components/EmotionPreview/AxisSlider.tsx src/components/EmotionPreview/CoordinateCard.tsx src/components/EmotionPreview/DepartureFloat.tsx
git commit -m "feat(slider): weighted drag and tap-to-fly in sky mode"
```

---

### Task 9: End-to-end pass, docs and PR

**Covers:** AE1–AE8 in the live app.

**Files:**
- Modify: `CLAUDE.md` (one "What ships today" bullet)

- [ ] **Step 1: Run every check.**

Run: `for s in fan csv cues pin checkin departure source gesture anchor density tags landing replay theme sky camera slider; do npm run check:$s || break; done`
Expected: every script ends `all passed` (or its equivalent success line).

- [ ] **Step 2: Walk the acceptance examples live** at desktop width and at 390×800. Cover AE1–AE8 with `?field=sky`, then AE8 with `?field=flat`. Include a full check-in: plant, adjust, tag three words, save. Then confirm the saved-card mini-map and history still plot the flat (x, y), and the CSV export is unchanged.

- [ ] **Step 3: Document it.** In `CLAUDE.md`, under "What ships today", add:

```md
- A night-sky field behind the `skyField` tuning flag (`?field=sky`): the field drawn as the inside of a dome, with the still point overhead, every word a star and tags drawn as a constellation. The card's sliders are weighted and tap-to-fly in that mode. Off by default; the datum is still the flat (x, y). See `docs/plans/2026-09-28-001-feat-night-sky-field-plan.md`.
```

- [ ] **Step 4: Commit and open the PR.**

```bash
git add CLAUDE.md
git commit -m "docs: note the night-sky field flag"
git push -u origin feat/night-sky-field
gh pr create --title "feat: night-sky field behind a flag, weighted sliders, tap-to-fly" --body-file <(printf '%s\n' "Implements docs/plans/2026-09-28-001-feat-night-sky-field-plan.md behind the skyField flag (off by default; ?field=sky to try it)." "" "🤖 Generated with [Claude Code](https://claude.com/claude-code)")
```

---

## Scope Boundaries

- **Deferred:** idle gaze drift (it would keep the field re-rendering forever), drag-on-sky to look around (a field press-drag keeps placing the pin), tapping a star to tag it, keyboard control of `AxisSlider`, and sky treatments for the history mini-map, replay and landing page.
- **Not doing:** the drift pad, a yawing camera, the sphere and well forms, or any change to `DiaryEntry` / `PinEntry` / CSV.

## Risks

- **Per-frame field re-render while the camera moves.** The fan (`computeRadialFan`) and the word memos recompute each camera frame. Task 6 Step 7 profiles this and names the mitigation (memoise on a rounded `look`). The camera sleeps when settled, so idle cost is zero.
- **Fan layout under perspective.** The fan works in px and will spread labels by screen distance, which is correct for what the user sees. Surface-word obstacles move with the camera, so labels may re-seat during a pan. Watch for it in Task 7's check. If it's distracting, freeze fan offsets while the camera is unsettled.
- **Words behind the camera at extreme tilts.** They're skipped (Task 6 Step 4). A tagged word behind the camera drops out of the constellation until the gaze returns. The great-circle drawing lifts the pen there rather than drawing a mirrored line.
- **`DepartureTrace` during a pan.** It already takes `toPx` per render, so the comet follows the moving sky. If the comet stutters, pass it the projection at `departureTracePlay` time instead.
- **Two sources of slider truth in weighted mode.** `shown` (local) and `value` (parent) re-sync only while idle. A parent-side change mid-gesture, such as a field press during a flight, is overridden by the flight until it lands. That's acceptable: the user's latest gesture wins either way.
