---
title: "feat: Living sky — shader aurora and milky way, admin-editable per theme, opening pan"
type: feat
date: 2026-09-28
origin: docs/brainstorms/2026-09-28-living-sky-requirements.md
---

# Living Sky Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In sky mode, paint a living milky way and a low aurora with a GPU shader that moves with the dome. Colours and strengths are editable per theme in admin, starting from Starry Night. On load, the camera rises from the horizon to the still point while the welcome cue shows.

**Architecture:** The sky's settings join `ShaderTheme`, so the existing per-theme override, admin Details panel and "Save to file" handoff carry them for free. The sky projection exposes its camera frame. A small `@react-three/fiber` canvas, `SkyAurora`, draws one full-screen `ShaderMaterial` quad and reads that frame from a ref in `useFrame`, so React never re-renders per frame. `SkyBackdrop` stops painting the soft sky whenever WebGL is available. A pure intro curve drives the opening pan inside `useSkyCamera`. A counter from App plays an anime.js swell on save.

**Tech Stack:** React 19, TypeScript, Vite, `three` + `@react-three/fiber` (already dependencies), anime.js 4 via `useAnimeScope`, pure `check:*` scripts run with `npx tsx`.

**Spec:** `docs/brainstorms/2026-09-28-living-sky-requirements.md` (R1–R17, AE1–AE8). It builds on `docs/brainstorms/2026-09-28-night-sky-field-requirements.md` and `docs/plans/2026-09-28-001-feat-night-sky-field-plan.md`, which are already on this branch. Approved mock: https://claude.ai/artifact/LgiPFHtqTVKcboqobmfKkB

## Global Constraints

- Everything here applies only when `tuning.skyField` is on. With it off, behaviour and appearance match the branch today (flat field, `ShaderBackground`, no pan). Every existing `check:*` script keeps passing.
- Colours:
  - Theme colours are authored only in `src/config/theme.ts`.
  - The shader gets them as uniforms from the theme block.
  - Components never paste a hex.
  - `npm run check:theme` must pass.
- No bounce. Every new rAF or `useFrame` loop honours reduced motion.
- Per-frame values reach WebGL through refs and `useFrame`, never through React props or state that re-renders App. This is the recompile bug from `e209c75`.
- New pure logic gets a `check:<name>` script and an AGENTS.md table row.
- `npm run lint` must show only the five known pre-existing errors.
- Work on `feat/night-sky-field` in the worktree `../emotions-wheel-night-sky`. Its `node_modules` is a symlink and shows as untracked, so stage files by name only.
- End every commit message with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Key Technical Decisions

- **Sky fields live on `ShaderTheme`, not in a parallel `SkyTheme` block.**
  - `setShaderOverride`, `useTheme`'s merge, `AdminShaderDetails`' reset/isDefault logic and `AdminThemeSaveButton`'s handoff JSON all key off `theme.shader`. Putting the sky there makes the "editable in admin" requirement mostly wiring.
  - A separate block would have needed a second override store, event and merge.
  - The `sky` prefix keeps the fields readable next to the ShaderGradient props.
- **Derived defaults for the other ten themes.** `mkShader(colors, sky?)` derives a sky from the three shader stops when a theme doesn't spell one out. Only Starry Night and Northern Lights carry the mock's exact values. `check:skytheme` guards that every theme ends up complete and in range.
- **`SkyFrame` on the projection, not a second camera.** `skyProjection` already computes `f`, `r`, `u`, `F` and the centre. Exposing them as an optional `frame` means the shader and the stars can't disagree. `check:sky` proves a pixel sent through the frame comes back to itself.
- **R3F, fed by a ref.** `EmotionField` writes `{ proj, moving }` into a ref in a layout effect every render. `SkyAurora`'s `useFrame` reads it.
  - Theme-driven uniforms are copied in an effect keyed on the theme block. They change only on theme edits.
  - Under reduced motion the canvas uses `frameloop="demand"` and is invalidated when the projection or theme changes.
- **The intro is a scripted curve, not the spring.** The spring would accelerate hard and hit the speed cap, so the rise uses a cosine ease timed to finish while the cue fades. `check:intro` proves it stays under the pan cap.
  - The hook runs the curve until done or interrupted.
  - During the curve it clears `prevTargetRef`, so the hand-off to normal stepping never "carries" a jump.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/config/theme.ts` | modify | `sky*` fields on `ShaderTheme`, defaults, `mixHex`, `deriveSky`, Starry Night and Northern Lights skies |
| `src/components/EmotionField/skyShader.ts` | create | GLSL sources, `hexToRgb01`, `skyThemeUniforms`, `canUseWebGL` |
| `scripts/test-sky-theme.ts` | create | `check:skytheme` |
| `src/utils/skyProjection.ts` | modify | `SkyFrame` and `frame` on sky projections |
| `scripts/test-sky-projection.ts` | modify | Frame round-trip check |
| `src/utils/skyIntro.ts` | create | `introStart`, `introLook`, `introPeakSpeed` |
| `scripts/test-sky-intro.ts` | create | `check:intro` |
| `src/admin/components/AdminShaderDetails.tsx` | modify | "Night sky" section |
| `src/config/revealTuning.ts`, `src/admin/components/AdminRevealTuning.tsx` | modify | `skyIntro`, `skyIntroDelay`, `skyIntroDuration` knobs |
| `src/components/EmotionField/SkyAurora.tsx` | create | R3F canvas and shader quad, dim, swell |
| `src/components/EmotionField/SkyBackdrop.tsx` | modify | `paintSky` prop: soft sky only as the WebGL fallback |
| `src/components/EmotionField/useSkyCamera.ts` | modify | Opening pan |
| `src/components/EmotionField/EmotionField.tsx` | modify | Mount `SkyAurora`, inputs ref, `skySwellPlay`, `skyIntro` |
| `src/App.tsx` | modify | Swell counter at both `record(...)` sites; pass `skyIntro` |
| `package.json`, `AGENTS.md`, `docs/theme-system.md`, `CLAUDE.md` | modify | Checks and docs |

---

### Task 1: Sky block on the theme, and its uniform mapping (`check:skytheme`)

**Covers:** R2, R3, R6, R8.

**Files:**
- Modify: `src/config/theme.ts` (`ShaderTheme`, the types after it, `SHADER_EXTRAS_DEFAULTS`, `mkShader`, the `i` and `j` entries)
- Create: `src/components/EmotionField/skyShader.ts`
- Create: `scripts/test-sky-theme.ts`
- Modify: `package.json`, `AGENTS.md`

**Interfaces:**
- Produces:
  - On `ShaderTheme`: the sky fields `skyZenith | skyHorizon | skyWarm | skyAuroraLow | skyAuroraHigh | skyBand: string` and `skyAuroraStrength | skyAuroraSpeed | skyAuroraReach | skyAuroraCap | skyBandStrength | skyWarmth | skyMovingDim | skySwell | skyRenderScale: number`.
  - From `theme.ts`: `mixHex(a, b, t): string` and `type SkyColors`.
  - From `skyShader.ts`: `SKY_VERTEX`, `SKY_FRAGMENT`, `type Rgb`, `hexToRgb01(hex): Rgb`, `skyThemeUniforms(s: ShaderTheme)` returning `{ uZen, uHor, uWarm, uA1, uA2, uBandCol: Rgb; uIntensity, uReach (radians), uBand, uCap, uWarmth: number }`, and `canUseWebGL(): boolean` (Step 3b).

- [ ] **Step 1: Write the check script** at `scripts/test-sky-theme.ts`:

```ts
// Behavioural check for the night sky's theme block (the sky* fields on
// ShaderTheme in src/config/theme.ts) and its uniform mapping
// (src/components/EmotionField/skyShader.ts). Run: npm run check:skytheme
import { THEMES, mixHex, toRgbChannels, type ShaderTheme } from '../src/config/theme';
import { hexToRgb01, skyThemeUniforms } from '../src/components/EmotionField/skyShader';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const COLOR_KEYS = ['skyZenith', 'skyHorizon', 'skyWarm', 'skyAuroraLow', 'skyAuroraHigh', 'skyBand'] as const;
const RANGES: Array<[keyof ShaderTheme, number, number]> = [
  ['skyAuroraStrength', 0, 1.5],
  ['skyAuroraSpeed', 0, 5],
  ['skyAuroraReach', 5, 80],
  ['skyAuroraCap', 0, 1],
  ['skyBandStrength', 0, 2],
  ['skyWarmth', 0, 1],
  ['skyMovingDim', 0, 1],
  ['skySwell', 0, 3],
  ['skyRenderScale', 0.25, 1],
];

// Every theme carries a complete, readable sky.
{
  const bad: string[] = [];
  for (const [id, theme] of Object.entries(THEMES)) {
    const s = theme.shader as ShaderTheme;
    for (const k of COLOR_KEYS) {
      const v = s[k];
      if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) bad.push(`${id}.${k}="${String(v)}"`);
      else toRgbChannels(v);
    }
    for (const [k, lo, hi] of RANGES) {
      const v = s[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) bad.push(`${id}.${String(k)}=${String(v)}`);
    }
  }
  check('every theme has a complete sky', bad.length === 0, bad.length ? bad.join('; ') : `${Object.keys(THEMES).length} themes`);
}

// Starry Night ships the mock-tested sky.
{
  const s = THEMES.i.shader as ShaderTheme;
  const want = { skyZenith: '#060B16', skyHorizon: '#16304D', skyWarm: '#5C4E1F', skyAuroraLow: '#8FC1C4', skyAuroraHigh: '#EAD9A8', skyBand: '#AFC0DC' };
  const off = Object.entries(want).filter(([k, v]) => s[k as keyof ShaderTheme] !== v).map(([k]) => k);
  check('Starry Night sky colors', off.length === 0, off.length ? `differs: ${off.join(', ')}` : 'matches the aurora study');
  const motion = s.skyAuroraStrength === 0.5 && s.skyAuroraSpeed === 0.97 && s.skyAuroraReach === 34 && s.skyAuroraCap === 0.26;
  check('Starry Night sky motion', motion, `strength ${s.skyAuroraStrength}, speed ${s.skyAuroraSpeed}, reach ${s.skyAuroraReach}°, cap ${s.skyAuroraCap}`);
}

// Color helpers.
check('mixHex endpoints', mixHex('#102030', '#FFFFFF', 0) === '#102030' && mixHex('#102030', '#FFFFFF', 1) === '#FFFFFF', `${mixHex('#102030', '#FFFFFF', 0.5)} at 0.5`);
{
  const [r, g, b] = hexToRgb01('#FF8000');
  check('hexToRgb01', r === 1 && Math.abs(g - 128 / 255) < 1e-12 && b === 0, `${r},${g.toFixed(4)},${b}`);
}

// Uniform mapping carries every sky field across, reach in radians.
{
  const u = skyThemeUniforms(THEMES.i.shader as ShaderTheme);
  check('reach goes to radians', Math.abs(u.uReach - (34 * Math.PI) / 180) < 1e-12, `${u.uReach.toFixed(4)} rad`);
  check('aurora colors carried', u.uA1.join() === hexToRgb01('#8FC1C4').join() && u.uA2.join() === hexToRgb01('#EAD9A8').join(), 'low + high');
  check('strengths carried', u.uIntensity === 0.5 && u.uBand === 0.96 && u.uCap === 0.26 && u.uWarmth === 0.26, `int ${u.uIntensity}, band ${u.uBand}`);
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
```

- [ ] **Step 2: Register it and watch it fail.** Add `"check:skytheme": "npx tsx scripts/test-sky-theme.ts",` after `check:slider` in `package.json`.

Run: `npm run check:skytheme`
Expected: FAIL. Either `mixHex` isn't exported or `skyShader` can't be found.

- [ ] **Step 3: Extend the theme.** In `src/config/theme.ts`:

(a) Append to `interface ShaderTheme`, after `fov: number;`:

```ts
  // Night-sky field (docs/plans/2026-09-28-002-feat-living-sky-plan.md): the
  // shader sky drawn behind the stars when the skyField flag is on. Colors are
  // hex like the ShaderGradient stops above; the admin theme page edits them
  // through the same override mechanism.
  skyZenith: string;       // the sky straight overhead, darkest
  skyHorizon: string;      // the sky near the horizon
  skyWarm: string;         // a glow that only lives close to the horizon
  skyAuroraLow: string;    // aurora color at its base
  skyAuroraHigh: string;   // aurora color toward its top
  skyBand: string;         // milky way tint
  skyAuroraStrength: number; // 0..1.5
  skyAuroraSpeed: number;    // shader seconds per real second
  skyAuroraReach: number;    // degrees above the horizon the aurora fades out by
  skyAuroraCap: number;      // max brightness the aurora adds, so labels stay legible
  skyBandStrength: number;   // 0..2
  skyWarmth: number;         // 0..1
  skyMovingDim: number;      // aurora multiplier while the user is dragging (1 = no dim)
  skySwell: number;          // extra aurora brightness at the peak of the save swell
  skyRenderScale: number;    // WebGL resolution relative to the screen (soft content)
```

(b) Replace the two type lines after it:

```ts
type ShaderColors = Pick<ShaderTheme, 'color1' | 'color2' | 'color3' | 'brightness'>;
type SkyColorKey = 'skyZenith' | 'skyHorizon' | 'skyWarm' | 'skyAuroraLow' | 'skyAuroraHigh' | 'skyBand';
export type SkyColors = Pick<ShaderTheme, SkyColorKey>;
type ShaderExtras = Omit<ShaderTheme, keyof ShaderColors | SkyColorKey>;
```

(c) Append to `SHADER_EXTRAS_DEFAULTS`, after `fov: 30,`, and add the helpers after the object:

```ts
  // Night-sky motion and strength, feel-tested in the aurora study mock
  // (https://claude.ai/artifact/LgiPFHtqTVKcboqobmfKkB, 2026-09-28).
  skyAuroraStrength: 0.5,
  skyAuroraSpeed: 0.97,
  skyAuroraReach: 34,
  skyAuroraCap: 0.26,
  skyBandStrength: 0.96,
  skyWarmth: 0.26,
  skyMovingDim: 0.45,
  skySwell: 0.9,
  skyRenderScale: 0.5,
};

// Mix two #rrggbb colors; t = 0 gives a, 1 gives b.
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// A theme that doesn't spell out its sky gets one from its shader stops:
// deepened color1 overhead, color2 at the horizon, color3 as the low warmth,
// and an aurora lifted out of color2 into color3. Starry Night and Northern
// Lights spell theirs out (the mock-tested values).
function deriveSky(c: ShaderColors): SkyColors {
  return {
    skyZenith: mixHex(c.color1, '#000000', 0.4),
    skyHorizon: c.color2,
    skyWarm: c.color3,
    skyAuroraLow: mixHex(c.color2, '#FFFFFF', 0.45),
    skyAuroraHigh: mixHex(c.color3, '#FFFFFF', 0.5),
    skyBand: mixHex(c.color2, '#FFFFFF', 0.7),
  };
}
```

(Remove the original closing `};` of `SHADER_EXTRAS_DEFAULTS`, since the block above supplies it.)

(d) Replace `mkShader`:

```ts
function mkShader(colors: ShaderColors, sky?: SkyColors): ShaderTheme {
  return { ...SHADER_EXTRAS_DEFAULTS, ...colors, ...(sky ?? deriveSky(colors)) };
}
```

(e) Starry Night (`i`): replace its `...mkShader({ color1: '#0B1220', color2: '#1B3A5C', color3: '#5c4e1f', brightness: 0.5 }),` line with:

```ts
      ...mkShader(
        { color1: '#0B1220', color2: '#1B3A5C', color3: '#5c4e1f', brightness: 0.5 },
        // The night sky's own colors, from the aurora study mock.
        { skyZenith: '#060B16', skyHorizon: '#16304D', skyWarm: '#5C4E1F', skyAuroraLow: '#8FC1C4', skyAuroraHigh: '#EAD9A8', skyBand: '#AFC0DC' },
      ),
```

(f) Northern Lights (`j`): replace `shader: mkShader({ color1: '#0A0C10', color2: '#1C4A3D', color3: '#3A2350', brightness: 0.4 }),` with:

```ts
    shader: mkShader(
      { color1: '#0A0C10', color2: '#1C4A3D', color3: '#3A2350', brightness: 0.4 },
      // Green-to-violet aurora, from the aurora study mock.
      { skyZenith: '#07090D', skyHorizon: '#133329', skyWarm: '#3A2350', skyAuroraLow: '#9FE0C2', skyAuroraHigh: '#B79FE0', skyBand: '#C8D6DA' },
    ),
```

- [ ] **Step 3b: Create** `src/components/EmotionField/skyShader.ts`:

```ts
import type { ShaderTheme } from '../../config/theme';

// The night sky's fragment shader (docs/plans/2026-09-28-002-feat-living-sky-plan.md),
// lifted from the approved aurora study mock. Each pixel is turned back into a
// dome direction with the same camera frame the stars use (SkyFrame in
// skyProjection.ts), so the milky way and the aurora pan and tilt with the sky.

export const SKY_VERTEX = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';

export const SKY_FRAGMENT = `
  precision highp float;
  uniform vec2 uRes, uCenter; uniform float uRatio, uF, uTime, uIntensity, uReach, uBand, uSwell, uDim, uCap, uWarmth;
  uniform vec3 uFwd, uRight, uUp, uZen, uHor, uWarm, uA1, uA2, uBandCol;
  float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  void main(){
    // stage px (top-left origin) -> dome direction, exactly as the 2D stars
    vec2 px = vec2(gl_FragCoord.x / uRatio, uRes.y - gl_FragCoord.y / uRatio);
    vec2 s = vec2((px.x - uCenter.x) / uF, -(px.y - uCenter.y) / uF);
    vec3 d = normalize(uFwd + uRight * s.x + uUp * s.y);
    float el = asin(clamp(d.y, -1.0, 1.0));
    float t = uTime;

    // base sky: darkest overhead, lifting toward the horizon
    float h = 1.0 - clamp(d.y, 0.0, 1.0);
    vec3 col = mix(uZen, uHor, pow(h, 2.4));
    // a warm glow that only lives close to the horizon
    col += uWarm * exp(-abs(el) / 0.12) * uWarmth;

    // milky way: a noisy band with darker dust lanes along a tilted great circle
    vec3 n = normalize(vec3(0.42, 0.62, -0.66));
    float off = dot(d, n);
    float core = exp(-pow(off / 0.17, 2.0));
    float dust = fbm(d * 4.5 + vec3(0.0, t * 0.004, 0.0));
    float lanes = smoothstep(0.42, 0.7, fbm(d * 10.0 + 7.0));
    float mw = core * (0.3 + 0.7 * dust) * (1.0 - 0.6 * lanes * core);
    col += uBandCol * mw * uBand * 0.16;

    // aurora: curtains that rise from the horizon, seamless around the compass
    float az = atan(d.z, d.x);
    vec3 ring = vec3(cos(az), sin(az), 0.0);
    float curtains = smoothstep(0.36, 0.82, fbm(ring * 1.1 + vec3(0.0, 0.0, t * 0.020)));
    float lower = 0.03 + 0.05 * fbm(ring * 2.6 + vec3(t * 0.030, 0.0, 0.0));
    float rise = el - lower;
    float body = smoothstep(0.0, 0.10, rise) * exp(-max(rise, 0.0) / (uReach * 0.42));
    float rays = 0.3 + 0.7 * smoothstep(0.3, 0.75, fbm(vec3(ring.xy * 14.0, t * 0.050) + vec3(0.0, el * 0.8, 0.0)));
    float fadeTop = 1.0 - smoothstep(uReach * 0.55, uReach, el);
    float a = curtains * body * rays * fadeTop;
    vec3 aCol = mix(uA1, uA2, clamp(rise / uReach, 0.0, 1.0));
    // capped so no label ever sits on a bright patch
    col += aCol * min(a * uIntensity * (1.0 + uSwell) * uDim, uCap);

    // below the horizon: sink gently into the dark, no hard limb
    col = mix(col, uZen * 0.8, smoothstep(0.0, 0.35, -d.y));
    gl_FragColor = vec4(col, 1.0);
  }`;

export type Rgb = [number, number, number];

// #rrggbb -> [r, g, b] in 0..1, the form a vec3 uniform takes.
export function hexToRgb01(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// The theme-driven (not per-frame) uniform values for one theme's shader block.
export function skyThemeUniforms(s: ShaderTheme) {
  return {
    uZen: hexToRgb01(s.skyZenith),
    uHor: hexToRgb01(s.skyHorizon),
    uWarm: hexToRgb01(s.skyWarm),
    uA1: hexToRgb01(s.skyAuroraLow),
    uA2: hexToRgb01(s.skyAuroraHigh),
    uBandCol: hexToRgb01(s.skyBand),
    uIntensity: s.skyAuroraStrength,
    uReach: (s.skyAuroraReach * Math.PI) / 180,
    uBand: s.skyBandStrength,
    uCap: s.skyAuroraCap,
    uWarmth: s.skyWarmth,
  };
}

// Whether this browser can give us a WebGL context. Called once from the
// field; never at import (the check scripts run in Node).
export function canUseWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run it.**

Run: `npm run check:skytheme && npm run check:theme && npx tsc -b`
Expected: 11 PASS lines, then `all passed`. check:theme passes, including "no hardcoded theme colors in src", and the type-check is clean.

- [ ] **Step 5: AGENTS.md row:** `| \`npm run check:skytheme\` | night-sky theme block: every theme's sky complete and in range, Starry Night values, uniform mapping (\`src/config/theme.ts\`, \`skyShader.ts\`) |`

- [ ] **Step 6: Commit.**

```bash
git add src/config/theme.ts src/components/EmotionField/skyShader.ts scripts/test-sky-theme.ts package.json AGENTS.md
git commit -m "feat(sky): add the living-sky block to each theme's shader settings"
```

---

### Task 2: Camera frame on the projection, and the opening-pan curve (`check:intro`)

**Covers:** R1 (frame), R12, R13.

**Files:**
- Modify: `src/utils/skyProjection.ts` (`FieldProjection`, `skyProjection` return)
- Modify: `scripts/test-sky-projection.ts` (one check)
- Create: `src/utils/skyIntro.ts`
- Create: `scripts/test-sky-intro.ts`
- Modify: `package.json`, `AGENTS.md`

**Interfaces:**
- Produces:
  - `SkyFrame { f, r, u: Vec3; F, cx, cy: number }`.
  - `FieldProjection.frame?: SkyFrame`: present on sky projections, absent on flat ones.
  - `IntroSpec { from, to: FieldCoord; delayS, durationS: number }`.
  - `introStart(lookMax): FieldCoord`, `introLook(elapsedS, spec): { look, done }`, `introPeakSpeed(spec): number`.

- [ ] **Step 1: Write the intro check** at `scripts/test-sky-intro.ts`:

```ts
// Behavioural check for the night-sky opening pan (src/utils/skyIntro.ts).
// Run: npm run check:intro
import { introLook, introPeakSpeed, introStart, type IntroSpec } from '../src/utils/skyIntro';
import { degToField, DEFAULT_CAMERA_PARAMS as P } from '../src/utils/skyCamera';
import { skyProjection } from '../src/utils/skyProjection';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}
const spec: IntroSpec = { from: introStart(P.lookMax), to: { x: 0, y: 0 }, delayS: 0.4, durationS: 5.5 };

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

// Rises monotonically, starts and ends at rest, and never outruns the pan cap.
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
  const cap = degToField(P.maxDegPerSec);
  check('never faster than the pan cap', peak <= cap && introPeakSpeed(spec) <= cap, `peak ${peak.toFixed(3)} (analytic ${introPeakSpeed(spec).toFixed(3)}) ≤ cap ${cap.toFixed(3)} field/s`);
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
```

- [ ] **Step 2: Add the frame check** to `scripts/test-sky-projection.ts`, just before the final `if (failures)` block:

```ts
// The frame a WebGL renderer uses must describe the same projection:
// a direction built from any pixel through the frame lands back on that pixel.
{
  const p = skyProjection({ look: { x: -0.7, y: 0.4 }, fovDeg: 72, width: W, height: H, viewport: { top: 0, height: 480 } });
  const fr = p.frame!;
  let worst = 0;
  for (const [px, py] of [[40, 30], [450, 240], [860, 470], [300, 400]]) {
    const sx = (px - fr.cx) / fr.F, sy = -(py - fr.cy) / fr.F;
    const d = [fr.f[0] + fr.r[0] * sx + fr.u[0] * sy, fr.f[1] + fr.r[1] * sx + fr.u[1] * sy, fr.f[2] + fr.r[2] * sx + fr.u[2] * sy];
    const l = Math.hypot(d[0], d[1], d[2]);
    const c = dirToField([d[0] / l, d[1] / l, d[2] / l]);
    const q = p.toPx(c);
    worst = Math.max(worst, Math.hypot(q.x - px, q.y - py));
  }
  check('sky frame agrees with toPx', worst < 0.5 && flatProjection({ width: W, height: H }).frame === undefined, `worst ${worst.toFixed(4)}px; flat has no frame`);
}
```

Register `"check:intro": "npx tsx scripts/test-sky-intro.ts",` in `package.json`.

Run: `npm run check:intro; npm run check:sky`
Expected: check:intro fails (module not found). check:sky fails on `p.frame!` being undefined.

- [ ] **Step 3: Implement.** In `src/utils/skyProjection.ts`, replace the `FieldProjection` interface opening with:

```ts
// The camera behind a sky projection, for renderers that turn each pixel
// back into a dome direction themselves (the WebGL sky, SkyAurora.tsx).
export interface SkyFrame {
  f: Vec3;
  r: Vec3;
  u: Vec3;
  F: number;
  cx: number;
  cy: number;
}
export interface FieldProjection {
  kind: 'flat' | 'sky';
  // Present on sky projections only.
  frame?: SkyFrame;
```

(keep the rest of the interface). In `skyProjection`'s returned object, add `frame: { f, r, u, F, cx, cy },` after `kind: 'sky',`.

Create `src/utils/skyIntro.ts`:

```ts
import type { FieldCoord } from './skyProjection';

// The opening camera move of the night-sky field
// (docs/plans/2026-09-28-002-feat-living-sky-plan.md): while the welcome cue
// shows, the gaze starts low over the Negative horizon and rises to the
// still point overhead. Pure, so check:intro can prove it stays under the
// pan speed cap and lands exactly.

export interface IntroSpec {
  from: FieldCoord;
  to: FieldCoord;
  delayS: number;
  durationS: number;
}

// Low over the Negative horizon: screen-down is always Negative, so rising
// from here reads as lifting your eyes from the horizon to the sky overhead.
export function introStart(lookMax: number): FieldCoord {
  return { x: 0, y: -lookMax };
}

export function introLook(elapsedS: number, spec: IntroSpec): { look: FieldCoord; done: boolean } {
  const k = Math.max(0, Math.min(1, (elapsedS - spec.delayS) / spec.durationS));
  const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
  return {
    look: { x: spec.from.x + (spec.to.x - spec.from.x) * e, y: spec.from.y + (spec.to.y - spec.from.y) * e },
    done: k >= 1,
  };
}

// Peak gaze speed of the eased rise, field units per second.
export function introPeakSpeed(spec: IntroSpec): number {
  const dist = Math.hypot(spec.to.x - spec.from.x, spec.to.y - spec.from.y);
  return (Math.PI / 2) * (dist / spec.durationS);
}
```

- [ ] **Step 4: Run.**

Run: `npm run check:intro && npm run check:sky && npm run check:camera`
Expected:
- check:intro: 8 PASS. The cap line reads `peak 0.343 (analytic 0.343) ≤ cap 0.411 field/s`, and the horizon line reads `horizon at y=465.6 of 700`.
- check:sky: all pass, including `sky frame agrees with toPx — worst 0.0000px; flat has no frame`.
- check:camera: unchanged.

- [ ] **Step 5: AGENTS.md row:** `| \`npm run check:intro\` | night-sky opening pan: starts with the horizon in view, lands on the zenith, stays under the pan cap (\`src/utils/skyIntro.ts\`) |`. Extend the `check:sky` row's text with "camera frame".

- [ ] **Step 6: Commit.**

```bash
git add src/utils/skyProjection.ts src/utils/skyIntro.ts scripts/test-sky-projection.ts scripts/test-sky-intro.ts package.json AGENTS.md
git commit -m "feat(sky): expose the camera frame and add the opening-pan curve"
```

---

### Task 3: Admin controls — Night sky section and intro knobs

**Covers:** R9, R10, R17.

**Files:**
- Modify: `src/admin/components/AdminShaderDetails.tsx`
- Modify: `src/config/revealTuning.ts`
- Modify: `src/admin/components/AdminRevealTuning.tsx`

**Interfaces:**
- Consumes: the `sky*` fields on `ShaderTheme` (Task 1); `setShaderOverride` / `useTheme` (existing).
- Produces: `RevealTuning.skyIntro: boolean`, `skyIntroDelay: number` and `skyIntroDuration: number`, with defaults `true`, `0.4` and `5.5`.

- [ ] **Step 1: Night sky section.** In `AdminShaderDetails.tsx`, after the last existing `SectionLabel` group inside the Details body, add:

```tsx
        <div>
          <SectionLabel title="Night sky (sky mode only)" />
          <Group>
            <HueField label="zenith" hex={s.skyZenith} onChange={(hex) => set({ skyZenith: hex })} />
            <HueField label="horizon" hex={s.skyHorizon} onChange={(hex) => set({ skyHorizon: hex })} />
            <HueField label="horizon warmth" hex={s.skyWarm} onChange={(hex) => set({ skyWarm: hex })} />
            <HueField label="aurora low" hex={s.skyAuroraLow} onChange={(hex) => set({ skyAuroraLow: hex })} />
            <HueField label="aurora high" hex={s.skyAuroraHigh} onChange={(hex) => set({ skyAuroraHigh: hex })} />
            <HueField label="milky way" hex={s.skyBand} onChange={(hex) => set({ skyBand: hex })} />
            <FieldSlider label="Aurora strength" value={s.skyAuroraStrength} min={0} max={1.5} step={0.01} onChange={(v) => set({ skyAuroraStrength: v })} />
            <FieldSlider label="Aurora speed" value={s.skyAuroraSpeed} min={0} max={5} step={0.01} onChange={(v) => set({ skyAuroraSpeed: v })} />
            <FieldSlider label="Aurora reach (°)" value={s.skyAuroraReach} min={5} max={80} step={1} onChange={(v) => set({ skyAuroraReach: v })} />
            <FieldSlider label="Aurora brightness cap" value={s.skyAuroraCap} min={0} max={1} step={0.01} onChange={(v) => set({ skyAuroraCap: v })} />
            <FieldSlider label="Milky way strength" value={s.skyBandStrength} min={0} max={2} step={0.01} onChange={(v) => set({ skyBandStrength: v })} />
            <FieldSlider label="Horizon warmth" value={s.skyWarmth} min={0} max={1} step={0.01} onChange={(v) => set({ skyWarmth: v })} />
            <FieldSlider label="Dim while moving" value={s.skyMovingDim} min={0} max={1} step={0.01} onChange={(v) => set({ skyMovingDim: v })} />
            <FieldSlider label="Save swell" value={s.skySwell} min={0} max={3} step={0.05} onChange={(v) => set({ skySwell: v })} />
            <FieldSlider label="Render scale" value={s.skyRenderScale} min={0.25} max={1} step={0.05} onChange={(v) => set({ skyRenderScale: v })} />
          </Group>
        </div>
```

The existing `isDefault` / "Reset shader" logic covers these fields automatically, because it iterates `Object.keys(base)`. Check `FieldSlider`'s exact prop names in `AdminShaderFields.tsx` and match them.

- [ ] **Step 2: Intro knobs.** In `src/config/revealTuning.ts`, append to `RevealTuning`:

```ts
  /** Night-sky opening pan: on load, rise from the horizon to the zenith while the welcome cue shows. */
  skyIntro: boolean;
  /** Seconds before the rise starts, and how long it takes. */
  skyIntroDelay: number;
  skyIntroDuration: number;
```

and to `DEFAULT_TUNING`: `skyIntro: true, skyIntroDelay: 0.4, skyIntroDuration: 5.5,`. In `AdminRevealTuning.tsx`, add to `SKY_KNOBS`:

```ts
  { key: 'skyIntroDelay', label: 'Opening pan delay', min: 0, max: 3, step: 0.1, fmt: (v) => `${v.toFixed(1)}s` },
  { key: 'skyIntroDuration', label: 'Opening pan length', min: 2, max: 12, step: 0.1, fmt: (v) => `${v.toFixed(1)}s` },
```

Also add an "Opening pan" checkbox bound to `skyIntro`, built the same way as the existing "Night-sky field" checkbox.

- [ ] **Step 3: Verify.**

Run: `npx tsc -b && npm run lint && npm run check:theme && npm run check:skytheme`
Expected: clean type-check, only the five known lint errors, and all checks pass.

Then run the dev server and open `/emotions-wheel/admin.html`:
- The Color themes page shows the Night sky section with Starry Night's values. Aurora low should read `#8FC1C4 · 183°`.
- Moving "Aurora strength" writes `skyAuroraStrength` into `localStorage['ui-theme-shader-overrides'].i`.
- "Reset shader" clears it.
- The reveal-tuning page shows the two pan knobs and the checkbox.

- [ ] **Step 4: Commit.**

```bash
git add src/admin/components/AdminShaderDetails.tsx src/config/revealTuning.ts src/admin/components/AdminRevealTuning.tsx
git commit -m "feat(admin): edit the night sky per theme and tune the opening pan"
```

---

### Task 4: `SkyAurora` — the WebGL sky layer

**Covers:** R1–R7, AE1, AE2, AE7.

**Files:**
- Create: `src/components/EmotionField/SkyAurora.tsx`
- Modify: `src/components/EmotionField/SkyBackdrop.tsx` (a `paintSky` prop)
- Modify: `src/components/EmotionField/EmotionField.tsx` (mount, inputs ref)

**Interfaces:**
- Consumes:
  - `SKY_VERTEX`, `SKY_FRAGMENT`, `skyThemeUniforms`, `canUseWebGL` (Task 1).
  - `FieldProjection.frame` (Task 2).
  - `useTheme()` (existing) for `theme.shader`.
- Produces:
  - `export interface SkyAuroraInputs { proj: FieldProjection; moving: boolean; swell: number }`.
  - `<SkyAurora inputs={RefObject<SkyAuroraInputs>} invalidateRef={RefObject<(() => void) | null>} reducedMotion={boolean} />`.
  - `SkyBackdrop` prop `paintSky: boolean`.

- [ ] **Step 1: Write the component** `src/components/EmotionField/SkyAurora.tsx`:

```tsx
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ShaderMaterial, Vector2, Vector3 } from 'three';
import { useTheme } from '../../config/theme';
import type { FieldProjection } from '../../utils/skyProjection';
import { SKY_FRAGMENT, SKY_VERTEX, skyThemeUniforms } from './skyShader';

export interface SkyAuroraInputs {
  proj: FieldProjection;
  // A field press or live draft is in progress: quiet the aurora (R5).
  moving: boolean;
  // 0..1 envelope of the save swell (Task 5 drives it; 0 until then).
  swell: number;
}

// The living sky behind the stars (docs/plans/2026-09-28-002-feat-living-sky-plan.md).
// One full-screen quad; the fragment shader turns each pixel into a dome
// direction with the projection's own camera frame, so the band and aurora
// move with the stars. Per-frame values come from `inputs` (a ref EmotionField
// writes every render), never from props, so neither this component nor App
// re-renders per frame.
export function SkyAurora({ inputs, invalidateRef, reducedMotion }: {
  inputs: RefObject<SkyAuroraInputs>;
  // Filled on create with R3F's invalidate, so the field can request a frame
  // when the camera moves under reduced motion (frameloop="demand").
  invalidateRef: RefObject<(() => void) | null>;
  reducedMotion: boolean;
}) {
  const { theme } = useTheme();
  const scale = theme.shader.skyRenderScale;
  const dpr = Math.min(2, window.devicePixelRatio || 1) * scale;
  return (
    <Canvas
      aria-hidden
      orthographic
      dpr={dpr}
      frameloop={reducedMotion ? 'demand' : 'always'}
      gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      onCreated={(st) => { invalidateRef.current = st.invalidate; }}
    >
      <SkyQuad inputs={inputs} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

function SkyQuad({ inputs, reducedMotion }: { inputs: RefObject<SkyAuroraInputs>; reducedMotion: boolean }) {
  const { theme } = useTheme();
  const s = theme.shader;
  const invalidate = useThree((st) => st.invalidate);
  const clock = useRef({ time: 0, dim: 1 });
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uRes: { value: new Vector2(1, 1) }, uCenter: { value: new Vector2() }, uRatio: { value: 1 }, uF: { value: 1 },
          uFwd: { value: new Vector3(0, 1, 0) }, uRight: { value: new Vector3(1, 0, 0) }, uUp: { value: new Vector3(0, 0, 1) },
          uTime: { value: 0 }, uSwell: { value: 0 }, uDim: { value: 1 },
          uIntensity: { value: 0 }, uReach: { value: 0.6 }, uBand: { value: 0 }, uCap: { value: 0.26 }, uWarmth: { value: 0 },
          uZen: { value: new Vector3() }, uHor: { value: new Vector3() }, uWarm: { value: new Vector3() },
          uA1: { value: new Vector3() }, uA2: { value: new Vector3() }, uBandCol: { value: new Vector3() },
        },
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Theme-driven uniforms: only when the theme or its sky override changes.
  useEffect(() => {
    const t = skyThemeUniforms(s);
    const u = material.uniforms;
    for (const k of ['uZen', 'uHor', 'uWarm', 'uA1', 'uA2', 'uBandCol'] as const) u[k].value.set(...t[k]);
    u.uIntensity.value = t.uIntensity; u.uReach.value = t.uReach; u.uBand.value = t.uBand; u.uCap.value = t.uCap; u.uWarmth.value = t.uWarmth;
    invalidate();
  }, [s, material, invalidate]);

  useFrame((state, delta) => {
    const inp = inputs.current;
    const fr = inp?.proj.frame;
    if (!inp || !fr) return;
    const dt = Math.min(0.05, delta);
    const u = material.uniforms;
    if (!reducedMotion) clock.current.time += dt * s.skyAuroraSpeed;
    const dimGoal = inp.moving ? s.skyMovingDim : 1;
    clock.current.dim += (dimGoal - clock.current.dim) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 2.2));
    u.uRes.value.set(state.size.width, state.size.height);
    u.uRatio.value = state.gl.getPixelRatio();
    u.uCenter.value.set(fr.cx, fr.cy);
    u.uF.value = fr.F;
    u.uFwd.value.set(...fr.f); u.uRight.value.set(...fr.r); u.uUp.value.set(...fr.u);
    u.uTime.value = clock.current.time;
    u.uDim.value = clock.current.dim;
    u.uSwell.value = inp.swell * s.skySwell;
  });

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
```

Under reduced motion the canvas only renders on `invalidate()`. EmotionField calls it through `invalidateRef` whenever the projection changes (Step 3).

- [ ] **Step 2: Let `SkyBackdrop` skip the soft sky.** Add the prop `paintSky: boolean` to `SkyBackdrop`'s `Props`, and destructure it. Wrap three blocks in `if (paintSky) { … }`: the radial sky gradient fill, the horizon haze rings, and the band (dots and puffs). The `clearRect` at the top of each frame stays unconditional, so when `paintSky` is false the canvas is transparent over the WebGL layer. Add `paintSky` to the draw effect's dependencies. Update the header comment to say which layer paints the soft sky.

- [ ] **Step 3: Mount it in `EmotionField`.** Near the other sky memos:

```tsx
  // WebGL decided once per mount; without it the 2D backdrop paints the sky (R7).
  const [webgl] = useState(() => sky && canUseWebGL());
  const auroraInputs = useRef<SkyAuroraInputs>({ proj, moving: false, swell: 0 });
  useLayoutEffect(() => {
    auroraInputs.current.proj = proj;
    auroraInputs.current.moving = isPressed || liveDraft !== null;
  });
```

As the first child of the field container, before `SkyBackdrop`:

```tsx
      {sky && webgl && <SkyAurora inputs={auroraInputs} reducedMotion={!!reducedMotion} />}
```

Pass `paintSky={!webgl}` to `SkyBackdrop`. For reduced motion, keep `const auroraInvalidate = useRef<(() => void) | null>(null);`, pass `invalidateRef={auroraInvalidate}` to `SkyAurora`, and extend the layout effect above so it requests a frame when the camera moves:

```tsx
  useLayoutEffect(() => {
    const moved = auroraInputs.current.proj !== proj;
    auroraInputs.current.proj = proj;
    auroraInputs.current.moving = isPressed || liveDraft !== null;
    if (moved && reducedMotion) auroraInvalidate.current?.();
  });
```

(This replaces the shorter layout effect shown above, so there's one layout effect, not two.)

- [ ] **Step 4: Verify.**

Run: `npx tsc -b && npm run lint && npm run check:theme && npm run check:sky`
Expected: clean.

Headless Playwright against `npm run build` + `npx vite preview` (use `--use-gl=angle --use-angle=swiftshader`), throwaway scripts under `/private/tmp/claude-501/`:
1. At `?field=sky` there is a WebGL canvas behind the star canvas. The star canvas's corner pixels are transparent, and the composite shows the Starry Night gradient: dark overhead, lighter toward the horizon.
2. Tilt toward a horizon: the aurora appears low, and no pixel within the aurora exceeds the base sky by more than the cap. Sample a region and compare against the same region with strength 0 via a shader override.
3. Pan: sample a bright band pixel before and after a small camera move. The feature moves by the same screen offset as a star beside it (AE1).
4. While dragging a slider, sampled aurora brightness drops toward `skyMovingDim` (AE2).
5. Reduced motion: two samples 500ms apart are identical at rest.
6. `?field=flat`: no WebGL sky canvas, `ShaderBackground` present as before.
7. WebGL off: launch Chromium with `--disable-gl --disable-webgl`, or stub `canUseWebGL` in a throwaway build. The 2D sky draws (AE7).

Record the numbers in the report.

- [ ] **Step 5: Commit.**

```bash
git add src/components/EmotionField/SkyAurora.tsx src/components/EmotionField/SkyBackdrop.tsx src/components/EmotionField/EmotionField.tsx
git commit -m "feat(sky): paint a living aurora and milky way with a dome-aware shader"
```

---

### Task 5: The save swell

**Covers:** R11, AE6.

**Files:**
- Modify: `src/App.tsx` (a counter bumped at both `record(pins, sessionStartRef.current, entrySource)` call sites, near lines 672 and 947, and passed to `EmotionField`)
- Modify: `src/components/EmotionField/EmotionField.tsx` (prop `skySwellPlay?: number`, the anime.js envelope into `auroraInputs.current.swell`)

**Interfaces:**
- Consumes: `useAnimeScope` (`src/hooks/useAnimeScope.ts`); `auroraInputs` (Task 4).
- Produces: `EmotionField` prop `skySwellPlay?: number` (default 0).

- [ ] **Step 1: Counter in App.**

```tsx
  // One saved check-in → one swell of the night sky's aurora (living-sky R11).
  const [skySwellPlay, setSkySwellPlay] = useState(0);
```

Right after each `const entry = record(...)` line, add `setSkySwellPlay((n) => n + 1);`. Pass `skySwellPlay={skySwellPlay}` to `<EmotionField>`.

- [ ] **Step 2: Envelope in EmotionField.** This follows the repo's one-shot convention: a counter-keyed effect calls a scoped method.

```tsx
  const swellTarget = useRef({ v: 0 });
  const { root: swellRoot, scope: swellScope } = useAnimeScope<HTMLDivElement>((scope, reduced) => {
    scope.add('swell', () => {
      if (reduced) return; // no swell under reduced motion (R11)
      animate(swellTarget.current, {
        v: [{ to: 1, duration: 800, ease: 'out(2)' }, { to: 0, duration: 2400, ease: 'inOut(2)' }],
        onUpdate: () => { auroraInputs.current.swell = swellTarget.current.v; },
      });
    });
  }, []);
  useEffect(() => {
    if (skySwellPlay > 0) swellScope.current?.methods.swell();
  }, [skySwellPlay, swellScope]);
```

Render `<div ref={swellRoot} style={{ display: 'none' }} />` inside the field container, since the scope needs a root element. Import `animate` from `animejs`. Check the keyframe array syntax against `node_modules/animejs` types for 4.5.0. If per-property keyframes differ, use two chained `animate` calls with the second started from the first's `onComplete`, and say so in the report.

- [ ] **Step 3: Verify.** `npx tsc -b && npm run lint`. Headless, sky mode: plant a pin and save. Sample the aurora region at 0.8s after the save (brighter than before) and at 3.5s (back within 2% of the pre-save value). Under reduced motion there is no change. Flat mode: saving still works and nothing throws.

- [ ] **Step 4: Commit.**

```bash
git add src/App.tsx src/components/EmotionField/EmotionField.tsx
git commit -m "feat(sky): swell the aurora once when a check-in is saved"
```

---

### Task 6: The opening pan

**Covers:** R12–R17, AE4, AE5.

**Files:**
- Modify: `src/components/EmotionField/useSkyCamera.ts`
- Modify: `src/components/EmotionField/EmotionField.tsx` (prop `skyIntro?: boolean`, pass `intro` and `interrupt` to the hook)
- Modify: `src/App.tsx` (pass `skyIntro`)

**Interfaces:**
- Consumes: `introStart`, `introLook`, `type IntroSpec` (Task 2); `RevealTuning.skyIntro`, `skyIntroDelay` and `skyIntroDuration` (Task 3).
- Produces:
  - `useSkyCamera` options `intro?: IntroSpec | null`, read once at mount.
  - `useSkyCamera` option `interruptRef?: RefObject<boolean>`: true while a field press or live draft is in progress.
  - `EmotionField` prop `skyIntro?: boolean`.

- [ ] **Step 1: Hook.** In `useSkyCamera`:
  - Accept `intro` and `interruptRef`.
  - Keep `const introRef = useRef<{ spec: IntroSpec; t0: number | null; done: boolean } | null>(null)`, initialised once: `intro && !reduced ? { spec: intro, t0: null, done: false } : null`.
  - Start the camera state at `intro.from` when the intro is live. Use `initialCamera(introRef.current ? intro.from : target, lean, params)`, but note `initialCamera` clamps to `lookMax`, which `introStart` already respects.
  - In `tick`, before the normal step:

```ts
      const ir = introRef.current;
      if (ir && !ir.done) {
        if (interruptRef?.current) {
          ir.done = true;               // a touch ends the rise where it is (R14)
        } else {
          if (ir.t0 === null) ir.t0 = now;
          const { look, done } = introLook((now - ir.t0) / 1000, ir.spec);
          const stepped = stepCamera(camRef.current, { target: targetRef.current, prevTarget: null, lean, reduced }, dt, params);
          const next = { look, vel: { x: 0, y: 0 }, fovDeg: stepped.fovDeg };
          camRef.current = next;
          setCam(next);
          prevTargetRef.current = null;  // the hand-off never "carries" a jump
          if (done) ir.done = true;
          raf = requestAnimationFrame(tick);
          return;
        }
        prevTargetRef.current = null;
      }
```

The loop must keep running during the intro even if `isSettled` would say otherwise. The early `return` above covers that.

- [ ] **Step 2: Field and App.** In `EmotionField`, add the prop `skyIntro = false`. Build the spec once:

```tsx
  const [introSpec] = useState<IntroSpec | null>(() =>
    sky && skyIntro && tuning.skyIntro
      ? { from: introStart(cameraParams.lookMax), to: { x: 0, y: 0 }, delayS: tuning.skyIntroDelay, durationS: tuning.skyIntroDuration }
      : null,
  );
```

`useFieldGesture` (which yields `isPressed`) runs after `useSkyCamera`, so the interrupt travels as a ref: declare `const introInterrupt = useRef(false);` before the `useSkyCamera` call and pass `intro: introSpec, interruptRef: introInterrupt`. In the aurora layout effect from Task 4, add `introInterrupt.current = isPressed || liveDraft !== null;`. In `App.tsx`, pass `skyIntro={showWelcome}` to `<EmotionField>`. The hook reads it only at mount, and the welcome shows on every app load.

- [ ] **Step 3: Verify.** Build and lint clean, and `npm run check:intro` / `check:camera` still pass. Headless, sky mode, fresh load at 1280×800 and 390×800:
  - Sample the zenith's projected position every frame for 7s. At t≈0.2s the horizon, `proj.toPx({ x: 0, y: -1.41 })`, is visible in the lower part of the stage.
  - The zenith reaches the stage centre (or the visible band's centre on phones) within ±2px by about 6.0s.
  - The per-frame gaze speed never exceeds the cap (AE4). Derive it from the change in look; expose look through a throwaway instrumented build only.
  - A press at 1.0s stops the rise at that frame (look stops moving toward the zenith), and the pin plants under the finger (AE5).
  - Reduced motion: the zenith is centred on the first frame.
  - `?field=flat`: no pan, flat field identical.
  - Toggling `skyIntro` off in tuning: no pan.

- [ ] **Step 4: Commit.**

```bash
git add src/components/EmotionField/useSkyCamera.ts src/components/EmotionField/EmotionField.tsx src/App.tsx
git commit -m "feat(sky): open by rising from the horizon to the still point"
```

---

### Task 7: End-to-end pass and docs

**Covers:** AE1–AE8.

**Files:**
- Modify: `docs/theme-system.md` (Consumers table: add a SkyAurora row; "Changing the look": the sky fields travel with the shader block)
- Modify: `CLAUDE.md` (extend the night-sky bullet)

- [ ] **Step 1: Run every check.**

Run: `for s in fan csv cues pin checkin departure source gesture anchor density tags landing replay theme sky camera slider skytheme intro; do npm run check:$s || break; done && npx tsc -b && npm run lint`
Expected: all pass; only the five known lint errors.

- [ ] **Step 2: Walk AE1–AE8 headlessly** at 1280×800 and 390×800, with WebGL via SwiftShader, and record PASS/FAIL with evidence. Include the admin round trip (AE3):
  1. Change Starry Night's aurora-low hue in admin.
  2. Confirm an open app tab repaints (read a pixel before and after).
  3. Press "Reset shader" and confirm the pixel returns.

- [ ] **Step 3: Docs.**
  - In `docs/theme-system.md`'s Consumers table, add: `| SkyAurora (sky mode) | Reads the theme's \`sky*\` shader fields through \`useTheme\`; edited in admin's shader Details → Night sky. |`.
  - Under "Changing the look" step 2, add a sentence: the `sky*` values in the saved `shader` block fold into the theme's `mkShader(…, sky)` second argument.
  - In `CLAUDE.md`, extend the night-sky bullet: "…with a living aurora and milky way (a dome-aware WebGL shader, per-theme and admin-editable) and an opening pan from the horizon to the still point."

- [ ] **Step 4: Commit.** Stop there: no push.

```bash
git add docs/theme-system.md CLAUDE.md
git commit -m "docs: note the living sky and where to tune it"
```

---

## Scope Boundaries

- **Not doing:** the sky in flat mode, on the landing page or in history; user-facing aurora controls (admin only); sound; region-specific aurora colour.
- **Deferred:** a phone-specific field of view (from the night-sky follow-ups) and real-device profiling. The shader should make idle cost lower than today's 2D haze and band, but it hasn't been measured on a phone.

## Risks

- **Double WebGL context at startup.** `canUseWebGL` creates a throwaway context once. On browsers with a low context limit that's harmless, since the flat `ShaderBackground` isn't mounted in sky mode. Watch for a "too many WebGL contexts" warning in Task 4's run.
- **R3F `Canvas` sizing inside the receded field wrapper.** The canvas measures its container. With the recede transform, `state.size` is the layout size, which is the same space `proj` uses, so `uCenter` and `uF` line up. Task 4's pan check (AE1) is the proof.
- **The anime.js keyframe syntax** for plain-object targets is the one unverified API in the plan. Task 5 names the fallback.
- **Intro versus returning users.** After the rise, a returning user's camera target is the previous check-in, so the gaze glides on from the zenith (R15). If that second move feels like too much, the knob is to end the rise at the target instead of the zenith. That is a one-line change of `to` in the spec, but it's a product call, so it's recorded here, not taken.
