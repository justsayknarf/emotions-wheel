---
title: "Coordinate-Primary Recording with Field-Tray Coordination"
status: draft
date: 2026-07-01
tags: [interaction, selection, coordinates, vocabulary, recognition, tray, field]
supersedes: docs/brainstorms/2026-06-24-001-coordinate-first-selection-requirements.md (partial)
actors:
  - A1: User (single person, mobile-first, also desktop mouse)
---

# Coordinate-Primary Recording with Field-Tray Coordination

## Problem

The coordinate-first model ships with a latent contradiction: the field lets you plant a pin anywhere, but the tray only opens when you land within `SELECTION_RADIUS` of a word. This implies that proximity to an emotion word is required to proceed — the opposite of what coordinate-first is supposed to communicate.

A second, deeper issue: even when the tray does open, it auto-assigns the nearest word as the entry's label. This positions the word as a required, accurate match. The starting cost of every check-in then becomes "I need to find the right word," which is the highest-friction moment in emotional articulation. The emotion label is being asked to do diagnostic work it should not do.

## Design Principle

**The coordinate is the record. Words are vocabulary scaffolding.**

A check-in is complete with only a coordinate. The (x, y) point on the circumplex is the user's truth — it captures valence, arousal, and position in emotional space with more precision than any single word can. Words are present to help users grow vocabulary over time through recognition, not to define or validate the entry.

The design must never encourage "searching for the right word." If a word resonates when the user sees it, they add it. If nothing resonates, the coordinate stands alone.

## What Changes from the Prior Model

This document supersedes the following behaviors in `docs/brainstorms/2026-06-24-001-coordinate-first-selection-requirements.md`:

- **R2 (word auto-assignment) is removed.** Words are no longer auto-assigned when a pin lands within `SELECTION_RADIUS`. No word is ever attached to an entry without an explicit user tap.
- **F1 and F2 collapse into one flow.** The distinction between "near a word" and "between words" is eliminated. Every pin drop goes through the same path: coordinate recorded → tray opens → recognition pills offered.
- **Discovery words become universal.** The pills that previously appeared only in the between-word case now appear on every pin drop, always showing the 3 nearest words regardless of proximity.

The region description (relational + narrative per prior R4) is retained and remains the primary content of the coordinate card.

## Core Model

### One flow for all pin drops

Every press-release records the coordinate and opens the tray. There is no branch for "near enough to a word" vs. "between words." Proximity to a word affects which pills are offered; it does not affect whether the tray opens or whether the entry is valid.

### Three word states on the field

**Ambient** — word at normal opacity; not part of the active pin's neighborhood.

**Highlighted** — one of the 3 nearest words to the most recent pin, within proximity radius. Brightened on the field. Reflected as a pill in the tray. Represents vocabulary in the neighborhood, not a selection.

**Selected** — confirmed by the user tapping a pill. Holds its selected state across subsequent pin drops. Persists until the session ends or is cleared.

Highlighted ≠ Selected. The design must make this distinction visible. A word being highlighted means "you landed near this word." Tapping the pill is the user saying "this word resonates."

### Highlight shift on new pin

When a second pin is dropped, the highlighted set clears and re-derives from the new pin's 3 nearest words. Selected words remain selected — they are not affected by subsequent pin drops.

### Words are additive

Tapping a pill adds the word to the entry. The entry is valid and complete whether zero, one, two, or three pills are tapped. There is no UI state that implies the user "should" tap a pill before proceeding.

---

## Key Flows

### F1: Every pin drop

1. User presses on the field; traversal press-reveal and crosshair activate as before.
2. User releases at a coordinate (anywhere on the field).
3. Coordinate is recorded as the entry.
4. The 3 nearest words within `VISIBILITY_RADIUS` shift to **highlighted** state on the field.
5. Tray opens. Coordinate card shows: region description (relational + narrative) and (x, y).
6. Below the coordinate card: up to 3 recognition pills, one per highlighted word.
7. User taps any pills that resonate (zero to three). Each tap transitions that word to **selected** on the field.
8. User proceeds when ready. No confirmation or pill tap is required.

### F2: Second pin in the same session

1. User drops a second pin while the tray is open.
2. Previous highlighted words return to **ambient** (or **selected** if confirmed). New pin's 3 nearest words shift to **highlighted**.
3. Tray appends a second coordinate card with the new pin's region description.
4. Pills below update to the new pin's 3 nearest words.
5. Words selected from the first pin retain their selected state on the field.

### F3: No nearby words

If the pin lands in a region where no words fall within `VISIBILITY_RADIUS`, no pills are shown. The coordinate card appears with region description only. The entry is complete as-is.

---

## Requirements

**R1 — Coordinate is always recorded.** Every press-release on the field records the (x, y) coordinate as the primary entry. The coordinate is complete on its own. No word proximity is required.

**R2 — Tray always opens.** The tray opens on every pin drop without exception. The distinction between "near a word" and "between words" does not affect tray visibility.

**R3 — No word auto-assignment.** No word is associated with an entry unless the user explicitly taps a pill. Landing within `SELECTION_RADIUS` of a word does not auto-assign that word. Recognition is always an explicit user action.

**R4 — Highlight 3 nearest words on field.** On pin release, the 3 nearest words within `VISIBILITY_RADIUS` shift to the highlighted state. If fewer than 3 words are within range, show what is available.

**R5 — Field-tray coordination.** The highlighted words on the field and the pills in the tray are the same set. Tapping a pill transitions the corresponding word on the field from highlighted to selected. The two surfaces are always in sync.

**R6 — Highlight clears on new pin.** When a second pin is dropped, the previous highlighted set clears. Selected words are unaffected. The new highlighted set derives from the new pin's 3 nearest words.

**R7 — Multiple pills tappable.** The user can tap any combination of the displayed pills. Each tap is independent. There is no enforced limit of one word per pin.

**R8 — Coordinate card content.** The tray card for a coordinate entry shows:
- Region description — relational primary ("between *tense* and *anxious*") and narrative secondary ("stirred up, a little on edge") per the prior region description spec.
- Recognition pills (0–3), presented as low-prominence tappable chips — not as a selection menu.

**R9 — Pills are low-prominence.** The visual treatment of pills must not imply that tapping one is required or expected. They are ambient offers, not a menu. A user who ignores all pills and proceeds should not feel they have done something incomplete.

**R10 — Free-text word entry deferred.** Users who have their own vocabulary for their emotional state cannot yet enter those words directly. This is explicitly deferred to a future iteration. The current model serves vocabulary building through recognition; free-text entry serves users who have already built that vocabulary.

---

## Scope Boundaries

**In scope:**
- Remove word auto-assignment on proximity
- Tray opens on every pin drop
- 3-word highlighted set on field, coordinated with tray pills
- Highlight shift on new pin; selected state persistence
- Low-prominence pill presentation

**Out of scope:**
- Free-text word entry
- Field word appearance before any pin is dropped
- Downstream diary review / how past entries render
- Direct field-tap word selection (pills in the tray are the selection surface; field highlights are informational)

---

## Success Criteria

- A user who drops a pin anywhere can complete a check-in without touching a pill
- A user who taps one or more pills feels they are adding vocabulary, not correcting an error
- No user state exists where the tray is closed and no entry has been recorded (tray gating is gone)
- The field and tray always agree on which words are highlighted and which are selected

---

## Open Questions

- **Visual distinction, highlighted vs. selected:** What is the exact visual treatment that makes "nearby but not chosen" legible vs. "confirmed"? (Design detail for planning; both states must be distinguishable.)
- **Deselect via pill re-tap:** If the user taps a pill, realizes the word doesn't fit, can they tap the pill again to deselect? Or is deselect only via re-pressing the field area? (Current field deselect model: re-press same area.)
- **Overlap state:** If a word is selected from a previous pin and also happens to be in the highlighted set of a new pin, which visual state takes precedence?
- **Pill count when fewer than 3 nearby words:** Show what's available; do not pad with words from outside the radius just to reach 3.

---

## Connections

- Partially supersedes `docs/brainstorms/2026-06-24-001-coordinate-first-selection-requirements.md` — R2, F1, F2 are replaced here; R3–R10 and R4 (region description) carry forward
- Affects `src/hooks/useProximity.ts` — SELECTION_RADIUS no longer gates tray opening or word assignment; used only to determine pill set
- Affects `src/components/EmotionField.tsx` — new word states (highlighted, selected) need distinct visual treatment
- Affects `src/components/EmotionDrawer.tsx` — tray opens on every pin; coordinate card always shown
- Affects `src/App.tsx` — `markerCoords` and `selectedEmotions` likely need to unify into a single per-entry structure (coordinate + optional word tags)
- Affects `src/types.ts` — `SelectedEmotion.label` must become nullable; or a new `Entry` type with coordinate + `string[]` word tags
