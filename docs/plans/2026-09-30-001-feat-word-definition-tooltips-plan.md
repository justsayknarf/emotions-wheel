# Word Definition Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a word's definition on the field while the user is choosing: rest on a star or a card word for 500ms and a definition card draws out on a hairline tether from the star; on phones the card sits in a band at the top of the visible field.

**Architecture:** Three pure modules carry all the logic and are covered by `check:*` scripts: a timing state machine (`definitionTiming.ts`), placement and hit-testing geometry (`definitionPlacement.ts`), and definition coverage (`descriptions.ts`). One hook in `App` owns the tooltip state and shares it through React context with the card; `EmotionField` receives it as props, hit-tests the pointer against its own word positions, and renders a single `DefinitionTip` (framer-motion) positioned through the field's projection, so the flat field and the night-sky field share one path.

**Tech Stack:** React 19, TypeScript, framer-motion 12, Vite. Checks run with `npx tsx` via `pnpm run check:*`. pnpm only, never `npm install`.

**Spec:** `docs/brainstorms/2026-09-30-word-definition-tooltips-requirements.md` (R1–R19, AE1–AE7). Mock: <https://claude.ai/artifact/AvsenaNj9FWQc4d5976oH6>.

## Global Constraints

- Delay before a tooltip opens: **500ms**. Hand-off grace after leaving all targets: **300ms**. Desktop tether standoff: **~95px**.
- One tooltip at a time (spec Key Decisions).
- Every word in the active framework (`radial-intensity`, 188 words) has a definition; 103 are missing today (R1). The shipped tooltip has no "no definition" state.
- Colours only from theme tokens (`var(--ui-*)`, `rgb(var(--ui-*-rgb) / a)`); never a hex. `pnpm run check:theme` enforces it.
- Motion has no overshoot or bounce: springs at critical damping (ζ = 1). Reduced motion: no draw, slide or lift; short fades only (R17).
- No component-test harness exists and none may be added (AGENTS.md). Pure logic goes in its own module with a `scripts/test-*.ts` check registered as `check:<name>` in `package.json`.
- No side effects inside a functional `setState` updater (StrictMode double-invokes them).
- framer-motion owns component enter/exit (`AnimatePresence`); anime.js is not needed here.
- Out of scope: saved check-in card, history, replay, `DepartureFloat`, read-only/previous check-in cards, contrast pairs.
- Branch: `feat/word-definition-tooltips`, worktree `.claude/worktrees/word-definitions` (already created off `origin/main` at `5a3b3ce`). The worktree's `node_modules` is a symlink to the main checkout's; `rm` the symlink (not the target) before `git worktree remove`.

## Codebase facts the tasks rely on

- **Field words are not pointer targets.** Every word renders with `pointerEvents: 'none'`; the field container (`EmotionField.tsx`, the `ref={setContainerRef}` div) is the single pointer target, wired to `useFieldGesture`'s `handlers`. Hover over a word must therefore be a pixel-space hit-test against where words draw.
- **Where a word draws:** dot at `proj.toPx(emotion)` → `{ x, y, visible }`. Its label box is centred at `(dotX + offset.dx, dotY - LABEL_STANDOFF + offset.dy)` with half-width `labelHalfWidth(label, depth)` and half-height `LABEL_LINE_H / 2` (`deoverlap.ts`, `EmotionWord.tsx`). Surface words have no offset; revealed deep words take `deepLabelOffsets.get(id)`.
- **Visible words** = `surfaceEmotions` whose projection is visible, plus `revealedDeep` (already filtered to visible).
- **`highlightedIds`** (prop from `App`) both lights a word (`isHighlighted`) and keeps a deep word revealed (`revealedDeep` includes highlighted ids unless an adjust drag is live). Adding an id to it is how a card hover lights and reveals a star.
- **`proj` changes every camera frame in sky mode**, re-rendering the field, so anything positioned from `proj` during render follows the camera.
- **Layout:** `useSidePanelLayout()` in `App` (`sideBySide`) is true for the desktop rail (≥900px with a fine pointer); otherwise the bottom tray. `skyOccluderTop` is the tray's top edge in field px when not side-by-side (passed in both flat and sky mode).
- **Slider drags:** `CoordinateCard` reports live coordinates through `App.handleAdjustDraft(coord | null)` and commits through `App.handleAdjustPin(pinId, x, y)`. The new-tab `DepartureFloat` drags through `setDepartureDraftCoord` (passed as `onDepartureDrag`).
- **Card words:** `CoordinateCard.tsx` renders two "guess" buttons (`renderGuess`), nearby `WordTag` chips (`renderTag`) and a "your words:" list of named `WordTag`s. `WordTag` is also used by history and the saved card, so tooltip wiring in it must be opt-in props.

## File Structure

| File | Responsibility |
|---|---|
| `src/data/descriptions.ts` (modify) | Add `definitionFor(id)` and `missingDefinitions(ids)`; add 103 definitions |
| `scripts/test-definitions.ts` (create) | `check:definitions`: every active-framework word has a definition (R2, AE7) |
| `src/components/EmotionField/definitionTiming.ts` (create) | Pure timing state machine: delay, hand-off, grace, press suppression, pin rest, tap |
| `src/components/EmotionField/definitionPlacement.ts` (create) | Pure geometry: word hit-test, tethered placement, band placement, tether end, region meta line, nearest word |
| `scripts/test-definition-tooltip.ts` (create) | `check:tooltip`: covers both pure modules above |
| `src/hooks/useDefinitionTooltip.ts` (create) | Hook running the state machine with one timer; context + `useDefinitionTooltipApi()` for the card |
| `src/components/EmotionField/DefinitionTip.tsx` (create) | The tooltip card and its tether: measure, place, animate |
| `src/components/EmotionField/EmotionField.tsx` (modify) | Hit-test hover, report press/release, render `DefinitionTip` |
| `src/App.tsx` (modify) | Own the hook, provide context, wire slider/departure drags, light/reveal via `highlightedIds` |
| `src/components/EmotionPreview/WordTag.tsx` (modify) | Opt-in hover/focus callback, `aria-describedby`, configurable × label |
| `src/components/EmotionPreview/CoordinateCard.tsx` (modify) | Card words drive the tooltip; tray-layout tap semantics |
| `AGENTS.md`, `CLAUDE.md` (modify) | Register the two new checks; note the shipped feature |

---

### Task 1: Definition coverage check

**Files:**
- Modify: `src/data/descriptions.ts` (append after `getDescription`)
- Create: `scripts/test-definitions.ts`
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Produces: `definitionFor(id: string): string | null` (no fallback text, unlike `getDescription`); `missingDefinitions(ids: string[]): string[]`.

- [ ] **Step 1: Write the check script**

```ts
// scripts/test-definitions.ts
// Coverage check for word definitions (word-definition-tooltips R1/R2/AE7).
// Every word in the active vocabulary framework must have a definition: the
// field's tooltip has no "no definition" state. Run: pnpm run check:definitions
import { emotions } from '../src/data/emotions';
import { definitionFor, missingDefinitions } from '../src/data/descriptions';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// The helpers themselves.
check('definitionFor: known word', typeof definitionFor('happy') === 'string', 'happy has text');
check('definitionFor: unknown id', definitionFor('not-a-word') === null, 'null, not the generic fallback');
check('missingDefinitions: names the gap', missingDefinitions(['happy', 'not-a-word']).join() === 'not-a-word', 'only the unknown id');

// Coverage of the live vocabulary.
const missing = missingDefinitions(emotions.map((e) => e.id));
check(
  `every active word defined (${emotions.length} words)`,
  missing.length === 0,
  missing.length === 0 ? 'none missing' : `${missing.length} missing: ${missing.join(', ')}`,
);

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
```

- [ ] **Step 2: Register it and run it to see it fail**

In `package.json` `scripts`, after `"check:comet"`, add:

```json
    "check:definitions": "npx tsx scripts/test-definitions.ts",
```

Run: `pnpm run check:definitions`
Expected: FAIL on the import (`definitionFor` is not exported).

- [ ] **Step 3: Add the helpers to `src/data/descriptions.ts`**

Append after `getDescription`:

```ts
// The definition the field's tooltip shows, or null when a word has none —
// no generic fallback, because the tooltip must never show filler text.
// scripts/test-definitions.ts keeps every active word covered.
export function definitionFor(id: string): string | null {
  const text = descriptions[id]?.description?.trim();
  return text ? text : null;
}

// The ids in `ids` that have no definition, in input order.
export function missingDefinitions(ids: string[]): string[] {
  return ids.filter((id) => definitionFor(id) === null);
}
```

- [ ] **Step 4: Run it**

Run: `pnpm run check:definitions`
Expected: the three helper checks PASS; `every active word defined (188 words)` FAILS listing 103 ids. That failure is correct and stays until Task 2. Exit code 1.

- [ ] **Step 5: Commit**

```bash
git add src/data/descriptions.ts scripts/test-definitions.ts package.json
git commit -m "feat(definitions): coverage check for word definitions"
```

---

### Task 2: Write the 103 missing definitions

This task is writing, not code. It ends with **Frank's review**: stop after Step 3 and show him the new entries before committing.

**Files:**
- Modify: `src/data/descriptions.ts` (add entries inside the `descriptions` object, grouped under a comment per cluster)

**Interfaces:**
- Consumes: `check:definitions` from Task 1.
- Produces: an entry `{ description, relatedIds }` for every active word.

**Voice rules** (match the existing entries; read 15–20 of them first, e.g. `happy`, `excited`, `playful`, `anxious`, `irritated`, `touched`, `hopeful`, `defeated`, `resigned`):
- One or two sentences, at most ~25 words. Plain words a teenager knows.
- Describe how the feeling sits in you, in second person or as a felt description. Not a dictionary gloss, no "a feeling of…", no synonyms-as-definition.
- No judgement, no advice, no clinical terms; this is not diagnosis. "Depressed" describes a heavy, flat state, not a disorder.
- Where a word is easy to confuse with a neighbour, the definition should make the difference audible (e.g. *apprehensive* is quieter and more anticipatory than *afraid*; *irate* is louder than *agitated*).
- Words that are nouns in the vocabulary (`grief`, `sorrow`, `anguish`, `panic`, `contempt`, `disdain`, `compassion`, `empathy`, `grace`, `regret`, `victim`) are still defined as the feeling, e.g. "grief" → what grieving feels like.
- `relatedIds`: 3–5 ids from the same cluster in `src/data/frameworks/radial-intensity.ts`, nearest first.
- Ids with hyphens must be quoted keys: `'burned-out': { … }`.

**The 103 ids, by cluster** (coordinates are arousal/valence; use them to judge intensity and neighbours):

- courageous: worthy, valiant
- curious: fascinated, intrigued, exploring, stimulated, involved
- peaceful: centered, patient, trusting
- loving: caring, affectionate, compassion, empathy, accepting, self-loving, reflective
- grateful: thankful, blessed, humbled, fortunate, grace
- hopeful: encouraged, expectant
- angry: upset, agitated, aggravated, exasperated, hostile, irate, pissed, bitter, contempt, disdain, cynical, vindictive, disgruntled, grouchy, moody, impatient, disturbed, edgy
- stressed: burned-out, frazzled, weary, worn-out, rattled, shaken, tight, cranky, on-edge
- fear: afraid, nervous, terrified, panic, frightened, apprehensive, hesitant, paralyzed
- unsettled: unsure, skeptical, suspicious, concerned, dissatisfied, perplexed, questioning, ungrounded, rejecting
- sad: grief, discouraged, unhappy, depressed, despondent, forlorn, gloomy, sorrow, teary, anguish, yearning
- numb: withdrawn, isolated, aloof, distant, indifferent, lethargic, listless, removed, resistant, shut-down
- shame: worthless, mortified, self-conscious, useless, weak, inhibited
- guilt: regret, remorseful, sorry
- powerless: trapped, incapable, impotent, victim, sensitive

- [ ] **Step 1: Re-list the gap from the code** (the list above was taken on 2026-09-30; trust the script)

Run: `pnpm run check:definitions`
Expected: FAIL listing 103 ids matching the list above.

- [ ] **Step 2: Write the entries**, one cluster at a time, under a comment such as `// radial-intensity: angry cluster`. Example of the expected shape and voice:

```ts
  apprehensive: {
    description: "A quiet unease about something that hasn't happened yet. Not fear exactly — more like bracing.",
    relatedIds: ['hesitant', 'nervous', 'afraid'],
  },
  'burned-out': {
    description: "You've given past the point of refilling. Even things you care about feel like they cost too much.",
    relatedIds: ['worn-out', 'weary', 'frazzled'],
  },
```

- [ ] **Step 3: Run the check and the type-check**

Run: `pnpm run check:definitions && pnpm exec tsc -b`
Expected: `OK — 0 failure(s).` and no type errors.

**STOP: show Frank the new entries** (e.g. `git diff src/data/descriptions.ts`) and apply his edits before committing.

- [ ] **Step 4: Commit**

```bash
git add src/data/descriptions.ts
git commit -m "feat(definitions): define every radial-intensity word"
```

---

### Task 3: Timing state machine

**Files:**
- Create: `src/components/EmotionField/definitionTiming.ts`
- Create: `scripts/test-definition-tooltip.ts`
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Produces:
  - `DEFINITION_DELAY_MS = 500`, `DEFINITION_GRACE_MS = 300`
  - `type DefinitionPhase = 'cold' | 'waiting' | 'open' | 'grace'`
  - `interface DefinitionState { phase; openId: string | null; pendingId: string | null; pressed: boolean }`
  - `type DefinitionEvent = { type: 'hover'; id: string | null } | { type: 'press' } | { type: 'release'; restId: string | null } | { type: 'tap'; id: string } | { type: 'timer' }`
  - `type TimerCommand = { set: number } | 'clear' | null` (`null` = leave any running timer alone)
  - `INITIAL_DEFINITION_STATE`, `stepDefinition(state, event): { state; timer }`. Returns the **same state object** when nothing changes, so callers can skip a render.

- [ ] **Step 1: Write the failing tests**

```ts
// scripts/test-definition-tooltip.ts
// Behavioural checks for the field's definition tooltip: the timing state
// machine (definitionTiming.ts) and its geometry (definitionPlacement.ts).
// Run: pnpm run check:tooltip
import {
  DEFINITION_DELAY_MS,
  DEFINITION_GRACE_MS,
  INITIAL_DEFINITION_STATE,
  stepDefinition,
  type DefinitionEvent,
  type DefinitionState,
  type TimerCommand,
} from '../src/components/EmotionField/definitionTiming';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// Run events in order, returning the final state and every timer command.
function run(events: DefinitionEvent[], from: DefinitionState = INITIAL_DEFINITION_STATE) {
  let state = from;
  const timers: TimerCommand[] = [];
  for (const e of events) {
    const r = stepDefinition(state, e);
    state = r.state;
    timers.push(r.timer);
  }
  return { state, timers };
}
const hover = (id: string | null): DefinitionEvent => ({ type: 'hover', id });
const timer: DefinitionEvent = { type: 'timer' };

// --- timing ---
check('delay is 500ms, grace 300ms', DEFINITION_DELAY_MS === 500 && DEFINITION_GRACE_MS === 300, `${DEFINITION_DELAY_MS}/${DEFINITION_GRACE_MS}`);
{
  const { state, timers } = run([hover('anxious')]);
  check('hover arms the delay', state.phase === 'waiting' && state.pendingId === 'anxious', state.phase);
  check('hover sets a 500ms timer', JSON.stringify(timers[0]) === JSON.stringify({ set: 500 }), JSON.stringify(timers[0]));
}
{
  const { state } = run([hover('anxious'), timer]);
  check('delay elapsing opens it (R4)', state.phase === 'open' && state.openId === 'anxious', `${state.phase} ${state.openId}`);
}
{
  // AE1: a sweep across words never opens anything.
  const { state, timers } = run([hover('a'), hover('b'), hover('c'), hover('d'), hover(null)]);
  check('sweep then leave: cold (AE1, R6)', state.phase === 'cold' && state.openId === null, state.phase);
  check('leaving cancels the timer', timers[timers.length - 1] === 'clear', String(timers[timers.length - 1]));
  check('each new word restarts the delay', timers.slice(0, 4).every((t) => typeof t === 'object' && t !== null), JSON.stringify(timers));
}
{
  const first = run([hover('anxious')]).state;
  const again = stepDefinition(first, hover('anxious'));
  check('re-hovering the pending word keeps the timer', again.state === first && again.timer === null, String(again.timer));
}
{
  // AE2: hand-off is instant once open.
  const { state, timers } = run([hover('anxious'), timer, hover('apprehensive')]);
  check('open: next word switches at once (AE2, R7)', state.phase === 'open' && state.openId === 'apprehensive', `${state.openId}`);
  check('switch sets no timer', timers[2] === null, String(timers[2]));
}
{
  // AE3: leaving everything closes after the grace and re-arms the delay.
  const left = run([hover('anxious'), timer, hover(null)]);
  check('leaving all targets starts the grace (R8)', left.state.phase === 'grace' && left.state.openId === 'anxious', left.state.phase);
  check('grace timer is 300ms', JSON.stringify(left.timers[2]) === JSON.stringify({ set: 300 }), JSON.stringify(left.timers[2]));
  const closed = stepDefinition(left.state, timer).state;
  check('grace elapsing closes (AE3)', closed.phase === 'cold' && closed.openId === null, closed.phase);
  const rearmed = stepDefinition(closed, hover('nervous'));
  check('after closing, the delay applies again', rearmed.state.phase === 'waiting', rearmed.state.phase);
  const rescued = stepDefinition(left.state, hover('nervous'));
  check('a word reached within the grace takes over', rescued.state.phase === 'open' && rescued.state.openId === 'nervous' && rescued.timer === 'clear', `${rescued.state.openId}`);
}
{
  // AE5: a press closes and suppresses.
  const { state, timers } = run([hover('anxious'), timer, { type: 'press' }]);
  check('press closes an open tooltip (AE5, R9)', state.phase === 'cold' && state.openId === null && state.pressed, state.phase);
  check('press clears the timer', timers[2] === 'clear', String(timers[2]));
  const during = stepDefinition(state, hover('nervous'));
  check('no hover while pressed', during.state === state, during.state.phase);
  const released = stepDefinition(state, { type: 'release', restId: null });
  check('release (no rest) ends suppression, stays closed', !released.state.pressed && released.state.phase === 'cold', released.state.phase);
  const again = stepDefinition(state, { type: 'press' });
  check('repeated press (every drag frame) changes nothing', again.state === state && again.timer === null, 'same state');
  const pending = run([hover('anxious'), { type: 'press' }]).state;
  check('press cancels a pending open', pending.phase === 'cold' && pending.pendingId === null, pending.phase);
}
{
  // AE6: the pin coming to rest in the tray layout.
  const { state, timers } = run([{ type: 'press' }, { type: 'release', restId: 'content' }]);
  check('pin rest arms the delay for the nearest word (R10)', state.phase === 'waiting' && state.pendingId === 'content' && !state.pressed, state.phase);
  check('pin rest timer is 500ms', JSON.stringify(timers[1]) === JSON.stringify({ set: 500 }), JSON.stringify(timers[1]));
  check('then opens', stepDefinition(state, timer).state.openId === 'content', 'content');
  const stray = stepDefinition(INITIAL_DEFINITION_STATE, { type: 'release', restId: null });
  check('a stray release changes nothing', stray.state === INITIAL_DEFINITION_STATE && stray.timer === null, 'same state');
}
{
  // R11: a tap opens immediately.
  const { state, timers } = run([{ type: 'tap', id: 'hopeful' }]);
  check('tap opens with no delay (R11)', state.phase === 'open' && state.openId === 'hopeful' && timers[0] === 'clear', state.phase);
  const switched = stepDefinition(state, { type: 'tap', id: 'touched' }).state;
  check('tap switches an open tooltip', switched.openId === 'touched', `${switched.openId}`);
}
{
  const stale = stepDefinition(INITIAL_DEFINITION_STATE, timer);
  check('a stale timer is ignored', stale.state === INITIAL_DEFINITION_STATE, stale.state.phase);
}

// GEOMETRY CHECKS (Task 4) GO HERE

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
```

In `package.json` add after `"check:definitions"`:

```json
    "check:tooltip": "npx tsx scripts/test-definition-tooltip.ts",
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm run check:tooltip`
Expected: FAIL, cannot resolve `definitionTiming`.

- [ ] **Step 3: Implement**

```ts
// src/components/EmotionField/definitionTiming.ts
// When the field's definition tooltip opens, switches and closes
// (docs/brainstorms/2026-09-30-word-definition-tooltips-requirements.md).
// Pure: the hook (useDefinitionTooltip) runs the one timer this asks for.
//
// - A word must be rested on for DEFINITION_DELAY_MS before anything opens,
//   so a pass across stars or card words shows nothing (R4–R6).
// - Once open, the next word takes over at once (R7). Leaving every word
//   holds the tooltip for DEFINITION_GRACE_MS, then it closes and the delay
//   re-arms (R8).
// - A press (field, pin or slider) closes it and ignores hover until release
//   (R9). In the tray layout, release names the word nearest the resting pin,
//   which opens after the delay (R10). A tap opens at once (R11).

export const DEFINITION_DELAY_MS = 500;
export const DEFINITION_GRACE_MS = 300;

export type DefinitionPhase = 'cold' | 'waiting' | 'open' | 'grace';

export interface DefinitionState {
  phase: DefinitionPhase;
  // The word whose tooltip is showing (open or grace).
  openId: string | null;
  // The word waiting out the delay.
  pendingId: string | null;
  // A press is in progress: hover is ignored.
  pressed: boolean;
}

export type DefinitionEvent =
  | { type: 'hover'; id: string | null }
  | { type: 'press' }
  | { type: 'release'; restId: string | null }
  | { type: 'tap'; id: string }
  | { type: 'timer' };

// Start a timer of `set` ms (replacing any running one), cancel it, or
// (null) leave whatever is running alone.
export type TimerCommand = { set: number } | 'clear' | null;

export interface DefinitionStep {
  state: DefinitionState;
  timer: TimerCommand;
}

export const INITIAL_DEFINITION_STATE: DefinitionState = {
  phase: 'cold',
  openId: null,
  pendingId: null,
  pressed: false,
};

const cold = (pressed: boolean): DefinitionState => ({ phase: 'cold', openId: null, pendingId: null, pressed });
const unchanged = (state: DefinitionState): DefinitionStep => ({ state, timer: null });

export function stepDefinition(s: DefinitionState, e: DefinitionEvent): DefinitionStep {
  switch (e.type) {
    case 'press':
      // Slider drags report every frame; a press already in force is a no-op,
      // so the drag doesn't re-render App each frame.
      if (s.pressed && s.phase === 'cold') return unchanged(s);
      return { state: cold(true), timer: 'clear' };

    case 'release':
      if (e.restId) {
        return {
          state: { phase: 'waiting', openId: null, pendingId: e.restId, pressed: false },
          timer: { set: DEFINITION_DELAY_MS },
        };
      }
      return s.pressed ? { state: { ...s, pressed: false }, timer: null } : unchanged(s);

    case 'tap':
      return { state: { phase: 'open', openId: e.id, pendingId: null, pressed: false }, timer: 'clear' };

    case 'timer':
      if (s.phase === 'waiting' && s.pendingId) {
        return { state: { ...s, phase: 'open', openId: s.pendingId, pendingId: null }, timer: null };
      }
      if (s.phase === 'grace') return { state: cold(s.pressed), timer: null };
      return unchanged(s);

    case 'hover': {
      if (s.pressed) return unchanged(s);
      const id = e.id;
      switch (s.phase) {
        case 'cold':
          return id
            ? { state: { ...s, phase: 'waiting', pendingId: id }, timer: { set: DEFINITION_DELAY_MS } }
            : unchanged(s);
        case 'waiting':
          if (id === s.pendingId) return unchanged(s);
          if (!id) return { state: cold(false), timer: 'clear' };
          return { state: { ...s, pendingId: id }, timer: { set: DEFINITION_DELAY_MS } };
        case 'open':
          if (id === s.openId) return unchanged(s);
          if (!id) return { state: { ...s, phase: 'grace' }, timer: { set: DEFINITION_GRACE_MS } };
          return { state: { ...s, openId: id }, timer: null };
        case 'grace':
          if (!id) return unchanged(s);
          return { state: { ...s, phase: 'open', openId: id }, timer: 'clear' };
      }
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm run check:tooltip`
Expected: every check PASS, `OK — 0 failure(s).`

- [ ] **Step 5: Commit**

```bash
git add src/components/EmotionField/definitionTiming.ts scripts/test-definition-tooltip.ts package.json
git commit -m "feat(field): definition tooltip timing state machine"
```

---

### Task 4: Placement and hit-testing geometry

**Files:**
- Create: `src/components/EmotionField/definitionPlacement.ts`
- Modify: `scripts/test-definition-tooltip.ts` (replace the `// GEOMETRY CHECKS (Task 4) GO HERE` line, add an import)

**Interfaces:**
- Produces:
  - `interface Point { x: number; y: number }`, `interface Box { x: number; y: number; w: number; h: number }`, `interface Obstacle extends Box { weight: number }`
  - `interface WordTarget { id: string; dotX: number; dotY: number; labelX: number; labelY: number; halfW: number; halfH: number }`
  - `type TipLayout = 'tethered' | 'band'`
  - Constants: `TIP_WIDTH = 236`, `TIP_STANDOFF = 95`, `BAND_GUTTER = 12`, `LABEL_OBSTACLE_WEIGHT = 30`, `MARK_OBSTACLE_WEIGHT = 80`
  - `hitTestWord(p: Point, targets: WordTarget[]): string | null`
  - `placeTethered(star: Point, size: { w: number; h: number }, obstacles: Obstacle[], bounds: Box, standoff?: number): Box`
  - `placeBand(star: Point, height: number, bounds: Box): Box`
  - `tetherEnd(star: Point, box: Box, layout: TipLayout): Point`
  - `describeWordRegion(x: number, y: number): string`
  - `nearestWordId(c: Point, words: Array<{ id: string; x: number; y: number }>, radius: number): string | null`

- [ ] **Step 1: Write the failing tests**

Add to the imports at the top of `scripts/test-definition-tooltip.ts`:

```ts
import {
  BAND_GUTTER,
  describeWordRegion,
  hitTestWord,
  nearestWordId,
  placeBand,
  placeTethered,
  tetherEnd,
  type Box,
  type Obstacle,
  type WordTarget,
} from '../src/components/EmotionField/definitionPlacement';
```

Replace the `// GEOMETRY CHECKS (Task 4) GO HERE` line with:

```ts
// --- geometry ---
const field: Box = { x: 0, y: 0, w: 1000, h: 700 };
const tip = { w: 236, h: 96 };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inside = (a: Box, b: Box) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
{
  const star = { x: 500, y: 400 };
  const box = placeTethered(star, tip, [], field);
  check('open sky: tooltip goes above the star (R13)', box.y + box.h <= star.y, `box bottom ${box.y + box.h}, star ${star.y}`);
  check('open sky: within the field', inside(box, field), JSON.stringify(box));
  const gap = star.y - (box.y + box.h);
  check('open sky: standoff about 95px', gap > 80 && gap < 110, `gap ${gap.toFixed(1)}`);
}
{
  const star = { x: 500, y: 400 };
  const blockers: Obstacle[] = [{ x: 330, y: 150, w: 340, h: 160, weight: 30 }];
  const box = placeTethered(star, tip, blockers, field);
  check('labels above: tooltip avoids them', !overlaps(box, blockers[0]), JSON.stringify(box));
}
{
  const star = { x: 500, y: 60 };
  const box = placeTethered(star, tip, [], field);
  check('near the top edge: stays inside', inside(box, field), JSON.stringify(box));
}
{
  const star = { x: 970, y: 400 };
  const box = placeTethered(star, tip, [], field);
  check('near the right edge: stays inside', inside(box, field), JSON.stringify(box));
}
{
  const star = { x: 500, y: 400 };
  const pin: Obstacle = { x: 490, y: 190, w: 20, h: 20, weight: 80 };
  const box = placeTethered(star, tip, [pin], field);
  check('never covers the pin', !overlaps(box, pin), JSON.stringify(box));
}
{
  const band: Box = { x: 0, y: 0, w: 390, h: 480 };
  const low = placeBand({ x: 200, y: 400 }, 90, band);
  check('band: anchors to the top (R14)', low.y === BAND_GUTTER && low.x === BAND_GUTTER && low.w === 390 - 2 * BAND_GUTTER, JSON.stringify(low));
  const high = placeBand({ x: 200, y: 60 }, 90, band);
  check('band: star under the top spot moves it to the bottom', high.y + high.h === 480 - BAND_GUTTER, JSON.stringify(high));
}
{
  const star = { x: 200, y: 400 };
  const box: Box = { x: 12, y: 12, w: 366, h: 90 };
  const end = tetherEnd(star, box, 'band');
  check('band tether: drops straight to the bottom edge', end.x === 200 && end.y === 102, JSON.stringify(end));
  const edge = tetherEnd({ x: 5, y: 400 }, box, 'band');
  check('band tether: clamped inside the card', edge.x >= box.x + 18, JSON.stringify(edge));
}
{
  const star = { x: 500, y: 400 };
  const box: Box = { x: 382, y: 209, w: 236, h: 96 };
  const end = tetherEnd(star, box, 'tethered');
  check('tethered: meets the card edge facing the star', Math.abs(end.y - 305) < 0.01 && Math.abs(end.x - 500) < 0.01, JSON.stringify(end));
}
{
  const targets: WordTarget[] = [
    { id: 'anxious', dotX: 300, dotY: 300, labelX: 300, labelY: 289, halfW: 30, halfH: 9 },
    { id: 'nervous', dotX: 400, dotY: 300, labelX: 400, labelY: 289, halfW: 30, halfH: 9 },
  ];
  check('hit: on the label', hitTestWord({ x: 320, y: 286 }, targets) === 'anxious', 'anxious');
  check('hit: on the dot', hitTestWord({ x: 404, y: 304 }, targets) === 'nervous', 'nervous');
  check('hit: empty sky', hitTestWord({ x: 350, y: 400 }, targets) === null, 'null');
}
{
  check('region: calm pleasant mild', describeWordRegion(-0.2, 0.3) === 'calm · pleasant · mild', describeWordRegion(-0.2, 0.3));
  check('region: activated unpleasant intense', describeWordRegion(0.68, -0.64) === 'activated · unpleasant · intense', describeWordRegion(0.68, -0.64));
  check('region: steady neutral', describeWordRegion(0.05, -0.1) === 'steady · neutral · mild', describeWordRegion(0.05, -0.1));
}
{
  const words = [{ id: 'a', x: 0.3, y: 0.3 }, { id: 'b', x: 0.5, y: 0.5 }];
  check('nearest word within reach', nearestWordId({ x: 0.32, y: 0.31 }, words, 0.35) === 'a', 'a');
  check('nothing within reach', nearestWordId({ x: -0.8, y: -0.8 }, words, 0.35) === null, 'null');
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm run check:tooltip`
Expected: FAIL, cannot resolve `definitionPlacement`.

- [ ] **Step 3: Implement**

```ts
// src/components/EmotionField/definitionPlacement.ts
// Where the field's definition tooltip sits and what the pointer is over
// (docs/brainstorms/2026-09-30-word-definition-tooltips-requirements.md,
// R4/R13/R14). Pure px geometry in the field's layout space; the field
// supplies positions from its projection, so the flat field and the night
// sky share this.

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
// Something the tooltip should not cover; heavier weighs more.
export interface Obstacle extends Box { weight: number }

// A word as it draws: its dot (the true coordinate) and its label box.
export interface WordTarget {
  id: string;
  dotX: number;
  dotY: number;
  labelX: number;
  labelY: number;
  halfW: number;
  halfH: number;
}

export type TipLayout = 'tethered' | 'band';

export const TIP_WIDTH = 236;
export const TIP_STANDOFF = 95;
export const BAND_GUTTER = 12;
export const LABEL_OBSTACLE_WEIGHT = 30;
export const MARK_OBSTACLE_WEIGHT = 80;

// The dot is tiny; this is how close counts as "on it".
const DOT_HIT_RADIUS = 10;
// Labels get a few px of slack so a hover doesn't flicker at the glyph edge.
const LABEL_HIT_PAD = 3;
// Keep the card this far off the field edge.
const EDGE_MARGIN = 8;
// Per px outside the field: far heavier than any label overlap.
const OVERFLOW_WEIGHT = 6;
// Band: if the star is within this much of where the top card would end, the
// card moves to the bottom of the band instead.
const BAND_CLEARANCE = 44;
// Band tether: keep its end this far inside the card's corners.
const BAND_TETHER_INSET = 18;
// Candidate directions (deg, screen space: -90 is straight up), in order of
// preference. Ties go to the earlier one, so upward wins in open sky.
const ANGLES = [-90, -55, -125, -25, -155, 0, 180, 25, 155, 55, 125, 90];

export function hitTestWord(p: Point, targets: WordTarget[]): string | null {
  let best: { id: string; d: number } | null = null;
  for (const t of targets) {
    const onLabel =
      Math.abs(p.x - t.labelX) <= t.halfW + LABEL_HIT_PAD &&
      Math.abs(p.y - t.labelY) <= t.halfH + LABEL_HIT_PAD;
    const onDot = Math.hypot(p.x - t.dotX, p.y - t.dotY) <= DOT_HIT_RADIUS;
    if (!onLabel && !onDot) continue;
    const d = Math.min(Math.hypot(p.x - t.labelX, p.y - t.labelY), Math.hypot(p.x - t.dotX, p.y - t.dotY));
    if (!best || d < best.d) best = { id: t.id, d };
  }
  return best?.id ?? null;
}

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function placeTethered(
  star: Point,
  size: { w: number; h: number },
  obstacles: Obstacle[],
  bounds: Box,
  standoff = TIP_STANDOFF,
): Box {
  let best: { score: number; box: Box } | null = null;
  ANGLES.forEach((deg, i) => {
    const r = (deg * Math.PI) / 180;
    const dx = Math.cos(r);
    const dy = Math.sin(r);
    // The card's near edge sits `standoff` from the star along this ray.
    const cx = star.x + dx * standoff + dx * size.w / 2;
    const cy = star.y + dy * standoff + dy * size.h / 2;
    const box = { x: cx - size.w / 2, y: cy - size.h / 2, w: size.w, h: size.h };
    let score = i * 0.5;
    const left = bounds.x + EDGE_MARGIN - box.x;
    const right = box.x + box.w - (bounds.x + bounds.w - EDGE_MARGIN);
    const top = bounds.y + EDGE_MARGIN - box.y;
    const bottom = box.y + box.h - (bounds.y + bounds.h - EDGE_MARGIN);
    score += OVERFLOW_WEIGHT * (Math.max(0, left) + Math.max(0, right) + Math.max(0, top) + Math.max(0, bottom));
    for (const o of obstacles) if (overlap(box, o)) score += o.weight;
    if (!best || score < best.score) best = { score, box };
  });
  return best!.box;
}

export function placeBand(star: Point, height: number, bounds: Box): Box {
  const w = bounds.w - 2 * BAND_GUTTER;
  const x = bounds.x + BAND_GUTTER;
  const topY = bounds.y + BAND_GUTTER;
  const starUnderTop = star.y < topY + height + BAND_CLEARANCE;
  const y = starUnderTop ? bounds.y + bounds.h - BAND_GUTTER - height : topY;
  return { x, y, w, h: height };
}

export function tetherEnd(star: Point, box: Box, layout: TipLayout): Point {
  if (layout === 'band') {
    const x = Math.max(box.x + BAND_TETHER_INSET, Math.min(box.x + box.w - BAND_TETHER_INSET, star.x));
    const y = box.y > star.y ? box.y : box.y + box.h;
    return { x, y };
  }
  // Where the ray from the card's centre to the star leaves the card.
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const dx = star.x - cx;
  const dy = star.y - cy;
  const kx = Math.abs(dx) > 1e-6 ? box.w / 2 / Math.abs(dx) : Infinity;
  const ky = Math.abs(dy) > 1e-6 ? box.h / 2 / Math.abs(dy) : Infinity;
  const k = Math.min(kx, ky, 1);
  return { x: cx + dx * k, y: cy + dy * k };
}

// "calm · pleasant · mild": the word's region and intensity, from its
// coordinate (x arousal, y valence) and radius (radial-intensity: radius is
// intensity).
export function describeWordRegion(x: number, y: number): string {
  const arousal = x < -0.15 ? 'calm' : x > 0.15 ? 'activated' : 'steady';
  const valence = y > 0.15 ? 'pleasant' : y < -0.15 ? 'unpleasant' : 'neutral';
  const r = Math.hypot(x, y);
  const intensity = r < 0.45 ? 'mild' : r < 0.75 ? 'moderate' : 'intense';
  return `${arousal} · ${valence} · ${intensity}`;
}

export function nearestWordId(
  c: Point,
  words: Array<{ id: string; x: number; y: number }>,
  radius: number,
): string | null {
  let best: { id: string; d: number } | null = null;
  for (const w of words) {
    const d = Math.hypot(w.x - c.x, w.y - c.y);
    if (d <= radius && (!best || d < best.d)) best = { id: w.id, d };
  }
  return best?.id ?? null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm run check:tooltip`
Expected: `OK — 0 failure(s).` If `open sky: standoff about 95px` fails, check the `cx`/`cy` lines first.

- [ ] **Step 5: Commit**

```bash
git add src/components/EmotionField/definitionPlacement.ts scripts/test-definition-tooltip.ts
git commit -m "feat(field): definition tooltip placement and hit-testing"
```

---

### Task 5: The hook and its context

**Files:**
- Create: `src/hooks/useDefinitionTooltip.ts`

**Interfaces:**
- Consumes: `stepDefinition`, `INITIAL_DEFINITION_STATE`, `DefinitionEvent` (Task 3); `TipLayout` (Task 4).
- Produces:

```ts
export interface DefinitionTooltipApi {
  enabled: boolean;               // false outside the provider: callers no-op
  layout: TipLayout;
  openId: string | null;          // the word whose tooltip shows
  litId: string | null;           // the card word under the pointer, lit at once (R5)
  hover(id: string | null, source: 'field' | 'card'): void;
  press(): void;
  release(restId: string | null): void;
  tap(id: string): void;
}
export const DefinitionTooltipContext: React.Context<DefinitionTooltipApi>;
export function useDefinitionTooltip(layout: TipLayout): DefinitionTooltipApi;
export function useDefinitionTooltipApi(): DefinitionTooltipApi; // useContext
```

No check script: the hook is a thin runner over the tested state machine. Verification is the type-check here and the live checks in Task 10.

- [ ] **Step 1: Implement**

```ts
// src/hooks/useDefinitionTooltip.ts
// Runs the definition tooltip's timing (definitionTiming.ts) with a single
// timer, and shares it: App owns one instance, passes it to the field as
// props and to the card through DefinitionTooltipContext.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_DEFINITION_STATE,
  stepDefinition,
  type DefinitionEvent,
  type DefinitionState,
} from '../components/EmotionField/definitionTiming';
import type { TipLayout } from '../components/EmotionField/definitionPlacement';

export interface DefinitionTooltipApi {
  enabled: boolean;
  layout: TipLayout;
  openId: string | null;
  litId: string | null;
  hover(id: string | null, source: 'field' | 'card'): void;
  press(): void;
  release(restId: string | null): void;
  tap(id: string): void;
}

const noop = () => {};
export const DefinitionTooltipContext = createContext<DefinitionTooltipApi>({
  enabled: false,
  layout: 'tethered',
  openId: null,
  litId: null,
  hover: noop,
  press: noop,
  release: noop,
  tap: noop,
});

export function useDefinitionTooltipApi(): DefinitionTooltipApi {
  return useContext(DefinitionTooltipContext);
}

export function useDefinitionTooltip(layout: TipLayout): DefinitionTooltipApi {
  // The machine's state lives in a ref so events can be stepped synchronously
  // from event handlers and timers; the state copy only drives renders.
  const stateRef = useRef<DefinitionState>(INITIAL_DEFINITION_STATE);
  const [state, setState] = useState<DefinitionState>(INITIAL_DEFINITION_STATE);
  const [litId, setLitId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const dispatch = useCallback((event: DefinitionEvent) => {
    const { state: next, timer } = stepDefinition(stateRef.current, event);
    if (timer !== null) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      if (timer !== 'clear') {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          dispatch({ type: 'timer' });
        }, timer.set);
      }
    }
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const hover = useCallback((id: string | null, source: 'field' | 'card') => {
    if (source === 'card') setLitId(id);
    dispatch({ type: 'hover', id });
  }, [dispatch]);
  const press = useCallback(() => {
    setLitId(null);
    dispatch({ type: 'press' });
  }, [dispatch]);
  const release = useCallback((restId: string | null) => dispatch({ type: 'release', restId }), [dispatch]);
  const tap = useCallback((id: string) => dispatch({ type: 'tap', id }), [dispatch]);

  const openId = state.phase === 'open' || state.phase === 'grace' ? state.openId : null;
  return useMemo(
    () => ({ enabled: true, layout, openId, litId, hover, press, release, tap }),
    [layout, openId, litId, hover, press, release, tap],
  );
}
```

`dispatch` refers to itself inside the timer callback. That is fine: `useCallback(..., [])` returns the same function forever, and the closure reads it after the declaration has run.

- [ ] **Step 2: Type-check and lint**

Run: `pnpm exec tsc -b && pnpm exec eslint src/hooks/useDefinitionTooltip.ts`
Expected: no errors. (Repo-wide `pnpm run lint` has 3 known errors on main in `useFieldGesture.ts`/`useGesturePin.ts`; they are not yours.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDefinitionTooltip.ts
git commit -m "feat(field): definition tooltip hook and context"
```

---

### Task 6: `DefinitionTip` component

**Files:**
- Create: `src/components/EmotionField/DefinitionTip.tsx`

**Interfaces:**
- Consumes: `placeTethered`, `placeBand`, `tetherEnd`, `describeWordRegion`, `TIP_WIDTH`, `BAND_GUTTER`, `Box`, `Obstacle`, `Point`, `TipLayout` (Task 4); `definitionFor` (Task 1); `FIELD_FONT` from `./EmotionWord`.
- Produces: `export const DEFINITION_TIP_ID = 'definition-tip'`; `export function DefinitionTip(props: { emotion: Emotion; star: Point; layout: TipLayout; obstacles: Obstacle[]; bounds: Box })`. It must be rendered as the direct child of an `AnimatePresence` with a **constant key**, so switching words slides instead of remounting, and a fresh open draws again.

Motion (R16/R17):
- Open: tether `pathLength` 0→1 over 0.22s ease-out; then the card fades in with a 6px lift and 0.97→1 scale over 0.26s, delayed 0.22s.
- Switch (new `emotion.id`): the card position springs (stiffness 400, damping 40, ζ = 1) and the tether end follows it every frame; the text fades in from 0.15 over 0.16s. Position changes with the same word (camera frames, measured-height changes) jump without a spring, so the card never lags the camera.
- Close (unmount under `AnimatePresence`): card fades out over 0.11s, then the tether retracts over 0.13s.
- Reduced motion: no draw, lift, scale or slide; card and tether fade in and out over 0.12s.

- [ ] **Step 1: Implement**

```tsx
// src/components/EmotionField/DefinitionTip.tsx
// The definition tooltip: a small card a standoff away from its star, joined
// to it by a hairline that runs bone at the star to gold at the card
// (docs/brainstorms/2026-09-30-word-definition-tooltips-requirements.md,
// R3/R13–R18). Mounted under AnimatePresence with a constant key by
// EmotionField: switching words re-targets this one instance.
import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useAnimationFrame, useReducedMotion, useSpring } from 'framer-motion';
import type { Emotion } from '../../data/emotions';
import { definitionFor } from '../../data/descriptions';
import { FIELD_FONT } from './EmotionWord';
import {
  BAND_GUTTER,
  TIP_WIDTH,
  describeWordRegion,
  placeBand,
  placeTethered,
  tetherEnd,
  type Box,
  type Obstacle,
  type Point,
  type TipLayout,
} from './definitionPlacement';

export const DEFINITION_TIP_ID = 'definition-tip';

const DRAW_S = 0.22;
const FADE_IN_S = 0.26;
const FADE_OUT_S = 0.11;
const RETRACT_S = 0.13;
const REDUCED_FADE_S = 0.12;
const TEXT_SWAP_S = 0.16;
const LIFT_PX = 6;
// stiffness 400, damping 40: ζ = 40 / (2·√400) = 1, critically damped.
const SLIDE = { stiffness: 400, damping: 40 };
// The tether starts this far out from the star so it never sits on the dot.
const STAR_INSET = 6;
// Height used until the card has been measured (its first frame is invisible).
const ESTIMATED_HEIGHT = 96;

interface Props {
  emotion: Emotion;
  star: Point;
  layout: TipLayout;
  obstacles: Obstacle[];
  bounds: Box;
}

export function DefinitionTip({ emotion, star, layout, obstacles, bounds }: Props) {
  const reduce = !!useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const [height, setHeight] = useState(ESTIMATED_HEIGHT);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    // observe() fires once at once, which supplies the first measurement.
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = layout === 'band' ? bounds.w - 2 * BAND_GUTTER : TIP_WIDTH;
  const box = layout === 'band'
    ? placeBand(star, height, bounds)
    : placeTethered(star, { w: width, h: height }, obstacles, bounds);

  const bx = useSpring(box.x, SLIDE);
  const by = useSpring(box.y, SLIDE);
  // Only a new word slides; camera frames and re-measures jump, so the card
  // never trails the sky.
  const lastIdRef = useRef(emotion.id);
  useLayoutEffect(() => {
    const switched = lastIdRef.current !== emotion.id;
    lastIdRef.current = emotion.id;
    if (switched && !reduce) {
      bx.set(box.x);
      by.set(box.y);
    } else {
      bx.jump(box.x);
      by.jump(box.y);
    }
  }, [emotion.id, box.x, box.y, reduce, bx, by]);

  // The tether follows the card's live (springing) position every frame.
  const liveRef = useRef({ star, w: width, h: height });
  useLayoutEffect(() => {
    liveRef.current = { star, w: width, h: height };
  });
  useAnimationFrame(() => {
    const line = lineRef.current;
    const grad = gradRef.current;
    if (!line || !grad) return;
    const { star: s, w, h } = liveRef.current;
    const end = tetherEnd(s, { x: bx.get(), y: by.get(), w, h }, layout);
    const len = Math.hypot(end.x - s.x, end.y - s.y) || 1;
    const sx = s.x + ((end.x - s.x) / len) * STAR_INSET;
    const sy = s.y + ((end.y - s.y) / len) * STAR_INSET;
    for (const el of [line, grad]) {
      el.setAttribute('x1', String(sx));
      el.setAttribute('y1', String(sy));
      el.setAttribute('x2', String(end.x));
      el.setAttribute('y2', String(end.y));
    }
  });

  const definition = definitionFor(emotion.id);

  return (
    <>
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 19 }}
      >
        <defs>
          <linearGradient ref={gradRef} id="definition-tether" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: 'rgb(var(--ui-text-rgb))', stopOpacity: 0.12 }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--ui-gold-rgb))', stopOpacity: 0.75 }} />
          </linearGradient>
        </defs>
        <motion.line
          ref={lineRef}
          stroke="url(#definition-tether)"
          strokeWidth={1}
          strokeLinecap="round"
          initial={reduce ? { opacity: 0, pathLength: 1 } : { pathLength: 0 }}
          animate={reduce
            ? { opacity: 1, pathLength: 1, transition: { duration: REDUCED_FADE_S } }
            : { pathLength: 1, transition: { duration: DRAW_S, ease: 'easeOut' } }}
          exit={reduce
            ? { opacity: 0, transition: { duration: REDUCED_FADE_S } }
            : { pathLength: 0, transition: { duration: RETRACT_S, delay: FADE_OUT_S, ease: 'easeIn' } }}
        />
      </svg>
      <motion.div
        style={{ position: 'absolute', left: 0, top: 0, x: bx, y: by, width, zIndex: 20, pointerEvents: 'none' }}
      >
        <motion.div
          ref={cardRef}
          id={DEFINITION_TIP_ID}
          role="tooltip"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: LIFT_PX, scale: 0.97 }}
          animate={reduce
            ? { opacity: 1, transition: { duration: REDUCED_FADE_S } }
            : { opacity: 1, y: 0, scale: 1, transition: { delay: DRAW_S, duration: FADE_IN_S, ease: 'easeOut' } }}
          exit={{ opacity: 0, transition: { duration: reduce ? REDUCED_FADE_S : FADE_OUT_S } }}
          style={{
            boxSizing: 'border-box',
            padding: '12px 14px 13px',
            borderRadius: 10,
            background: 'rgb(var(--ui-surface-rgb) / 0.88)',
            border: '1px solid var(--ui-border)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 10px 30px -12px rgb(var(--ui-bg-rgb) / 0.8)',
          }}
        >
          <motion.div
            key={emotion.id}
            initial={{ opacity: reduce ? 1 : 0.15 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : TEXT_SWAP_S }}
          >
            <div style={{ fontFamily: FIELD_FONT, fontSize: 17, lineHeight: 1.2, color: 'var(--ui-gold-hi)' }}>
              {emotion.label}
            </div>
            <div style={{ marginTop: 3, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ui-text-3)' }}>
              {describeWordRegion(emotion.x, emotion.y)}
            </div>
            <div style={{ marginTop: 7, fontSize: 13, lineHeight: 1.5, color: 'rgb(var(--ui-text-rgb) / 0.86)' }}>
              {definition}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </>
  );
}
```

- [ ] **Step 2: Type-check, lint, theme check**

Run: `pnpm exec tsc -b && pnpm exec eslint src/components/EmotionField/DefinitionTip.tsx && pnpm run check:theme`
Expected: no errors; `check:theme` passes (no hex literals). If eslint's `react-hooks/refs` objects to anything, keep every ref write inside effects or the frame callback, as written here.

- [ ] **Step 3: Commit**

```bash
git add src/components/EmotionField/DefinitionTip.tsx
git commit -m "feat(field): DefinitionTip card and tether"
```

---

### Task 7: Field wiring

**Files:**
- Modify: `src/components/EmotionField/EmotionField.tsx`

**Interfaces:**
- Consumes: `hitTestWord`, `nearestWordId`, `LABEL_OBSTACLE_WEIGHT`, `MARK_OBSTACLE_WEIGHT`, `WordTarget`, `Obstacle`, `Box`, `TipLayout` (Task 4); `DefinitionTip` (Task 6); `definitionFor` (Task 1).
- Produces: new optional `EmotionField` props:

```ts
  // The word whose definition tooltip is open, and the layout it uses
  // (word-definition-tooltips). App's useDefinitionTooltip owns this state.
  definitionOpenId?: string | null;
  definitionLayout?: TipLayout;
  // The pointer is over this word (or none): field-side hover (R4).
  onDefinitionHover?: (id: string | null) => void;
  // A field press began (R9).
  onDefinitionPress?: () => void;
  // A field press ended. restId is the word nearest the resting pin in the
  // band layout (R10), else null.
  onDefinitionRelease?: (restId: string | null) => void;
```

- [ ] **Step 1: Imports and props**

Add imports:

```ts
import { DefinitionTip } from './DefinitionTip';
import {
  hitTestWord,
  nearestWordId,
  LABEL_OBSTACLE_WEIGHT,
  MARK_OBSTACLE_WEIGHT,
  type Box,
  type Obstacle,
  type TipLayout,
  type WordTarget,
} from './definitionPlacement';
import { definitionFor } from '../../data/descriptions';
```

Add the five props above to `interface Props` (after `skyIntro`), and to the destructuring with defaults:

```ts
  definitionOpenId = null,
  definitionLayout = 'tethered',
  onDefinitionHover,
  onDefinitionPress,
  onDefinitionRelease,
```

- [ ] **Step 2: Report the resting pin's nearest word on release**

In `handleRelease`, as its first statement (before the `findNearbyPinPx` lookup), add:

```ts
    // Band layout (phone tray): the word nearest where the pin comes to rest
    // gets its definition after the delay (R10). The nearest word in reach is
    // always revealed: surface words always show, and a pin reveals its
    // nearest deep words.
    onDefinitionRelease?.(
      definitionLayout === 'band' ? nearestWordId(center, emotions, VISIBILITY_RADIUS) : null,
    );
```

and add `onDefinitionRelease, definitionLayout` to its dependency array.

- [ ] **Step 3: Hit-test targets**

After the `wordTethers` memo, add:

```ts
  // Every word as it draws right now, for the hover hit-test and as obstacles
  // for the definition tooltip. Words are pointerEvents: none — the field is
  // the only pointer target — so hover is found in px here.
  const wordTargets = useMemo<WordTarget[]>(() => {
    if (size.width === 0) return [];
    const out: WordTarget[] = [];
    const add = (e: (typeof emotions)[number], o: { dx: number; dy: number }) => {
      const p = proj.toPx(e);
      if (!p.visible) return;
      out.push({
        id: e.id,
        dotX: p.x,
        dotY: p.y,
        labelX: p.x + o.dx,
        labelY: p.y - LABEL_STANDOFF + o.dy,
        halfW: labelHalfWidth(e.label, e.depth),
        halfH: LABEL_LINE_H / 2,
      });
    };
    for (const e of surfaceEmotions) add(e, { dx: 0, dy: 0 });
    for (const e of revealedDeep) add(e, deepLabelOffsets.get(e.id) ?? { dx: 0, dy: 0 });
    return out;
  }, [size.width, proj, revealedDeep, deepLabelOffsets]);

  // Pointer position in layout px (the space proj works in), corrected for a
  // CSS transform on the field or an ancestor, as toCoord does above.
  const layoutPx = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (size.width / rect.width),
      y: (e.clientY - rect.top) * (size.height / rect.height),
    };
  };

  // The open definition: its word, where its star draws, what it should not
  // cover, and the area it may use (the band above the tray on phones).
  const definitionEmotion = definitionOpenId && definitionFor(definitionOpenId)
    ? emotions.find((e) => e.id === definitionOpenId) ?? null
    : null;
  const definitionStar = definitionEmotion ? proj.toPx(definitionEmotion) : null;
  const definitionObstacles = useMemo<Obstacle[]>(() => {
    const out: Obstacle[] = wordTargets
      .filter((t) => t.id !== definitionOpenId)
      .map((t) => ({ x: t.labelX - t.halfW, y: t.labelY - t.halfH, w: t.halfW * 2, h: t.halfH * 2, weight: LABEL_OBSTACLE_WEIGHT }));
    for (const p of pins) {
      const at = proj.toPx(p);
      if (at.visible) out.push({ x: at.x - 10, y: at.y - 10, w: 20, h: 20, weight: MARK_OBSTACLE_WEIGHT });
    }
    if (anchorMark) {
      const r = anchorMark.ringSize / 2 + 4;
      out.push({ x: anchorMark.x - r, y: anchorMark.y - r, w: r * 2, h: r * 2, weight: MARK_OBSTACLE_WEIGHT });
    }
    return out;
  }, [wordTargets, definitionOpenId, pins, proj, anchorMark]);
  const definitionBounds: Box = {
    x: 0,
    y: 0,
    w: size.width,
    h: definitionLayout === 'band' && skyOccluderTop !== null ? Math.min(size.height, skyOccluderTop) : size.height,
  };
```

- [ ] **Step 4: Wrap the container's pointer handlers**

Replace the five handler props on the container div:

```tsx
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={(e) => {
        handlers.onPointerLeave(e);
        if (e.pointerType !== 'touch') onDefinitionHover?.(null);
      }}
      onPointerDown={(e) => {
        onDefinitionPress?.();
        handlers.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        handlers.onPointerMove(e);
        // Hover only: a mouse or pen with no button down. Touch never hovers.
        if (e.pointerType !== 'touch' && e.buttons === 0) {
          onDefinitionHover?.(hitTestWord(layoutPx(e), wordTargets));
        }
      }}
      onPointerUp={handlers.onPointerUp}
      onPointerCancel={() => {
        handlers.onPointerCancel();
        onDefinitionRelease?.(null);
      }}
```

`onPointerUp` stays as is: `useFieldGesture` calls `handleRelease`, which reports the release (Step 2). `handlers.onPointerCancel` takes no argument.

- [ ] **Step 5: Render the tooltip**

Inside the `size.width > 0 && (<> … </>)` block, after the pins map (as the last child, so it draws above words and pins), add:

```tsx
          {/* The definition tooltip (word-definition-tooltips). One constant
              key: a new word re-targets the same card; a fresh open draws the
              tether again. */}
          <AnimatePresence>
            {definitionEmotion && definitionStar?.visible && (
              <DefinitionTip
                key="definition-tip"
                emotion={definitionEmotion}
                star={{ x: definitionStar.x, y: definitionStar.y }}
                layout={definitionLayout}
                obstacles={definitionObstacles}
                bounds={definitionBounds}
              />
            )}
          </AnimatePresence>
```

- [ ] **Step 6: Type-check and run every check**

Run: `pnpm exec tsc -b && pnpm run check:tooltip && pnpm run check:gesture && pnpm run check:sky`
Expected: no type errors; all checks OK. Nothing opens yet: App doesn't pass the props until Task 8.

- [ ] **Step 7: Commit**

```bash
git add src/components/EmotionField/EmotionField.tsx
git commit -m "feat(field): hover hit-test and definition tooltip render"
```

---

### Task 8: App wiring

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useDefinitionTooltip`, `DefinitionTooltipContext` (Task 5); the new `EmotionField` props (Task 7); `nearestWordId` (Task 4); `VISIBILITY_RADIUS` from `src/hooks/useProximity`.

- [ ] **Step 1: Own the hook**

Add imports:

```ts
import { DefinitionTooltipContext, useDefinitionTooltip } from './hooks/useDefinitionTooltip';
import { nearestWordId } from './components/EmotionField/definitionPlacement';
import { VISIBILITY_RADIUS } from './hooks/useProximity';
```

(If `VISIBILITY_RADIUS` or `emotions` is already imported in `App.tsx`, reuse that import.)

Right after `const sideBySide = useSidePanelLayout();` (line ~154):

```ts
  // The field's definition tooltip (word-definition-tooltips): tethered
  // beside its star on the desktop rail layout, in a band above the tray on
  // phones.
  const definition = useDefinitionTooltip(sideBySide ? 'tethered' : 'band');
```

- [ ] **Step 2: Light and reveal the word under discussion**

After the `highlightedIds` memo (line ~443), add:

```ts
  // A card word under the pointer lights its star at once and, if it is a
  // hidden deep word, reveals it (R5); the open word stays lit and revealed
  // so its tooltip always has a star to point at. Both ride highlightedIds,
  // which already lights and reveals.
  const fieldHighlightedIds = useMemo(() => {
    const extra = [definition.litId, definition.openId].filter((id): id is string => !!id && !highlightedIds.has(id));
    return extra.length ? new Set([...highlightedIds, ...extra]) : highlightedIds;
  }, [highlightedIds, definition.litId, definition.openId]);
```

- [ ] **Step 3: Slider and departure drags press and release**

In `handleAdjustDraft`, before `setAdjustDraft(coord);`:

```ts
    // A slider drag closes the definition and holds it off until release (R9).
    if (coord !== null) definition.press();
    else definition.release(null);
```

In `handleAdjustPin`, after `setAdjustDraft(null);`:

```ts
    // Phone tray: the word nearest where the pin came to rest gets its
    // definition after the delay (R10).
    definition.release(sideBySide ? null : nearestWordId({ x, y }, emotions, VISIBILITY_RADIUS));
```

Add `definition` and `sideBySide` to both callbacks' dependency arrays (`definition.press`/`definition.release` are stable; depending on them is enough if you prefer). `release(null)` before `release(restId)` is safe in either order; see the state machine's tests.

Wrap the departure drag where `EmotionDrawer` receives `onDepartureDrag={setDepartureDraftCoord}` (define the handler below the `departureDraftCoord` state, line ~222):

```tsx
                onDepartureDrag={handleDepartureDrag}
```

with, near the other handlers:

```ts
  const handleDepartureDrag = useCallback((coord: { x: number; y: number } | null) => {
    if (coord !== null) definition.press();
    else definition.release(null);
    setDepartureDraftCoord(coord);
  }, [definition]);
```

- [ ] **Step 4: Pass the props to the field**

On `<EmotionField …>` change `highlightedIds={highlightedIds}` to `highlightedIds={fieldHighlightedIds}` and add:

```tsx
          definitionOpenId={view === 'field' ? definition.openId : null}
          definitionLayout={definition.layout}
          onDefinitionHover={(id) => definition.hover(id, 'field')}
          onDefinitionPress={definition.press}
          onDefinitionRelease={definition.release}
```

- [ ] **Step 5: Provide the context to the card**

Wrap the field-only chrome block (`{view === 'field' && ( <> … </> )}`, the one containing `<EmotionDrawer>`) in the provider:

```tsx
      <DefinitionTooltipContext.Provider value={definition}>
        {view === 'field' && (
          …unchanged…
        )}
      </DefinitionTooltipContext.Provider>
```

- [ ] **Step 6: Type-check, build, run the checks**

Run: `pnpm exec tsc -b && pnpm run build && pnpm run check:tooltip && pnpm run check:checkin`
Expected: clean build; checks OK.

- [ ] **Step 7: Quick live smoke (desktop)**

Start the dev server with the `preview_start` tool (`.claude/launch.json`; point `--prefix` at `.claude/worktrees/word-definitions`, never `../`). Open `/emotions-wheel/`, plant a pin, rest the cursor on a visible surface word for half a second. Expected: the tether draws from its star, then the card fades in above it. Press the field: it closes.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire the definition tooltip to field and drags"
```

---

### Task 9: Card words

**Files:**
- Modify: `src/components/EmotionPreview/WordTag.tsx`
- Modify: `src/components/EmotionPreview/CoordinateCard.tsx`

**Interfaces:**
- Consumes: `useDefinitionTooltipApi` (Task 5); `DEFINITION_TIP_ID` (Task 6).
- Produces: `WordTag` gains three optional props, `onHoverChange?: (hovering: boolean) => void`, `describedBy?: string`, `dismissLabel?: string` (default `'Dismiss'`). Existing callers (history, saved card, landing) are unaffected.

Behaviour (R5, R11, R19):
- Desktop (`layout === 'tethered'`): pointer enter or keyboard focus on any draft-card word (both guesses, nearby tags, "your words") calls `hover(id, 'card')`; leave or blur calls `hover(null, 'card')`. Taps keep today's toggle behaviour.
- Tray (`layout === 'band'`): tapping an untagged guess or tag tags it **and** opens its definition (`tap`). Tapping an already tagged word opens its definition instead of untagging. The "your words" chips get a × (`dismissLabel="Remove"`) that untags.
- Any card word whose definition is open carries `aria-describedby="definition-tip"`.
- Read-only cards (previous check-in) get none of this.

- [ ] **Step 1: `WordTag` props**

Add to `Props`:

```ts
  // Definition tooltip wiring (word-definition-tooltips R5/R19). Only the
  // draft card passes these. Pointer enter/leave (never touch) and keyboard
  // focus/blur report hovering.
  onHoverChange?: (hovering: boolean) => void;
  // Points assistive tech at the open definition tooltip.
  describedBy?: string;
  // The × button's accessible verb ("Dismiss" a suggestion, "Remove" a tag).
  dismissLabel?: string;
```

Destructure them (`dismissLabel = 'Dismiss'`). On the outer `<span ref={root} …>` add:

```tsx
      onPointerEnter={onHoverChange ? (e) => { if (e.pointerType !== 'touch') onHoverChange(true); } : undefined}
      onPointerLeave={onHoverChange ? (e) => { if (e.pointerType !== 'touch') onHoverChange(false); } : undefined}
```

On the toggle `<button>` add:

```tsx
          aria-describedby={describedBy}
          onFocus={onHoverChange ? () => onHoverChange(true) : undefined}
          onBlur={onHoverChange ? () => onHoverChange(false) : undefined}
```

and change the dismiss button's label to `aria-label={`${dismissLabel} ${text}`}`.

- [ ] **Step 2: `CoordinateCard` wiring**

Imports:

```ts
import { useDefinitionTooltipApi } from '../../hooks/useDefinitionTooltip';
import { DEFINITION_TIP_ID } from '../EmotionField/DefinitionTip';
```

Inside the component, near `toggleName`:

```ts
  // The field's definition tooltip (word-definition-tooltips). Read-only
  // cards stay out of it.
  const definition = useDefinitionTooltipApi();
  const defines = definition.enabled && !readOnly;
  const isBand = definition.layout === 'band';
  const describedBy = (id: string) => (defines && definition.openId === id ? DEFINITION_TIP_ID : undefined);
  const hoverChange = (id: string) => (defines ? (on: boolean) => definition.hover(on ? id : null, 'card') : undefined);
```

Replace `toggleName`:

```ts
  // Desktop: tap names or un-names, as before. Phone tray: tap names the word
  // and opens its definition; a word already named opens its definition and
  // is removed with its × instead (R11).
  const toggleName = (id: string) => {
    if (defines && isBand) {
      if (!recognizedSet.has(id)) onRecognize(id);
      definition.tap(id);
      return;
    }
    if (recognizedSet.has(id)) onDerecognize(id);
    else onRecognize(id);
  };
```

In `renderGuess`, add to the `<button>`:

```tsx
        aria-describedby={describedBy(e.id)}
        onPointerEnter={(ev) => { if (ev.pointerType !== 'touch') hoverChange(e.id)?.(true); }}
        onPointerLeave={(ev) => { if (ev.pointerType !== 'touch') hoverChange(e.id)?.(false); }}
        onFocus={() => hoverChange(e.id)?.(true)}
        onBlur={() => hoverChange(e.id)?.(false)}
```

`renderTag` becomes:

```tsx
  const renderTag = (e: NearbyEmotion) => (
    <WordTag
      key={e.id}
      label={e.label}
      named={recognizedSet.has(e.id)}
      onToggle={() => toggleName(e.id)}
      onHoverChange={hoverChange(e.id)}
      describedBy={describedBy(e.id)}
    />
  );
```

The "your words" list becomes:

```tsx
            {pin.recognizedWords.map((id) => (
              <WordTag
                key={id}
                label={labelForId(id)}
                named
                onToggle={defines && isBand ? () => definition.tap(id) : () => onDerecognize(id)}
                onDismiss={defines && isBand ? () => onDerecognize(id) : undefined}
                dismissLabel="Remove"
                onHoverChange={hoverChange(id)}
                describedBy={describedBy(id)}
              />
            ))}
```

- [ ] **Step 3: Type-check, lint, theme**

Run: `pnpm exec tsc -b && pnpm exec eslint src/components/EmotionPreview/WordTag.tsx src/components/EmotionPreview/CoordinateCard.tsx && pnpm run check:theme`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/EmotionPreview/WordTag.tsx src/components/EmotionPreview/CoordinateCard.tsx
git commit -m "feat(card): card words drive the definition tooltip"
```

---

### Task 10: Live verification and docs

**Files:**
- Modify: `AGENTS.md` (check table), `CLAUDE.md` ("What ships today")

- [ ] **Step 1: Desktop, flat field** (browser pane, default viewport ≥ 900px wide). Verify each, reading state with `read_page` or screenshots:
  1. AE1: sweep the cursor quickly across all seven card words. No tooltip.
  2. AE2: rest on a field word 0.5s → tether draws, then card. Move straight to a neighbour → switches without waiting, card slides.
  3. AE3: move to empty sky → closes after ~0.3s; resting on another word waits 0.5s again.
  4. AE4: hover a card word that is a hidden deep word → its star appears and lights at once; the tooltip follows after 0.5s.
  5. AE5: with a tooltip open, press the field → it closes; drag a slider → nothing opens during the drag.
  6. Keyboard: Tab to a card word → after 0.5s the tooltip opens; the button has `aria-describedby="definition-tip"` (check with `read_page`).
  7. The tooltip never covers the pin or the previous-check-in ring, and stays inside the field near the edges.
  8. Console: no errors (`read_console_messages`).

- [ ] **Step 2: Desktop, night sky** (`?field=sky`). Repeat AE2 and AE5. While the camera glides after planting a pin, an open tooltip and its tether stay on their star with no lag.

- [ ] **Step 3: Phone** (`resize_window` preset `mobile`, reload). AE6: drag the arousal slider and release near a word → after 0.5s its tooltip appears at the top of the visible field with the tether down to the star; when the star is near the top, the card sits at the bottom of the band, above the tray. Tap a nearby tag → it is tagged and its definition opens at once. Tap it again in "your words" → definition shows, the tag stays; its × removes it. Press the field → the tooltip closes. Reset with preset `desktop` afterwards.

- [ ] **Step 4: Reduced motion.** The browser pane can't emulate it, so use Playwright (installed): a scratchpad script that launches Chromium with `browser.newContext({ reducedMotion: 'reduce' })`, opens the dev server URL, hovers a word for 600ms and screenshots at +50ms and +200ms. Expected: tooltip and tether only fade; no partial tether draw, no lift.

- [ ] **Step 5: Docs.** In `AGENTS.md`'s check table add:

```markdown
| `npm run check:definitions` | every word in the active vocabulary has a definition (`src/data/descriptions.ts`) |
| `npm run check:tooltip` | definition tooltip: timing (delay, hand-off, grace, press, pin rest, tap) and placement/hit-test geometry (`src/components/EmotionField/definitionTiming.ts`, `definitionPlacement.ts`) |
```

In `CLAUDE.md` "What ships today", add a line:

```markdown
- Word definitions on the field: rest on a star or a card word for 500ms and its definition draws out on a tether (`DefinitionTip`, `useDefinitionTooltip`); on phones it sits above the tray and opens when the pin rests or a tray word is tapped. Every active word has a definition (`check:definitions`).
```

and remove the statement that definitions only appear in admin, if present.

- [ ] **Step 6: Full checks**

Run: `pnpm run build && for c in definitions tooltip theme gesture sky pin checkin; do pnpm run check:$c || exit 1; done`
Expected: clean build; every check OK.

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "docs: definition tooltip checks and shipped feature"
```

---

## Spec coverage

| Requirement | Task |
|---|---|
| R1 definitions for every word | 2 |
| R2 coverage check | 1 |
| R3 label, meta line, definition | 4 (`describeWordRegion`), 6 |
| R4 field hover 500ms | 3, 7 |
| R5 card hover/focus, instant light, reveal | 5 (`litId`), 8 (`fieldHighlightedIds`), 9 |
| R6 pass-through opens nothing | 3 |
| R7 instant hand-off | 3, 6 (slide) |
| R8 300ms grace | 3 |
| R9 presses suppress | 3, 7, 8 |
| R10 pin rest (tray) | 3, 7 (field press), 8 (slider) |
| R11 tray taps | 3 (`tap`), 9 |
| R12 field press closes (tray) | 3, 7 |
| R13 tethered placement | 4, 7 (obstacles) |
| R14 band placement | 4, 7 (bounds from `skyOccluderTop`) |
| R15 follows projection | 6 (jump on same word), 7 |
| R16 motion | 6 |
| R17 reduced motion | 6 |
| R18 tether look, tokens | 6, `check:theme` |
| R19 accessibility | 9 (`aria-describedby`, focus) |
| AE1–AE7 | 1, 3, 4, 10 |
