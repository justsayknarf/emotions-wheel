---
title: "feat: Dwell reveal + slow fade for deep emotions"
date: 2026-07-06
type: feat
origin: docs/brainstorms/2026-07-06-003-dwell-reveal-fade-requirements.md
---

## Summary

Three targeted changes: a hover-dwell mechanism that progressively reveals deep emotions near the cursor (closest first, cascading outward) after 1.2s of stable hover; smooth dwell exit when the cursor moves; and slow fade-in entrance for all deep emotion mounts regardless of trigger (dwell, pin-drop, or selection recognition).

---

## Problem Frame

Placing a pin causes up to three deep emotions to appear on the map instantly — there is no preview and no entrance animation, making the post-click experience jarring. The user also has no way to explore the deep vocabulary for an area before committing to a position.

See origin: `docs/brainstorms/2026-07-06-003-dwell-reveal-fade-requirements.md`

---

## Requirements Trace

| Req | Unit | Description |
|-----|------|-------------|
| R1 — Dwell timer | U1 | 1.2s threshold, movement-based reset, suppressed during drag |
| R2 — Radial cascade | U2, U3 | Distance-sorted entrance with rank × 0.08s stagger |
| R3 — Dwell clear on move | U2, U3 | Dwell center clears on movement; AnimatePresence handles fade-out |
| R4 — Slow entrance on mount | U3 | `initial={{ opacity: 0 }}` for all deep emotion mounts |
| R5 — Dwell + pin merge | U2 | max(dwellOpacity, pinOpacity, selectedOpacity) per emotion |

---

## Key Technical Decisions

**KTD1: Dwell timer lives in `useFieldGesture`, not a new hook**

The hook already owns all pointer event handlers (`onPointerMove`, `onPointerLeave`, `onPointerDown`). Adding dwell state alongside the existing gesture state keeps pointer event handling in one place. A separate `useDwellCenter` hook would require sharing or duplicating those event handlers and the coordinate conversion logic.

**KTD2: Hover position tracked on every `onPointerMove`, not only during press**

Currently `useFieldGesture` tracks position only during pointer-down for `revealCenter`. The `onPointerMove` handler fires during hover too — extending it to update `hoverPos` regardless of press state adds dwell tracking at zero event-handling cost.

**KTD3: Dwell timer suppressed during pointer-down**

A user dragging to place a pin should not trigger dwell. The timer is cleared on `onPointerDown` and not restarted until the pointer is released and hovering again.

**KTD4: Cascade via `enterDelay` prop on `EmotionWord`**

Dwell-revealed deep emotions receive an `enterDelay = rank × 0.08s` where rank is the emotion's distance-sorted position from the dwell center (0 = nearest). `EmotionWord` applies this as the `delay` field in its spring transition. All emotions in the dwell set mount simultaneously; the stagger is produced by their individual delays, not by sequential mounting.

**KTD5: `AnimatePresence` wraps deep emotion renders for smooth exit**

When the dwell center clears, deep emotions leave the render filter and would unmount instantly. Wrapping the deep emotion block in `<AnimatePresence>` and adding `exit={{ opacity: 0 }}` to `EmotionWord` keeps departing words in the DOM long enough for a fade-out before removal. This is the idiomatic Framer Motion pattern — identical to the existing `AnimatePresence` usage in `CoordinateCard.tsx`.

**KTD6: `initial={{ opacity: 0 }}` only on deep emotion mounts, not surface**

Surface emotions are always mounted and their opacity changes continuously — adding `initial` would cause a visible flash from 0 on first load. Deep emotions only mount when they become eligible (dwell, pin, selection), so `initial={{ opacity: 0 }}` is correct: they spring from invisible to their target opacity on entry.

---

## High-Level Technical Design

### Dwell state machine (in `useFieldGesture`)

```
IDLE
  ↓ pointerEnter (not pressed)
HOVERING
  [onPointerMove]
    dist from stablePos > 0.04 units → update stablePos, restart 1.2s timer, clear dwellCenter
    dist ≤ 0.04 units              → timer continues
  [1.2s timer fires]
    → set dwellCenter = stablePos
  [onPointerDown]
    → clear dwellCenter, clear timer → IDLE
  [onPointerLeave]
    → clear dwellCenter, clear timer → IDLE
```

### Opacity merge per deep emotion

```
dwellOpacity  = t_dwell  (0 if dwellCenter absent or emotion outside radius)
pinOpacity    = t_pin    (0 if no pin within radius)
selectedOpacity = 1.0    (if in selectedIds or highlightedIds)

finalOpacity = max(dwellOpacity, pinOpacity, selectedOpacity)
enterDelay   = rank × 0.08  (0 if pin-only or selected; from dwell rank)
```

### Cascade entrance sequence

```
dwellCenter set at T=0
  → deepEmotions.filter(within VISIBILITY_RADIUS) → sorted by distance → rank assigned
  → all mount simultaneously via filter change
  → each EmotionWord: initial={{ opacity: 0 }}, transition={{ delay: rank × 0.08 }}
    rank 0 (nearest):  fades in at T=0
    rank 1:            fades in at T=0.08s
    rank n:            fades in at T=n×0.08s

dwell clears (cursor moves > threshold)
  → dwellOpacityMap empties → emotions leave filter → AnimatePresence exit
  → each word: exit={{ opacity: 0 }} over 0.25s, then unmounts
  (words held by pin proximity stay mounted; only dwell-only words exit)
```

---

## Implementation Units

### U1. Add dwell timer to `useFieldGesture`

**Goal:** Track hover position continuously and emit `dwellCenter` after 1.2s of stable hover (cursor movement below threshold).

**Requirements:** R1

**Dependencies:** None

**Files:**
- `src/hooks/useFieldGesture.ts`

**Approach:**
- Add `lastStablePos` ref (initialized to null) and a `dwellTimer` ref (number | null).
- Extend `onPointerMove` handler: update `hoverPos` ref on every move, regardless of press state. When not pressed, compute distance from `lastStablePos`. If distance > 0.04 coordinate units, update `lastStablePos` to current position, clear `dwellCenter` state, cancel and restart the 1.2s timer. If distance ≤ 0.04 (jitter), leave the timer running.
- On timer fire: set `dwellCenter` state to `lastStablePos`.
- On `onPointerDown`: cancel timer, set `dwellCenter` to null.
- On `onPointerLeave`: cancel timer, set `dwellCenter` to null.
- Add `dwellCenter: { x: number; y: number } | null` to the hook's return type and value.
- Use the same pixel-to-coordinate conversion already applied to `revealCenter`.

**Patterns to follow:** Existing `revealCenter` coordinate conversion in `useFieldGesture.ts` (pixel → normalized coordinate via `containerRef` bounds); existing timeout cleanup patterns in React hooks (cancel on effect cleanup and on state transitions).

**Test scenarios:**
- Hover at coordinate (0.3, 0.4) for 1.2s without moving → `dwellCenter` = { x: 0.3, y: 0.4 }
- Hover for 1.0s, then move to delta > 0.04 units → `dwellCenter` null, timer resets; pausing for 1.2s again sets it
- Hover for 1.0s, then micro-move < 0.04 units (jitter) → timer continues; `dwellCenter` fires at 1.2s from original stable point
- Hover for 1.2s (dwellCenter set), then pointer leaves → `dwellCenter` clears immediately
- Hover for 1.2s (dwellCenter set), then pointer presses down → `dwellCenter` clears immediately
- Rapid cursor sweep across field (no pause ≥ 1.2s) → `dwellCenter` remains null throughout

**Verification:** `dwellCenter` in `useFieldGesture` return is null during drag, null during fast cursor movement, and set to the hover coordinate after 1.2s stable hover. Console logging during development confirms state transitions match the state machine above.

---

### U2. Dwell opacity computation and merge in `EmotionField`

**Goal:** Compute opacity for dwell-revealed deep emotions (with distance rank for stagger), and merge dwell + pin + selection opacities into a single final opacity per word.

**Requirements:** R2, R3, R5

**Dependencies:** U1 (`dwellCenter` must be available from the hook)

**Files:**
- `src/components/EmotionField/EmotionField.tsx`

**Approach:**
- Destructure `dwellCenter` from `useFieldGesture` return alongside existing `{ isRevealed, revealCenter, handlers }`.
- Add a second `useMemo` computing `dwellOpacityMap: Map<string, { opacity: number; rank: number }>`:
  - Filter `deepEmotions` to those within `VISIBILITY_RADIUS` of `dwellCenter`.
  - Sort by distance ascending.
  - Assign `rank = index` (0 = nearest).
  - For each: `t = 1 - dist / VISIBILITY_RADIUS`, `opacity = t`.
  - If `dwellCenter` is null, return an empty map.
- Update the deep emotion render loop:
  - Eligible filter: `dwellOpacityMap.has(e.id) || deepOpacityMap.has(e.id) || selectedIds.has(e.id) || highlightedIds.has(e.id)`.
  - Final opacity: `Math.max(dwellOpacityMap.get(e.id)?.opacity ?? 0, deepOpacityMap.get(e.id) ?? 0, isSelectedOrHighlighted ? 1 : 0)`.
  - `enterDelay`: `dwellOpacityMap.get(e.id)?.rank * 0.08 ?? 0` (0 for pin-only or selected words).
  - Pass both `finalOpacity` and `enterDelay` to `EmotionWord`.

**Patterns to follow:** Existing `deepOpacityMap` useMemo in `EmotionField.tsx` — same distance formula (`t = 1 - dist / VISIBILITY_RADIUS`), same `VISIBILITY_RADIUS` import from `useProximity.ts`.

**Test scenarios:**
- `dwellCenter` set at (0.6, -0.7): deep emotions within 0.35 units appear in `dwellOpacityMap` with interpolated opacity and correct rank order
- `dwellCenter` clears: `dwellOpacityMap` empties; dwell-only emotions fall out of render filter (triggering AnimatePresence exit per U3)
- Pin placed at (0.6, -0.7) while hovering there; cursor moves (dwell clears): `deepOpacityMap` keeps those emotions visible via pin — they do not exit
- Same emotion within radius of dwell center (t=0.7) and a pin (t=0.4): `finalOpacity = 0.7`
- Emotion in `selectedIds`: `finalOpacity = 1.0` regardless of dwell and pin proximity
- Dwell rank 0: `enterDelay = 0`; rank 4: `enterDelay = 0.32`
- `enterDelay = 0` for all pin-only-revealed emotions

**Verification:** After a 1.2s hover over a region containing deep emotions, the field shows nearby deep emotion words. The nearest appears first; more distant ones follow with visible stagger. Placing a pin while hovering then moving the cursor keeps words visible. Moving away from a pin-free region makes words fade out (per U3).

---

### U3. Slow entrance and exit animation for deep emotions

**Goal:** Deep emotions fade in from opacity 0 on mount (fixing instant pop-in); dwell-triggered words cascade with `enterDelay`; dwell-cleared words fade out smoothly via `AnimatePresence`.

**Requirements:** R4, R2 (entrance), R3 (exit fade)

**Dependencies:** U2 (`enterDelay` prop computed there and passed in)

**Files:**
- `src/components/EmotionField/EmotionWord.tsx` — add `enterDelay` prop, `initial`, and `exit` behavior
- `src/components/EmotionField/EmotionField.tsx` — wrap deep emotion renders in `<AnimatePresence>`

**Approach:**
- In `EmotionWord`: add optional `enterDelay?: number` prop (default 0). Apply as `transition={{ delay: enterDelay, type: 'spring', stiffness: 120, damping: 20 }}` so the spring entrance is delayed. Add `exit={{ opacity: 0 }}` with a short non-spring transition (`duration: 0.25, ease: 'easeOut'`). The `initial` prop is not added to `EmotionWord` itself — it is passed in from the call site (see below), keeping the component flexible for both surface and deep use.
- In `EmotionField`, deep emotion render loop:
  - Pass `initial={{ opacity: 0 }}` explicitly when rendering deep emotions. Surface emotion renders omit `initial` (Framer Motion treats absent `initial` as `false`, disabling the initial animation).
  - Wrap the entire deep emotion block (filter + map) in `<AnimatePresence>`.
- Surface emotion renders are unchanged.

**Patterns to follow:** `pillVariants` / `chipVariants` + `<AnimatePresence>` in `CoordinateCard.tsx` — the same pattern of `initial: 'hidden'` / `exit: 'exit'` on `motion.button` within `AnimatePresence`. `EmotionWord` is a `motion.span` — the same props apply.

**Test scenarios:**
- Deep emotion mounting via pin drop: word springs from opacity 0 to target opacity (not from ambient opacity); no pop-in visible
- Surface emotions: no change in appearance — no initial-opacity flash on field load
- Dwell entrance — rank 0 word: starts springing immediately on dwell activation; rank 3 word: starts 0.24s later
- Dwell clear: words fade to 0 over ~0.25s before DOM removal; does not disappear instantly
- Words held by pin proximity: do not exit when dwell clears; `AnimatePresence` correctly distinguishes them (they stay in the filter)
- Deep emotion recognized via card Nearby pill: if not previously visible, enters from opacity 0 and springs to 1.0
- `Test expectation: none` for surface-emotion behavior — no behavioral change; visual inspection confirms no regression

**Verification:** Pin-drop deep emotion appearance is gradual (visible spring from 0). Dwell hover → cascading appearance of nearby words, closest first with noticeable stagger. Cursor move after dwell → words fade out rather than disappearing. `npx tsc -b --noEmit` returns clean after changes.

---

## Scope Boundaries

### In scope
- Dwell timer state machine in `useFieldGesture`
- Dwell proximity + rank computation in `EmotionField`
- Dwell + pin + selection opacity merge
- `enterDelay` prop for cascade stagger on `EmotionWord`
- `AnimatePresence` wrapper for deep emotion exits
- `initial={{ opacity: 0 }}` for deep emotion mounts

### Out of scope
- Surface emotion animation (always mounted, no initial animation)
- Any change to pin placement, drawer behavior, or recognized-word mechanics
- A visible dwell progress indicator (no timer UI)
- Persistent dwell that survives pointer leave

### Deferred to follow-up work
- Tuning `enterDelay` multiplier (0.08s/rank) and movement threshold (0.04 units) based on feel
- Dwell behavior for surface emotions (separate brainstorm if desired)
- "Show all" toggle for full 242-word view

---

## Deferred to Implementation

- Whether to use `useRef` + `setTimeout` or `useEffect` + cleanup for the dwell timer — either works; `useRef` + manual cancel is simpler for a non-React timer
- Exact exit transition duration (0.25s suggested; tune to match the feel of other AnimatePresence exits in the app)
- Whether `enterDelay` also delays the exit (Framer Motion applies `transition.delay` to all animations; if this feels wrong on exit, set `exit={{ opacity: 0, transition: { duration: 0.25, delay: 0 } }}` to override the delay on exit)

---

## Sources & Research

- Origin requirements: `docs/brainstorms/2026-07-06-003-dwell-reveal-fade-requirements.md`
- Prior plan (surface/deep split, deepOpacityMap): `docs/plans/2026-07-06-002-feat-field-declutter-coordinate-plan.md`
- AnimatePresence pattern reference: `src/components/EmotionPreview/CoordinateCard.tsx` (existing usage with `chipVariants`/`pillVariants`)
- `EmotionWord` current implementation: `src/components/EmotionField/EmotionWord.tsx` — `motion.span`, spring `{ stiffness: 120, damping: 20 }`, no `initial` or `exit` props today
- `useFieldGesture` current implementation: `src/hooks/useFieldGesture.ts` — instant hover, no dwell timer
