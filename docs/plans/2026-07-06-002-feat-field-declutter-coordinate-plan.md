---
title: "feat: Declutter emotion field + restore coordinate visibility"
date: 2026-07-06
type: feat
origin: docs/brainstorms/2026-07-06-001-field-declutter-coordinate-requirements.md
---

## Summary

Four targeted changes to the emotion selector: default to surface-depth emotions only (dramatically reducing word density), reveal deep emotions near each placed pin, add a live axis-position indicator during drag, and restore a readable coordinate readout in the card using position bars instead of the removed raw number format.

---

## Problem Frame

The emotion selector shows all 242 emotion words at 15% ambient opacity. The densest clusters — angry (25 words), sad (19), joyful (18) — are visually noisy before interaction and worse during hover. Separately, the coordinate position the user records is invisible: the raw V/A readout was removed in a previous session as jargon, but the underlying position is the primary output and should be communicated in a legible form.

See origin: `docs/brainstorms/2026-07-06-001-field-declutter-coordinate-requirements.md`

---

## Requirements Trace

| Req | Unit | Status |
|-----|------|--------|
| R1 — Surface-only default | U1 | Planned |
| R2 — Lower ambient opacity floor | U1 | Planned |
| R3 — Pin drop reveals nearby deep emotions | U2 | Planned |
| R4 — Axis position indicator during drag | U3 | Planned |
| R5 — Readable coordinate in card | U4 | Planned |

---

## Key Technical Decisions

**KTD1: Pin-based deep proximity computed inline in EmotionField, not via `useProximity`**

`useProximity` is a generic hook that takes a list of emotions and a single hover-based `revealCenter`. Extending it to handle multiple pin positions would add a new responsibility and break its simple interface. Instead, deep-emotion proximity is computed directly in `EmotionField` from `pins` (already a prop): for each deep emotion, find the closest pin within `VISIBILITY_RADIUS`; if found, compute `t = 1 - dist / VISIBILITY_RADIUS` as the opacity factor. This keeps `useProximity` unchanged.

**KTD2: Axis indicator driven by existing `revealCenter` and `isRevealed`**

`useFieldGesture` already returns `revealCenter` (current coordinate position during drag) and `isRevealed` (whether the user is actively pressing). No changes to the gesture hook are needed — the axis indicator is a pure render concern in `EmotionField`: two absolutely positioned dot elements shown when `isRevealed && revealCenter`, each positioned along its respective axis edge using `toPercent(revealCenter.x)` and `toPercent(-revealCenter.y)`.

**KTD3: `toPercent` needs to be available in `CoordinateCard`**

The coordinate-to-percentage mapping (`5 + ((v + 1) / 2) * 90`) is currently private to `EmotionField.tsx` and will also be needed in `CoordinateCard.tsx` for the position bar markers. Options: extract to `src/lib/coordinates.ts`, or define locally in `CoordinateCard.tsx`. Both are valid; the implementation decision is deferred. The plan uses the function name as-is in both units.

**KTD4: Selected and highlighted deep emotions always display**

Deep emotions that are in `selectedIds` (recognized by the user) or `highlightedIds` (top 3 nearby after pin drop) must remain visible even before a subsequent pin is placed nearby. The U2 render logic must check both pin-proximity AND the selected/highlighted sets — any deep emotion in either of those sets is rendered at full opacity regardless of pin distance.

---

## High-Level Technical Design

### Emotion render segmentation after U1 + U2

```
EmotionField
  ├── surfaceEmotions (from emotions where depth === 'surface')
  │     useProximity(surfaceEmotions, revealCenter, isRevealed, selectedIds)
  │     → rendered always at computed opacity (floor now 0.05)
  │
  └── deepEmotions (from emotions where depth === 'deep')
        computePinProximity(deepEmotions, pins) → Map<id, opacity>
        + union with selectedIds, highlightedIds
        → rendered only when opacity > 0
```

### Axis indicator position during drag

```
revealCenter.x ──toPercent──► left: X%   (dot on bottom axis edge)
revealCenter.y ──toPercent (inverted)──► top: Y%  (dot on right axis edge)
Both visible only when isRevealed === true
```

### Card coordinate bars (U4)

```
[Calm ──────●──── Activated]   left: toPercent(pin.x)%
[Negative ──●──────── Positive] left: toPercent(pin.y)%
```
Each bar: thin track (2px height, low-opacity background), 6px gold dot marker.

---

## Implementation Units

### U1. Surface-only ambient display + lower opacity floor

**Goal:** Reduce the rendered emotion set to surface-depth only by default, and lower the ambient opacity floor to make surface words less visually demanding.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- `src/components/EmotionField/EmotionField.tsx` — filter `emotions` to surface-only before passing to `useProximity` and the render loop
- `src/hooks/useProximity.ts` — change ambient floor constant from `0.15` to `0.05`

**Approach:**
In `EmotionField`, split emotions at the top of the component: `surfaceEmotions = emotions.filter(e => e.depth === 'surface')`. Pass `surfaceEmotions` to `useProximity` and render only `surfaceEmotions` in the emotion word loop. Deep emotions are not rendered at all in this unit (U2 adds them back near pins).

In `useProximity`, the ambient floor `0.15` appears in two places: the "at rest" branch (all words floor opacity) and the lower bound of the pressed-proximity formula (`0.15 + t * 0.85`). Change both to `0.05`. The upper bound (1.0) and the proximity interpolation formula are unchanged.

**Patterns to follow:** Existing filter in `AdminTable.tsx` (`visibleEmotions = visibleIds === null ? emotions : emotions.filter(...)`)

**Test scenarios:**
- On mount with no interaction: only surface-depth emotions are present in the DOM; no deep-depth emotion is rendered
- On mount, a surface emotion's opacity is approximately 0.05 (ambient floor) — not 0.15
- On hover near a surface emotion: that emotion brightens toward 1.0 as before; the proximity formula still works
- Edge case: the guilt cluster (0 surface emotions) produces no rendered words before pin placement

**Verification:** Visual inspection shows dramatically fewer words at rest. The dense angry/sad/joyful regions are visibly cleaner. No deep emotions are visible before a pin is placed.

---

### U2. Pin-triggered deep emotion reveal

**Goal:** When a pin is placed, deep emotions within `VISIBILITY_RADIUS` of that pin's coordinate fade in using the same proximity opacity model. Removing a pin reverses the reveal.

**Requirements:** R3

**Dependencies:** U1 (surface/deep split must be established first)

**Files:**
- `src/components/EmotionField/EmotionField.tsx` — add deep emotion proximity computation and rendering

**Approach:**
In `EmotionField`, derive `deepEmotions = emotions.filter(e => e.depth === 'deep')`. Compute a `Map<string, number>` (deep emotion id → opacity) by iterating over all deep emotions and all pins. For each deep emotion, find the closest pin within `VISIBILITY_RADIUS`; the opacity is `t = 1 - dist / VISIBILITY_RADIUS`, taking the max across all pins. If no pin is within range, the emotion is absent from the map.

Additionally, always include deep emotions that are in `selectedIds` (recognized) or `highlightedIds` (highlighted after pin drop) at full opacity (1.0), regardless of pin proximity.

Render loop addition after the surface emotion loop:
```
deepEmotions
  .filter(e => deepOpacityMap.has(e.id) || selectedIds.has(e.id) || highlightedIds.has(e.id))
  .map(e => <EmotionWord
    proximity={{ opacity: resolvedDeepOpacity(e), scale: 1.0, isCandidate: false }}
    isSelected={selectedIds.has(e.id)}
    isHighlighted={highlightedIds.has(e.id)}
    ...
  />)
```
`resolvedDeepOpacity(e)` returns 1.0 if selected/highlighted, else the map value.

**Patterns to follow:** Existing pin-position rendering math in `EmotionField.tsx` (`px = (toPercent(pin.x) / 100) * size.width`); existing proximity formula in `useProximity.ts` (`t = 1 - dist / VISIBILITY_RADIUS`).

**Test scenarios:**
- After placing a pin at (0.6, -0.7) (angry region): deep angry-cluster emotions within 0.35 distance appear with computed opacity
- Removing that pin: deep emotions that were only revealed by it disappear
- Two pins both revealing the same deep emotion: the emotion's opacity uses the closest pin (max opacity wins)
- A deep emotion selected via the card's Nearby pills: displays at full opacity even before any pin is nearby
- Deep emotions outside `VISIBILITY_RADIUS` of all pins remain hidden
- Guilt-cluster emotions (all deep, at approx -0.35, -0.45): invisible before a pin is placed in that region; visible after

**Verification:** Placing a pin in the angry region reveals ~20 additional words nearby. Removing the pin collapses them back. No deep emotion appears without a pin in its vicinity (except selected/highlighted ones).

---

### U3. Axis position indicator during drag

**Goal:** While the user is actively dragging (before pin release), show a small position indicator dot on each axis edge that tracks cursor position in real time. The indicators disappear when dragging stops.

**Requirements:** R4

**Dependencies:** None (reads existing `revealCenter` and `isRevealed` from `useFieldGesture`)

**Files:**
- `src/components/EmotionField/EmotionField.tsx` — add axis indicator elements

**Approach:**
`useFieldGesture` already returns `{ isRevealed, revealCenter, handlers }`. `revealCenter` is the current coordinate (x, y) during drag; `isRevealed` is true while pressing.

Add two absolutely positioned dot elements inside the field container, rendered conditionally when `isRevealed && revealCenter`:

- **Arousal indicator** (x axis): positioned at `left: toPercent(revealCenter.x)%`, `bottom: 8px`. A 6px circular dot in `rgba(201,168,124,0.55)`. Slides left-right with x position.
- **Valence indicator** (y axis): positioned at `top: toPercent(-revealCenter.y)%`, `right: 8px`. Same size and color. Slides up-down with y position (inverted because positive valence = top).

Both use `pointerEvents: 'none'` and a brief `transition: 'left 0.04s linear, top 0.04s linear'` to keep them from lagging behind fast gestures.

**Patterns to follow:** Existing axis label style (`AXIS_LABEL` constant in `EmotionField.tsx`); existing conditional rendering of the pulse ring and dot after pin placement.

**Test scenarios:**
- While dragging, both indicator dots are visible in the DOM
- After pin release (`isRevealed` returns to false), indicator dots are absent from the DOM
- Dragging to x = 1.0 (far right): arousal indicator is at ~95% left without overflowing
- Dragging to y = 1.0 (positive): valence indicator is at ~5% top (near the top edge)
- Dragging to x = 0: arousal indicator is at 50% left (center)
- Test expectation: no unit tests needed for indicator pixel positions — visual inspection during interaction is sufficient

**Verification:** Drag interaction shows both dots tracking cursor in real time. Dots disappear when finger/cursor lifts. No visual artifacts outside the field container.

---

### U4. Card coordinate readout

**Goal:** Add two compact position bars to the CoordinateCard showing the placed pin's arousal and valence position. Non-numeric, visual, secondary to the relational text.

**Requirements:** R5

**Dependencies:** None (reads `pin.x` and `pin.y` from the existing `PinEntry` prop)

**Files:**
- `src/components/EmotionPreview/CoordinateCard.tsx` — add position bar section below narrative
- `src/lib/coordinates.ts` *(new, if `toPercent` is extracted; otherwise define inline)* — shared coordinate-to-percentage mapping

**Approach:**
Below the narrative paragraph in the card's main metric block, add a coordinate bar section. Two rows:

Row 1 — Arousal:
- Small label row: `Calm` on left, `Activated` on right (8px, `--oura-text-3`, uppercase, wide tracking)
- Track: 100% wide, 2px tall, `rgba(237,232,223,0.08)` background, borderRadius 1px
- Marker: 6px circular dot at `left: toPercent(pin.x)%`, translateX -50%, `rgba(201,168,124,0.7)`

Row 2 — Valence: same structure, `Negative` left / `Positive` right, marker at `left: toPercent(pin.y)%`.

The section sits between the narrative `<p>` and the recognized/nearby word section (the recessed band at the bottom). It is always shown when a pin has coordinates (i.e., always — every pin has x, y from placement).

**Patterns to follow:** Existing label typography style in `CoordinateCard.tsx` (`fontSize: 8.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--oura-text-3)'`); the gold dot from `EmotionField.tsx` pulse animation (`rgba(201, 168, 124, 0.7)`).

**Test scenarios:**
- Pin at x = 0.8: arousal marker renders at approximately 86% left of its track
- Pin at x = -0.8: arousal marker renders at approximately 14% left
- Pin at y = 0: valence marker renders at 50% left (center)
- Pin at y = 1.0: valence marker renders at approximately 95% left (Positive end)
- Card renders without error when both x and y are at boundary values (-1.0, 1.0)

**Verification:** After placing a pin anywhere on the field, the card shows two labeled position bars with a gold dot marker at the correct position. Bars read left-to-right as Calm → Activated and Negative → Positive respectively.

---

## Scope Boundaries

### In scope
- Filtering `EmotionField` word render to surface depth by default
- Lowering ambient opacity floor in `useProximity`
- Pin-based deep emotion reveal in `EmotionField`
- Axis indicator during drag (render-only, no gesture hook changes)
- Two-bar coordinate readout in `CoordinateCard`

### Out of scope
- Admin-style dot map as the main field rendering
- Cluster-label navigation (tapping a cluster to reveal its words)
- Any change to pin placement, recognized-word mechanics, or drawer behavior
- Adding surface-depth representatives to all-deep clusters (guilt, powerless)

### Deferred to follow-up work
- Animated fade-in for deep emotions when pin is placed (currently instant)
- A "show all" toggle to temporarily reveal all 242 emotions without placing a pin
- Adjusting `VISIBILITY_RADIUS` for pin-reveal if the revealed zone proves too large in practice

---

## Deferred to Implementation

- Whether `toPercent` is extracted to `src/lib/coordinates.ts` or defined locally in `CoordinateCard` — trivial, implementation-time call
- Whether `deepOpacityMap` is computed as a `useMemo` inside `EmotionField` or as a derived value — depends on how the implementer structures the component
- Exact transition timing on axis indicator dots (0.04s suggested; tune to feel right during actual drag)

---

## Sources & Research

- Origin requirements doc: `docs/brainstorms/2026-07-06-001-field-declutter-coordinate-requirements.md`
- Grounding dossier (cluster breakdown, opacity code): `/tmp/compound-engineering/ce-brainstorm/noise-reduction-2026-07-01/grounding.md`
- No external research run — local patterns in `useProximity.ts` and `EmotionField.tsx` are sufficient
