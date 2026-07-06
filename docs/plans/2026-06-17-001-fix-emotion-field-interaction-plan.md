---
title: "fix: Emotion field interaction polish — speed, orientation, and label spread"
type: fix
date: 2026-06-17
---

# fix: Emotion field interaction polish — speed, orientation, and label spread

## Summary

Three connected friction points make the emotion field harder to use than intended: dragging is too slow to enable discovery, the 2D axes are unlabeled so users don't know what they're navigating, and emotion positions cluster in the middle of each quadrant leaving edges sparse and centers overcrowded. This plan fixes all three.

---

## Problem Frame

The first-launch experience has three specific problems:

**Speed.** `DRAG_SCALE = 0.2` means a full phone-width drag moves the pin only ~0.4 coordinate units. Traversing from center to the edge of one quadrant requires 2–3 full-screen drags. Words don't emerge fast enough for the interaction to feel discoverable.

**Orientation.** Nothing communicates that x = valence (pleasant/unpleasant) and y = arousal (activated/calm). The existing hint ("press and drag to explore") auto-dismisses on the first gesture, leaving no persistent spatial context after that.

**Density.** Emotion coordinates cluster between ~0.35 and ~0.90 within each quadrant. The outer fringes are empty; the center-inner zone is overcrowded with overlapping labels.

---

## Requirements

**Drag speed**
- R1. A full phone-width drag moves the pin approximately 1.2–1.5 coordinate units.
- R2. Tap-to-select continues to work correctly after the drag speed change.

**Axis orientation**
- R3. Four persistent, subtle labels identify the field's cardinal directions: "activated" (top), "calm" (bottom), "pleasant" (right), "unpleasant" (left).
- R4. Axis labels do not participate in gesture handling and do not obscure emotion words.

**Label spread**
- R5. Spread positions use more of the full [−1, 1] range, with no two emotion positions closer than 0.14 coordinate units.
- R6. Spread positions preserve quadrant membership — an emotion with positive original valence stays at positive valence.
- R7. Proximity detection (visibility, scale, selection) uses spread positions, not original positions.

---

## Key Technical Decisions

- **DRAG_SCALE 0.2 → 0.7.** At 0.7, a full-screen drag covers `(337 / 337.5) × 2 × 0.7 ≈ 1.4` coordinate units — enough to traverse most of the field in a single gesture. `TAP_MAX_MOVEMENT` is unaffected: tap detection uses raw pixel movement via `pixelToCoord(mx, w)` before any scale factor is applied.

- **Axis labels always visible.** The first-launch hint dismisses on first drag and cannot serve as persistent orientation. The axis labels are always-on, very low opacity, and placed at the field edges outside any emotion cluster.

- **Circumplex vocabulary** ("activated" / "calm" / "pleasant" / "unpleasant"). Matches Russell's Core Affect Circumplex framing used throughout the codebase.

- **Spread computed at module load in `layout.ts`.** A module-level export `SPREAD_POSITIONS: Map<string, {x: number, y: number}>` computed once on first import. `EmotionField` reads this Map to build enriched emotion objects before passing them to hooks and word components. Original coordinates in `emotions.ts` are unchanged.

- **Spread algorithm — normalize then repel.** Two-pass: (1) globally scale all coordinates so `max(|x|)` and `max(|y|)` map to 0.95; (2) iterative pairwise repulsion (150 iterations, `MIN_DIST = 0.14`, `REPULSION_STRENGTH = 0.003`) with clamp to ±0.95 and a quadrant-preservation guard that prevents sign flip for any emotion whose original |coord| > 0.10.

---

## Implementation Units

### U1. Increase drag speed

**Goal:** Raise `DRAG_SCALE` from 0.2 to 0.7 so the field is traversable in 1–2 gestures.

**Requirements:** R1, R2

**Dependencies:** none

**Files:**
- Modify: `src/hooks/useGesturePin.ts`

**Approach:** Change the constant `DRAG_SCALE = 0.2` to `DRAG_SCALE = 0.7`. No other changes are needed — `TAP_MAX_MOVEMENT` is compared against the pixelToCoord-converted movement, which is in coordinate space and is not scaled by `DRAG_SCALE`.

**Note on TAP_MAX_MOVEMENT:** `TAP_MAX_MOVEMENT = 0.015` is in coordinate space (≈ 2.5px on 375px screen). The threshold is tight on iOS — verify on physical device before shipping.

**Patterns to follow:** The constant definition at the top of `src/hooks/useGesturePin.ts`.

**Test scenarios:**
- Happy path: starting from pin at (0, 0), dragging ~280px horizontally moves the pin approximately 1.2–1.3 coordinate units.
- Edge clamp: a drag that would exceed ±1.0 clamps correctly at ±1.0.
- Tap regression: press and release with < ~2.5px total movement (≈ 0.015 coordinate units); the nearest emotion within `SELECTION_RADIUS` is toggled; no false-drag detected.

**Verification:** A single deliberate swipe from mid-left to mid-right moves the pin visibly across the field and reveals a fresh cluster of emotion words.

---

### U2. Add axis orientation labels

**Goal:** Render four persistent, low-opacity labels at the cardinal edges of the field.

**Requirements:** R3, R4

**Dependencies:** none

**Files:**
- Create: `src/components/EmotionField/AxisLabels.tsx`
- Modify: `src/components/EmotionField/EmotionField.tsx`

**Approach:** `AxisLabels` renders four absolutely-positioned `<span>` elements. Positions: top-center, bottom-center, right-middle, left-middle. Left label ("unpleasant") rotates `rotate(-90deg)` so it reads bottom-to-top. Right label ("pleasant") rotates `rotate(90deg)` so it reads top-to-bottom. All four use `pointer-events: none`, `user-select: none`, approximately `fontSize: 10px`, `opacity: 0.18`, neutral stone color. `EmotionField` renders `<AxisLabels />` with z-index below emotion words and the pin. Stacking order: field background (z-index 0) < axis labels (z-index 1) < emotion words (z-index 2) < pin (z-index 3).

**Patterns to follow:** The `pointer-events: none` / `position: absolute` pattern from the first-launch hint overlay in `src/App.tsx`.

**Test scenarios:**
- All four labels render in the field on initial load.
- Pressing and dragging over a label behaves identically to pressing the empty field — no gesture capture.
- Labels do not visually obscure the pin marker or selected emotion words near the edge.

**Verification:** Open app; four faint directional labels are visible at the edges without drawing focus from emotion words.

---

### U3. Spread emotion positions via runtime layout

**Goal:** Compute spread positions for all 188 emotions at module load and use them for rendering and interaction.

**Requirements:** R5, R6, R7

**Dependencies:** none

**Files:**
- Create: `src/data/layout.ts`
- Modify: `src/components/EmotionField/EmotionField.tsx`
- Modify: `src/hooks/useGesturePin.ts` (add `emotions` parameter to Options)

**Approach:**

`layout.ts` exports `SPREAD_POSITIONS: Map<string, {x: number, y: number}>` computed at module load:

1. **Normalize** — find `maxAbsX = max(|e.x|)` and `maxAbsY = max(|e.y|)` across all 188 emotions. Scale all positions so extremes map to ±0.95.
2. **Repulse** — 150 iterations. Each iteration: for every pair within `MIN_DIST = 0.14`, apply a force of `(MIN_DIST − dist) × 0.003` in the direction away from the other. Clamp to ±0.95 after each step. Quadrant guard: if the original emotion's |coordinate| > 0.10 and the updated position would flip its sign, clamp to ±0.03 in the original direction. Emotions with |coord| ≤ 0.10 are treated as genuinely ambivalent on that axis and may drift freely across zero with no guard.

`EmotionField` builds a local enriched array substituting each emotion's `x` and `y` from `SPREAD_POSITIONS` before passing to `useProximity`, `useGesturePin`, and `EmotionWord`. The `Emotion` interface in `emotions.ts` does not change.

**Interface change to `useGesturePin`:** Add `emotions: Emotion[]` to the `Options` interface and use this parameter in the tap handler instead of importing the module-level `emotions` constant directly. Without this change, tap selection uses original coordinates while words render at spread positions, causing tap misses. `EmotionField` passes the spread-enriched array. `useProximity` and `EmotionWord` continue reading `.x` and `.y` from whatever they receive — no API changes to those files.

`SelectedEmotion.x` and `.y` stored on selection should reflect spread positions, since that is where the word visually appears.

**Patterns to follow:** Module-level const pattern in `src/data/emotions.ts`; distance computation in `src/hooks/useProximity.ts`.

**Test scenarios:**
- Spread range: no spread coordinate exceeds ±0.95 or is NaN after algorithm completes. Fallback: if any position is NaN or Infinity, fall back to the original coordinate for that emotion and log a warning.
- Min distance: no two spread positions are closer than 0.13 (0.01 slack for floating-point). During development, log the actual minimum pair distance after algorithm completes to confirm convergence.
- Quadrant preservation: every emotion with original |x| > 0.10 retains the same x sign; same for y. Emotions with |coord| ≤ 0.10 are exempt — they may cross zero.
- Selection correctness: tapping near a spread-position word selects that emotion and records its spread x/y.
- Proximity regression: words near the pin are visible; words far away are hidden; opacity and scale behave as before at the new positions.
- Visibility at center: with pin at (0, 0), at least 3 emotion words are visible. If fewer than 3 are visible with the current VISIBILITY_RADIUS=0.35, increase VISIBILITY_RADIUS as part of this unit (not deferred).

**Verification:** Open app; words near center are distributed evenly rather than tightly clustered. Dragging reveals evenly-spaced words with no large empty voids and no dense pile-ups.

---

## Scope Boundaries

### Deferred to follow-up work
- Adjusting `VISIBILITY_RADIUS` after spread is applied — the increased inter-emotion distances may warrant a slightly larger visibility radius. Observe and tune separately if needed.
- Fine-tuning axis label opacity, font size, or placement based on physical iOS Safari testing.
- Tuning `MIN_DIST` or `REPULSION_STRENGTH` constants in `layout.ts` — starting values in the plan; implementer adjusts by inspection.

### Out of scope
- Changing which emotions exist or their labels.
- Definition cards, diary, session complete, or history views.
- Zooming, pinch-to-zoom, or multi-touch gestures.
- Quadrant background tinting or grid overlays.

---

## Risks & Dependencies

- **Repulsion runtime cost.** O(n²) pairs × 150 iterations ≈ 5.3M arithmetic ops at module load. Expected < 50ms on a modern JS engine. If measurably slow, reduce `ITERATIONS` to 50 (still effective) or precompute at build time and embed as a static Map.
- **iOS tap interference.** Higher `DRAG_SCALE` means the pin travels further during gestures that begin as taps. `TAP_MAX_MOVEMENT = 0.015` is in coordinate space (≈ 2.5px on 375px screen — tighter than it looks). `DRAG_SCALE` is not in the tap detection path so the threshold itself doesn't change, but the 2.5px window is tight for iOS touch jitter. Verify on physical device before shipping; treat as a blocking gate.
