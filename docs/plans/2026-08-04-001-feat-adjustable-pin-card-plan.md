---
title: "feat: Adjustable pin — the post-drop check-in card"
type: feat
date: 2026-08-04
origin: docs/brainstorms/2026-08-04-adjustable-pin-card-requirements.md
status: ready-for-work
---

# feat: Adjustable pin — the post-drop check-in card

## Summary

Make the post-pin-drop check-in card (`src/components/EmotionPreview/CoordinateCard.tsx`)
adjustable. The two static axis bars become **draggable sliders on top of the card**
(commit-on-release); the pin's coordinate becomes mutable and its description recomputes on
move; the relational words drop from a *"between X and Y"* verdict to an honest, dismissable
*"Does X or Y fit?"* question with tap-to-name recognition and a slot-only dissolve that
softly re-suggests on release. The original drop is kept as secondary metadata and shown on
the field as an anchor so refining never silently drifts. All dissolve timings are tunable
through the existing admin tuning panel.

Built from the origin brainstorm (see origin:
`docs/brainstorms/2026-08-04-adjustable-pin-card-requirements.md`).

---

## Problem Frame

Today `CoordinateCard` is read-only: it displays the pin's state led by a *"between X and Y"*
line and two **static** axis bars (Calm↔Activated, Negative↔Positive). A test user reached
for those bars to *adjust* — they look like controls but aren't — and the singular relational
verdict invites word-hunting that pulls the user off the position they actually felt. The
brainstorm resolved: make the bars real sliders, keep the drop anchored so adjustment can't
silently drift, and re-voice the words as an optional question that builds vocabulary through
recognition rather than demanding a target.

Key existing-code realities that shape the plan:

- **`PinEntry.regionDescription` is a stored snapshot** (`src/types.ts`), computed once at
  drop time in `handlePinRelease` (`src/App.tsx`). Moving a pin must recompute it via
  `getRegionDescription` (`src/data/regions.ts`) or the caption goes stale.
- **`highlightedIds` already derives live** from `selectedPin.x/y` via `nearestTagIds`
  (`useMemo` in `src/App.tsx`), so the field's lit words and the card's tags recompute for
  free once a pin's coordinates change. The missing piece is a coordinate-update handler.
- **`CoordinateCard` is rendered per-pin inside `EmotionDrawer`** (`src/components/EmotionPreview/EmotionDrawer.tsx`),
  which already threads `onRecognize` / `onDerecognize` / `onRemove` / `onSelect` from `App`.
  A new adjust callback follows the same path.
- **Recognition already exists** as `PinEntry.recognizedWords` + `handleRecognize` /
  `handleDerecognize`; "name a word" reuses it — no new vocabulary persistence.
- **The field already has** a `ghostPin` prop and "axis position indicators" overlay
  (`src/components/EmotionField/EmotionField.tsx`) to reuse for the adjust ghost + anchor.
- **Tuning is a settled pattern**: `RevealTuning` knobs in `src/config/revealTuning.ts`
  (persisted to localStorage, live via `useRevealTuning()`), edited in
  `src/admin/components/AdminRevealTuning.tsx`. Dissolve knobs join it the same way.

---

## Requirements

Traced from the origin document (R# are this plan's labels):

- **R1** — The two axis bars become draggable sliders at the **top** of the card, each with
  an origin tick marking the drop. (U2)
- **R2** — Adjustment is **commit-on-release**: pin + ghost glide live during a drag; the
  card's words hold until release. (U2, U3, U5)
- **R3** — Moving a pin updates its stored coordinate **and recomputes its description**;
  lit words / tags follow. (U1)
- **R4** — The relational line becomes a stable **"Does A or B fit?"** question with the two
  true-nearest words + **5 nearby tags**. (U3)
- **R5** — Tapping a word **names it** (kept via `recognizedWords`); **"none of these"**
  dismisses at zero cost; wordless/edge states fall back gracefully. (U3)
- **R6** — On release, **only the word-slots + tag chips dissolve** and ease back in; the
  question frame holds still; in-place taps are instant. (U3)
- **R7** — Dissolve timing is **tunable via the admin panel** and honors
  `prefers-reduced-motion`. (U4)
- **R8** — The **original drop stays visible** on the field (anchor + travel line) so
  refining never silently drifts; the drop is kept as secondary metadata on the pin. (U1, U5)

Success criteria (from origin):

- A dropped pin can be nudged on both axes from the card; the field pin and its description
  update to match, resolving on release.
- The caption never presents a singular verdict the user must accept; a word is always a
  question that can be waved off, and "none of these" is first-class.
- On release, the scaffolding stays fixed while only words + tags dissolve; timing is
  admin-adjustable and honors reduced-motion.
- Adjusting a pin never loses the sense of where it was first dropped.

---

## Key Technical Decisions

- **KTD1 — Coordinate stays authoritative; drop kept as secondary metadata.** `PinEntry.x/y`
  remains the primary record and is **updated in place** on adjust. Add an **optional**
  `origin?: { x: number; y: number }` to `PinEntry`, captured once at creation and never
  mutated — the "your drop" anchor and an interesting historical datapoint. Optional keeps it
  backward-compatible with existing diary entries and the `DiaryEntry` shape (per Frank: the
  PinEntry coordinate is the important stored value; the original drop is secondary-but-worth-keeping).
- **KTD2 — One `handleAdjustPin(pinId, x, y)` in `App`** (sibling to `handleRecognize`) sets
  the pin's `x/y` and **recomputes `regionDescription`** via `getRegionDescription`. It does
  **not** touch `origin` or `recognizedWords`. `highlightedIds` continues to derive live — no
  change there.
- **KTD3 — Commit-on-release with an ephemeral field draft.** The card holds a local draft
  coordinate while a slider is dragged and calls the adjust callback only on release. A
  separate lightweight `onAdjustDraft(coord | null)` lets `App` hold an ephemeral
  `adjustDraft` used purely for the field ghost/travel overlay (not persisted).
- **KTD4 — Stable question frame, slot-only dissolve.** The `"Does ⟶ or ⟶ fit?"` scaffolding
  is rendered once and held; only the two word-slots and the tag row re-fill and animate on
  commit. In-place actions (name / "none of these") update instantly. This mirrors the
  resolved prototype behavior.
- **KTD5 — Dissolve knobs extend `RevealTuning`.** Add `captionFadeOut`, `captionFadeIn`,
  `captionHold` (seconds) to `RevealTuning` + `DEFAULT_TUNING`; `sanitize()` already accepts
  any numeric key that exists on the default, so persistence needs no extra work. Add a
  "Check-in card" knob section to `AdminRevealTuning`. The card reads them via the `tuning`
  object already available in `App` (`useRevealTuning()`), passed down as props.
- **KTD6 — Reuse `tagCount` for the nearby-tags count** (redefined as "nearby tags shown
  beneath the question," default lowered to **5**); the two guesses are the two nearest from
  the same list. No new knob.
- **KTD7 — Verification without a test runner.** The repo has no unit-test framework; it
  verifies pure logic with standalone `scripts/test-*.ts` node checks (`check:csv`,
  `check:fan`, `check:cues`) wired as npm scripts, plus `tsc -b` / `eslint` /
  `lint:spacing`, and manual browser checks. Pure coordinate/region logic gets a new
  `scripts/test-pin-adjust.ts` (+ `check:pin` script); interaction/animation is verified in
  the browser + typecheck/lint/build.

---

## High-Level Technical Design

Data flow for a slider adjustment (commit-on-release):

```mermaid
sequenceDiagram
    participant U as User
    participant Card as CoordinateCard (sliders)
    participant Drawer as EmotionDrawer
    participant App as App (state)
    participant Field as EmotionField

    U->>Card: drag slider (move)
    Card->>Card: update local draft coord (thumb follows)
    Card->>Drawer: onAdjustDraft(draft)
    Drawer->>App: onAdjustDraft(draft)
    App->>Field: adjustDraft prop (ghost + travel overlay)
    Note over Card: card words HOLD (frozen)
    U->>Card: release
    Card->>Drawer: onAdjust(pinId, x, y)
    Drawer->>App: onAdjust(pinId, x, y)
    App->>App: handleAdjustPin → set x/y + recompute regionDescription
    App->>App: clear adjustDraft; highlightedIds re-derives
    App-->>Card: new pin props
    Card->>Card: slot-only dissolve (fade words+tags → hold → fade in)
    App->>Field: pin marker moves to new x/y; ghost cleared
```

Component ownership:

- **`PinEntry`** (`src/types.ts`) — authoritative `x/y` (mutable) + optional `origin`.
- **`App`** — owns `pins`, the new `handleAdjustPin`, ephemeral `adjustDraft`, and passes
  `tuning` down.
- **`CoordinateCard`** — sliders (local draft), the question caption + slot-only dissolve.
- **`EmotionField`** — renders the pin marker (derives from `pins`), plus the drop anchor,
  travel line, and adjust ghost.

---

## Implementation Units

### U1. Mutable pin coordinate + region recompute (state foundation)

**Goal:** Make a pin's coordinate updatable after drop, recomputing its description, and
capture the original drop as optional secondary metadata. Establish the callback path
`App → EmotionDrawer → CoordinateCard`.

**Requirements:** R3, R8 (data half).

**Dependencies:** none.

**Files:**
- `src/types.ts` — add optional `origin?: { x: number; y: number }` to `PinEntry`.
- `src/App.tsx` — `handleAdjustPin(pinId, x, y)` (recompute `regionDescription` via
  `getRegionDescription`); capture `origin` in `handlePinRelease`; hold ephemeral
  `adjustDraft` state + `handleAdjustDraft`; pass new callbacks to `EmotionDrawer`.
- `src/components/EmotionPreview/EmotionDrawer.tsx` — thread `onAdjust` + `onAdjustDraft`
  props to `CoordinateCard`.
- `scripts/test-pin-adjust.ts` — pure-logic check (new).
- `package.json` — add `"check:pin": "npx tsx scripts/test-pin-adjust.ts"`.

**Approach:** `handleAdjustPin` mirrors `handleRecognize`'s `setPins` update shape but targets
the pin by id, writes `x/y`, and replaces `regionDescription` with a fresh
`getRegionDescription(x, y, emotions)`. Leave `origin` and `recognizedWords` untouched.
`handlePinRelease` sets `origin: { x, y }` at creation. `adjustDraft` is a plain
`useState<{x,y}|null>` cleared on commit.

**Patterns to follow:** the `setPins((prev) => …)` immutable-update pattern already used by
`handleRecognize` / `handleDerecognize`; the `getRegionDescription` call already made in
`handlePinRelease`.

**Test scenarios** (`scripts/test-pin-adjust.ts`, node check like `scripts/test-csv-export.ts`):
- Given a pin at (0.51, -0.30), adjusting to (-0.40, 0.50) yields a `regionDescription` equal
  to `getRegionDescription(-0.40, 0.50, emotions)` (relational + narrative both updated).
- Adjusting a pin preserves its `origin` unchanged and preserves `recognizedWords`.
- A pin created via the release path has `origin` equal to its initial `x/y`.
- Adjusting into a wordless center (e.g. (0.0, 0.0) with no emotion within
  `VISIBILITY_RADIUS`) produces the axis-fallback relational string, not a stale word pair.

**Verification:** `npm run check:pin` passes; `tsc -b` clean; `App` compiles with the new
handler wired.

---

### U2. Sliders on top of the card (commit-on-release)

**Goal:** Replace the two static axis bars with draggable sliders moved to the top of the
card; drag updates a live draft (pin/ghost glide) and commits on release.

**Requirements:** R1, R2 (slider half).

**Dependencies:** U1.

**Files:**
- `src/components/EmotionPreview/CoordinateCard.tsx` — replace the static axis-bar block with
  a sliders block at the top; add pointer-drag handling with local draft state; origin ticks;
  call `onAdjustDraft` during drag and `onAdjust` on release. Accept `onAdjust`,
  `onAdjustDraft`, and `pin.origin` via props/`Props`.

**Approach:** Two horizontal tracks (Calm↔Activated = x, Negative↔Positive = y) reusing the
existing `coordToPercent` mapping for thumb + origin-tick placement. Pointer capture updates a
local `draft` coord; `onAdjustDraft(draft)` fires on move, `onAdjust(pin.id, x, y)` on
pointer-up (then clear draft). While dragging, the card's textual content does **not**
re-resolve (that is U3's dissolve-on-commit). Keep `stopPropagation` on the sliders so a drag
never falls through to card select / field.

**Technical design** (directional, not spec): thumb left = `coordToPercent(value)`; drag maps
pointer-x within the track rect to `[-1, 1]` (clamped); the y-slider maps the same way (no
inversion — it's a 1-D control, not the 2-D field).

**Patterns to follow:** the existing axis-bar markup/tokens in `CoordinateCard` (gold dot,
2px track); pointer-capture drag as used by `useFieldGesture` in `EmotionField`.

**Test scenarios** (manual/browser — no runner; verify each explicitly):
- Dragging the Calm↔Activated slider moves the field pin left/right live; releasing commits
  and the card resolves once.
- Dragging past either end clamps at the field edge (no NaN / overflow).
- The origin tick sits at the drop coordinate and does not move when the thumb moves.
- Tapping the track (no drag) still commits a small move and does not open/close the card or
  drop a stray field pin.
- Sliders render above the caption; `isSelected` styling and the × remove button still work.

**Verification:** `tsc -b` + `eslint` clean; browser check of the five scenarios above at
desktop and 390px widths.

---

### U3. The honest-question caption + slot-only dissolve

**Goal:** Replace the *"between X and Y"* relational line with a stable *"Does A or B fit?"*
question + 5 nearby tags, tap-to-name recognition, "none of these," graceful empty states,
and a dissolve on commit that animates **only** the word-slots + tags.

**Requirements:** R4, R5, R6, R2 (words-hold half).

**Dependencies:** U1, U2.

**Files:**
- `src/components/EmotionPreview/CoordinateCard.tsx` — remove the `RelationalText` verdict
  as the lead; render the persistent question frame (`#slotA`, `or`, `#slotB`, `fit?`) + a
  nearby-tags row (count = `tagCount`); wire word/tag taps to `onRecognize`; local
  `dismissed` state for "none of these"; axis-fallback + "your spot is enough" messages;
  slot-only dissolve on prop-coordinate change.
- `src/data/regions.ts` — reuse `getRegionDescription` / `nearestTagIds`; add a small helper
  if needed to return the two nearest labels + the next-N nearby for the caption (keep the
  single-source-of-truth guarantee).

**Approach:** The two guesses are the two nearest from `nearestTagIds` (or a caption-specific
nearest list); the tag row is the next `tagCount` beyond them. Naming a word calls
`onRecognize` (existing `recognizedWords`); named words read in the gold/checked state.
"none of these" sets local `dismissed` until the next commit (which resets it). Empty states:
no words in range → axis-fallback line; after dismiss → "your spot is enough." Dissolve:
detect a committed coordinate change (prop diff) and fade only `#slotA/#slotB/#tagsDyn`
(opacity out → hold → refill → in); mount/unmount of the whole frame (entering/leaving a
wordless zone) uses a whole-block fade. In-place taps re-fill instantly.

**Technical design** (directional): keep the frame's static text nodes ("Does", "or", "fit?",
"or nearby") mounted; a `fillSlots()` updates only slot/tag `innerHTML`-equivalent React
subtrees; a `fadeSlots()` toggles opacity on just those nodes around a `fillSlots()`. Timing
values come from U4 (until then, use placeholder constants).

**Patterns to follow:** the existing chip/pill markup + `chipVariants` in `CoordinateCard`;
`recognizedWords` handling already in the card; `getRegionDescription`'s relational/axis
fallback logic in `regions.ts`.

**Test scenarios** (manual/browser + one pure-logic addition):
- (pure, add to `scripts/test-pin-adjust.ts`) The caption's two guesses equal the two nearest
  labels within `VISIBILITY_RADIUS`; the nearby list has ≤ `tagCount` items and excludes the
  two guesses.
- Tapping a guess or a tag marks it named (gold/checked) and it appears in "your words";
  tapping again is a no-op or de-names per existing `recognizedWords` semantics.
- "None of these" replaces the question with "your spot is enough" and shows no words; the
  next slider release restores the question.
- Moving into a wordless center shows the axis-fallback line, not a stale word pair.
- On release to a new zone, the "Does … fit?" text stays visually fixed while only the two
  words + tags cross-fade; naming a word does **not** trigger a dissolve.

**Verification:** `npm run check:pin` (updated) passes; `tsc -b` + `eslint` clean; browser
check of the recognition, dismiss, empty-state, and dissolve-scope scenarios.

---

### U4. Tunable dissolve + reduced-motion

**Goal:** Make the dissolve timings hand-tunable through the admin panel and honor
`prefers-reduced-motion`.

**Requirements:** R7.

**Dependencies:** U3.

**Files:**
- `src/config/revealTuning.ts` — add `captionFadeOut`, `captionFadeIn`, `captionHold`
  (seconds) to `RevealTuning` + `DEFAULT_TUNING`.
- `src/admin/components/AdminRevealTuning.tsx` — add a "Check-in card" `Knob[]` section (three
  sliders) below "Welcome"; lower the `tagCount` default/label semantics to "Nearby tags (5)".
- `src/components/EmotionPreview/CoordinateCard.tsx` — consume the three values (passed from
  `App`'s `tuning`) for the U3 dissolve; when `prefers-reduced-motion: reduce`, swap instantly
  (skip fades).
- `src/App.tsx` / `src/components/EmotionPreview/EmotionDrawer.tsx` — pass the needed `tuning`
  fields to the card (App already holds `tuning = useRevealTuning()`).

**Approach:** Follows the `axisPulse*` knob precedent exactly — new numeric fields flow through
`sanitize()` unchanged (it accepts any numeric key present on `DEFAULT_TUNING`). The card reads
timings from props and applies them to the U3 fade transitions; a
`window.matchMedia('(prefers-reduced-motion: reduce)')` check short-circuits to an instant
refill.

**Patterns to follow:** the `WELCOME_KNOBS` array + `renderKnob` in `AdminRevealTuning`; the
`fmt: (v) => \`${v.toFixed(1)}s\`` second-formatter; `DEFAULT_TUNING` numeric entries.

**Test scenarios** (manual/browser + typecheck):
- Changing "Fade out" / "Fade in" / "Hold" in the admin tab visibly changes the card's
  dissolve timing in a second tab (cross-tab live update, like the existing knobs).
- Persisted values survive reload (localStorage round-trip); an invalid/NaN value falls back
  to default (existing `sanitize`).
- With `prefers-reduced-motion: reduce`, releasing a slider swaps words/tags instantly (no
  fade), and no timing knob causes motion.
- "Reset all" restores the caption knobs to defaults alongside the others.

**Verification:** `tsc -b` + `eslint` clean; browser check of live-tuning, persistence,
reduced-motion, and reset.

---

### U5. Field overlay — drop anchor, travel line, live adjust ghost

**Goal:** On the field, keep the original drop visible as an anchor with a travel line to the
current pin, and show a ghost at the live draft while a card slider is dragged.

**Requirements:** R2 (ghost half), R8 (visual half).

**Dependencies:** U1 (origin + adjustDraft), U2 (draft emission).

**Files:**
- `src/App.tsx` — pass `adjustDraft` and the selected pin's `origin` to `EmotionField`.
- `src/components/EmotionField/EmotionField.tsx` — render (a) a "your drop" anchor at
  `origin`, (b) a faint travel line `origin → current pin`, (c) a ghost marker at `adjustDraft`
  while it is non-null. Reuse the existing `ghostPin` marker + "axis position indicators"
  patterns and `toPercent` mapping.

**Approach:** These are additive overlays keyed off two new props; the pin marker itself
already derives from `pins` and moves on commit (U1), so no separate animation is needed for
the committed move. Show the anchor + travel line only when the current pin differs from
`origin` beyond a small epsilon; show the ghost only during an active draft. Respect the
existing z-order so overlays sit under the pin and gold words.

**Patterns to follow:** the `ghostPin` block and the `isRevealed && revealCenter` axis-indicator
block already in `EmotionField`; `toPercent` coordinate mapping; existing SVG/line usage if
present, else a lightweight absolutely-positioned element.

**Test scenarios** (manual/browser):
- Dragging a card slider shows a dashed ghost on the field at the draft position; releasing
  moves the real pin there and clears the ghost.
- The "your drop" anchor stays fixed at the original drop while the pin moves; a travel line
  connects them and disappears when the pin returns to the drop.
- A pin that has never been adjusted (pin ≈ origin) shows no travel line and a resting anchor.
- Overlays never intercept pointer events meant for the field/words (pointer-events none).

**Verification:** `tsc -b` + `eslint` clean; browser check at desktop and 390px of the ghost,
anchor, and travel-line behaviors.

---

## Scope Boundaries

**In scope:** everything in the origin brainstorm — adjustable sliders, mutable coordinate +
region recompute, the question-caption with recognition + dissolve, tunable dissolve knobs,
and the field anchor/ghost/travel overlay.

### Deferred to Follow-Up Work
- Applying the same collapsible/adjust treatment to any other card surface (e.g., the mirror
  or history detail cards) — out of scope for this pass.
- A dedicated automated UI-test harness (Vitest + Testing Library). This plan follows the
  repo's current `scripts/*` + manual-browser verification convention; introducing a test
  runner is a separate decision.

### Out of scope (unchanged behavior)
- How a pin is first dropped on the field.
- The diary/history recording shape beyond the additive optional `origin` field.
- The radial-intensity vocabulary framework itself.

---

## Open Questions (deferred to implementation)

- Exact helper boundary in `regions.ts` for "two guesses + N nearby" (reuse `nearestTagIds`
  vs. a thin caption-specific helper) — resolve when wiring U3 against real data.
- Whether the travel line/anchor is best as inline SVG or absolutely-positioned elements —
  match whatever `EmotionField` already uses for `ghostPin`.
- Whether a de-name (tap a named word again) should be exposed in the caption or left to the
  existing chip-remove affordance — confirm against current `recognizedWords` UX in U3.

---

## Risks & Dependencies

- **Stale-description risk (mitigated by U1):** any code path that moves a pin without
  `handleAdjustPin` would leave `regionDescription` stale. Route all coordinate changes
  through the one handler.
- **`DiaryEntry` compatibility:** `origin` is optional; ensure CSV export
  (`src/utils/diaryCsv.ts`) and history rendering tolerate its absence on old entries (check
  during U1).
- **Dissolve vs. reduced-motion:** the animation must degrade to an instant swap; verify the
  `matchMedia` guard in U4 before shipping.
- **Two units edit `CoordinateCard` (U2, U3):** land U2 first (structure/sliders), then U3
  (caption) to avoid churn.

---

## Sources & Research

- Origin: `docs/brainstorms/2026-08-04-adjustable-pin-card-requirements.md`.
- Local code (read first-hand): `src/components/EmotionPreview/CoordinateCard.tsx`,
  `src/components/EmotionPreview/EmotionDrawer.tsx`, `src/data/regions.ts`, `src/types.ts`,
  `src/App.tsx`, `src/config/revealTuning.ts`, `src/admin/components/AdminRevealTuning.tsx`,
  `src/components/EmotionField/EmotionField.tsx`, `package.json` scripts.
- Verification convention: existing `scripts/test-csv-export.ts` / `test-fan.ts` /
  `test-grounding-cues.ts` wired as `check:*` npm scripts; `build` = `tsc -b && vite build`;
  `lint` = eslint + `scripts/lint-emotion-spacing.mjs`. No unit-test runner present.
- Interaction reference: the iterated playground Artifact from the brainstorm (sliders-on-top,
  commit-on-release, "Does X or Y fit?" voice, slot-only dissolve, drop anchor).
