---
title: "Empty State: The Returning Mirror"
type: requirements
tags: [ux, empty-state, onboarding, reflection, habit, emotion-field, rail]
date: 2026-07-09
topic: empty-state-returning-mirror
project: emotions-wheel
---

## Summary

Turn the empty landing state into a *returning mirror*. On load, the right rail shows the user's last check-in and a quiet rhythm strip, and a single ghost pin marks their last coordinate on the field. A true first-timer with no history instead gets an animated gesture demo with brightened axes and a rail skeleton card. Across both states the axes become legible at rest and the rail is never dead.

## Problem Frame

The landing screen is the ritual-initiation moment — the point where a check-in either starts or doesn't. Today it under-delivers on exactly that:

- The right rail is a decorative backdrop (`src/App.tsx` — the "quiet rail backdrop" block) with `pointerEvents: none`. It holds nothing until a pin is placed.
- The axes are barely perceptible: crosshairs render at `rgba(201,168,124,0.04)` and the position-indicator dots appear only while dragging (`src/components/EmotionField/EmotionField.tsx`).
- The only "what do I do" affordance — "How are you feeling? / Touch anywhere to explore" — is gated on first visit via `localStorage` (`emotion-selector-onboarded`). **Returning users see nothing**: a faint crosshair, ambient words, and dead space.

Per `STRATEGY.md`, the two live tracks this space should serve are Habit formation (the return trigger) and Reflection surface (the compounding value of past entries). The current empty state serves neither for the repeat user it most needs to retain.

## Key Decisions

- **The empty state is a reflection surface, not just an onboarding surface.** The space is filled with the user's own recent activity, so returning is rewarded with continuity rather than a blank grid. This is the chosen direction over a pure teach-the-gesture treatment or a purely atmospheric one.

- **Memory lives in the rail; the field shows at most one ghost pin.** The rail carries the detail (last entry + rhythm). The field gets a single ghost pin at the last coordinate — not a constellation of recent points — to avoid worsening the field-density problem already documented in the project's UX notes and prior declutter work.

- **The ghost pin is step one of a future animated constellation trace.** It must be built so that extending to a temporal path (recent coordinates connected and animated in chronological order) is additive, not a rewrite. The single-pin scope now is a deliberate first increment of that larger idea.

- **Day-zero folds in the gesture demo.** A first-time user with no history gets an animated ghost-pin demonstration, brightened axes, and a rail skeleton card, replaced by the returning mirror once they have history. One arc: learn → return.

- **Axes get legible at rest.** Independent of which state is showing, the crosshairs and labels are readable on load rather than only during a drag — this directly answers the "axes aren't visible enough" complaint.

## Requirements

**Returning user (has ≥1 prior entry)**

- R1. On load, the right rail shows a "last check-in" card: the coordinate's region description, a relative timestamp (e.g., "Yesterday, late evening"), and any recognized words from that entry.
- R2. The rail shows a rhythm strip beneath the last-check-in card: the recent run of days as a compact dot sequence conveying cadence / streak.
- R3. A single ghost pin renders on the field at the coordinate of the most recent entry, visually quieter than a live pin.
- R4. The first touch on the field dismisses the ghost pin and any rail memory content, and begins a fresh pin — the mirror never blocks starting a new check-in.
- R5. On desktop, the mirror occupies the same rail region that `EmotionDrawer` uses, and cedes to the drawer when the first pin is placed.

**First-time user (no prior entries)**

- R6. On load, an animated demonstration traces the core gesture on the field — a ghost pointer drifts and drops a pin that pulses and fades — without relying on text to convey the gesture.
- R7. During the demo, the axes brighten from their resting state to clearly legible, and the edge position-indicator dots ride along the demo path.
- R8. The rail shows a skeleton of the coordinate card the user is about to create (e.g., "Your check-in will appear here").
- R9. The demo settles to the quiet resting state on first user touch, and does not replay once the user has interacted.

**Both states**

- R10. The axes (crosshairs and the Positive / Negative / Calm / Activated labels) are legible in the resting empty state, at a higher contrast than today's 4%-opacity crosshair.
- R11. The ghost-pin implementation is structured so a future temporal constellation (multiple recent coordinates connected and animated in chronological order) extends it without a rewrite.

## Key Flows

- F1. **Returning user opens the app.** Rail renders last-check-in card + rhythm strip; field renders the single ghost pin; axes are legible. User touches the field → ghost pin and rail memory dismiss, a fresh pin drops, `EmotionDrawer` takes the rail. **Covers R1–R5.**

- F2. **First-time user opens the app.** Demo animation plays (ghost pointer → pulsing pin → fade), axes brighten and settle, rail shows the skeleton card. User touches the field → demo ends, real interaction begins, demo never replays. **Covers R6–R9.**

- F3. **First-timer becomes a returner.** After the first recorded entry, subsequent loads show the returning mirror (F1) instead of the demo (F2). **Covers R9, R1–R5.**

## Acceptance Examples

- AE1. **Given** a user with one prior entry from yesterday evening, **when** they open the app, **then** the rail shows that entry's region and "Yesterday, late evening," a rhythm strip reflecting their recent days, and one ghost pin sits at that entry's coordinate. **Covers R1–R3.**
- AE2. **Given** the returning mirror is on screen, **when** the user touches anywhere on the field, **then** the ghost pin and rail memory disappear and a fresh live pin drops with the drawer sliding into the rail. **Covers R4, R5.**
- AE3. **Given** a brand-new user with no entries, **when** they open the app, **then** the gesture demo plays and the axes brighten; **when** they touch the field, **then** the demo stops and does not replay on the next load. **Covers R6, R7, R9.**
- AE4. **Given** any empty state (demo or mirror), **when** the user has not yet interacted, **then** the axis crosshairs and labels are legibly visible without dragging. **Covers R10.**

## Scope Boundaries

**Deferred for later**
- The full constellation and its animated chronological trace — this brainstorm ships only the single latest ghost pin as its first increment.
- Any richer rhythm/analytics in the rail beyond a simple cadence strip (trends, summaries) — those belong to the reflection/history surface, not the empty state.

**Outside this product's identity**
- Social, comparison, or shared-streak framing — `STRATEGY.md` excludes social features; the mirror reflects only the user's own record.
- Clinical or scoring framing in the last-check-in card — no "accuracy" or evaluation of past entries.

## Outstanding Questions

**Resolve before / during planning**
- Q1. **Mobile placement.** Mobile has no persistent side rail — the drawer is a bottom sheet. Where does the mirror live on that layout (a compact bottom peek, a top strip, a dismissible card)? Default assumption: a compact bottom peek that the fresh-pin sheet replaces; confirm in planning.
- Q2. **Relationship to the full history view.** The mirror is a glance on the field screen; the existing history view (`src/components/DiaryHistory/`) is the deep surface reachable via the history button and left-swipe. Confirm they stay distinct and the mirror doesn't duplicate history's affordances.

**Deferred to planning**
- Q3. Exact resting-state contrast values for axes and ghost pin (tuning against the Oura-ish dark palette).
- Q4. Timing and easing of the first-run demo (duration, whether it loops before first touch, how it settles).

## Sources / Research

- `STRATEGY.md` — Habit formation and Reflection surface tracks; primary user (first-time tracker, underdeveloped vocabulary); social/clinical exclusions.
- `src/App.tsx` — current empty-state composition: quiet rail backdrop, first-visit-only hint, history button and left-swipe-to-history.
- `src/components/EmotionField/EmotionField.tsx` — axis crosshair opacity, axis labels, drag-only position dots, existing pin pulse/dot rendering (basis for the ghost pin).
- `src/components/EmotionPreview/EmotionDrawer.tsx` — rail vs. sheet variants and `RAIL_WIDTH`; the region the mirror shares with the drawer.
- `src/hooks/useDiary.ts` — source of `entries`/`record`; supplies the history the mirror reads.
- Project UX notes — existing field-density concern motivating the single-ghost-pin (not constellation) decision.
