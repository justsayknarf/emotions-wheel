---
title: "feat: Simplified first-ever new-tab check-in"
type: feat
date: 2026-09-04
origin: docs/brainstorms/2026-09-04-newtab-first-checkin-simplify-requirements.md
---

# feat: Simplified first-ever new-tab check-in

## Summary

For the exact intersection of new-tab entry and first-check-in-ever, hide
the draft card's word caption and tag neighborhood (sliders + Save only),
and relabel the post-save mirror's reopen button to read as an "add tags"
invitation rather than a correction. Both pieces reuse existing rendering
paths and derived state — no new mechanism, no new top-level state in
`App.tsx` beyond one line.

---

## Problem Frame

Confirmed live against the shipped code: once the new-tab landing's first
slider release mints a pin (`handlePinRelease`,
[App.tsx:454](../../src/App.tsx#L454)), `EmotionDrawer`'s `draftCards`
([EmotionDrawer.tsx:601](../../src/components/EmotionPreview/EmotionDrawer.tsx#L601))
renders a `CoordinateCard` that always shows its caption block (guess
words + nearby tags,
[CoordinateCard.tsx:456-529](../../src/components/EmotionPreview/CoordinateCard.tsx#L456-L529))
and its recognized-words summary
([CoordinateCard.tsx:544-557](../../src/components/EmotionPreview/CoordinateCard.tsx#L544-L557)),
identically for a first-time user and a returning one. This is more surface
than a user with zero prior context needs at the one moment that matters
(place a pin, hit Save) — see origin document's Problem Frame.

Also confirmed: the post-save mirror card
([EmotionDrawer.tsx:863-881](../../src/components/EmotionPreview/EmotionDrawer.tsx#L863-L881))
already renders automatically once `previousCheckIn` resolves to the
just-saved entry — no new plumbing needed there, only the reopen button's
label needs to differ for this specific case.

---

## Key Technical Decisions

- **The card-simplification gate is computed entirely inside
  `EmotionDrawer`, from props it already has.** `isFocus` (`variant ===
  'focus'`, [EmotionDrawer.tsx:221](../../src/components/EmotionPreview/EmotionDrawer.tsx#L221))
  is the existing proxy for `desktopLandingActive`; `previousCheckIn` is
  already a prop. `isFirstEverCheckIn = isFocus && !isReopened &&
  !previousCheckIn` reproduces the origin document's
  `desktopLandingActive && entries.length === 0` exactly, since
  `previousCheckIn` is null precisely when `entries` is empty
  (`derivePreviousCheckIn`, [App.tsx:326](../../src/App.tsx#L326)). No new
  prop is threaded down from `App.tsx` for this half.

- **`CoordinateCard` gets one new prop, `simplified`, following its
  existing optional-boolean convention** (same shape as `readOnly`/
  `frosted`). When true, it wraps the caption block
  ([CoordinateCard.tsx:456-529](../../src/components/EmotionPreview/CoordinateCard.tsx#L456-L529))
  and the recognized-words summary
  ([CoordinateCard.tsx:544-557](../../src/components/EmotionPreview/CoordinateCard.tsx#L544-L557))
  in `{!simplified && (...)}`. The sliders (:420-454) and the surrounding
  header/reopen chrome are untouched — Save itself lives in `actionBar`,
  outside `CoordinateCard` entirely, and needs no change.

- **The across-time delta paragraph (:538-542) needs no explicit gating.**
  It only renders when `anchor` is non-null, and `realAnchor`
  ([EmotionDrawer.tsx:569](../../src/components/EmotionPreview/EmotionDrawer.tsx#L569))
  is `previousCheckIn ? anchor : null` — already structurally null
  whenever `isFirstEverCheckIn` is true. Confirmed via reading both sites
  rather than assumed, since `simplified` doesn't touch this block.

- **`simplified` only reaches the `draftCards` render site
  ([EmotionDrawer.tsx:613](../../src/components/EmotionPreview/EmotionDrawer.tsx#L613)),
  not `editingCards`.** `isFirstEverCheckIn` already requires
  `!isReopened`, so `editingCards` (which only renders while `isReopened`)
  would never receive `true` here anyway — passed as `false`/omitted there
  for clarity, not because it's reachable.

- **The mirror's CTA copy is a second, independent derived boolean, also
  computed inside `EmotionDrawer` from existing props.**
  `firstEverEntryFromNewTab = entries.length === 1 && previousCheckIn?.source
  === 'new-tab'` reuses `DiaryEntry.source`
  ([data/source.ts](../../src/data/source.ts)), already stamped per-entry
  by `record()` ([hooks/useDiary.ts:10](../../src/hooks/useDiary.ts#L10)).
  This is self-resetting by construction — once a second entry exists,
  `entries.length === 1` is false and the label reverts to "Reopen" on its
  own, with no manual reset logic required. Deliberately not just
  `entries.length === 1` alone: that would also relabel a direct-visit
  first-timer's mirror (out of scope — origin document's Problem Frame
  explicitly leaves that path untouched).

- **One line added to `handleLandingSave`
  ([App.tsx:606](../../src/App.tsx#L606)) so the mirror isn't left
  peeked/collapsed on a mobile-width first save.** `mirrorExpanded`
  defaults to `false` and is only forced true by the *ordinary* mint path
  (`handlePinRelease`, [App.tsx:485](../../src/App.tsx#L485)) — the
  landing-save path never touches it today. On `sideBySide` (desktop
  'rail') this is moot (no peek/collapse exists outside `isSheet`,
  confirmed by reading `EmotionDrawer`'s peek logic), but on a mobile-width
  new-tab session the post-save 'sheet' would otherwise default to peeked,
  hiding the CTA behind an extra tap. Reuses the exact same setter the
  ordinary mint path already calls — no new mechanism. Gated to
  `entries.length === 0` (pre-save) so it only fires for this narrow case,
  not every landing save.

---

## Requirements

(Carried from origin: docs/brainstorms/2026-09-04-newtab-first-checkin-simplify-requirements.md.)

- R1. On a first-ever check-in via the new-tab landing, the draft card
  shows only sliders + Save — no caption, no tags, no "your words"
  summary.
- R2. Scoped to `desktopLandingActive && entries.length === 0` only; every
  other entry point is unaffected.
- R3. The field stays directly press/relocate-able during this simplified
  first check-in.
- R4. After Save, the rail's mirror surfaces the just-saved entry.
- R5. The mirror's reopen control reads as an add-tags invitation, not
  "Reopen", in this specific case.
- R6. Tapping that CTA reopens the entry into the existing full editable
  card — no new tagging UI.
- R7. Declining the CTA leaves the saved entry valid and untouched.

---

## Implementation Units

### U1. `CoordinateCard`: add `simplified` prop

**Goal:** A card can render sliders-only, omitting the caption block and
recognized-words summary, via one new optional prop.

**Requirements:** R1

**Dependencies:** None.

**Files:**
- `src/components/EmotionPreview/CoordinateCard.tsx` (`Props` interface
  ~64-96, component signature ~99, caption block ~456-529, recognized-words
  block ~544-557)

**Approach:** Add `simplified?: boolean` to `Props`, documented next to
`readOnly`/`frosted` in the same comment style, defaulting to `false` in
the destructured signature. Wrap the caption `motion.div`
(:463-529) and the `pin.recognizedWords.length > 0` block (:544-557) each
in `{!simplified && (...)}`. No change to the sliders, header, or any hook
— `captionRef`'s `ResizeObserver` effect already no-ops safely when its
ref never attaches (confirmed by reading it: `if (!el) return`).

**Test scenarios:**
- Happy path: `simplified={false}` (or omitted) renders identically to
  today — a pure additive prop.
- Happy path: `simplified={true}` renders sliders + header only; no
  caption text, no tag buttons, no "your words" row, regardless of
  `pin.recognizedWords`.
- Edge case: `simplified={true}` with a non-empty `pin.recognizedWords`
  (reachable only via direct prop testing, not through this plan's own UI
  flow) still hides the summary — confirms the wrap is unconditional on
  `simplified`, not just on emptiness.

**Verification:** Live, in a visible tab — render the card both ways at a
fixed coordinate and confirm the caption/tag/words DOM is absent, not just
visually hidden.

---

### U2. `EmotionDrawer`: gate `draftCards`' card on `isFirstEverCheckIn`

**Goal:** Only the exact new-tab-and-first-ever intersection gets the
simplified card; every other draft render is untouched.

**Requirements:** R1, R2, R3

**Dependencies:** U1.

**Files:**
- `src/components/EmotionPreview/EmotionDrawer.tsx` (near
  `neutralDepartureEligible`, ~391; `draftCards`, ~601-631)

**Approach:** Add `const isFirstEverCheckIn = isFocus && !isReopened &&
!previousCheckIn;` alongside the existing `neutralDepartureEligible`
derivation (same inputs, minus the `pins.length === 0` clause, since this
one needs to stay true for the whole post-mint editing session, not just
before mint). Pass `simplified={isFirstEverCheckIn}` on the `CoordinateCard`
inside `draftCards` (:613-627) only. R3 requires no code change: the field's
press/relocate path (`dropDisabled`,
[App.tsx:1038](../../src/App.tsx#L1038)) already only gates before the
first pin exists, unaffected by anything in this unit.

**Test scenarios:**
- Happy path: fresh `localStorage` (`entries.length === 0`), new-tab entry,
  first slider release → card renders via U1's `simplified={true}`.
- Happy path: same fresh state, but a direct field press instead of the
  landing's slider (once the field is press-enabled) → still simplified,
  same `isFirstEverCheckIn` condition. Covers R3.
- Regression: returning user (`previousCheckIn !== null`) on the same
  new-tab URL → `isFirstEverCheckIn` is false, card renders exactly as
  today. Covers R2.
- Regression: direct web visit, no `?source=new-tab` (`isFocus` false) →
  `isFirstEverCheckIn` is false regardless of entry count, card renders as
  today (the `FirstRunDemo` path is untouched). Covers R2.
- Regression: a reopened entry (`isReopened` true) → `isFirstEverCheckIn`
  is false by construction; `editingCards` never receives `simplified`.

**Verification:** Live, in a visible tab, at both a desktop and mobile
viewport, clearing `localStorage` between runs to re-enter the first-ever
state. Not `check:*`-testable per AGENTS.md's testing split (gesture/
state-transition behavior).

---

### U3. `App.tsx`: expand the mirror on a first-ever landing save

**Goal:** The post-save mirror (and its CTA) isn't left peeked/collapsed
on a mobile-width first-ever new-tab session.

**Requirements:** R4

**Dependencies:** None (independent of U1/U2; touches a different file).

**Files:**
- `src/App.tsx` (`handleLandingSave`, ~606-613)

**Approach:** At the top of `handleLandingSave`, before `record(...)`,
add `if (entries.length === 0) setMirrorExpanded(true);`. Add `entries.length`
to the callback's dependency array (currently `[pins, record, entrySource,
scheduleLandingSettle]`). No change to `record`, `setPins`, or the rest of
the function.

**Test scenarios:**
- Happy path: fresh `localStorage`, mobile-width new-tab session, Save →
  `mirrorExpanded` becomes true; the sheet renders its body (not just the
  peek bar) immediately, no tap required.
- Regression: returning user (`entries.length > 0`) saves via the landing
  → `mirrorExpanded` untouched by this line, unchanged from today's
  behavior (whatever it already was).
- Regression: desktop (`sideBySide`) new-tab save → no visible difference
  (no peek/collapse exists in `'rail'`), confirms this unit is inert
  on desktop, not just untested there.

**Verification:** Live, at a mobile viewport specifically (the only width
where `mirrorExpanded` has a visible effect), clearing `localStorage`
first.

---

### U4. `EmotionDrawer`: relabel the mirror's reopen CTA

**Goal:** Immediately after a first-ever new-tab save, the mirror's reopen
button reads as an invitation to add tags, not a correction.

**Requirements:** R5, R6, R7

**Dependencies:** None (independent of U1-U3).

**Files:**
- `src/components/EmotionPreview/EmotionDrawer.tsx` (near `timeLabel`/
  `realAnchor`, ~422-569; the previous-check-in `CoordinateCard`,
  ~863-881)

**Approach:** Add `const firstEverEntryFromNewTab = entries.length === 1 &&
previousCheckIn?.source === 'new-tab';` alongside the other
`previousCheckIn`-derived consts. Pass `reopenLabel={firstEverEntryFromNewTab
? 'Add tags' : 'Reopen'}` on the read-only `CoordinateCard` at :879-880
(currently no `reopenLabel` is passed there, so it falls back to the
component's own `'Reopen'` default — this makes the case explicit instead
of relying on the default). R6/R7 require no new code: tapping the button
still calls the existing `onReopen(previousCheckIn!.id, pin.id)` →
`handleReopen` unchanged, and not tapping it leaves the recorded entry as
`record()` already left it.

**Test scenarios:**
- Happy path: exactly one entry total, `source === 'new-tab'` → button
  reads "Add tags".
- Regression: exactly one entry, `source === 'web'` (a direct-visit
  first-timer's own save) → button reads "Reopen", unchanged from today.
  Confirms the `source` check, not just entry count, gates this.
- Regression: two or more entries → button reads "Reopen" regardless of
  the most recent entry's source, unchanged from today. Confirms
  self-resetting behavior with no manual flag to clear.
- Happy path: tapping "Add tags" reopens the entry into the ordinary full
  card (caption + tags visible, sliders live); recognizing a word and
  hitting Save updates that same entry (`entries.length` stays 1). Covers
  R6.
- Happy path: after the "Add tags" mirror renders, navigating away or
  starting a new check-in without tapping it leaves the entry recorded
  with `recognizedWords: []` — same as any other untagged entry. Covers
  R7.

**Verification:** Live, in a visible tab, exercising both the new-tab and
direct-visit first save to confirm the label differs correctly between
them.

---

## Scope Boundaries

**Deferred for later** (carried from origin)

- Whether "stripped card → post-save tag CTA" extends to every check-in,
  not just the first — a distinct, larger decision tracked in its own
  future brainstorm.
- Unifying the new-tab landing and `FirstRunDemo` onboarding paths.

**Outside this product's identity** (carried from origin)

- Making tags/words required to complete a check-in, at any point.

**Deferred to follow-up work** (surfaced by this plan's own research)

- `mirrorExpanded`'s reset-to-peeked behavior on the sheet variant
  ([App.tsx:376-378](../../src/App.tsx#L376-L378)) still applies to every
  *later* appearance of the mirror, including a first-ever user's second
  check-in onward — U3 only forces it open for the very first save. Not a
  regression (matches today's existing behavior for every other case),
  just noted as the boundary of what U3 touches.

---

## Risks & Dependencies

- `simplified`'s two gate conditions (U2) and `firstEverEntryFromNewTab`'s
  two gate conditions (U4) are independent booleans computed from the same
  underlying props (`previousCheckIn`, `entries`, `isFocus`) but are not
  the same expression — a future edit to one must not assume it also
  covers the other. Worth a one-line comment cross-referencing them at
  both sites (added as part of U2/U4, not a separate unit).
- `DiaryEntry.source` is confirmed already stamped by every `record()` call
  ([hooks/useDiary.ts:10](../../src/hooks/useDiary.ts#L10)) — U4 reads an
  existing field, adds no new data-model surface.
- No storage/schema changes anywhere in this plan; `PinEntry`/`DiaryEntry`
  shapes are unchanged.

---

## System-Wide Impact

- Every change is additive and narrowly gated: `CoordinateCard` gains one
  optional prop (default preserves today's behavior everywhere it's
  already used), `EmotionDrawer` gains two derived booleans read from
  existing props, `App.tsx` gains one gated line in one callback. No
  existing call site changes behavior unless both halves of its gate
  condition are true.
- Nothing about the diary, CSV export, constellation replay, or the admin
  emotion editor changes.

---

## Sources / Research

- [src/App.tsx](../../src/App.tsx) — `handleLandingSave` (:606-613),
  `handlePinRelease` (:454-501, confirming the ordinary
  `setMirrorExpanded(true)` precedent U3 reuses), `dropDisabled`
  (:1038), `previousCheckIn`/`derivePreviousCheckIn` (:326).
- [src/components/EmotionPreview/EmotionDrawer.tsx](../../src/components/EmotionPreview/EmotionDrawer.tsx)
  — `isFocus`/`isReopened` (:221-222), `neutralDepartureEligible` (:391),
  `draftCards` (:601-631), `editingCards` (:640+), the previous-check-in
  mirror card (:851-881), peek/collapse logic confirmed `isSheet`-only
  (:1056-1154).
- [src/components/EmotionPreview/CoordinateCard.tsx](../../src/components/EmotionPreview/CoordinateCard.tsx)
  — `Props` interface (:54-97), caption block (:456-529), recognized-words
  summary (:544-557), `captionRef`/`ResizeObserver` effect (:151-161,
  confirmed safe when unmounted).
- [src/data/source.ts](../../src/data/source.ts) — `resolveEntrySource`/
  `resolveSessionEntrySource`, confirming `DiaryEntry['source']` is
  `'web' | 'new-tab'`.
- [src/hooks/useDiary.ts](../../src/hooks/useDiary.ts) — `record()` (:10),
  confirming `source` is stamped on every entry at save time.
- [AGENTS.md](../../AGENTS.md) — the `check:*` testing-split convention;
  this plan's changes are all React rendering/state, not pure logic, so
  none of it is `check:*`-testable.
- docs/brainstorms/2026-09-04-newtab-first-checkin-simplify-requirements.md
  — origin document; Requirements and Key Decisions carried forward from
  here.
