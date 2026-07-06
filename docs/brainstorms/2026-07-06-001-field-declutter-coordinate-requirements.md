---
title: "Emotion Field: Declutter + Coordinate Visibility"
type: requirements
tags: [ux, emotion-field, coordinate, noise-reduction, word-cloud]
date: 2026-07-06
project: emotions-wheel
---

## Problem

The emotion selector field renders all 242 emotion words at 15% ambient opacity at all times, then brightens nearby words as the user hovers. The result is a visually noisy word cloud where dense clusters (angry: 25 words, sad: 19, joyful: 18) overlap and compete. Hovering makes things worse, not better — it adds more bright words to parse rather than filtering down to fewer.

Separately, the coordinate — the primary thing being recorded — is invisible. The V/A readout was removed from the card because the format was jargon-y, but the underlying coordinate is the meaningful output of the session. Users have no feedback on where in the valence/arousal space their pin has landed.

## Goals

1. Reduce word density on the field to a visually manageable set by default.
2. Make the emotion vocabulary progressively more specific as the user commits to a position.
3. Make the coordinate position legible — during drag and after placement — without reintroducing raw number jargon.

## Success Criteria

- Default field renders significantly fewer words than 242, eliminating the worst cluster pile-ups.
- Placing a pin reveals additional emotionally specific vocabulary in that region — without requiring a separate UI toggle.
- Axis position is communicated in real time as the user drags.
- The card shows where on each axis the pin landed in plain language.
- The interaction model is unchanged: touch-drag-release to place a pin. No new gestures required.

## Key Flows

### F1: Explore before placing

User opens the field. Surface-depth emotions are visible at low ambient opacity. The field feels calm rather than busy. User drags — axis position indicator appears live on the field edges. Nearby surface words light up through proximity.

### F2: Place a pin

User releases. Pin appears at the dropped coordinate. The CoordinateCard shows: relational text, narrative, and a readable axis position summary ("more activated, lightly positive"). Deep emotions within the pin's vicinity fade in alongside the already-visible surface words — the act of committing to a position unlocks finer-grained vocabulary nearby.

### F3: Recognize and tag

User sees deep emotion words that appeared after pin drop. One resonates. They tap it — it joins the "Recognized" list in the card. The word and position are recorded together.

## Requirements

### R1 — Surface-only default

The emotion field renders only `depth: 'surface'` emotions by default. Deep emotions are not rendered (not merely hidden — not mounted) until triggered by R3.

**Rationale:** Defaulting to surface depth eliminates the most severe density in the anger, sadness, and joyful regions, which are all deep-heavy (angry: 3 surface of 25 total; sad: 3 of 19; joyful: 6 of 18). Two clusters (guilt, powerless) become invisible by default — appropriate, since these states are genuinely harder to name and belong to the post-placement discovery phase.

### R2 — Lower ambient opacity floor

The ambient opacity floor is reduced from 0.15 to approximately 0.05. Proximity lighting behavior (brightening to 1.0 as the cursor approaches) is unchanged.

**Rationale:** Surface-only words at 0.15 are still busy; surface-only at 0.05 creates a faint topographic effect that is present but not demanding.

### R3 — Pin drop reveals nearby deep emotions

When a pin is placed (pointer release event), deep emotions within `VISIBILITY_RADIUS` of the pin's coordinate light up using the same proximity opacity model as surface emotions, anchored to the pin position rather than the cursor position.

- Deep emotions outside the pin's radius remain hidden.
- If the pin is removed, deep emotions that were revealed by that pin return to hidden (not ambient).
- With multiple pins: each pin independently reveals deep emotions in its own radius. A deep emotion visible from one pin may be hidden once only that pin is removed.

**Boundary condition:** The reveal radius for deep emotions uses the existing `VISIBILITY_RADIUS` value (0.35). If this produces too large a reveal zone in practice, the planning phase should tune it — but the behavioral intent is "nearby" (same region), not "field-wide."

### R4 — Axis position indicator during drag

While the user is actively dragging (pointer down, before release), the field shows a subtle position indicator on each axis edge:

- One indicator on the horizontal axis (arousal: calm ↔ activated)
- One indicator on the vertical axis (valence: negative ↔ positive)
- The indicator moves in real time with the cursor/touch position
- The indicator disappears when not actively dragging (between interactions)
- Visual style: consistent with the existing axis label treatment — low-contrast, recessive, non-distracting

**Format of indicator:** Unresolved. Options include a sliding dot on the axis line, a percentage readout next to the axis label, or a bracket/reticle. This is a planning-phase design decision.

### R5 — Readable coordinate in the card

After a pin is placed, the CoordinateCard shows the pin's axis position in plain language. This replaces the previously removed "V +0.65 · A +0.60" jargon.

- The format communicates position qualitatively, not as raw floats.
- Example formats (planning to decide): "More activated, strongly positive" or progress bars labeled Calm/Activated and Negative/Positive.
- The coordinate display is secondary to the relational text and narrative — it should not compete visually.

## Scope Boundaries

### In scope
- Filtering rendered words by `depth` in `EmotionField`
- Adjusting ambient opacity floor in `useProximity`
- Post-placement deep-emotion reveal logic tied to pin position
- Axis position indicator during drag in `EmotionField`
- Readable coordinate display in `CoordinateCard`

### Out of scope
- Admin-style dot map replacing words in the main app
- Cluster-label navigation (tapping a cluster to expand)
- Any change to how pins are placed or how recognized words are added to the card

## Outstanding Questions

1. **Axis indicator visual form:** Sliding dot on axis edge, percentage readout, or another treatment? (Planning decision)
2. **Card coordinate format:** Progress bars, qualitative label, or inline text? (Planning decision)
3. **Multi-pin deep reveal overlap:** If two pins both reveal the same deep emotion, is its opacity additive or capped at 1.0?
4. **Surface-only deep clusters:** Guilt and powerless are entirely deep-depth — users who land in that region before placing a pin see nothing. Is that acceptable, or should those regions get one surface-depth representative each?

## Dependencies / Assumptions

- The `depth` field (`'surface' | 'deep'`) exists on all 242 `Emotion` records in `src/data/emotions.ts` — confirmed.
- `VISIBILITY_RADIUS` (0.35) is the existing proximity constant in `src/hooks/useProximity.ts` — confirmed.
- `useProximity` currently takes a `revealCenter` point; extending it to support multiple centers (hover + one-per-pin) is a planning-time design choice.

## Connections

- `src/components/EmotionField/EmotionField.tsx` — renders the word field; R1, R3, R4 land here
- `src/hooks/useProximity.ts` — proximity opacity logic; R2, R3 depend on this
- `src/components/EmotionPreview/CoordinateCard.tsx` — card display; R5 lands here
- `src/data/emotions.ts` — 242 emotions with `depth` field; verified as source of truth
- Grounding dossier: `/tmp/compound-engineering/ce-brainstorm/noise-reduction-2026-07-01/grounding.md`
