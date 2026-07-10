---
title: "Emotion Field: Dwell Reveal + Slow Fade"
type: requirements
tags: [ux, emotion-field, dwell, animation, deep-emotions]
date: 2026-07-06
project: emotions-wheel
---

## Problem

Two jarring moments occur in the post-click experience:

1. **Sudden deep emotion appearance**: When the user places a pin, up to three deep emotions suddenly appear on the map with no entrance animation. The user has no preview of what will surface — everything is unexpected because nothing was already on screen.

2. **No exploration preview**: The user has no way to discover what deep emotions exist in an area without committing to a pin. Hovering only brightens surface words; there is no way to preview finer-grained vocabulary before clicking.

## Goals

1. Let the user passively discover deep emotions by holding still over an area — no click required.
2. Ensure that when deep emotions appear for any reason (dwell, pin drop, recognition), they enter gradually rather than popping in.
3. Keep the field calm: the dwell reveal should feel like surfacing, not like an explosion of words.

## Success Criteria

- After 1.2s of holding still, the nearest deep emotions begin to appear — closest first, then cascading outward.
- Moving the cursor resets the reveal: words fade back out, the new hover position starts a fresh dwell timer.
- When a deep emotion enters the DOM (via dwell, pin reveal, or selection), it fades in from invisible rather than popping.
- Pin-drop and dwell co-exist: placing a pin in a dwelled region produces a seamless handoff (words remain visible, now powered by the pin).

## Key Flows

### F1: Explore before placing — dwell preview

User moves cursor over the angry region and holds still. After ~1.2s, the nearest deep emotion fades in (e.g., *furious*). A beat later, the next-closest appears (*enraged*), then the next. User continues holding — more words surface. User moves cursor — words fade back out, new dwell timer starts at the new position.

### F2: Place a pin — slow reveal handoff

User dwells → deep emotions surface → user clicks and releases. Pin is placed. The deep emotions that were visible via dwell remain visible (now via pin proximity). No flash or jump — they never left the screen.

### F3: Pin-only deep reveal — slow entrance

User places a pin without dwelling first. The three nearby deep emotions that appear (post-release) do so slowly: they fade in from invisible over a short entrance, closest first.

### F4: Recognize a deep word — slow entrance

User taps a Nearby pill in the card, recognizing a deep emotion. The word moves to the Recognized list in the card; on the field it remains visible (already there if dwelled/pinned). If the word enters the field for the first time at recognition, it fades in from invisible.

## Requirements

### R1 — Dwell timer

The emotion field tracks hover position continuously. When the cursor has remained within a threshold of ~0.04 coordinate units for at least **1.2 seconds**, the dwell state is activated at the current hover position.

- The 1.2s timer resets on any movement exceeding the threshold — including small fidgets.
- The timer does not activate during a pointer-down gesture (dragging to place a pin); dwell is a hover-only behavior.
- When the cursor leaves the field entirely, dwell state clears immediately.
- Dwell state tracks a single position (the last stable hover position) — it does not accumulate across multiple stops.

### R2 — Radial dwell reveal

When the dwell state is active, deep emotions within `VISIBILITY_RADIUS` of the dwell position are revealed. They appear in distance order: the closest deep emotion fades in first, followed by successively more distant ones, each staggered by a delay proportional to its distance rank.

- Entrance: fade from 0 to `t`-interpolated opacity (same formula as surface proximity: `t = 1 - dist / VISIBILITY_RADIUS`).
- Stagger: each deep emotion in the dwell set delays its entrance by approximately `rank × 0.08s` (rank 0 = nearest = no delay, rank 1 = 0.08s, etc.).
- The entrance uses the existing Framer Motion spring on `EmotionWord` — no separate animation library needed. Only `initial` and `delay` need to be set.
- Simultaneous reveal: all words in the set begin their entrance cascade when the dwell threshold is crossed, not one at a time as the timer progresses.

### R3 — Dwell clear on move

When the cursor moves beyond the threshold distance from the dwell position, the dwell state clears:

- All dwell-revealed deep emotions fade back out (spring returns their opacity to 0).
- No cascade on fade-out: all words in the dwell set fade out together.
- A new dwell timer immediately starts at the new cursor position.
- Deep emotions that are also visible via pin proximity or selection remain visible during and after the clear — dwell clear only removes the dwell-sourced reveal.

### R4 — Slow entrance for all deep emotion appearances

Any deep emotion that mounts into the DOM — regardless of trigger (dwell, pin reveal, recognition) — fades in from opacity 0 rather than appearing instantly.

- `EmotionWord` receives an `initial={{ opacity: 0 }}` prop (or equivalent) so the existing spring animation triggers from zero.
- This ensures pin-drop reveals are also gradual, removing the jarring appearance described in the problem frame.
- Currently `EmotionWord` has no `initial` prop — this is the source of the pop-in behavior and is the fix.
- The existing spring config (`stiffness: 120, damping: 20`) produces a ~0.5–0.8s fade-in; no changes to the spring are required.

### R5 — Dwell + pin interaction

The dwell reveal and pin reveal are independent opacity sources for each deep emotion. A deep emotion may be visible because of the dwell center, a pin, selection, or any combination.

- When a pin is placed while dwell is active, the pin reveal takes over for words in the pin's radius.
- The dwell clear (from moving the cursor) does not remove words that are also within a pin's radius.
- Implementation: when computing the opacity for a deep emotion, take the maximum of dwell opacity, pin opacity, and selection opacity (1.0 if selected or highlighted).

## Scope Boundaries

### In scope

- Dwell timer tracking in the gesture hook (or inline in `EmotionField`)
- Dwell-based deep emotion reveal using existing `deepOpacityMap` pattern, extended with a dwell center
- Distance-ranked stagger for dwell entrance
- Adding `initial` prop to `EmotionWord` for the slow fade-in on mount
- Dwell + pin opacity merge (max of two sources)

### Out of scope

- Any changes to how pins are placed, the drawer, or recognized-word mechanics
- Dwell for surface emotions (surface proximity already handles hover brightening)
- A visible "loading" or progress indicator for the dwell timer
- Persistent dwell (dwell state that survives pointer leave)

## Outstanding Questions

1. **Movement threshold**: 0.04 coordinate units is suggested for the reset threshold. This is approximately 4% of the field's coordinate space — tune at implementation time if too sensitive.
2. **Stagger multiplier**: 0.08s per rank is a starting point. May need to increase if the cascade feels too fast or decrease if too slow for dense clusters.

## Dependencies / Assumptions

- `useFieldGesture` returns hover position continuously — confirmed: pointer move is tracked for `revealCenter` during drag; the same pattern can track hover position at rest.
- `EmotionWord` uses `motion.span` with spring `{ stiffness: 120, damping: 20 }` — confirmed by scout. Adding `initial={{ opacity: 0 }}` is all that is needed for R4.
- `deepOpacityMap` is currently computed from pin positions only — R1/R2 require extending it to include a second source (dwell center). The max-merge approach in R5 keeps this composable.

## Connections

- `src/hooks/useFieldGesture.ts` — dwell timer lives here or in a new `useDwellCenter` hook; R1 lands here
- `src/components/EmotionField/EmotionField.tsx` — dwell opacity source merged with pin proximity; R2, R3, R5 land here
- `src/components/EmotionField/EmotionWord.tsx` — `initial` prop added; R4 lands here
- `docs/plans/2026-07-06-002-feat-field-declutter-coordinate-plan.md` — prior plan that established `deepOpacityMap` and the surface/deep split
