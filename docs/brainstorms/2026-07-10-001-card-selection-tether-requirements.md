---
title: "Selection-Driven Pin-to-Card Tether"
type: requirements
tags: [ux, tray, tether, selection, spatial-interaction, emotion-field]
date: 2026-07-10
topic: card-selection-tether
project: emotions-wheel
---

## Summary

Make the pin-to-card thread selection-driven. Clicking a card selects it — drawing the tether from that card's own coordinate to the card, highlighting the card, and emphasizing the matching pin on the field. The newest card auto-selects when a pin is dropped, so the thread is never absent; clicking another card moves the selection. One card is selected at a time.

## Problem Frame

Today the `Tether` (`src/components/EmotionField/Tether.tsx`) always connects the most-recent pin to the top card, wired in `src/App.tsx` as `pin={pins[pins.length - 1]}` with `cardEl` fixed to the first (i===0) card. With multiple pins/cards, the thread is stuck on the newest — the user can't ask "which point does *this* card describe?" for an older card. This sits in the Spatial interaction model track (`STRATEGY.md`): the tether is what makes a card read as a margin note on a point in emotional space, and it should follow the user's attention.

## Key Decisions

- **Selection drives the thread, card, and pin together.** Selecting a card is the single source of truth for: which card the tether ends at, which card shows a selected highlight, and which field pin is emphasized. The three always agree.

- **Auto-select the newest card on drop.** Dropping a pin selects its new card, so the tether appears immediately (preserving today's feel). Chosen over a blank-until-click state so the thread is never missing while cards exist (see origin decisions).

- **Bidirectional emphasis.** The selected card's matching pin brightens/enlarges on the field, closing the card↔point loop the thread implies — not card-side-only.

- **Single selection.** Selecting a card deselects any previous one; at most one tether, one highlighted card, one emphasized pin.

- **Card-body click selects; inner controls don't.** Clicking the card body selects it. The word pills (recognize/derecognize) and the × remove button keep their own actions and do not change selection.

## Requirements

**Selection behavior**

- R1. Clicking a card's body selects that card (and deselects any previously selected card).
- R2. When a pin is dropped, its newly created card becomes the selected card.
- R3. Clicking a word pill or the × remove button performs that control's action and does not change the current selection.

**Visual response to selection**

- R4. The selected card shows a distinct selected state (e.g., highlighted border/glow) that reads clearly against unselected cards.
- R5. The tether draws from the selected card's pin coordinate to the selected card (replacing today's fixed most-recent-pin → top-card thread).
- R6. The field pin corresponding to the selected card is emphasized (brighter/larger) while its card is selected; non-selected pins render normally.

**Edge behavior**

- R7. Removing the selected card reselects the newest remaining card (so the tether never dangles); removing the last card leaves no selection and no tether.
- R8. Clearing all pins resets selection to none (no highlight, no tether, no emphasized pin).

## Key Flows

- F1. **Select an older card.** With several cards present, the user clicks a lower card → the tether redraws from that card's pin to it, that card gains the selected highlight, its field pin emphasizes, and the previously selected card/pin return to normal. **Covers R1, R4, R5, R6.**
- F2. **Drop a new pin.** The user drops a pin → a new card appears already selected, with the tether drawn to it and its pin emphasized. **Covers R2, R5, R6.**
- F3. **Remove the selected card.** The user removes the selected card → selection falls back to the newest remaining card (tether + emphasis move there); removing the last card clears everything. **Covers R7.**

## Acceptance Examples

- AE1. **Given** three cards with the middle one selected, **when** the user clicks the bottom card, **then** the tether ends at the bottom card, only the bottom card is highlighted, and only the bottom card's pin is emphasized. **Covers R1, R4–R6.**
- AE2. **Given** a selected card, **when** the user taps one of its word pills, **then** the word toggles recognized/unrecognized and the selection/tether does not move. **Covers R3.**
- AE3. **Given** the selected card, **when** the user clicks its × remove, **then** the card disappears and selection moves to the newest remaining card (or clears if it was the last). **Covers R7.**

## Scope Boundaries

**In scope:** desktop companion-rail behavior — the tether is already desktop-only (`sideBySide`).

**Deferred / out of scope:**
- **Mobile thread.** On mobile (bottom-sheet drawer) there is no tether today. Selecting a card there may highlight the card and its pin but draws no thread; a mobile tether is not part of this work.
- Hover-preview of the tether (this is click-to-select only).
- Multiple simultaneous selections / multiple threads.

## Outstanding Questions

**Resolve during planning**
- Q1. **Selection-change animation.** When selection moves between cards, should the tether re-run its draw-in animation (redraw) or smoothly reposition its endpoints? Default assumption: a quick redraw; confirm the feel during implementation and tune.
- Q2. **Mobile selection.** Whether card selection + pin emphasis apply on mobile (without a thread) or selection is desktop-only. Default assumption: card + pin emphasis may apply on mobile, thread stays desktop-only.

## Sources / Research

- `src/components/EmotionField/Tether.tsx` — the existing thread; currently takes a single `pin` + `cardEl`.
- `src/App.tsx` — tether wiring (`pins[pins.length - 1]`, `activeCardEl` via `activeCardRef` on the i===0 card), `sideBySide` gating, pin state, remove/clear handlers.
- `src/components/EmotionPreview/EmotionDrawer.tsx` — renders reversed cards and sets `activeCardRef` on the top card (the hook this feature repurposes for the selected card).
- `src/components/EmotionPreview/CoordinateCard.tsx` — the card; has pill (recognize) and × remove controls whose clicks must not trigger selection.
- `src/components/EmotionField/EmotionField.tsx` — renders pins on the field; the place to emphasize the selected pin.
- `STRATEGY.md` — Spatial interaction model track.
