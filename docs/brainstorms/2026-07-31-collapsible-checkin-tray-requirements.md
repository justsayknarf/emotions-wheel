---
date: 2026-07-31
topic: collapsible-checkin-tray
status: brainstorm — solutions not yet locked
---

# Collapsible "Last check-in" Tray — Requirements

## Summary

On mobile, a returning user lands on the field with the **`MirrorCard` bottom
sheet** (the "Last check-in" tray) already docked at the bottom. It is
content-height and calls `stopPropagation` on pointer-down, so the band of field
it covers is dead — the user can't drop a pin there, and the lower-arousal
("calm") region of the circumplex is exactly what it sits on top of. The fix:
give the tray a **collapsed resting state** that peeks a minimal handle, frees
the field beneath it, and **expands on demand** (tap/drag the handle) to reveal
the full last-check-in + rhythm content.

This is a brainstorm of possible solutions, not a locked decision — see
**Solution Options** and the recommendation.

## Problem Frame

The returning-mirror empty state (`showMirror` in `src/App.tsx`: history present,
no pins yet) renders `MirrorCard` with `variant='sheet'` on mobile
(`useSidePanelLayout` false). The sheet
(`src/components/EmotionMirror/MirrorCard.tsx:98`) is `position:absolute;
bottom:0; left:0; right:0`, sized by its content — "Last check-in", relative
time, a relational sentence, word pills, and the "Recent rhythm" strip. That can
be a tall stack, and it has `onPointerDown={(e) => e.stopPropagation()}` so
nothing under it reaches the field's gesture layer.

Net effect on a phone: the moment the app opens, the bottom slice of the field is
both **visually occluded** and **functionally dead**. The occluded slice is the
low-arousal band (bottom of the valence/arousal field), so the words most
relevant to mild/calm feelings — already the thinnest part of the vocabulary —
are the hardest to reach. The tray is meant to be a gentle "here's where you left
off" mirror, but on mobile it behaves like a modal that ate the canvas.

Two coupled defects:
1. **Occlusion** — the tray covers field the user may want to pin on.
2. **Dead zone** — even the visible-but-uncovered edge cases are complicated by
   `stopPropagation` swallowing touches meant for the field.

The same bottom-sheet pattern is shared by `EmotionDrawer` (the active
pin-review tray), so whatever collapse affordance we choose should be
**consistent between the two sheets** — but the drawer only appears *after* a pin
exists, so it is not the load-time blocker. The load-time blocker is
`MirrorCard`.

## Key Decisions (proposed, open to revision)

- **Collapsed-by-default on mobile load.** A returning user should land on an
  open, fully-pinnable field. The mirror is context, not the task — it should
  start peeked, not expanded.
- **Expand is explicit and reversible.** Tapping/dragging the handle expands the
  tray; tapping the handle again (or dragging down, or tapping the field)
  collapses it. No auto-expand that re-steals the canvas.
- **Collapsed state must free the field beneath it.** Collapsed isn't just
  visually smaller — the `stopPropagation` dead zone must shrink to just the
  handle, so a pin can be dropped in the newly-uncovered band.
- **Rail (desktop) is unaffected.** On desktop the mirror docks as a side rail
  next to the field, not over it, so there is no occlusion to fix. Collapse is a
  mobile-sheet concern only.
- **One collapse mechanism, shared by both sheets.** `MirrorCard` and
  `EmotionDrawer` should collapse/expand the same way so the gesture is learned
  once. (Scope note below: this brainstorm fixes `MirrorCard`; generalizing to
  `EmotionDrawer` can be a fast follow.)

## Solution Options

### A. Peek handle + tap-to-expand (recommended)
Collapsed state = a short bar (~40–52px) pinned to the bottom showing a one-line
digest ("Last check-in · 2h ago" or just a grabber + label) and a chevron. Tap
or drag-up expands to the full content; tap chevron / drag-down / tap field
collapses. Only the peek bar carries `stopPropagation`; the rest of the field is
live.
- **Pros:** smallest dead zone; familiar bottom-sheet idiom; keeps the mirror
  discoverable; reuses the existing spring motion.
- **Cons:** needs a drag/tap gesture on the handle and a snap-point state
  machine (collapsed ↔ expanded); must not re-introduce a swipe that fights
  pin-drop (see the just-removed field swipe-to-history gesture — same class of
  bug).

### B. Auto-collapse on field interaction
Tray starts expanded (as today) but collapses to a peek the instant the user
touches the field to start pinning.
- **Pros:** preserves the current "greeting" feel on load; zero-friction to
  read.
- **Cons:** the load-time occlusion still exists until first touch — a user who
  wants to pin in the covered band has to touch elsewhere first to dismiss it.
  Doesn't fully solve defect #1.

### C. Shrink content to a fixed compact digest (no expand)
Replace the mobile sheet's full stack with a permanently-compact one-line digest;
move full detail to the existing History view.
- **Pros:** simplest; no gesture/state machine; deterministic small footprint.
- **Cons:** loses the "recent rhythm" glanceability on the field; a product
  regression on the returning-mirror surface's purpose.

### D. Float the tray as a dismissible pill
Render the mirror as a small floating pill (like the `history` / `replay` header
pills) instead of a full-width sheet; tap opens a modal/expanded card.
- **Pros:** frees almost all field; visually light.
- **Cons:** diverges from the `EmotionDrawer` sheet language — two different tray
  idioms on the same surface; the rhythm strip doesn't fit a pill.

**Recommendation: Option A**, with the collapsed peek as the mobile default on
load. It fixes both occlusion and the dead zone, keeps the mirror's content, and
sets up a shared collapse affordance the `EmotionDrawer` can adopt. Option B is a
reasonable fallback / complement (auto-collapse on first touch *plus* a
default-collapsed load), but A alone is sufficient.

## Key Flows (for the recommended option)

- F1. Returning user lands on mobile
  - **Trigger:** App loads, history present, no pins yet (`showMirror`, sheet
    variant).
  - **Steps:** The tray appears **collapsed** as a peek bar at the bottom; the
    full field above it — including the low-arousal band the tray used to cover —
    is live and pinnable.
  - **Outcome:** The user can drop a pin anywhere immediately; the mirror is
    available but not in the way.

- F2. User wants to see the last check-in
  - **Trigger:** User taps / drags up the peek handle.
  - **Steps:** The tray expands to full content (time, relational line, word
    pills, rhythm strip) over the field.
  - **Outcome:** Full mirror shown; a tap on the handle, a drag down, or a tap on
    the field collapses it back to the peek.

- F3. User pins on the band the tray occupied
  - **Trigger:** With the tray collapsed, the user presses on the lower field.
  - **Steps:** The press reaches the field gesture layer (the collapsed tray's
    `stopPropagation` is limited to the peek bar); a pin drops normally.
  - **Outcome:** No dead zone under the collapsed tray.

## Requirements

**Collapsed default & occlusion**

- R1. On mobile load with the returning mirror, the tray renders in a collapsed
  peek state, not fully expanded.
- R2. In the collapsed state, the field area above the peek bar is fully
  interactive for dropping a pin — including the band the expanded tray would
  cover.
- R3. `stopPropagation` (or equivalent touch-swallowing) is limited to the peek
  bar's own bounds in the collapsed state, not the full expanded footprint.

**Expand / collapse**

- R4. The user can expand the tray to full content via an explicit, discoverable
  affordance (tap and/or drag-up on the handle).
- R5. The user can collapse an expanded tray back to the peek via a
  corresponding action (tap handle / drag-down) and by starting an interaction
  with the field.
- R6. Expand/collapse animates with the app's existing calm bottom-sheet motion
  (reuse the current spring), and respects reduced-motion.

**Content & parity**

- R7. The collapsed peek shows enough to be meaningful (at minimum a "Last
  check-in" label; ideally the relative time), not a blank bar.
- R8. The expanded state shows the same content the sheet shows today (time,
  relational line, word pills, recent rhythm).
- R9. Desktop (rail variant) behavior is unchanged.

## Acceptance Examples

- AE1. Covers R1, R2. **Given** a returning user on mobile with history and no
  pins, **when** the app loads, **then** the tray is collapsed and a pin can be
  dropped in the lower field band the expanded tray would otherwise cover.
- AE2. Covers R3. **Given** the collapsed tray, **when** the user presses on the
  field just above the peek bar, **then** the press starts a pin (it is not
  swallowed by the tray).
- AE3. Covers R4, R5. **Given** the collapsed tray, **when** the user taps the
  handle, **then** it expands to full content; **when** the user taps the handle
  again or taps the field, **then** it collapses back to the peek.
- AE4. Covers R9. **Given** a desktop viewport, **when** the returning mirror
  shows, **then** it docks as the side rail with no collapse affordance and no
  behavior change.

## Scope Boundaries

- **`EmotionDrawer` (active pin-review tray) collapse** — same pattern, and a
  strong candidate to share the mechanism, but not required to fix this bug. Fast
  follow, not in this pass.
- **Desktop rail** — unchanged; this is a mobile-sheet fix only.
- **Reworking the mirror's content** (what the last-check-in shows) — out of
  scope; only its collapse/expand shell changes.
- **Persisting collapsed/expanded preference across sessions** — deferred;
  default-collapsed on each load is sufficient for now.

## Outstanding Questions

Deferred to planning:

- Exact collapsed peek height and what the digest line reads ("Last check-in ·
  2h ago" vs. label-only vs. a bare grabber).
- Whether expand supports a **drag** with a live snap-point (collapsed ↔
  expanded), or **tap-only** to keep the gesture surface simple and avoid any
  vertical-swipe conflict with the field's press-and-drag pin gesture. (Lesson
  from the just-removed field swipe-to-history: gestures layered over the field
  fight pin-drop — prefer an explicit tap target over an ambient swipe.)
- Whether to also auto-collapse on first field touch (Option B) as a complement
  to default-collapsed load.
- Whether `MirrorCard` and `EmotionDrawer` share a single `<CollapsibleSheet>`
  wrapper now or after this pass.
