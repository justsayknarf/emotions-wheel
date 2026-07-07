---
title: "Coordinate-First Selection — Flag Planting in Emotion Space"
status: draft
date: 2026-06-24
tags: [interaction, selection, coordinates, circumplex, vocabulary, discovery]
actors:
  - A1: User (single person, mobile-first, also desktop mouse)
---

# Coordinate-First Selection — Flag Planting in Emotion Space

## Problem

The current word-selection model frames the interaction as a choice from a vocabulary set. When multiple words are close but none are exactly right, users face a recognition-vs-selection asymmetry: they are much better at recognizing whether a word fits than at choosing between candidates. Forcing a selection from a visible set triggers the paradox of choice and positions the emotion label as a required accurate match rather than an approximation.

The circumplex coordinate space is the more precise instrument. A user who presses between "tense" and "anxious" is communicating something real — they are in that region of activated, negative valence — and the current model discards that signal by treating the between-word press as a failure.

## Goal

Reframe emotion selection as **planting a flag** at a coordinate in emotion space. The coordinate is the primary data point. The nearest word, when close enough, is a label — a vocabulary exposure moment, not a required choice. The space between words is meaningful, not empty.

Users should never face a failed selection. Every intentional press produces a record.

## Actors

**A1: User** — a person doing a moment-based emotional check-in. May be on mobile (touch) or desktop (mouse). Familiar enough with the field to place themselves spatially, but not necessarily with the vocabulary.

## Core Model

### Coordinate as primary artifact

Every press-release on the field records the coordinate pair (x, y) in the [-1, 1] circumplex space. This coordinate is always the primary selection — it is recorded regardless of what words are nearby.

### Word label as proximity signal

If the press coordinate falls within SELECTION_RADIUS of a word, that word is associated with the flag as its label. Proximity is the recognition signal: landing near a word implies agreement with it. No additional confirmation is required.

If the press coordinate falls outside SELECTION_RADIUS of any word, no word label is assigned. This is a valid selection, not a failure.

### Between-word space is meaningful

A flag planted between words communicates "I am in this region, not quite any single word." The drawer surface this positively: it describes the region in axis terms and offers nearby words as discovery items — vocabulary the user can optionally add if they resonate.

### Word distribution as infrastructure

For the model to work, the emotion word set must cover the field with no large unpopulated zones. Every coordinate a user is likely to press should have at least one word within VISIBILITY_RADIUS (~0.35 units). This is a distribution constraint on the data layer, not on the interaction.

---

## Key Flows

### F1: Plant a flag near a word

1. User presses in the region of a word (traversal v2 press-reveal activates)
2. Nearby words illuminate; nearest word scales up as candidate
3. User releases within SELECTION_RADIUS of a word → flag planted at exact press coordinate, word assigned as label
4. Drawer slides up: word card showing label, description, related words (existing behavior)
5. User can deselect the word via the × button in the drawer

### F2: Plant a flag between words

1. User presses in space between words (traversal v2 press-reveal activates)
2. Nearby words illuminate within VISIBILITY_RADIUS; none are within SELECTION_RADIUS at release
3. Flag planted at exact press coordinate; no word label assigned
4. Drawer slides up: **coordinate card** showing region description + nearby discovery words
5. User can tap a discovery word to add it to the diary entry (optional)

### F3: Add a discovery word from the coordinate card

1. Flag is in between-word state (F2)
2. User taps a discovery word pill in the drawer
3. Word is added to the diary entry — treated identically to a field-selected word
4. Word card replaces or supplements the coordinate card in the drawer
5. User can deselect via × on the word card

### F4: Multi-flag session

1. User plants flag A anywhere in the field (F1 or F2)
2. User plants flag B in a different region
3. Each flag independently records its coordinate and optional word label
4. Drawer stacks all selections — coordinate cards and word cards can coexist

---

## Requirements

**R1 — Flag at coordinate.** Any pointerup records the press coordinate (x, y) as the primary selection. The coordinate is always recorded, regardless of word proximity. This supersedes traversal v2 R6 ("empty-space release is a no-op") — a between-word release is a valid, meaningful selection.

**R2 — Word label by proximity.** If the press coordinate is within SELECTION_RADIUS of a word at release, that word is associated as the flag's label. No additional gesture is required.

**R3 — No forced word assignment.** When a flag is outside SELECTION_RADIUS of any word, no word is auto-assigned. The nearest word is not forced as the label regardless of distance.

**R4 — Region description.** Each flag is described using two layers of language:
- **Relational** (primary): describe the position in terms of the nearest words — "between *tense* and *anxious*" or "closer to *tense* than to *anxious*." This is the vocabulary teaching moment — the user learns the neighborhood, not just the nearest word.
- **Narrative** (secondary): a short emotional phrase derived from the coordinate's axis position — e.g., "stirred up, a little on edge" for high-arousal, slightly-negative space. In v1, this is a pre-defined lookup table mapping arousal and valence ranges to emotional phrases. LLM-generated narrative enhancement is explicitly deferred to a future version.

Raw coordinate values and clinical axis labels ("high arousal, -0.3 valence") are not surfaced to the user.

**R5 — Discovery words.** When a flag has no word label (between-word case), the drawer shows words within VISIBILITY_RADIUS as optional discovery items (target: 2–3 words). These are presented as pills or compact labels, clearly distinct from the region description.

**R6 — Discovery word equivalence.** A discovery word added from the drawer enters the diary entry as a standard word selection — it appears in the session record and history identically to a field-proximity selection.

**R7 — Multi-flag.** Multiple flags can be planted per session. Flags are independent; each records its own coordinate and optional word label. No limit on count beyond what the existing multi-select model supports.

**R8 — Word distribution coverage.** The emotion word set must be distributed such that no region of the field larger than VISIBILITY_RADIUS (~0.35 units radius) is entirely empty. Audit the current `src/data/emotions.ts` coordinate spread before shipping; redistribute or add words where coverage gaps are found.

**R9 — Crosshair interaction cursor.** During a press gesture, the system cursor is replaced by a crosshair rendered at the exact press point. The crosshair is visually inoffensive — thin lines, light weight, small footprint; not a heavy targeting reticle. It follows movement while pressed, acting as the live reveal center.

**R9a — Dynamic crosshair label.** While pressed, the crosshair displays a live label showing the current nearest word or region description, updating in real time as the user moves. This provides vocabulary discovery *before* commitment — the user can observe what different areas of the field are called by moving through them. The label shows the nearest candidate word when within VISIBILITY_RADIUS of one; otherwise it shows the region description (relational + narrative per R4).

**R9b — Settled flag marker.** On release, the crosshair settles into a persistent flag marker at the exact release coordinate. The label at the marker reflects the committed state: the word name if within SELECTION_RADIUS, or the region description if between words. The flag marker coexists with word highlights in the field (amber for close-proximity selections).

**R10 — Session record.** The diary/history entry for a session must surface: the flag coordinate as a position indicator (visual or prose), the region description on the valence/arousal axes, and any word labels (proximity-assigned or discovery-added). The existing "only word IDs" record format is insufficient; coordinate data must be part of the persisted entry.

---

## Scope Boundaries

**In scope:**
- Flag-at-coordinate selection model
- Coordinate card in the emotion preview drawer (region description + discovery words)
- Word distribution audit and redistribution
- Session record updated to include coordinate + region data
- Crosshair interaction cursor with live label (during press) and settled flag marker (after release)

**Out of scope for this feature:**
- Axis grid lines or valence/arousal labels overlaid on the field
- Hover-only preview of region without pressing (desktop enhancement, deferred)
- Visual distinction between proximity-selected and discovery-added words in the diary record — treat them identically for now, revisit if analysis shows the distinction matters
- Animated reveal radius ring (deferred from traversal v2, still deferred)
- Named quadrant zones (upper-left = "tense cluster," etc.) — region description uses relational + narrative language, not quadrant branding
- LLM-generated narrative phrases — the narrative layer in v1 uses a pre-defined lookup table; LLM enrichment of that phrase is a natural future enhancement once the coordinate data layer is established

---

## Success Criteria

- A user who presses between two words completes the check-in without a "failed to select" state
- A user who presses near a word gets that word as their label without additional tapping
- The session record communicates where the user placed themselves on the valence/arousal axes, not only which word they selected
- Discovery words in the between-word drawer feel like an invitation, not another selection menu

---

## Open Questions

- **Region description language:** Resolved — relational primary ("between *tense* and *anxious*") plus narrative secondary phrase ("stirred up, a little on edge") from a lookup table. LLM enrichment deferred to future version.
- **Discovery word count:** 2–3 nearby words is the working target. What radius determines "nearby" for the discovery set — VISIBILITY_RADIUS (0.35)? A tighter range?
- **Coordinate card visual:** How does the coordinate card look compared to a word card? Does it include a mini circumplex dot? A prose axis read-out? Both?
- **Flag marker visual:** Resolved — inoffensive crosshair replaces cursor during press, with a live label following it showing the nearest word or region description in real time. Settles as a persistent flag marker at release coordinate. Hover-only crosshair on desktop (without press) is deferred.
- **History entry format:** The diary entry currently persists an array of `SelectedEmotion` objects. Coordinate-only flags have no word `id`. Does the schema need a new type, or can `id` be nullable for coordinate-only entries?

---

## Connections

- Supersedes traversal v2 R6 in `docs/brainstorms/2026-06-22-001-traversal-v2-requirements.md` — empty-space release is now a valid selection
- Extends the emotion preview drawer plan `docs/plans/2026-06-24-001-feat-emotion-preview-drawer-plan.md` — drawer needs a second mode (coordinate card) for between-word flags
- Affects `src/data/emotions.ts` — word distribution audit required
- Affects `src/types.ts` — `SelectedEmotion` and `DiaryEntry` may need schema extension for coordinate-only entries
- Affects `src/hooks/useProximity.ts` — SELECTION_RADIUS gating behavior changes (flag always records, word label conditional)
