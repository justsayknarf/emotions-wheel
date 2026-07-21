---
title: "Emotion Field: Radial-Intensity Re-audit"
type: requirements
tags: [ux, emotion-field, vocabulary, coordinates, intensity, density]
date: 2026-07-21
project: emotions-wheel
---

## Problem

The field is a **donut**: emotions crowd the outer ring, the center is empty. Measured over the current 188-word vocabulary (distance from origin, coordinates in [-1, 1]):

| Radius band | Words | Share |
|---|---|---|
| r ≤ 0.20 (inner core) | 0 | 0% |
| r ≤ 0.30 | 2 | 1% |
| r ≤ 0.40 | 5 | 3% |
| r 0.70–1.00 (outer ring) | 122 | 65% |
| r > 0.50 | 162 | 86% |

The inner ~40% of the radius — the entire "mild feeling" zone — holds 5 of 188 words. A user who feels *a little bit positive* or *slightly activated* lands in a sparse region with no vocabulary to recognize, so the field offers little nuance for low-intensity states. The emptiness also reads as unintentional — the field looks unfinished rather than designed.

The closest words to center (*Sensitive* r=0.28, *Expectant* r=0.29, *Interested* r=0.32, *Grounded* r=0.39, *Reflective* r=0.40) confirm that nuanced low-intensity vocabulary *belongs* here — there is simply far too little of it.

## The insight that shapes the fix

In the circumplex model the center is neutrality (low arousal, neutral valence), so emotions genuinely thin toward the origin — the naive fix of relocating strong words inward would misrepresent intensity. And the pure-render fixes (crop, fisheye, reshape) are counterproductive: the center is not pixel-cramped, it is *word-empty*; the crammed region is the outer ring. Cropping or magnifying the center would compress that outer ring further, re-crowding the density just resolved by the coordinate-anchored de-overlap work ([[2026-07-20-001-coordinate-anchored-words-requirements]], PR #8).

So the fix is a **data re-audit**, not a render trick — and done well it *relieves* the outer ring rather than fighting it.

## Chosen approach: radial = intensity

Re-audit the vocabulary onto a polar reading of the circumplex:

- **Angle = quality of feeling** (the valence/arousal direction) — a word's angular position stays semantically correct.
- **Radius = intensity** — mild variants sit near center, intense variants toward the edge (e.g. *annoyed → angry → furious* along one spoke).

This fills the center with honest low-intensity vocabulary (the felt nuance), spreads over-packed outer families inward (the visual balance, and outer-ring relief), and makes the field's geometry *mean something*. A **light signaling** cue communicates that intensity grows outward, without a clinical legend.

### Resolved structure

- **Always-visible tier = one anchor per spoke.** Each emotional direction (spoke) shows a single always-visible landmark (a mid-intensity word); its mild-inner and intense-outer variants are deep, revealed on dwell/pin. At rest the field is a balanced ring of anchors, evenly spaced by angle; dwelling down a spoke reveals its intensity gradient, which teaches the radial model implicitly. (This replaces the current flat 39-surface / 149-deep split.)
- **The very center (r ≈ 0) is an unlabeled still point.** Neutrality stays wordless — mild vocabulary begins in the inner *ring*, not at the origin. The still point is carried by the light-signaling affordance only.
- **The vocabulary is a hotswappable framework.** Every emotion model reduces to *words at coordinates*, so the dataset becomes a named, swappable framework (word, x, y, tier, spoke). The current custom set is one framework; the radial-intensity set is another; Plutchik/Willcox/circumplex variants can ship later as loadable datasets.
- **Authored by anchoring to a known framework as a vocabulary + intensity source**, mapped onto *this field's* circumplex axes (radius = intensity, mild inner → intense outer) — not by adopting another wheel's geometry wholesale. Note the frameworks disagree on radius: Russell's circumplex (what this field is) = intensity outward ✅; Plutchik = intensity but inverted; Willcox = granularity, not intensity. Lean for the first authored set: a circumplex-native valence/arousal source, which maps with zero translation.

## Goals

1. A user feeling a mild emotion finds recognizable low-intensity vocabulary near the center.
2. The field reads as evenly, intentionally filled — no empty core.
3. Radius carries a legible sense of intensity, softly signaled.
4. The re-audit relieves the over-crammed outer ring rather than worsening it.
5. Angle keeps encoding the quality of the feeling (circumplex semantics preserved).

## Success Criteria

- The radial histogram flattens: the inner *ring* populates (r 0.15–0.40 goes from 5 words to a meaningful spread) while the very core (r < ~0.15) stays a deliberate still point; the outer r 0.70–1.00 band drops well below 65%.
- Placing a pin at low intensity (in the inner ring) surfaces recognizable mild words nearby.
- At rest the field reads as an evenly-spaced ring of spoke anchors, not a donut.
- `pnpm lint:spacing` stays green (re-baselined to the new coordinates; no surface-surface overlaps).
- The intensity gradient is perceptible as intentional without any legend or instruction.
- A word's angular direction still matches its emotional quality (spot-checkable per family).

## Approaches Considered

Ten were surfaced. The decisive sort was **what each actually fixes**:

- **Render-only** (crop/rescale, fisheye warp, reshape the field) — rejected: the center is word-empty, not pixel-cramped, so these compress and re-crowd the outer ring, fighting PR #8.
- **Data, additive** (author ~20–40 mild words into the empty core, keep all other coordinates) — viable and low-churn, but leaves the outer ring as crammed as it is.
- **Data, algorithmic** (seed center anchors, then force-directed relaxation) — even coverage as an emergent property, but less hand-control over placement and risks moving words off their true angular quality.
- **Data, radial-intensity re-audit** — **chosen**: angle = quality, radius = intensity. Fills center + relieves outer ring + makes geometry meaningful. Highest effort, highest payoff.
- **Interaction** (center responds on approach with blended labels; intensity as a separate gesture) — deferred; a larger input-model reframe, out of this scope.
- **Reframe** (embrace the empty center as an intentional still point) — folded in partially as the *light signaling* of the neutral center.

## Scope Boundaries

### In scope
- Re-authoring emotion coordinates onto the radial-intensity model (angle = quality, radius = intensity), with one always-visible anchor per spoke.
- Authoring mild inner variants for families that lack them, anchored to a known framework as a vocabulary/intensity source.
- A **framework abstraction**: the vocabulary becomes a named, swappable dataset (word, x, y, tier, spoke) so alternative frameworks can be loaded.
- A light signaling affordance for the intensity gradient and the still center (wordless).
- Re-baselining `scripts/lint-emotion-spacing.mjs` to the new coordinates.

### Out of scope (deferred)
- All render-side fixes — cropping/rescaling the viewport, fisheye/non-linear axis warp, non-square field shapes. They fight the outer-ring density.
- Intensity as a separate input gesture (press-depth / radial-drag to set strength) — a larger interaction reframe.
- Center-responds-on-approach (generated/blended labels near the origin).

## Key Decisions

- **Data re-audit, not render.** Render tricks re-crowd the outer ring; the honest fix is placement.
- **Radial-intensity model** over additive-only (leaves outer ring crammed) and algorithmic relaxation (less control, angular-drift risk).
- **Light signaling** over purely implicit (misses the "intentional" goal) and explicit legend (too clinical for the app's recognition-first, minimal ethos).
- **Always-visible tier = one anchor per spoke** over landmarks-across-all-radii (closest to today, but less clean) and mild-core-as-surface (empties the edges at rest — inverts the imbalance).
- **Center = unlabeled still point** over a neutral anchor word / small neutral cluster — keeps the origin as honest "no strong feeling"; mild words live in the inner ring instead.
- **Vocabulary as a hotswappable framework**, authored by anchoring to a known emotion framework as a vocabulary/intensity *source* mapped onto this field's circumplex axes — not by adopting another wheel's geometry.

## Open Questions (for planning)

*Resolved during brainstorm: surface/deep remap → one anchor per spoke; exact center → unlabeled still point; vocabulary sourcing → anchor to a known framework, framework hotswappable. See Key Decisions.*

- **Which framework first.** The specific source for the first radial set — lean is a circumplex-native valence/arousal word set (maps to the axes with zero translation). Plutchik/Willcox become later swappable datasets.
- **Spoke count / definition.** How many spokes (angular directions) — i.e. how many always-visible anchors at rest — and how spokes map to the existing `cluster` field.
- **Re-placement method.** Per-word (keep each word's angle, adjust only its radius by intensity) vs. a fuller re-placement per spoke — the former better preserves current semantics.
- **Framework data shape.** How a framework is represented and selected in `src/data/` (what makes it swappable) — a technical design call for planning.
- **Reveal tuning.** With a populated inner ring, do `VISIBILITY_RADIUS` (0.35) and `DEEP_REVEAL_CAP` (6) need adjustment so a central dwell doesn't over-reveal?
- **Light-signaling form.** Soft concentric gradient vs. a quiet center still-point marker vs. both — a visual-design call for a design pass.

## Connections

- [[2026-07-20-001-coordinate-anchored-words-requirements]] — the shipped dots/de-overlap/tether work (PR #8) that this re-audit must stay compatible with and can relieve.
- `src/data/emotions.ts` — the 188-word coordinate set to re-audit.
- `scripts/lint-emotion-spacing.mjs` — the spacing guard to re-baseline.
- `src/hooks/useProximity.ts` — `VISIBILITY_RADIUS`, `DEEP_REVEAL_CAP` (reveal tuning).
