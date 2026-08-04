---
title: "Adjustable pin — the post-drop check-in card"
type: requirements
status: ready-for-planning
date: 2026-08-04
area: EmotionPreview / check-in card
---

# Adjustable pin — the post-drop check-in card

## Problem

After a pin is dropped, the card that appears (`src/components/EmotionPreview/CoordinateCard.tsx`)
shows the emotional state as a read-only readout, led by the relational line
*"between X and Y"* with two **static** axis bars (Calm↔Activated, Negative↔Positive).

In testing, a user instinctively reached for those two axis indicators to **adjust**
their position — the bars look like controls but aren't. Two problems compound:

1. **The card can't refine the drop.** The only way to move is to drop a new pin.
2. **The relational line invites word-hunting.** A singular "between X and Y" verdict is
   something a user can *disagree with*, so they bump toward a word they accept — and
   because the zone thresholds are invisible, they drift far from the position they
   actually felt. This recreates the recall cost the wheel exists to remove:
   the coordinate is the truth; words are scaffolding for **recognition**, not a target.

## Goal

Make the two axis bars into **sliders** that adjust the pin after the fact, and re-voice
the words as a quiet, honest **suggestion** that builds vocabulary through recognition —
never a verdict the user feels they must target.

## Non-goals

- No 2D pad / joystick control (evaluated and rejected — two labeled sliders read clearer).
- No live word-hunting readout; the card must not encourage chasing a specific word.
- No change to how a pin is first dropped on the field, or to diary/history recording shape.
- Not building a "felt phrase" summary (e.g. "stirred up, on edge") — rejected: it relocates
  the targeting problem from a word to a phrase.

## Resolved design

### Layout
- **Sliders move to the top of the card** and become the primary act:
  - Calm ↔ Activated (x), Negative ↔ Positive (y).
  - Each slider carries an **origin tick** marking where the pin was dropped, so travel
    from the felt drop is visible without looking at the field.
- Beneath the sliders sits a **quiet caption** (the demoted words); the nearby-tags band
  follows as today.

### Adjustment model — commit on release
- While a slider is dragged, the **pin glides live** on the field (with the existing
  dashed **ghost preview** + target ring showing where it will land).
- The **card's words hold still during the drag** and only re-resolve when the slider is
  **released**. This keeps the card calm and avoids threshold-flicker mid-drag.
- Dragging the **field pin directly** behaves the same way: pin glides live, card resolves
  on release.
- **Anchor the adjustment:** the original drop stays visible on the field as an anchor with
  a travel line to the current pin, so refining never silently drifts far from the felt drop.

### The caption voice — an honest question
- A stable question frame: **"Does ⟶ or ⟶ fit?"** filling the two blanks with the
  **two true-nearest words**.
- Below it, **five nearby tags** (the wider neighborhood) — see tunable count.
- The words shown are always the genuine nearest neighbors, so a "yes" is always earned.
- **Recognition, not recall:**
  - Tapping a word (in the question or the tags) **names it** — it is kept as the user's
    vocabulary ("your words: …") and reads in a gold, checked state.
  - **"None of these"** dismisses the suggestion at zero cost. Words are only ever offers.
- **Empty/edge states:**
  - Wordless zone (no emotions within range): fall back to a plain axis description
    (e.g. "activated, negative"); no question frame.
  - After "none of these": show *"your spot is enough."*

### The dissolve — soft re-suggestion on release
- On release (a real position commit), **only the mutable parts animate**: the two
  word-slots and the tag chips **dissolve out and ease back in**. The
  **"Does … or … fit?" scaffolding holds perfectly still.**
- The effect reads as the card quietly swapping its guesses in place, not the whole
  block blinking — a gentle re-offering.
- In-place actions (naming a word, "none of these") update **instantly**, with no dissolve —
  those are the user's actions, not the card re-suggesting.
- Entering/leaving a wordless zone (where there's no question frame to preserve) may use a
  whole-block fade instead of the slot-only dissolve.

### Tunable dissolve settings (required)
The dissolve must be **hand-tunable via the existing admin tuning panel**, matching the
axis-pulse pattern — not hardcoded. Concretely:
- Add fields to `RevealTuning` in `src/config/revealTuning.ts` (with entries in
  `DEFAULT_TUNING`), consumed live in the card via `useRevealTuning()`.
- Add a knob row (a "Check-in card" section) to
  `src/admin/components/AdminRevealTuning.tsx` alongside "Reveal feel" / "Welcome".
- Suggested knobs (final names/ranges are planning's call):
  - `captionFadeOut` (s) — how long the words/tags take to fade out.
  - `captionFadeIn` (s) — how long they ease back in.
  - `captionHold` (s) — the beat held empty between out and in (the "re-suggest" pause).
  - Optionally `captionDissolve` on/off to disable the effect entirely.
- Respect `prefers-reduced-motion` (fall back to an instant swap).

## Open decisions (resolved with defaults — confirm at planning)

1. **Named-word persistence.** Named words **persist** across adjustments. A word that is
   named and then no longer nearby **stays** in "your words." (Default: persist.)
2. **"Nearby" count = 5.** The nearby-tags row shows **5** words *beyond* the two guesses.
   Note: the existing `tagCount` knob (default 6, labelled "Nearby tags") currently governs
   the card's pills — planning should decide whether the two guesses are drawn from the same
   nearest list as the tags (so "5 nearby" means 5 after the pair) or tracked separately,
   and whether the count stays tunable.
3. **Empty-state copy.** Keep *"your spot is enough."*

## Implementation constraints (surfaced during brainstorm)

- **`regionDescription` is a stored snapshot.** Today `PinEntry.regionDescription`
  (`src/types.ts`) is computed once at drop time and stored. Making the pin adjustable
  requires **recomputing it when a pin moves** (via `getRegionDescription` in
  `src/data/regions.ts`), or deriving it live — otherwise the caption goes stale.
- **`highlightedIds` already derives live.** In `src/App.tsx`, `highlightedIds` is a
  `useMemo` over `selectedPin.x/y` (via `nearestTagIds`), so the field's lit words and the
  card's tag pills **already recompute for free** when a pin's coordinates change. The pin
  update handler is the missing piece.
- A new **update-pin-coordinates** action is needed in `src/App.tsx` (sibling to
  `handleRecognize` / `handlePinRemove`) that sets a pin's x/y and refreshes its
  `regionDescription`.
- Recognition already exists as `PinEntry.recognizedWords` + `handleRecognize` /
  `handleDerecognize` — the "name a word" interaction should reuse it.

## Success criteria

- A dropped pin can be nudged on both axes from the card; the field pin and its description
  update to match, resolving on release.
- The caption never presents a singular verdict the user must accept; a word is always a
  question that can be waved off, and "none of these" is a first-class answer.
- On release, the question scaffolding stays fixed while only the words + tags dissolve and
  re-settle; the timing is adjustable from the admin panel and honors reduced-motion.
- Adjusting a pin never silently loses the sense of where it was first dropped.

## Prototype

Interaction reference (all states/animations): the published playground iterated during
this brainstorm — sliders-on-top, commit-on-release, ghost + anchor, the "Does X or Y fit?"
voice, and the slot-only dissolve.
