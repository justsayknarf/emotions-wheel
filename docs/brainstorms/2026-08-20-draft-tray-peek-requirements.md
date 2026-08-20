---
date: 2026-08-20
topic: draft-tray-peek
---

# Draft Tray Peek — Requirements

## Summary

Extend the existing peek/collapse mechanism on the mobile sheet so it also
works once the draft has pins, not only on an empty draft. The toggle becomes
reachable any time; while a card slider is actively dragged, sibling cards and
the action bar hide so only the active slider stays visible, shrinking the
tray's footprint without touching the control mid-gesture.

## Problem Frame

`EmotionDrawer`'s sheet variant already has a peek/collapse affordance
(`isPeeked` at `src/components/EmotionPreview/EmotionDrawer.tsx:555`), built
for the returning-mirror empty state. It's gated to `!canSave` — the moment
the draft has a pin, the toggle handle disappears entirely and the sheet is
stuck at `maxHeight: 46vh` (`src/components/EmotionPreview/EmotionDrawer.tsx:651`)
with no way to collapse it.

That gap didn't matter much until the adjustable-pin-card sliders shipped
(`adjustDraft` in `src/App.tsx:79-81`, `dragAxis`/`commitAxis` in
`src/components/EmotionPreview/CoordinateCard.tsx:296-335`): a user can now
drag a pin to a new position without ever seeing where it lands, if that
position falls in the ~46vh band the expanded tray covers. Confirmed in
dialogue: this is a real, band-localized issue (only bites when the pin is in
the covered band), and it matters both while dragging and after release, at
rest. It isn't a daily-workflow pain for an experienced user who trusts the
card's numbers — the STRATEGY.md "spatial interaction model" track is what
raises the stakes: the field is the primary teaching surface for a first-time
tracker, and it's unavailable at exactly the moment (adjusting a pin) that
teaches the most.

## Key Decisions

- **Extend the existing peek mechanism rather than build a new one.** Reuse
  `mirrorExpanded` / `onToggle` / `isPeeked` — already proven by the earlier
  [[collapsible-checkin-tray]] work — instead of introducing a new UI surface.
- **Shrink chrome during drag rather than collapse the whole tray.** Fully
  collapsing to the peek bar would unmount the card holding the slider the
  user's finger is on mid-gesture. Hiding sibling cards and the action bar
  keeps the active control mounted throughout.
- **Snap back to the full card list on release, not to peeked.** Prioritizes
  uninterrupted draft workflow (multiple pins, reaching Save) over automatic
  at-rest visibility; checking the resting position is a manual tap away via
  the now-available toggle.
- **Two alternative approaches were considered and rejected.** Auto-peek with
  a floating slider hoisted above the peek bar (real new UI, and moving the
  active control mid-gesture risks a dropped touch — the same class of bug
  `AGENTS.md` already flags from the removed field swipe gesture). A compact
  live spatial readout embedded in the card (avoids touching tray geometry,
  but only gives a proxy signal — it doesn't satisfy the actual ask of seeing
  the pin on the field, which is the point per the STRATEGY.md rationale
  above).

## Requirements

**Peek availability with an active draft**

- R1. The peek/collapse toggle is available whenever the sheet-variant tray
  is showing a draft with pins, not only when the draft is empty.
- R2. Toggling to peek reveals the field beneath, including the band the
  expanded tray would otherwise cover.
- R3. The reopened-check-in edit flow (`isReopened`) keeps its own Discard
  Edit / Update Check-in controls and does not gain this toggle.

**Mid-drag visibility**

- R4. While a card slider is actively being dragged, sibling pin cards and
  the action bar hide, leaving only the actively-dragged card visible.
- R5. The actively-dragged slider is never unmounted or repositioned during
  the drag — the shrink only removes surrounding chrome.

**Post-release and default behavior**

- R6. Releasing a slider restores the full card list (siblings and the
  action bar), not the peeked state.
- R7. The tray's default state on a fresh pin drop remains fully expanded,
  unchanged from today.

**Peek bar content**

- R8. When peeked with an active draft, the peek bar's label reflects the
  draft in progress rather than "Last check-in," so it doesn't misdescribe
  an active edit as history.

## Key Flows

- F1. Adjusting a pin whose draft position falls in the covered band
  - **Trigger:** User drags an axis slider on an expanded card.
  - **Steps:** Sibling cards and the action bar hide (R4); only the active
    card's slider remains, and the field's existing ghost/travel overlay
    becomes visible in the freed space; on release, the adjustment commits
    and the full card list restores (R6).
  - **Outcome:** Live feedback is visible mid-drag without disturbing the
    active gesture.

- F2. Checking a resting pin
  - **Trigger:** Draft has pins, tray is expanded, user taps the peek toggle
    (R1).
  - **Steps:** Tray collapses to the peek bar with draft-in-progress copy
    (R8); the field beneath, including the previously covered band, becomes
    visible and interactive.
  - **Outcome:** User confirms the resting position; tapping the peek bar
    again returns to the full card list.

## Acceptance Examples

- AE1. **Covers R1, R3.**
  - **Given:** Draft has 2 pins, `isReopened` is false.
  - **When:** User taps the peek toggle.
  - **Then:** Tray collapses to peek. The toggle never renders while
    `isReopened` is true — that flow keeps its own controls.

- AE2. **Covers R4, R5, R6.**
  - **Given:** Expanded card list with 3 pins.
  - **When:** User starts dragging pin B's X slider.
  - **Then:** Pin A's and pin C's cards and the action bar hide; pin B's
    card, with its live slider, stays visible and mounted. On release, A, C,
    and the action bar reappear.

## Scope Boundaries

- Auto-peek with a floating slider, and an in-card live spatial readout —
  considered, rejected (see Key Decisions).
- Desktop rail — unaffected; it docks beside the field, not over it, so
  there's no occlusion to fix, matching the exemption already established in
  [[collapsible-checkin-tray]].
- Guaranteeing the covered band always fully clears during a drag — the
  mid-drag shrink reduces the footprint but isn't sized to the draft's live
  position, so full clearance isn't guaranteed in every case.

## Dependencies / Assumptions

Builds entirely on state that already exists — `adjustDraft`
(`src/App.tsx:79-81`), `mirrorExpanded` / `onToggle`
(`src/App.tsx:570-571`), and `isPeeked` (`src/components/EmotionPreview/EmotionDrawer.tsx:555`)
— no new state primitives.

## Outstanding Questions

**Deferred to Planning**

- Exact copy for the peeked "draft in progress" label (R8).
- Whether the peek bar's summary line during an active draft shows pin
  count, or nothing beyond the label.

## Sources / Research

- `src/components/EmotionPreview/EmotionDrawer.tsx:174-225` — the action bar
  and its unconditional "Discard Draft" / "Save" buttons.
- `src/components/EmotionPreview/EmotionDrawer.tsx:542-627` — the peeked
  render branch, currently gated to `!canSave`.
- `src/components/EmotionPreview/EmotionDrawer.tsx:630-709` — the full-sheet
  render branch, `maxHeight: 46vh`.
- `src/App.tsx:79-81, 205-213, 570-571` — `adjustDraft`, `fieldBottom`, and
  `mirrorExpanded`/`onToggle`.
- `src/components/EmotionPreview/CoordinateCard.tsx:296-335` — slider drag
  state (`dragAxis`, `cancelAxis`, `commitAxis`).
- `STRATEGY.md` — "Spatial interaction model" track, primary persona (the
  first-time tracker).
- `docs/brainstorms/2026-07-31-collapsible-checkin-tray-requirements.md` —
  prior art establishing the peek pattern and the desktop-rail exemption.
