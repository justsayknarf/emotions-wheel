---
title: "fix: Cap deep-emotion reveal at nearest six words"
type: fix
date: 2026-07-07
---

# fix: Cap deep-emotion reveal at nearest six words

## Summary

Cap both the dwell-triggered and pin-triggered deep-emotion reveals at the six nearest deep words instead of every deep word within `VISIBILITY_RADIUS`. The cascade animation, opacity model, and gesture behavior are unchanged — only the size of the revealed set shrinks.

## Problem Frame

Dwelling or placing a pin reveals every deep emotion within the 0.35 visibility radius. In the activated-negative quadrant that is up to 42 deep words (plus 12 surface words) inside a ~280px circle on a desktop viewport — an unreadable pile of overlapping text at the exact moment of user attention. The dwell-reveal spec called for "surfacing, not an explosion of words"; the uncapped set delivers the explosion. This amends the reveal behavior established in `docs/plans/2026-07-06-002-feat-field-declutter-coordinate-plan.md` (pin reveal) and `docs/plans/2026-07-06-003-feat-dwell-reveal-fade-plan.md` (dwell reveal): the "nearby, not field-wide" intent stands; the set size gains a hard cap.

## Requirements

- R1. A dwell reveal shows at most 6 deep words — the nearest by coordinate distance to the dwell center.
- R2. A pin reveal shows at most 6 deep words per pin — the nearest to that pin's coordinate. With multiple pins, each pin contributes its own capped set; the union may exceed 6.
- R3. Deep words that are selected (recognized) or highlighted (card pills) remain visible regardless of the cap.
- R4. Existing entrance/exit animation behavior is preserved: distance-ranked stagger on dwell entrance, fade-out on dwell clear, max-merge of dwell/pin opacity sources.
- R5. The cap value is a single named constant, adjacent to the existing radius constants.

## Key Technical Decisions

- **Cap at 6, applied per source (per dwell center, per pin), before the opacity merge.** Capping the union instead would make a word's visibility depend on unrelated pins, breaking the existing per-pin independence in the multi-pin reveal model.
- **Cap by distance rank, not by opacity threshold.** The dwell map already sorts eligible words by distance to assign stagger ranks; slicing that sorted list is the minimal change. The pin map (`deepOpacityMap`) does not currently sort — it gains the same sort-then-slice shape.
- **Constant lives in `src/hooks/useProximity.ts`** alongside `VISIBILITY_RADIUS` and `SELECTION_RADIUS`, named `DEEP_REVEAL_CAP`. All field-tuning knobs stay in one place.

## Implementation Units

### U1. Cap dwell and pin deep-reveal sets

- **Goal:** Both reveal maps in `EmotionField` return at most `DEEP_REVEAL_CAP` entries per source.
- **Requirements:** R1–R5
- **Dependencies:** none
- **Files:**
  - `src/hooks/useProximity.ts` — add `DEEP_REVEAL_CAP = 6`
  - `src/components/EmotionField/EmotionField.tsx` — apply the cap in `dwellOpacityMap` and `deepOpacityMap`
- **Approach:** In `dwellOpacityMap`, the eligible list is already distance-sorted before rank assignment — slice to the cap after sorting. In `deepOpacityMap`, restructure from per-emotion max-over-pins to per-pin nearest-K: for each pin, collect deep words within radius, sort by distance, keep the cap, then merge into the map taking the max opacity per word. Selected/highlighted words are handled by the existing render filter and are unaffected.
- **Patterns to follow:** the existing `eligible.sort` + rank pattern in `dwellOpacityMap` (`src/components/EmotionField/EmotionField.tsx`).
- **Test scenarios:** no test runner exists in this repo; verify in the running app (manual scenarios below are the acceptance set).
  - Hover-dwell at the angry cluster center (~x 0.55, y −0.60): exactly 6 deep words fade in, nearest first; previously ~40.
  - Dwell in a sparse region (near origin): fewer than 6 deep words appear if fewer are in radius; no error.
  - Place a pin in the angry cluster without dwelling: at most 6 deep words fade in around the pin.
  - Place two pins in different clusters: each shows its own ≤6 set; removing one pin removes only its set.
  - Recognize a deep word from the card, then move the cursor away: the recognized word stays visible even when outside any capped set.
  - Dwell, then press and release at the same spot: revealed words persist through the dwell-to-pin handoff without flashing (existing R5 behavior from the dwell plan).
- **Verification:** the four field states (idle, dwell, drag, post-pin) screenshot cleanly with no overlapping deep-word pile in the angry, sad, and fear clusters; word count within any reveal is ≤6 per source.

## Scope Boundaries

### Deferred to Follow-Up Work

- Progressive reveal — surfacing the next ring of deep words when the user keeps dwelling past the initial cascade. Deliberately excluded so this stays a cap-only change; it would redesign dwell state.
- Extracting the two reveal-map computations into a shared, unit-testable helper. Worth doing if a test runner is ever added.

## Sources

- Measured worst case: probing the field grid at radius 0.35 finds up to 54 words (12 surface + 42 deep) inside a single reveal zone around x 0.5–0.7, y −0.5 to −0.7 (`src/data/emotions.ts`, 188 words: 39 surface, 149 deep).
- `docs/brainstorms/2026-07-06-003-dwell-reveal-fade-requirements.md` — the calm-surfacing goal this change enforces.
