---
title: "feat: Saved check-in confirmation card"
type: feat
date: 2026-09-04
origin: docs/brainstorms/2026-09-04-saved-checkin-confirmation-card-requirements.md
---

# feat: Saved check-in confirmation card

## Summary

Replace the abrupt draft-card-to-blue-mirror swap with a confirmation
card for the just-saved entry only: a mini-map echo of the field
(reusing the existing `MiniCircumplex`), a "Today's check-in" title, and
up to three nearby-word suggestions the user can accept or dismiss.
Unifies the two existing post-save paths onto this one moment, retiring
the `SessionComplete` celebration screen in the process.

---

## Problem Frame

Confirmed live against the shipped code (see origin document's Problem
Frame for the user-facing framing): two different things happen after
Save today. `handleLandingSave`
([App.tsx:614-628](../../src/App.tsx#L614-L628)) reveals the rail/sheet
directly, where the previous-check-in mirror
(`CoordinateCard`'s `readOnly` body,
[CoordinateCard.tsx:398-421](../../src/components/EmotionPreview/CoordinateCard.tsx#L398-L421))
appears with no connection to the action just taken. `handleRecord`'s
non-reopen branch
([App.tsx:875-889](../../src/App.tsx#L875-L889)) instead routes to a
full-screen celebration (`SessionComplete.tsx`) with a checkmark ring,
"N moments recorded," and New check-in/View history buttons — no
coordinate, no tags, and the mirror card is only reached indirectly from
there, later.

Also confirmed: `src/utils/fieldGeometry.ts`'s own comment
("`toPercent`... shared by the EmotionField, the ghost pin, the
constellation replay, and the MiniCircumplex") pointed at an existing,
already-shipped mini-map component
([MiniCircumplex.tsx](../../src/components/DiaryHistory/MiniCircumplex.tsx),
used today in [SessionDetailCard.tsx:80](../../src/components/DiaryHistory/SessionDetailCard.tsx#L80))
that the brainstorm's own mock did not know about. This plan reuses it
as-is rather than building a second mini-map from scratch.

---

## Key Technical Decisions

- **`justSavedEntryId` is new, transient, non-persisted React state in
  `App.tsx`** (`useState<string | null>(null)`), set to the entry's id at
  the moment either save path records/re-records it, never explicitly
  cleared. It doesn't need clearing: it's only ever compared against
  `previousCheckIn?.id`, and `previousCheckIn` itself already changes out
  from under it whenever a newer entry is saved or a reopen temporarily
  excludes it (`derivePreviousCheckIn`,
  [checkIn.ts](../../src/data/checkIn.ts) — confirmed via
  `check:checkin`'s own "reopened check-in resolves to exactly one
  group" case) — so staleness resolves itself through the existing
  derivation, not through new bookkeeping.

- **Reopening the just-saved entry and updating it does not need special
  handling.** `handleRecord`'s existing `draftId` branch
  ([App.tsx:854-870](../../src/App.tsx#L854-L870)) calls `updateEntry`
  with the *same* entry id — `justSavedEntryId` is left untouched by
  that branch and still matches afterward, so the confirmation treatment
  correctly continues to show. Confirmed by tracing the two branches
  separately: only the non-`draftId` (fresh-record) branch needs to set
  `justSavedEntryId`.

- **Reuse `MiniCircumplex` unmodified, gold dot included**, rather than
  forking it or adding an accent prop for this one caller. Its dot color
  already means "a check-in's own coordinate" consistently in the diary
  history; the brainstorm's mock invented a blue dot without knowing this
  component existed, and blue was never a requirement in its own right —
  the requirement was "don't look like a different, editable component,"
  which the map's read-only-ness already satisfies regardless of dot
  color. The card's title/chips keep the recorded-blue language
  separately; the map does not need to match them pixel-for-pixel to
  read as "confirmed."

- **Suggestion candidates are computed once per mount, not recomputed as
  chips resolve.** `SavedCheckInSummary` seeds its candidate id list from
  `nearbyEmotions(pin.x, pin.y, emotions, 5)`'s top 3 in a lazy
  `useState` initializer, keyed to the pin by the parent's `key={pin.id}`
  (React resets the component's state on that key changing — no manual
  reset effect needed for a new entry). A dismissed chip is removed from
  that fixed list, not backfilled from a 4th candidate — matches the
  mock's own behavior and avoids a suggestion "reappearing" mid-session
  under a different word.

- **One candidate list serves both suggested and already-recognized
  display**, rather than two separate derivations. Each of the seeded
  candidate ids renders as an accepted/solid chip if
  `pin.recognizedWords.includes(id)` (true immediately after the user
  accepts it, since `onRecognize` writes through `updateEntry` and the
  `pin` prop re-renders with the update), or a dashed/pending chip
  otherwise (unless locally dismissed, in which case it's omitted
  entirely). No separate "your words" section is needed — accepting
  converts a chip in place, matching the mock exactly.

- **Accepting writes through `updateEntry` immediately** via a new
  `handleRecognizeSaved(entryId, pinId, emotionId)` in `App.tsx`, mirroring
  `handleReopen`'s own `entries.find((e) => e.id === entryId)` lookup
  pattern ([App.tsx:905-913](../../src/App.tsx#L905-L913)) rather than
  routing through the draft (`pins`) state at all — the pin being
  annotated isn't in the draft; it's already recorded. Dismissing writes
  nothing; it's local-only UI state inside `SavedCheckInSummary`.

- **The ordinary save path is unified with the landing path by simply not
  routing to `'complete'`**, not by building a second confirmation
  surface. `handleRecord`'s non-reopen branch already does everything
  `handleLandingSave` does except this one call — after removing it, both
  paths land on `view === 'field'` with `pins` cleared, and the existing
  `showMirror`/previous-check-in render path
  ([App.tsx:356](../../src/App.tsx#L356)) already picks it up with no
  further branching needed.

- **`SessionComplete.tsx`, `lastEntry`, `handleNewSession`, and the
  `'complete'` member of `AppView` are deleted, not deprecated.**
  Confirmed via grep that `setView('complete')` has exactly one call site
  ([App.tsx:887](../../src/App.tsx#L887)) and `handleNewSession`
  ([App.tsx:923-933](../../src/App.tsx#L923-L933)) has exactly one
  caller (`SessionComplete`'s own `onNewSession` prop) — nothing else
  depends on either.

- **The `firstEverEntryFromNewTab`/conditional `reopenLabel` shipped in
  the previous round is removed, not extended.**
  ([EmotionDrawer.tsx:442](../../src/components/EmotionPreview/EmotionDrawer.tsx#L442)
  and its use at the previous-check-in `CoordinateCard`,
  [EmotionDrawer.tsx:909-914](../../src/components/EmotionPreview/EmotionDrawer.tsx#L909-L914)).
  That card only ever renders for a previous check-in that is *not* the
  just-saved one under this plan (the just-saved one now renders
  `SavedCheckInSummary` instead), so "Add tags" as this card's own label
  no longer applies there — it reverts to the default "Reopen", and the
  "Add tags" language lives exclusively in the new component now.

---

## Requirements

(Carried from origin: docs/brainstorms/2026-09-04-saved-checkin-confirmation-card-requirements.md.)

- R1. Immediately after any save, the previous-check-in slot renders a
  confirmation card: mini-map, "Today's check-in" title, up to a few
  nearby-word suggestions as dashed accept/dismiss chips.
- R2. Scoped to the just-saved entry only, for the remainder of the page
  load; any other viewing of that same entry (reload, return visit, once
  a newer entry supersedes it) renders today's plain "Previous check-in"
  mirror.
- R3. The ordinary save path no longer shows `SessionComplete`; it lands
  on the field view with the confirmation card, same as the landing path.
- R4. Accepting a suggestion recognizes it against the saved pin via the
  existing update mechanism. Dismissing removes it from view only.
- R5. "Add tags" stays available on the confirmation card regardless of
  chip state, reopening the existing full editor unchanged.
- R6. The confirmation card's map and title are read-only.

---

## Implementation Units

### U1. `App.tsx`: `justSavedEntryId` state, wired into both save paths

**Goal:** Both save paths mark their entry as "just saved," and the
ordinary path stops routing to the celebration screen.

**Requirements:** R1, R2, R3

**Dependencies:** None.

**Files:**
- `src/App.tsx` (`handleLandingSave`, :614-628; `handleRecord`, :854-889)

**Approach:**
- Add `const [justSavedEntryId, setJustSavedEntryId] = useState<string | null>(null);`
  near the other draft-lifecycle state.
- `handleLandingSave`: capture `record(...)`'s return value
  (`const entry = record(pins, sessionStartRef.current, entrySource);`)
  and call `setJustSavedEntryId(entry.id);` right after.
- `handleRecord`'s non-`draftId` branch: replace
  `setLastEntry(entry); setView('complete');` with
  `setJustSavedEntryId(entry.id);` — `record(...)`'s return value is
  already captured there today (`const entry = record(...)`), so this is
  a one-line swap, not a new lookup. Leave everything else in that branch
  (`setPins([])`, `setSelectedPinId(null)`) unchanged.
- The `draftId` branch (reopen/update) is untouched — see KTD above for
  why it needs nothing.

**Test scenarios:**
- Happy path: fresh landing save → `justSavedEntryId` equals the new
  entry's id, `view` stays whatever it already was (never `'complete'`).
- Happy path: ordinary rail/sheet save → same outcome, and the field view
  never shows a celebration screen.
- Regression: reopening an entry and hitting Update Check-in
  (`draftId` branch) does not change `justSavedEntryId` — still equals
  whatever it was before the reopen.
- Regression: a second, later save updates `justSavedEntryId` to the new
  entry's id, superseding the first.

**Verification:** Live, in a visible tab, exercising both entry points.
Not `check:*`-testable per AGENTS.md's testing split (React state/UI
flow, not pure logic).

---

### U2. `App.tsx`: retire `SessionComplete`/`lastEntry`/`handleNewSession`/`'complete'`

**Goal:** Remove the now-unreachable celebration screen and its
supporting state/handler cleanly, with no dead code left behind.

**Requirements:** R3

**Dependencies:** U1 (the call site this removes must already be gone).

**Files:**
- `src/App.tsx` (import at :16; `lastEntry` state at :78;
  `handleNewSession` at :923-933; `'complete'` view JSX at :1247-1261)
- `src/components/SessionComplete.tsx` (delete)
- `src/types.ts` (`AppView` union, :1 — drop `'complete'`)

**Approach:** Delete the `SessionComplete` import, the `lastEntry` state
and its setter calls (none remain after U1), `handleNewSession` in full,
and the `{view === 'complete' && lastEntry && (...)}` JSX block. Delete
`SessionComplete.tsx`. Remove `'complete'` from `AppView`
(`'field' | 'cards' | 'complete' | 'history' | 'constellation'` ->
drops one member) — `'cards'`/`'history'`/`'constellation'` are unrelated
and stay.

**Test scenarios:**
- Regression: `npx tsc -b` passes clean with `'complete'` removed from
  `AppView` — confirms no other code still branches on or sets that
  view value (a stale reference would now be a type error, not a
  silent no-op).
- Regression: full app smoke test (mint, save, reopen, discard, history,
  constellation replay) exercises every other `view` value; none of them
  regress from removing `'complete'` specifically.

**Verification:** `npx tsc -b`, then live smoke test of the flows above.

---

### U3. `App.tsx`: `handleRecognizeSaved`

**Goal:** A suggestion's accept action can write a recognized word onto
an already-saved (non-draft) entry.

**Requirements:** R4

**Dependencies:** None (independent of U1/U2).

**Files:**
- `src/App.tsx` (near `handleReopen`, :905-913)

**Approach:**
```ts
const handleRecognizeSaved = useCallback((entryId: string, pinId: string, emotionId: string) => {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return;
  updateEntry({
    ...entry,
    pins: entry.pins.map((p) =>
      p.id === pinId && !p.recognizedWords.includes(emotionId)
        ? { ...p, recognizedWords: [...p.recognizedWords, emotionId] }
        : p,
    ),
  });
}, [entries, updateEntry]);
```
`updateEntryInList` ([checkIn.ts:35-48](../../src/data/checkIn.ts#L35-L48))
already preserves the original `timestamp`/`sessionDurationMs`/`source`
regardless of what's passed in `updated` — confirmed reused as-is, no
change needed there. The `!includes` guard is defensive (a double-accept
from a stale render shouldn't duplicate the id); the UI itself only ever
offers accept on a not-yet-recognized candidate.

**Test scenarios:**
- Happy path: accepting a candidate on a fresh single-pin entry adds it
  to `recognizedWords`, preserves the entry's original timestamp.
- Edge case: two different browser tabs/renders both firing accept for
  the same word — the guard prevents a duplicate id (not otherwise
  harmful, but keeps the array clean).
- Regression: accepting does not touch any other entry in `entries`
  (`updateEntryInList`'s existing "every other entry preserved untouched"
  behavior, already covered by `check:checkin`).

**Verification:** Live, plus `npm run check:checkin` as a regression
check on the underlying `updateEntryInList` this reuses (no new pure
logic is introduced by this unit itself — `handleRecognizeSaved` is a
thin App-level wrapper, matching the testing split's own guidance that a
storage-backed function stays a thin wrapper over pure logic already
covered elsewhere).

---

### U4. New component: `SavedCheckInSummary.tsx`

**Goal:** The confirmation card's actual content — map, title, chips,
Add tags — as one self-contained component.

**Requirements:** R1, R4, R5, R6

**Dependencies:** None (pure presentational component; wired to the app
in U5).

**Files:**
- `src/components/EmotionPreview/SavedCheckInSummary.tsx` (new)
- Reuses: `src/components/DiaryHistory/MiniCircumplex.tsx` (unmodified),
  `src/data/regions.ts`'s `nearbyEmotions`, `src/data/emotions.ts`'s
  `emotions`/`labelForId`.

**Approach:**
```tsx
interface Props {
  pin: PinEntry;
  onRecognize: (emotionId: string) => void;
  onReopen: () => void;
}

export function SavedCheckInSummary({ pin, onRecognize, onReopen }: Props) {
  const [candidateIds] = useState(() =>
    nearbyEmotions(pin.x, pin.y, emotions, 5).map((e) => e.id).slice(0, 3),
  );
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = candidateIds.filter((id) => !dismissed.has(id));
  // render: MiniCircumplex, title text "Today's check-in" (owned by the
  // caller's group header per U5 — this component renders the map +
  // chips + Add tags only, not the header row), chip per `visible` id
  // (accepted/solid if pin.recognizedWords.includes(id), else
  // dashed with accept/dismiss), Add tags -> onReopen.
}
```
Dashed chip styling reuses the app's existing tokens
(`--ui-recorded`/`--ui-recorded-dim`/`--ui-border`), matching the mocked
direction (dashed, not muted-fill) and the read-only card's own accent
convention (`accentDim` for `readOnly`,
[CoordinateCard.tsx:105](../../src/components/EmotionPreview/CoordinateCard.tsx#L105)).
`MiniCircumplex` is used with a single-pin array: `<MiniCircumplex
pins={[pin]} size={72} />` — no prop changes to that component (KTD
above).

**Test scenarios:**
- Happy path: a pin with 3 distinct nearby candidates, none recognized —
  renders 3 dashed chips.
- Happy path: accepting one converts it to a solid chip in place; the
  other two remain dashed.
- Happy path: dismissing one removes it; it does not reappear even if
  the component re-renders with the same `pin` (fixed candidate list,
  not recomputed).
- Edge case: a pin whose nearest candidates are already all in
  `pin.recognizedWords` (e.g., after a prior "Add tags" edit) — renders
  all 3 as solid chips, no dashed ones; not an error state.
- Edge case: fewer than 3 emotions exist near the coordinate (sparse
  field edge) — renders however many `nearbyEmotions` actually returns,
  same defensive shape `CoordinateCard`'s own guess/tag rendering already
  tolerates.

**Verification:** Live, in a visible tab. Not `check:*`-testable (React
component/UI), though `nearbyEmotions` itself already has pure-logic
coverage via `check:pin`.

---

### U5. `EmotionDrawer.tsx`: render `SavedCheckInSummary` for the just-saved entry

**Goal:** Wire the new component into the previous-check-in slot, only
for the just-saved entry; every other previous check-in keeps rendering
exactly as today.

**Requirements:** R1, R2, R5

**Dependencies:** U1, U3, U4.

**Files:**
- `src/components/EmotionPreview/EmotionDrawer.tsx` (group header,
  :860-864; previous-check-in `CoordinateCard` loop, :909-914;
  `firstEverEntryFromNewTab`, :442)

**Approach:**
- Add two new props: `justSavedEntryId: string | null` and
  `onRecognizeSaved: (entryId: string, pinId: string, emotionId: string) => void`.
- Compute `const justSaved = !isFocus && previousCheckIn?.id ===
  justSavedEntryId && previousPins.length === 1;` (the
  `previousPins.length === 1` clause is defensive — every entry
  `justSavedEntryId` can ever point to is single-pin under the shipped
  single-pin-checkin model; this only guards against that invariant
  somehow not holding, not an expected branch).
- Group header ([EmotionDrawer.tsx:861-864](../../src/components/EmotionPreview/EmotionDrawer.tsx#L861-L864)):
  swap the literal `Previous check-in` for `Today's check-in` when
  `justSaved`, keeping the same `· N pin(s)` suffix.
- Previous-check-in card render
  ([EmotionDrawer.tsx:871-914](../../src/components/EmotionPreview/EmotionDrawer.tsx#L871-L914)):
  branch on `justSaved` — render one `<SavedCheckInSummary key={previousCheckIn!.id} pin={previousPins[0]} onRecognize={(id) => onRecognizeSaved(previousCheckIn!.id, previousPins[0].id, id)} onReopen={() => onReopen(previousCheckIn!.id, previousPins[0].id)} />`
  instead of the existing `AnimatePresence`/`reversedPreviousPins.map(...)`
  loop; keep that loop, unmodified except removing the `reopenLabel`
  prop (reverts to its default `'Reopen'`), for the `!justSaved` case.
- Remove `firstEverEntryFromNewTab` ([EmotionDrawer.tsx:442](../../src/components/EmotionPreview/EmotionDrawer.tsx#L442))
  entirely — no remaining reader after the `reopenLabel` removal above.
- `App.tsx`: pass the two new props through at the `<EmotionDrawer
  .../>` call site.

**Test scenarios:**
- Happy path: `justSaved` true, single pin -> `SavedCheckInSummary`
  renders in place of the ordinary card; header reads "Today's check-in".
- Regression: `justSaved` false (an older previous check-in, or the same
  entry after a reload since `justSavedEntryId` resets on reload) ->
  today's exact card/header, "Reopen" label, unchanged.
- Regression: mid-reopen (`draftId` set) -> `previousCheckIn` is null or
  a different, older entry per `derivePreviousCheckIn`'s existing
  exclusion — `justSaved` is structurally false either way (either
  `previousCheckIn` is null, so the whole block doesn't render, or it's a
  non-matching id), so no new guard is needed here beyond what already
  exists.
- Regression: a legacy multi-pin entry that happens to be
  `previousCheckIn` (only reachable if `justSavedEntryId` were somehow
  set to one, which nothing in this plan ever does) falls back to the
  ordinary loop via the defensive `previousPins.length === 1` clause.

**Verification:** Live, in a visible tab, at both desktop and mobile
viewports, covering: first-ever new-tab save, returning-user new-tab
save, ordinary rail/sheet save, a second save superseding the first, a
reload after a save, and reopening the just-saved entry via "Add tags"
then updating it.

---

## Scope Boundaries

**Carried from origin (explored via mock, not chosen)**

- Sliders retained on the confirmed card.
- Map on the card's right edge.
- Muted-fill (vs. dashed) suggestion chips.

**Carried from origin (deferred for later)**

- Extending this treatment to every historical mirror card, not just the
  just-saved one.
- Any redesign of whatever purpose `SessionComplete` served beyond being
  the mandatory post-save screen — this plan only removes that role.

**Deferred to follow-up work (surfaced by this plan's own research)**

- `MiniCircumplex` renders its dot at a fixed 4px regardless of `size` —
  fine at both its existing 80px call site and this plan's 72px one, but
  worth a glance if a much smaller instance is ever wanted elsewhere.
- No visual "just landed" emphasis (e.g., a brief pulse) on the map dot
  is included — the card's own existing mount-in transition (shared with
  every other card in this list) was judged sufficient; not a
  requirement from the origin document.

---

## Risks & Dependencies

- The single largest behavior change here is removing `SessionComplete`
  as the mandatory post-save screen for the ordinary flow — confirmed
  its only call site and only consumer of `handleNewSession` before
  committing to deletion, so this isn't guessing at dead code.
- `handleRecognizeSaved` is new write-through behavior (recognizing a
  word against a pin outside the draft/reopen flow for the first time in
  this app) — the underlying `updateEntry`/`updateEntryInList` path is
  already exercised by the reopen flow and covered by `check:checkin`,
  so the risk is scoped to the thin new wrapper, not the storage layer.
- No storage/schema changes: `PinEntry`/`DiaryEntry` shapes are
  unchanged; `justSavedEntryId` is render-only state.

---

## System-Wide Impact

- `SavedCheckInSummary` is additive and narrowly gated (`justSaved`
  only) — every other rendering of a previous check-in, in every other
  view (diary history, constellation replay, a reopened multi-pin
  entry), is untouched.
- Deleting `SessionComplete`/`lastEntry`/`handleNewSession`/`'complete'`
  removes code, not behavior anyone still reaches — confirmed via their
  call sites before this plan commits to the deletion.

---

## Sources / Research

- [src/App.tsx](../../src/App.tsx) — `handleLandingSave` (:614-628),
  `handleRecord` (:854-889), `handleReopen` (:905-913, the lookup pattern
  `handleRecognizeSaved` mirrors), `handleNewSession` (:923-933),
  `lastEntry`/`SessionComplete` JSX (:78, :1247-1261) — read to confirm
  exact call sites before proposing their removal.
- [src/components/SessionComplete.tsx](../../src/components/SessionComplete.tsx)
  — read in full in the origin brainstorm to confirm it carries no
  coordinate/tag content worth preserving.
- [src/utils/fieldGeometry.ts](../../src/utils/fieldGeometry.ts) — led
  directly to discovering `MiniCircumplex` already exists via its own
  "shared by... the MiniCircumplex" comment.
- [src/components/DiaryHistory/MiniCircumplex.tsx](../../src/components/DiaryHistory/MiniCircumplex.tsx)
  and its call site,
  [SessionDetailCard.tsx:80](../../src/components/DiaryHistory/SessionDetailCard.tsx#L80)
  — confirmed reusable unmodified.
- [src/data/checkIn.ts](../../src/data/checkIn.ts) — `updateEntryInList`
  (:35-48), confirming what it preserves vs. overwrites on an update.
- [src/hooks/useDiary.ts](../../src/hooks/useDiary.ts) — `record`/
  `updateEntry`, confirming `record` already returns the new `DiaryEntry`
  (no new return-value plumbing needed for U1).
- [src/components/EmotionPreview/EmotionDrawer.tsx](../../src/components/EmotionPreview/EmotionDrawer.tsx)
  — group header (:860-864), previous-check-in card loop (:871-914),
  `firstEverEntryFromNewTab` (:442) — the exact logic this plan
  supersedes.
- [src/components/EmotionPreview/CoordinateCard.tsx](../../src/components/EmotionPreview/CoordinateCard.tsx)
  — `readOnly` body (:398-421), `accentDim` (:105), `nearbyEmotions`
  usage (:126) — the existing conventions `SavedCheckInSummary` matches.
- [src/types.ts](../../src/types.ts) — `AppView` union, confirming
  `'complete'`'s only role before removing it.
- docs/brainstorms/2026-09-04-saved-checkin-confirmation-card-requirements.md
  — origin document; Requirements and the mock-derived decisions (map
  left/no-sliders/dashed, carried into KTDs and Scope Boundaries here as
  the parts this plan's own units don't re-derive) carried forward.
