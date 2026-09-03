---
title: "feat: Single-pin check-ins"
type: feat
date: 2026-09-03
origin: docs/brainstorms/2026-09-03-single-pin-checkin-requirements.md
---

# feat: Single-pin check-ins

## Summary

Make `handlePinRelease` relocate the existing pin instead of appending a
second one, everywhere a check-in can be started, so a check-in always
holds exactly one pin going forward.

---

## Problem Frame

Confirmed live against the shipped code: `handlePinRelease`
([src/App.tsx:424](../../src/App.tsx#L424)) unconditionally appends every
new pin (`setPins(prev => [...prev, withOrigin(entry)])`) — both call sites
that reach it (`handleDepart` at [App.tsx:474](../../src/App.tsx#L474), the
departure-slider commit; and `handleFieldPress` at
[App.tsx:544](../../src/App.tsx#L544), every direct field press) converge
on this one function, so a second press or slider release always grows the
draft rather than moving what's already there. This no longer matches
expectation after using the shipped app (see origin document's Problem
Frame).

---

## Key Technical Decisions

- **Single-pin enforcement lives entirely inside `handlePinRelease`.**
  Confirmed via research that both real call sites already converge on this
  one function, and that `CoordinateCard.tsx`/`EmotionDrawer.tsx`'s card-list
  rendering is already single-pin-shaped (a `CoordinateCard` takes exactly
  one `PinEntry`; `cardList`'s array-mapping already renders N=1 correctly
  and must keep rendering legacy N>1 entries unchanged per R3). No rendering-
  layer changes are needed for R1/R2/R4.

- **The relocate branch preserves the existing pin's identity.** It must
  reuse `adjustPin(existingPin, x, y)`
  ([src/data/pins.ts:23](../../src/data/pins.ts#L23)) — which already
  preserves `id`/`origin`/`recognizedWords` and only refreshes
  `x`/`y`/`regionDescription` — rather than adopting the fresh `PinEntry`
  object callers already build (a new `uuidv4()`, empty `recognizedWords`).
  This is a correctness constraint, not a design choice: doing otherwise
  would silently reset a pin's recognized words and break any code keying on
  its `id` (`selectedPinId`, `AnimatePresence key={pin.id}`).

- **A field-press relocate is a quiet update, matching the existing
  slider-adjust path.** `handleAdjustPin`
  ([App.tsx:753](../../src/App.tsx#L753)) today only updates `pins` and
  clears `adjustDraft` — no re-entrance animation, tray expansion, tether
  bump, or scroll-to-top. The new field-press relocate branch mirrors that:
  no `setMirrorExpanded`/`setEnteringPinId`/`setTetherKey`/scroll. The
  original mint (first pin) keeps its existing fanfare unchanged.

- **No extra guard is needed to stop the departure trace from re-firing on
  relocate.** `isDepartureEligible` requires `draftPinCount === 0`
  ([src/data/departure.ts:51](../../src/data/departure.ts#L51)) — once the
  single pin exists, this is already structurally false on every subsequent
  commit.

- **No extra guard is needed for editing a legacy multi-pin entry.**
  `handlePinRelease`'s existing `draftId !== null` refusal
  ([App.tsx:432](../../src/App.tsx#L432)) already blocks any new pin from
  landing while reopened — this is F4/R3's existing safety net, unchanged.

- **The relocate branch reads the existing pin through `setPins`'s own
  functional updater, never through the closed-over `pins` variable.**
  `handlePinRelease`'s `useCallback` dependency array is
  `[draftId, pins.length, previousCheckIn, anchorPin]`
  ([App.tsx:465](../../src/App.tsx#L465)) — it tracks `pins.length`, not
  `pins`' contents, because today the function never reads a pin's fields.
  `handleAdjustPin`/`handleRecognize`/`handleDerecognize` all mutate
  `pins[0]` in place without changing its length, so a relocate reading
  `pins[0]` straight from the closure could read a stale pin (missing an
  interim slider adjustment or recognized word). Sourcing the base pin from
  `setPins`'s own updater sidesteps the closure entirely — the same
  convention every other pin mutation in this file already uses.

- **The relocate branch does not need to call `setSelectedPinId`.**
  Confirmed via `resolveActiveSelection`
  ([src/data/checkIn.ts:91](../../src/data/checkIn.ts#L91)): it matches
  `selectedPinId` against the draft pins by `id` first, before falling back
  to "last draft pin." Since relocate preserves the pin's existing `id`
  (per the identity-preservation KTD above), the id set at mint time stays
  valid and keeps resolving to the same pin — nothing needs to re-set it.

---

## Requirements

(Carried from origin: docs/brainstorms/2026-09-03-single-pin-checkin-requirements.md.)

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

## Implementation Units

### U1. Branch `handlePinRelease` into mint vs. relocate

**Goal:** Every existing call path (`handleDepart`, `handleFieldPress`)
relocates the single existing pin instead of appending a second, everywhere.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None.

**Files:**
- `src/App.tsx` (`handlePinRelease`, ~424-465)
- `src/data/pins.ts` (`adjustPin`, reused unmodified)

**Approach:** Inside `handlePinRelease`, after the existing `draftId !== null`
early return, branch on whether `pins.length > 0`:
- `pins.length === 0` — unchanged: today's mint path (`withOrigin`, append,
  select, tray expand, tether bump, scroll-to-top).
- `pins.length > 0` — new relocate path: `setPins((prev) => [adjustPin(prev[0],
  entry.x, entry.y)])`, reading the base pin from `setPins`'s own updater
  rather than the closed-over `pins` variable (preserving its `id`/`origin`/
  `recognizedWords`, per the KTD above), and stop there — no
  `setMirrorExpanded`/`setEnteringPinId`/`setTetherKey`/scroll (KTD:
  matches `handleAdjustPin`'s existing quiet-update shape).

**Test scenarios:**
- Happy path: first field press with `pins.length === 0` mints a new pin,
  identical to today's behavior.
- Happy path: a second field press, with `pins.length === 1`, moves the
  existing pin's `x`/`y`; `pins.length` stays `1`; the pin's `id`,
  `origin`, and `recognizedWords` are unchanged. Covers R1, R4.
- Edge case: a pin with non-empty `recognizedWords` keeps them after a
  relocate.
- Edge case: adjust a pin's coordinate via its card's slider (committing
  through `handleAdjustPin`), then immediately relocate it via a field
  press — the relocate must land on the slider-adjusted coordinate, not an
  earlier one, and must not silently drop the recognized words gained in
  between. Regression check for the closure-safety KTD above.
- Edge case: `draftId !== null` (a reopened entry, possibly already holding
  several legacy pins) — a field press still does nothing, unchanged from
  today. Covers R3.
- Integration: relocating does not re-fire the departure-trace connector
  (`departureTracePlay`) — already structurally guarded by
  `isDepartureEligible`'s `draftPinCount === 0` check once one pin exists.

**Verification:** Live, in a visible tab, at both a desktop and mobile
viewport, exercising the new-tab landing, an ordinary direct web visit, and
a reopened multi-pin entry. Gesture/state-transition behavior isn't
`check:*`-testable per AGENTS.md's testing split.

---

## Scope Boundaries

**Deferred for later** (carried from origin)

- The new-tab landing's centered review card still sits over the field and
  can end up over the pin it's reviewing. A mocked opposite-quadrant
  repositioning fix was tried and rejected — it read as the card fleeing
  the pin rather than making room for it. Left as a genuinely unsolved,
  separate problem for a future dedicated brainstorm.
- Any terminology or data-model cleanup reflecting one-pin-as-default
  (e.g. the plural framing in `PinEntry[]` and its surrounding vocabulary).

**Outside this product's identity** (carried from origin)

- Capturing more than one simultaneous feeling within a single check-in.

**Deferred to Follow-Up Work** (surfaced by this plan's own research)

- `scripts/test-check-in.ts`'s simulated check-in setup comments describe
  today's append-only mint; worth a glance once this ships in case the
  comment's framing drifts from the new relocate behavior (the script
  itself doesn't call the real `handlePinRelease` and needs no functional
  change).
- `CoordinateCard.tsx`'s `onRecognize`/`onDerecognize` always apply to
  `prev[prev.length - 1]` regardless of which card's button was pressed — a
  pre-existing quirk, latent today in multi-pin reopened edits, that this
  plan does not touch and single-pin incidentally makes correct-by-
  construction for ordinary (non-reopened) check-ins.

---

## Risks & Dependencies

- Both real call sites into `handlePinRelease` are confirmed (via grep) to
  be exactly `handleDepart` and `handleFieldPress` — no other UI or
  admin/test-harness path mints a pin, so U1's change has a fully contained
  blast radius.
- The relocate branch must not adopt the freshly-built `PinEntry` object
  wholesale (see KTD on identity preservation) — the clearest way this
  change could silently regress is a naive `setPins([entry])` replacing the
  existing pin instead of adjusting it in place.
- No storage/schema changes: `PinEntry[]`'s shape is unchanged; only
  runtime UI behavior changes going forward, and only for newly-created
  check-ins.

---

## System-Wide Impact

- Single-pin enforcement is centralized in one function
  (`handlePinRelease`), so despite applying "everywhere," the actual code
  change is small and contained — not a series of parallel changes across
  each entry point.
- Historical multi-pin entries remain fully readable and editable exactly
  as today; nothing about the diary, CSV export, or constellation replay
  changes.

---

## Sources / Research

- [src/App.tsx](../../src/App.tsx) — `handlePinRelease` (:424-465),
  `handleDepart` (:474-487), `handleFieldPress` (:544-551),
  `handleAdjustPin` (:753-756).
- [src/components/EmotionPreview/CoordinateCard.tsx](../../src/components/EmotionPreview/CoordinateCard.tsx) —
  confirmed already single-pin-shaped; no changes needed here.
- [src/components/EmotionField/EmotionField.tsx](../../src/components/EmotionField/EmotionField.tsx) —
  `handleRelease` (:165-191), confirming a press within `TOUCH_RADIUS_PX`
  of the existing pin already routes to select, not mint/relocate.
- [src/data/checkIn.ts](../../src/data/checkIn.ts) — `findNearbyPin`,
  `TOUCH_RADIUS_PX` (:123-141).
- [src/data/pins.ts](../../src/data/pins.ts) — `withOrigin`, `adjustPin`
  (:14-25), the pure transforms this plan reuses.
- [src/data/departure.ts](../../src/data/departure.ts) —
  `isDepartureEligible` (:51-57).
- [AGENTS.md](../../AGENTS.md) — the `check:*` testing-split convention.
- docs/brainstorms/2026-09-03-single-pin-checkin-requirements.md — origin
  document; Requirements and Key Decisions carried forward from here.
