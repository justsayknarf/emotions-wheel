# Repo conventions

Guidance for anyone — human or agent — writing code in this repo. Product context is in [CLAUDE.md](CLAUDE.md); product direction is in [STRATEGY.md](STRATEGY.md).

## Testing

**There is no component-test harness.** No Jest, no Vitest, no React Testing Library. Do not write component tests expecting one to exist, and do not add one as a side effect of another change.

What exists instead is a set of **pure-logic check scripts** under `scripts/`, run via `npx tsx` and registered as `check:*` in `package.json`:

| Script | Covers |
|---|---|
| `npm run check:fan` | radial fan geometry |
| `npm run check:csv` | diary CSV export |
| `npm run check:cues` | grounding-cue rotation |
| `npm run check:pin` | pin coordinate adjustment |
| `npm run check:theme` | theme drift: generated tokens, theme completeness, DESIGN.md palette, no hardcoded theme colors (see [docs/theme-system.md](docs/theme-system.md)) |
| `npm run check:landing` | landing page sky geometry |
| `npm run check:replay` | constellation replay timing and day labels (`src/components/Constellation/replaySchedule.ts`) |
| `npm run check:sky` | night-sky projection: orientation, press round-trip, horizon, flat parity, camera frame (`src/utils/skyProjection.ts`) |
| `npm run check:intro` | night-sky opening pan: starts with the horizon in view, lands on the zenith, stays under its own speed ceiling (`src/utils/skyIntro.ts`) |
| `npm run check:camera` | night-sky camera: pan cap, no overshoot, carry during flights, tilt limit, target order (`src/utils/skyCamera.ts`) |
| `npm run check:slider` | weighted slider: edge resistance, no overshoot, grab zone, flight timing (`src/utils/sliderWeight.ts`) |
| `npm run check:skytheme` | night-sky theme block: every theme's sky complete and in range, Starry Night values, uniform mapping (`src/config/theme.ts`, `skyShader.ts`) |
| `npm run check:comet` | night-sky light trails: the tag-line draw timeline (the replay's look) and the departure comet's timeline, spring and sizes (`src/utils/comet.ts`) |
| `npm run check:definitions` | every word in the active vocabulary has a definition (`src/data/descriptions.ts`) |
| `npm run check:tooltip` | definition tooltip: timing (delay, hand-off, grace, press, pin rest, tap) and placement/hit-test geometry (`src/components/EmotionField/definitionTiming.ts`, `definitionPlacement.ts`) |
| `npm run check:patchdefs` | the admin's in-place `descriptions.ts` editor changes only the entries it is given (`src/admin/lib/patchDescriptions.ts`) |
| `npm run check:vocabulary` | the admin vocabulary switcher's saved choice resolves to a registered framework, else the default (`src/data/frameworks/index.ts`) |

New logic gets a new `check:<short-name>` script following the same shape.

**The testing split that makes this work:** these scripts run under Node, which has no `localStorage`. Anything importing `src/store/diary.ts` therefore throws on load. So keep pure logic in its own module and make the storage-backed function a thin wrapper over it — the script tests the pure half, and the wrapper is verified live in the app. `pickCueIndex` / `nextCue` in `src/data/groundingCues.ts` is the reference example.

`npm run lint` runs ESLint plus a custom emotion-word spacing linter. `npm run build` type-checks (`tsc -b`) before building.

## Branch and PR habit

Work happens on a branch named for it (`feat/…`, `fix/…`, `docs/…`), lands via pull request, and merges to `main`. Planning artifacts live in `docs/brainstorms/` and `docs/plans/` and are committed alongside the work they describe.

## Conventions

- Design tokens are the `--ui-*` custom properties, authored once in `src/config/theme.ts` and generated into `src/theme-tokens.css` (`npm run sync:theme`). Reach for an existing token, or a derived channel like `rgb(var(--ui-gold-rgb) / 0.3)`, before introducing a color; never paste a hex. `npm run check:theme` enforces it.
- Derive at render rather than reconciling in an effect. `src/App.tsx` resolves the selected pin and its dependents this way on purpose — several visual systems read from one resolved value so they cannot drift apart.
- Motion is framer-motion throughout and most of it honors `useReducedMotion` — but not all: the canvas `requestAnimationFrame` loops (`AxisRadiance.tsx`) do not, so adding reduced-motion support there is new work rather than reuse.
- **anime.js** (`animejs` 4.x) sits alongside framer-motion, not in place of it. framer-motion keeps component enter/exit and `AnimatePresence`; anime.js is for one-shot moments (pin landing, the comet, word reveals) and anything that needs a scrubbable timeline. Go through `useAnimeScope` (`src/hooks/useAnimeScope.ts`) so animations are scoped to the component, reverted on cleanup, and handed the reduced-motion flag. Colors come from the theme (`themeRgba`, `var(--ui-*)`), never a pasted hex.
- One-shot animations key on a counter and measure at play time, not on geometry — see `AxisRadiance.tsx`, which had a resize-restart bug precisely because it did otherwise.
