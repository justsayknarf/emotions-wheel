---
date: 2026-09-03
topic: single-pin-checkin
---

## Summary

Move every check-in entry point to one pin per check-in: a field press or
slider commit after the first pin relocates that pin instead of adding a
second one.

---

## Problem Frame

The product's original data model treats a check-in as a set of pins
(CLAUDE.md: "a recorded entry holds a set of pins") — every field press or
slider release after the first one appends another pin (`handlePinRelease`
in [App.tsx:424](../../src/App.tsx#L424)), rather than moving the one
that's already there. After using the shipped app, that no longer matches
expectation: the natural read of a second press is "move the pin I just
placed," not "add another feeling to this entry." The multi-pin model was
a deliberate hypothesis in the original strategy; this brainstorm revisits
it based on that usage.

---

## Key Decisions

- **Single-pin-per-check-in replaces the original multi-pin model,
  everywhere, in one pass.** Not staged behind the new-tab landing —
  applied uniformly to the new-tab landing and the ordinary rail/sheet
  flow on a direct web visit alike. An inconsistent mental model between
  entry points isn't worth preserving just to soften the rollout.

- **A second press or slider commit relocates the existing pin rather than
  adding one.** The relocate mechanism already exists —
  `handleAdjustPin(pinId, x, y)` ([App.tsx:753](../../src/App.tsx#L753))
  already moves an existing pin's coordinate in place; today it's only
  reachable from a card's own adjust slider. This decision reuses it
  rather than inventing a new mechanism.

- **Existing saved entries with multiple pins are left untouched.** No
  migration, no retroactive collapse. They render exactly as they do
  today in the diary and history views; the one-pin rule governs new
  check-ins going forward only.

- **Reopening a past multi-pin entry needs no new gating.**
  `handlePinRelease`'s existing `draftId !== null` guard already refuses
  any new pin drop while editing a reopened entry — so a reopened
  multi-pin entry already can't grow today, and this brainstorm doesn't
  need to add anything for that case. Every existing pin in that entry
  stays individually visible and adjustable.

---

## Requirements

- R1. A check-in holds exactly one pin. A field press or a slider commit
  after the first pin relocates that pin to the new coordinate instead of
  creating a second one. Recording a second feeling requires a separate
  check-in.
- R2. This model applies at every check-in entry point — the new-tab
  landing and the ordinary rail/sheet flow on a direct web visit — not
  scoped to one surface.
- R3. Existing saved check-ins that already hold multiple pins are
  unaffected; they display and remain editable exactly as they do today.
- R4. There is no way, at any entry point, to add a second, distinct pin
  within one check-in session.

---

## Key Flows

- F1. **First pin drop.** Trigger: user releases the new-tab landing's
  departure slider, or presses the field for the first time in a fresh
  check-in. Outcome: the pin mints, unchanged from today. Covers R1.
- F2. **Relocate via adjust slider.** Trigger: user drags an existing
  pin's adjust slider and releases. Outcome: the pin's coordinate updates
  in place — no new pin is created. Covers R1.
- F3. **Relocate via direct field press.** Trigger: user presses the
  field directly while a pin already exists. Outcome: the existing pin
  moves to the press coordinate — no new pin is created. Covers R1, R4.
- F4. **Reopening a past multi-pin entry.** Trigger: user reopens a
  previously saved check-in that already holds multiple pins, via the
  existing "reopen this entry instead" link. Outcome: unchanged from
  today — the existing `draftId` guard already blocks any new pin from
  being added; all original pins stay visible and individually adjustable.
  Covers R3.

---

## Acceptance Examples

- AE1. Given a check-in with one pin already placed at any entry point,
  when the field is pressed elsewhere, then the existing pin moves to the
  new coordinate and no second pin appears in the card list. Covers R1,
  R4.
- AE2. Given a previously saved entry with three pins, when it's reopened
  for editing, then all three pins remain visible and individually
  adjustable, and pressing the field does nothing — matching today's
  shipped behavior. Covers R3.

---

## Scope Boundaries

**Deferred for later**

- **The centered new-tab review card sitting on top of the pin it's
  reviewing is a real, separate problem — deliberately not solved here.**
  An opposite-quadrant corner snap was explored with a working mock; it
  read as the card visibly avoiding/fleeing the pin rather than making
  room for it, which is the wrong feeling for a check-in surface meant to
  feel calm and grounded (see CLAUDE.md's aesthetic guidance). Fixing
  this well will take iteration on the actual felt motion, not just a
  positioning formula — worth a dedicated brainstorm of its own once
  there's room to explore it properly, rather than folding it into this
  narrower single-pin change.
- Any terminology or data-model cleanup reflecting one-pin-as-default
  (e.g., the plural framing baked into `PinEntry[]` and its surrounding
  vocabulary). This pass changes interaction behavior only.

**Outside this product's identity**

- Capturing more than one simultaneous feeling within a single check-in.
  This was part of the original product thesis ("a recorded entry holds a
  set of pins") and is explicitly retired as the default interaction
  model by this brainstorm.

---

## Dependencies / Assumptions

- Builds on `handleAdjustPin`/`adjustPin`
  ([App.tsx:753](../../src/App.tsx#L753)) as the existing relocate
  mechanism.
- Confirmed by reading the code: reopening an existing entry
  (`draftId !== null`) already refuses any new pin drop via
  `handlePinRelease`'s existing guard — no additional gating is required
  for the multi-pin-entry-edit case (F4).

---

## Sources / Research

- [src/App.tsx](../../src/App.tsx) — `handlePinRelease` (append-only mint,
  existing `draftId` reopen guard), `handleFieldPress` (existing pre-mint
  no-op guard), `handleAdjustPin` (existing relocate mechanism),
  `handleDepart` — read in full to confirm today's shipped mint/relocate
  paths.
- CLAUDE.md, STRATEGY.md — the original "a recorded entry holds a set of
  pins" data-model statement this brainstorm's single-pin decision
  revises.
