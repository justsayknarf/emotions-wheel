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

New logic gets a new `check:<short-name>` script following the same shape.

**The testing split that makes this work:** these scripts run under Node, which has no `localStorage`. Anything importing `src/store/diary.ts` therefore throws on load. So keep pure logic in its own module and make the storage-backed function a thin wrapper over it — the script tests the pure half, and the wrapper is verified live in the app. `pickCueIndex` / `nextCue` in `src/data/groundingCues.ts` is the reference example.

`npm run lint` runs ESLint plus a custom emotion-word spacing linter. `npm run build` type-checks (`tsc -b`) before building.

## Branch and PR habit

Work happens on a branch named for it (`feat/…`, `fix/…`, `docs/…`), lands via pull request, and merges to `main`. Planning artifacts live in `docs/brainstorms/` and `docs/plans/` and are committed alongside the work they describe.

## Conventions

- Design tokens are CSS custom properties in `src/index.css`. Reach for an existing `--oura-*` token before introducing a color.
- Derive at render rather than reconciling in an effect. `src/App.tsx` resolves the selected pin and its dependents this way on purpose — several visual systems read from one resolved value so they cannot drift apart.
- Motion is framer-motion throughout and most of it honors `useReducedMotion` — but not all: the canvas `requestAnimationFrame` loops (`AxisRadiance.tsx`) do not, so adding reduced-motion support there is new work rather than reuse.
- One-shot animations key on a counter and measure at play time, not on geometry — see `AxisRadiance.tsx`, which had a resize-restart bug precisely because it did otherwise.
