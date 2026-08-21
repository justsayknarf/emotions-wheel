---
date: 2026-08-21
topic: mobile-draft-tray-layout
---

# Mobile Draft Tray Layout — Requirements

## Summary

Three mobile-only (sheet variant) fixes to `EmotionDrawer`: once the draft
has pins, previous-check-in content hides entirely so the draft cards render
at the top; Discard Draft and Save move to a bottom-pinned bar below the
card list; and the peek ⇄ expanded transition animates instead of snapping.

## Problem Frame

The sheet variant's card list (`src/components/EmotionPreview/EmotionDrawer.tsx:452-531`)
renders, in order: the returning-summary block (relative time + "Recent
rhythm" strip), the previous check-in's read-only pin cards, then the
draft's own cards. The moment a mobile user drops their first pin, the new
draft card lands at the bottom of that stack — below all the historical
content — so confirming the drop requires a scroll.

The action bar (Discard Draft / Save,
`src/components/EmotionPreview/EmotionDrawer.tsx:187-242`) renders *before*
the card list on the sheet, but *after* it on the rail
(`src/components/EmotionPreview/EmotionDrawer.tsx:543-566`). The rail's
placement already works — the card list is the scrollable region (`flex:
1; overflow-y: auto`), and the action bar is a fixed sibling that stays
pinned below it. The sheet's placement is the odd one out.

The peek ⇄ expanded toggle (`isPeeked` at
`src/components/EmotionPreview/EmotionDrawer.tsx:581`) branches into two
structurally different `motion.div` returns with no shared layout or
`AnimatePresence` between them. Each individually animates in from
off-screen on mount, but toggling `isPeeked` doesn't mount or unmount the
parent — it just swaps which branch renders, so the height change between a
52px peek bar and a 46vh sheet snaps rather than animates.

These three fixes only affect the sheet variant. The rail docks beside the
field rather than over it, has no history-occlusion problem, and already
places its action bar after the card list.

## Key Decisions

- **Hide previous-check-in content wholesale, not just the cards.** Once
  the draft has pins, both the returning-summary block and the previous
  check-in's read-only cards disappear together, rather than leaving the
  summary visible on its own. Keeps the sheet unambiguously "this is your
  active draft," instead of mixing history and draft signals.
- **No peek-back to the previous check-in during an active draft.**
  Previous-check-in content is fully inaccessible until the draft is saved
  or discarded — no partial-view escape hatch. An active draft is a
  deliberate mode; a user who wants to re-check history can discard or
  save first.
- **Action bar moves to the bottom, mirroring the rail's existing
  pattern** rather than inventing new bottom-bar behavior: the card list
  stays the scrollable region, the action bar is a fixed sibling after it.
- **Consolidate the mid-drag hide condition into the broader "draft has
  pins" condition, rather than keeping both.** The existing
  `dragShrinkActive` guard (`src/components/EmotionPreview/EmotionDrawer.tsx:135`)
  already hides the same summary/cards content, but only while a slider is
  actively dragged — a strict subset of "the draft has pins." Once R1 hides
  that content under the wider condition, the narrower drag-specific guard
  becomes redundant.

## Requirements

**History visibility with an active draft**

- R1. On the sheet variant, once the draft has any pins, the
  returning-summary block (relative time + "Recent rhythm" strip) and the
  previous check-in's read-only pin cards both stop rendering.
- R2. The hide in R1 persists for as long as the draft has pins — there is
  no control to reveal the previous check-in's content again until the
  draft is saved or discarded.
- R3. With previous-check-in content hidden, the draft's own cards render
  as the top (and only) content in the sheet's scrollable card list.
- R4. The rail is unaffected by R1-R3: it keeps showing the previous
  check-in's group and the draft group side by side, as today.

**Action bar placement**

- R5. On the sheet variant, Discard Draft and Save render in a bar after
  the scrollable card list, not before it — matching the rail's existing
  placement.
- R6. The action bar stays pinned at the bottom of the sheet's visible area
  regardless of how many cards are in the list; the card list, not the
  action bar, is what scrolls.
- R7. Reopened-check-in editing (`isReopened`) is unaffected — its own
  local Discard Edit / Update Check-in row inside `editingSection` keeps
  its current position.

**Peek/expand transition animation**

- R8. Toggling between peeked and expanded on the sheet animates the
  height and position change rather than snapping between the two states.
- R9. The animation applies in both directions: collapsing to peek and
  expanding from peek.
- R10. The animation respects reduced-motion preference, consistent with
  the chevron rotation and other motion already gated on
  `useReducedMotion` in this component.

## Key Flows

- F1. Dropping the first pin with a previous check-in showing
  - **Trigger:** Mobile user drops a pin while the sheet shows the
    returning-summary block and previous check-in cards (R1-R3).
  - **Steps:** The returning-summary block and previous check-in cards
    disappear; the new draft card renders at the top of the now-empty card
    list.
  - **Outcome:** The user sees their new pin immediately, with no scroll
    and no competing historical content.

- F2. Toggling peek with an active draft
  - **Trigger:** User taps the peek bar or the in-sheet toggle handle while
    the draft has pins.
  - **Steps:** The sheet animates between the 52px peek bar and the full
    card list (R8-R9), instead of snapping.
  - **Outcome:** The transition reads as continuous motion consistent with
    the rest of the app's aesthetic, in both directions.

## Acceptance Examples

- AE1. **Covers R1, R2, R3.**
  - **Given:** Draft is empty, sheet expanded, previous check-in's summary
    and cards are visible.
  - **When:** User drops the first pin.
  - **Then:** The returning-summary block and previous check-in cards stop
    rendering. The new draft card is the top (and only) item in the card
    list. They stay hidden as long as the draft holds pins, with no control
    to bring them back.

- AE2. **Covers R5, R6.**
  - **Given:** Sheet expanded with 3 draft pins, enough to require
    scrolling the card list.
  - **When:** User scrolls the card list up and down.
  - **Then:** Discard Draft and Save stay fixed at the bottom of the sheet,
    unaffected by scroll position.

- AE3. **Covers R8, R9.**
  - **Given:** Sheet peeked with an active draft.
  - **When:** User taps the peek bar to expand, then taps the handle again
    to collapse.
  - **Then:** Both transitions animate the height/position change; neither
    snaps.

## Scope Boundaries

- Peeking back to view the previous check-in while the draft has pins —
  considered and rejected (see Key Decisions). Fully inaccessible until the
  draft is saved or discarded.
- The mid-drag slider-shrink transition (`dragShrinkActive`) — a separate
  mechanism from the peek/expand toggle. R8-R10's animation requirement
  doesn't extend to it.
- Rail (desktop) layout — unaffected; it already places its action bar
  after the card list and has no comparable history-occlusion problem.

## Dependencies / Assumptions

Builds on existing state: `canSave` (`pins.length > 0`), `isPeeked` /
`expanded` / `onToggle`
(`src/components/EmotionPreview/EmotionDrawer.tsx:121-122, 581`), and the
current `dragShrinkActive` condition
(`src/components/EmotionPreview/EmotionDrawer.tsx:135`), which becomes
redundant once R1 hides the same content under a wider condition and should
be removed rather than kept as a second, narrower guard alongside it. No
new state primitives are introduced.

## Outstanding Questions

**Deferred to Planning**

- Exact animation mechanism for R8-R9 (shared layout animation vs. a single
  persistent container with an animated height) and timing/easing values.

## Sources / Research

- `src/components/EmotionPreview/EmotionDrawer.tsx:452-531` — `cardList`'s
  current render order: returning-summary, previous check-in cards, then
  draft cards.
- `src/components/EmotionPreview/EmotionDrawer.tsx:187-242` — `actionBar`,
  rendered before `cardList` in the sheet branch.
- `src/components/EmotionPreview/EmotionDrawer.tsx:543-566` — the rail
  variant, which already places `actionBar` after `cardList`.
- `src/components/EmotionPreview/EmotionDrawer.tsx:581-662` — the
  `isPeeked` branch and the expanded-sheet branch: two structurally
  separate `motion.div` returns with no shared layout animation between
  them.
- `src/components/EmotionPreview/EmotionDrawer.tsx:130-135, 264-266,
  469-472, 488` — `dragShrinkActive`, the existing narrower hide condition
  this brainstorm's R1 supersedes.
- `docs/brainstorms/2026-08-20-draft-tray-peek-requirements.md` — prior
  brainstorm that introduced the peek-with-active-draft mechanism this one
  extends.
