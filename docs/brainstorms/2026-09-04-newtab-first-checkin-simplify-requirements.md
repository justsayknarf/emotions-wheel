---
date: 2026-09-04
topic: newtab-first-checkin-simplify
---

## Summary

For a user's very first check-in ever, arriving via the new-tab landing, strip
the draft card down to the axis sliders and Save — no word caption, no tag
neighborhood. After Save, the rail's existing previous-check-in mirror
surfaces automatically, carrying a CTA to reopen the entry and add tags.

---

## Problem Frame

The new-tab landing's draft card
([CoordinateCard.tsx](../../src/components/EmotionPreview/CoordinateCard.tsx))
renders the same content for every user: sliders, a word-guess caption
("Does *x* or *y* fit?"), a nearby-tags neighborhood, and a "your words"
summary — all at once, the instant a slider is first released
(`handlePinRelease` in [App.tsx:454](../../src/App.tsx#L454) mints the pin;
the card's caption/tag block is
[CoordinateCard.tsx:456-529](../../src/components/EmotionPreview/CoordinateCard.tsx#L456-L529),
the recognized-words summary is
[CoordinateCard.tsx:544-557](../../src/components/EmotionPreview/CoordinateCard.tsx#L544-L557)).

For a first-time user with zero prior context, that's a lot of unfamiliar
surface competing with the one action that actually matters: place a pin,
hit Save. It also undersells CLAUDE.md's own model — "words are *recognized*
against a pin as optional annotation, never required to complete a
check-in" — because right now optional and simultaneous look the same. The
fix is to separate the primary action (place + save) from the optional one
(annotate), and let the second one arrive only after the first succeeds.

This is deliberately narrow. It does not touch:
- Returning users landing via new-tab (`desktopLandingActive` with a
  `previousCheckIn` already on record) — unchanged.
- Direct-visit first-timers, who get a separate `FirstRunDemo` welcome
  ([App.tsx:357](../../src/App.tsx#L357),
  [App.tsx:1115](../../src/App.tsx#L1115)) — unchanged, though a later pass
  is expected to unify these onboarding paths.
- Whether tagging-after-save becomes the general pattern for *every*
  check-in, not just the first. That's a real, larger product decision
  (deferring all tag-adding to a post-save, optional step) that's being
  captured in its own separate brainstorm once there's feedback on this
  narrower version.

---

## Key Decisions

- **Scoped to the exact intersection of new-tab entry and first-check-in-
  ever.** Gate: `desktopLandingActive && entries.length === 0` (equivalently,
  `previousCheckIn === null` going into the landing). Not "any first-time
  user" (that would also catch direct-visit, which keeps `FirstRunDemo` for
  now) and not "every new-tab landing" (returning users keep today's full
  card).

- **The simplified card omits content, not interaction.** Only the caption
  block and the recognized-words summary are hidden. The sliders render
  exactly as today, and the field stays press/relocate-able exactly as
  today — `dropDisabled` already only gates the field before the first pin
  exists ([App.tsx:1038](../../src/App.tsx#L1038)), so a first-time user can
  still discover the direct field-press gesture during this same check-in,
  not just the sliders.

- **No new mechanism for the post-save summary.** `handleLandingSave`
  ([App.tsx:606](../../src/App.tsx#L606)) already clears `pins` and records
  the entry; `previousCheckIn` re-derives from `entries`
  ([App.tsx:326](../../src/App.tsx#L326)) and `showMirror`
  ([App.tsx:356](../../src/App.tsx#L356)) already goes true once
  `pins.length === 0 && previousCheckIn !== null`. The rail mirror showing
  the just-saved check-in is what happens today, unchanged — this brainstorm
  only asks for the CTA's label and prominence in this specific case.

- **No new tagging surface.** The mirror's read-only card already renders a
  reopen affordance (`onReopen`/`reopenLabel` on `CoordinateCard`, wired at
  [EmotionDrawer.tsx:879](../../src/components/EmotionPreview/EmotionDrawer.tsx#L879)).
  Reopening via that button pulls the entry back into the draft with
  `handleReopen` ([App.tsx:883](../../src/App.tsx#L883)), which renders the
  full card — caption and tags included. For this flow only, the label
  passed there changes from the default "Reopen" to inviting copy (e.g.
  "Add tags") — everything else about the reopened card is untouched.

---

## Requirements

- R1. On a first-ever check-in (`entries.length === 0`) via the new-tab
  landing, the draft card renders only the axis sliders and Save — no word
  caption, no nearby-tags neighborhood, no "your words" summary.
- R2. This simplified card is scoped to `desktopLandingActive &&
  entries.length === 0` only. Every other entry point — a returning user's
  new-tab landing, a direct-visit first-timer, the ordinary rail/sheet flow
  — is unaffected.
- R3. The field remains directly press/relocate-able during this simplified
  first check-in, unchanged from today.
- R4. After Save, the rail's previous-check-in mirror appears, summarizing
  the just-saved entry, using the existing mirror mechanism.
- R5. The mirror's reopen control reads as an invitation to add tags (not a
  correction/edit action) in this specific case — distinct copy from the
  default "Reopen" label used elsewhere.
- R6. Tapping that CTA reopens the entry into the existing full editable
  card (caption + tags visible), using the existing reopen mechanism —
  no new tagging UI.
- R7. Declining the CTA — navigating on, starting a new check-in, or simply
  not tapping it — leaves the saved entry valid and untouched. Nothing
  about the first check-in is incomplete without tags.

---

## Key Flows

- F1. **First-ever new-tab check-in.** Trigger: a user with no prior
  entries lands via `?source=new-tab` and drags a landing slider for the
  first time. Outcome: a pin mints as today, but the card shows only
  sliders + Save. Covers R1, R2.
- F2. **Direct field press during the simplified first check-in.** Trigger:
  same session as F1, user presses the field directly instead of (or in
  addition to) using the sliders. Outcome: unchanged from today — the pin
  relocates, no caption/tags appear. Covers R3.
- F3. **Save and mirror.** Trigger: user hits Save on the simplified card.
  Outcome: the entry records, the draft clears, and the rail's mirror
  renders the just-saved check-in with an "Add tags"-style CTA in place of
  the default "Reopen" label. Covers R4, R5.
- F4. **Add tags via CTA.** Trigger: user taps the CTA on the mirror.
  Outcome: the entry reopens into the full card (caption + tags visible);
  recognizing words and hitting Save updates the same entry in place — the
  existing reopen/save-while-reopened behavior, unchanged. Covers R6.
- F5. **Decline the CTA.** Trigger: user ignores the mirror's CTA and starts
  a new check-in, or simply leaves. Outcome: the first entry stays recorded
  exactly as saved, with no recognized words — no different from any other
  check-in nobody chose to tag. Covers R7.

---

## Acceptance Examples

- AE1. Given a browser with no prior entries, when the new-tab landing's
  slider is released for the first time, then the resulting card shows the
  two axis sliders and a Save button, and shows no caption text, no tag
  pills, and no "your words" row. Covers R1.
- AE2. Given the same first-time session, when Save is pressed, then the
  entry records, the draft card is replaced by the rail mirror showing that
  entry, and the mirror's reopen button reads as an add-tags invitation
  rather than "Reopen". Covers R4, R5.
- AE3. Given that mirror is showing, when its CTA is tapped, then the entry
  reopens into a card identical in shape to today's ordinary reopened card
  — sliders, caption, tags all present — and recognizing a word there and
  hitting Save updates the same entry (no second entry is created). Covers
  R6.
- AE4. Given a *returning* user (at least one prior entry) lands via the
  same new-tab URL, when their slider is released, then the card renders
  exactly as it does today — caption and tags included, unchanged. Covers
  R2.

---

## Scope Boundaries

**Deferred for later**

- **Whether the "stripped card → post-save tag CTA" pattern extends to
  every check-in, not just the first.** Raised in this brainstorm's
  conversation as a live possibility depending on feedback, but treated as
  a distinct, larger product decision — it would mean removing live
  tag-editing from the draft card for *all* users, not just first-timers.
  Tracked as its own future brainstorm ("tagging as an optional add-on to a
  saved pin"), not decided or built here.
- **Unifying the new-tab landing and the direct-visit `FirstRunDemo`
  onboarding paths.** Acknowledged as a real, separate goal; not attempted
  in this pass. This brainstorm intentionally adds a third, temporary
  first-touch variant (new-tab-first-timer) alongside the two that already
  exist, on the understanding that it's a stepping stone.

**Outside this product's identity**

- Making tags or words required, at any point, to complete or "finish" a
  check-in. The CTA is an invitation; declining it must never read as an
  incomplete entry.

---

## Dependencies / Assumptions

- Builds on the existing mirror mechanism (`showMirror`,
  `previousCheckIn`) and the existing reopen mechanism (`handleReopen`,
  `CoordinateCard`'s `onReopen`/`reopenLabel` props) — confirmed by reading
  the code that both already do everything this brainstorm needs except the
  first-time-only card simplification and the CTA's copy.
- Assumes `entries.length === 0` is an acceptable proxy for "first check-in
  ever" on this device — consistent with how the rest of the app already
  treats a fresh/cleared `localStorage` as a fresh start (no accounts, no
  backend, per CLAUDE.md).
- Confirmed `dropDisabled` ([App.tsx:1038](../../src/App.tsx#L1038)) only
  gates the field before a pin exists, not after — so R3 (field stays
  interactive) requires no new gating logic.

---

## Sources / Research

- [src/App.tsx](../../src/App.tsx) — `desktopLandingActive`/`drawerVariant`
  (new-tab entry gating), `handleLandingSave`, `handlePinRelease`,
  `previousCheckIn`/`showMirror` (mirror resolution), `handleReopen`,
  `dropDisabled` — read to confirm today's shipped landing, save, and
  mirror/reopen paths.
- [src/components/EmotionPreview/CoordinateCard.tsx](../../src/components/EmotionPreview/CoordinateCard.tsx)
  — caption/tag block, recognized-words summary, `reopenLabel`/`onReopen`
  rendering — read to confirm exactly what content this brainstorm hides
  for the simplified card and what the CTA reuses.
- [src/components/EmotionPreview/EmotionDrawer.tsx](../../src/components/EmotionPreview/EmotionDrawer.tsx)
  — where the mirror's read-only `CoordinateCard` is wired to `onReopen`
  for the previous check-in specifically.
- CLAUDE.md — "words are optional annotation, never required to complete a
  check-in," the statement this brainstorm's card simplification makes
  visually true for a first-time user.
- Conversation with Frank (this session) — scoping decisions: intersection
  of new-tab + first-ever only; the broader "tagging as optional add-on"
  direction confirmed but deliberately split into its own future doc; CTA
  should feel like the same pattern the eventual unified onboarding will
  use.
