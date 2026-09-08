---
date: 2026-09-04
topic: saved-checkin-confirmation-card
---

## Summary

Replace the abrupt swap from the gold draft card to the plain blue
"Previous check-in" mirror with a single continuous confirmation card:
the just-saved pin's coordinate is confirmed via a small mini-map echo of
the field, its title reads "Today's check-in" instead of "Previous
check-in," and a few nearby words are offered as accept/dismiss
suggestions — Linear-style proposed labels on an already-saved record,
not a blocking step. Applies to every save, at both existing save entry
points, and only to the just-saved entry.

---

## Problem Frame

User feedback on the shipped single-pin flow: after Save, "the blue thing
appears" with nothing connecting it to the action just taken. Confirmed
against the code: the draft card (gold, sliders, editable) is replaced by
`CoordinateCard`'s `readOnly` body
([CoordinateCard.tsx:398-421](../../src/components/EmotionPreview/CoordinateCard.tsx#L398-L421))
inside the "Previous check-in" group
([EmotionDrawer.tsx:860-864](../../src/components/EmotionPreview/EmotionDrawer.tsx#L860-L864))
— a title that always means "the past," a cool `--ui-recorded` accent
identical to every other historical entry, and (since the
first-checkin-simplify plan) an "Add tags"/"Reopen" button that requires
reopening the full editor for any correction. Nothing in that transition
says "this is the thing you just made."

Also confirmed live: this problem is not first-timer-specific and not
confined to one entry point. There are two different post-save surfaces
today:
- The new-tab landing (`handleLandingSave`,
  [App.tsx:614-628](../../src/App.tsx#L614-L628)) clears the draft and
  reveals the rail/sheet directly — the mirror card described above
  appears there.
- Every other save (`handleRecord`'s non-reopen branch,
  [App.tsx:875-889](../../src/App.tsx#L875-L889)) instead routes to
  `view = 'complete'`, a full-screen celebration
  ([SessionComplete.tsx](../../src/components/SessionComplete.tsx)) with
  a checkmark ring, "N moments recorded," and New check-in/View history
  buttons — no coordinate, no tags, nothing connecting it to the mirror
  card either. A user only ever reaches the mirror card from this path
  indirectly, on a later return to the field.

This brainstorm settles on Linear's actual mechanism, translated
accurately: a suggested label sits on an issue that is unambiguously
already saved, rendered in a visibly tentative register (dashed, easy
accept/dismiss) that never competes with or gates the "this is saved"
fact. Applied here, the pin/coordinate is the confirmed thing; a few
nearby words are the proposed thing — using data (`nearbyEmotions`) the
draft card's own caption already computes, not a new suggestion engine.

A mocked comparison (sliders retained vs. a mini-map echo of the field
vs. both, map on the left vs. right, dashed vs. muted-fill suggestion
chips) settled on: mini-map only (no retained sliders), map on the card's
left edge, dashed chips. See Key Decisions for the reasoning.

---

## Key Decisions

- **Scoped to the just-saved entry only, not every historical mirror
  card.** The confirmation treatment (title, map, suggestions) applies
  only while the entry currently shown as `previousCheckIn` is the one
  most recently saved *in this page load*. A plain reload, a return visit,
  or a second save all revert to today's ordinary "Previous check-in"
  look for anything that isn't the newest thing. Tracked as new,
  non-persisted React state (`justSavedEntryId: string | null`, default
  `null`) — no localStorage/schema change, since it only needs to survive
  within one running session, not across visits.

- **Both existing save entry points converge on this one moment.**
  `handleRecord`'s non-reopen branch stops routing to `view = 'complete'`
  and instead clears the draft the same way `handleLandingSave` already
  does, landing on the ordinary field view with the mirror showing the
  new confirmation card immediately — matching the landing path's
  behavior exactly rather than building a second, parallel treatment.
  `SessionComplete.tsx`, `lastEntry`, `handleNewSession`, and the
  `'complete'` view branch become dead code once nothing routes to them,
  to be removed as part of this work (confirmed: `setView('complete')` at
  [App.tsx:887](../../src/App.tsx#L887) is the only call site).

- **No sliders on the confirmed card.** Mocked and rejected: a draggable
  slider is a strong, well-learned signal for "still an open, continuous
  control," which fights the "this is done" message on every single save
  in exchange for a quick-nudge convenience that's rare and already
  covered by reopening the full editor. The mini map carries the
  confirmation instead — read-only by construction, so there's no false
  signifier, and it works by recognition (the user already knows this
  shape, they were just dragging on a bigger version of it) rather than
  recall of a sentence.

- **Mini map sits on the card's left edge.** Two reasons, confirmed via a
  live comparison: it's the lowest-effort, highest-confidence signal on
  the card, so it should be the first thing the eye hits in normal
  reading order, with the genuinely new information (the suggestions)
  following naturally to its right; and on desktop specifically, the real
  field sits to the *left* of the docked rail
  ([EmotionDrawer.tsx](../../src/components/EmotionPreview/EmotionDrawer.tsx)'s
  `RAIL_WIDTH` panel), so a mini-map on the card's left edge sits on the
  side physically nearer the thing it's a miniature of.

- **Suggested-tag chips render dashed, not muted-fill.** Dashed
  communicates "tentative" through shape, not color alone — more
  accessible, and it gives a bigger, clearer visual delta at the moment
  of acceptance (hollow-dashed -> solid-filled) than muted-fill's smaller
  before/after difference.

- **"Add tags" stays available as a fallback, unconditionally.** Reopens
  the existing full slider + tag editor exactly as today
  (`handleReopen`, [App.tsx:895+](../../src/App.tsx#L895)) — for anyone
  whose actual feeling isn't among the few proposed chips. This is no
  longer conditioned on `firstEverEntryFromNewTab`
  ([EmotionDrawer.tsx:442](../../src/components/EmotionPreview/EmotionDrawer.tsx#L442),
  shipped in the previous round) — every just-saved entry gets both the
  proposed chips and the "Add tags" fallback now, so that narrower
  condition and its "Add tags" vs. "Reopen" label distinction are
  superseded by this broader treatment.

- **Suggested words reuse the existing proximity computation, not a new
  one.** The same `nearbyEmotions(pin.x, pin.y, emotions, ...)`
  ([regions.ts:55](../../src/data/regions.ts#L55)) already used for the
  draft card's own caption/tag neighborhood
  ([CoordinateCard.tsx:126](../../src/components/EmotionPreview/CoordinateCard.tsx#L126))
  supplies the chip words for the read-only confirmed card too — no new
  data source, no ranking model.

- **Accepting or dismissing every suggestion does not "graduate" the card
  early.** The confirmation title/map treatment persists for the entry's
  entire `justSavedEntryId` lifetime regardless of how many chips remain
  — an empty suggestion row (everything resolved) is a valid resting
  state, not a trigger to fall back to "Previous check-in" mid-session.

---

## Requirements

- R1. Immediately after any save (new-tab landing or the ordinary
  rail/sheet flow), the entry shown as the previous check-in renders a
  confirmation card: a small mini-map echoing the field with a dot at the
  pin's coordinate, a title reading "Today's check-in" (not "Previous
  check-in"), and up to a few nearby-word suggestions as dashed,
  individually accept/dismiss chips.
- R2. This treatment applies only to the just-saved entry for the
  remainder of the current page load. Any other entry — including this
  same one after a reload or once a newer entry is saved — renders
  exactly as it does today ("Previous check-in," no chips).
- R3. The ordinary (non-landing) save path no longer shows the
  full-screen `SessionComplete` celebration; it lands on the field view
  with the confirmation card showing, the same as the landing path.
- R4. Accepting a suggestion (✓) recognizes that word against the pin,
  using the existing recognize mechanism — no new persistence path.
  Dismissing one (✕) removes it from the row without affecting the saved
  entry.
- R5. "Add tags" remains available on the confirmation card regardless of
  the suggestion chips' state, and reopens the existing full editor
  unchanged.
- R6. The confirmation card's title and mini map are read-only — no
  sliders, no drag-to-adjust, on this card.

---

## Key Flows

- F1. **Landing save, first or returning user.** Trigger: `Save` on the
  new-tab landing. Outcome: the rail/sheet reveals with the confirmation
  card (map, "Today's check-in," suggestions) instead of today's plain
  mirror. Covers R1.
- F2. **Ordinary save.** Trigger: `Save` on the rail/sheet's own draft
  card, any entry surface. Outcome: no celebration screen; the field view
  shows the same confirmation card as F1. Covers R1, R3.
- F3. **Accept a suggestion.** Trigger: tap ✓ on a chip. Outcome: the word
  is recognized against the saved pin; the chip settles into the app's
  existing solid recorded-pill look. Covers R4.
- F4. **Dismiss a suggestion.** Trigger: tap ✕ on a chip. Outcome: the
  chip is removed from the row; nothing about the saved entry changes.
  Covers R4.
- F5. **Fall back to the full editor.** Trigger: tap "Add tags." Outcome:
  unchanged from today's reopen flow — the entry reopens into the full
  slider + caption + tag card. Covers R5.
- F6. **A second check-in.** Trigger: the user saves again (from either
  entry point) while the confirmation card from a first save is still
  showing. Outcome: the confirmation card now describes the *new* entry;
  the previous one, no longer `previousCheckIn`, is simply history.
  Covers R2.
- F7. **Reload or return visit.** Trigger: the page reloads, or the app
  is reopened later, with an unchanged `previousCheckIn`. Outcome: today's
  plain "Previous check-in" mirror, no map, no chips, no confirmation
  language. Covers R2.

---

## Acceptance Examples

- AE1. Given an empty diary, when the new-tab landing's Save is pressed,
  then the rail shows a card titled "Today's check-in" with a small map
  (dot at the pin's coordinate) and 2-3 dashed suggestion chips — not
  "Previous check-in," not the plain italic caption alone. Covers R1.
- AE2. Given any existing history, when Save is pressed from the ordinary
  rail/sheet draft card, then the app does not show the checkmark-ring
  celebration screen; it shows the same confirmation card as AE1. Covers
  R1, R3.
- AE3. Given the confirmation card is showing, when a suggestion chip's
  ✓ is tapped, then that word appears among the pin's recognized words
  (visible if the entry is later reopened) and the chip shows as
  accepted. Covers R4.
- AE4. Given the confirmation card is showing with all chips dismissed or
  accepted, when nothing else happens, then the card still reads "Today's
  check-in" with the map — it does not revert to "Previous check-in."
  Covers the graduation-timing Key Decision.
- AE5. Given the confirmation card is showing for entry A, when a second,
  different entry B is saved, then the confirmation card now describes B;
  reopening or viewing A elsewhere shows it as ordinary history. Covers
  R2, F6.
- AE6. Given the confirmation card was showing for entry A, when the page
  is reloaded and entry A is still the most recent entry, then it renders
  as today's plain "Previous check-in" mirror — no map, no chips. Covers
  R2, F7.

---

## Scope Boundaries

**Explored via mock, not chosen**

- Keeping the sliders visible/draggable on the confirmed card — rejected
  for the affordance mismatch (looks editable, isn't) against a rare,
  already-covered benefit.
- Map positioned on the card's right edge — mocked as a direct comparison
  against left; left won on both a general reading-order argument and the
  desktop-specific field-is-on-the-left argument.
- Muted-fill (solid, low-opacity) suggestion chips — mocked against
  dashed; dashed won on accessibility (signals tentative through shape,
  not just color) and a clearer accept-moment visual delta.

**Deferred for later**

- Whether the mini map (or some version of this confirmation treatment)
  ever extends to *every* historical mirror card, not just the just-saved
  one — explicitly out of scope per this brainstorm's own scoping
  decision ("start with the just-saved entry").
- Any redesign of the `SessionComplete` celebration concept itself for
  some other future moment — this brainstorm only removes its role as
  the mandatory post-save screen; it does not propose a replacement for
  whatever purpose it served beyond that.

**Outside this product's identity**

- An actual suggestion/ranking model beyond the existing coordinate-
  proximity computation — "AI-suggested" here means the same
  `nearbyEmotions` neighborhood already shown on the draft card, not a
  new inference step.

---

## Dependencies / Assumptions

- `nearbyEmotions` ([regions.ts:55](../../src/data/regions.ts#L55)) is
  pure and only needs a pin's committed `(x, y)` — confirmed reusable for
  a read-only saved pin with no new data plumbing.
- The existing recognize/derecognize mechanism
  (`onRecognize`/`onDerecognize`,
  [CoordinateCard.tsx](../../src/components/EmotionPreview/CoordinateCard.tsx))
  already writes to a pin's `recognizedWords` on a draft; using it against
  an already-saved pin (outside a reopen) is new wiring this brainstorm's
  own follow-up plan will need to confirm/build, not assumed already to
  exist.
- Removing the `'complete'` view is confirmed safe by reading the code:
  `setView('complete')` has exactly one call site
  ([App.tsx:887](../../src/App.tsx#L887)); no other flow depends on
  reaching it.
- No storage/schema changes — `justSavedEntryId` is transient render
  state, not persisted, and `DiaryEntry`/`PinEntry` shapes are unchanged.

---

## Sources / Research

- [src/App.tsx](../../src/App.tsx) — `handleLandingSave` (:614-628),
  `handleRecord` (:854-889, confirming the `'complete'` routing and its
  one call site), `showMirror`/`previousCheckIn` derivation (:326, :356).
- [src/components/SessionComplete.tsx](../../src/components/SessionComplete.tsx)
  — read in full to confirm exactly what the ordinary save path shows
  today and that it carries no coordinate/tag content to preserve.
- [src/components/EmotionPreview/EmotionDrawer.tsx](../../src/components/EmotionPreview/EmotionDrawer.tsx)
  — the previous-check-in mirror's `CoordinateCard` render site (:860-914,
  including the `firstEverEntryFromNewTab`/`reopenLabel` logic this
  brainstorm supersedes with a broader treatment).
- [src/components/EmotionPreview/CoordinateCard.tsx](../../src/components/EmotionPreview/CoordinateCard.tsx)
  — `readOnly` body (:398-421), `nearbyEmotions` usage (:126), confirming
  the existing proximity computation this reuses.
- [src/data/regions.ts](../../src/data/regions.ts) — `nearbyEmotions`
  (:55).
- Interactive mock (this session) — https://claude.ai/code/artifact/375e40e7-b905-457c-bf61-a15279702cd8,
  iterated through: baseline text-only caption; sliders vs. mini-map vs.
  both, with live drag added to the sliders variant; map+column
  composition (map anchoring a row with the label and, for map-alone,
  the suggestions nested beside it) replacing three independently
  stacked/spaced sections; map-left vs. map-right. Settled: mini-map
  alone, left, dashed chips.
- Conversation with Frank (this session) — the Linear-suggested-labels
  analogy and its translation into "confirmed pin, proposed words";
  scope decision (just-saved entry only); decision to unify both save
  paths onto one post-save moment, retiring `SessionComplete`'s role in
  the process; "Add tags" kept as an unconditional fallback.
