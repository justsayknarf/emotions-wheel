---
title: "History Pulse-Trace: The Animated Constellation"
type: requirements
tags: [ux, empty-state, reflection, history, animation, constellation, emotion-field]
date: 2026-07-09
topic: history-pulse-trace
project: emotions-wheel
---

## Summary

Add a new on-field state that animates the user's recent check-ins as a constellation *drawn* by an electric pulse bouncing chronologically from point to point. It plays on the circumplex, triggered by its own button. When the trace finishes, the constellation persists and each point is tappable to open that entry's detail; dismissing returns to the mirror. It sits alongside the existing tabular history view, not replacing it.

## Problem Frame

The returning-mirror empty state (see `docs/brainstorms/2026-07-09-001-empty-state-returning-mirror-requirements.md`) shows a single ghost pin at the user's last coordinate and deferred "the full constellation and its animated chronological trace." This brainstorm realizes that deferred idea.

The reflection value of the app compounds over time (`STRATEGY.md`, Reflection surface track), but today that history is only legible as tabular Day/Week charts and lists in `DiaryHistory`. There's no moment where the user *feels* the arc of their check-ins as a journey through emotional space. The pulse-trace is that moment: a low-cost, high-delight payoff that makes returning feel rewarding rather than clerical.

## Key Decisions

- **The pulse-trace is a new on-field state, separate from the tabular history.** The existing `DiaryHistory` Day/Week view stays as the deeper analytical surface. The pulse-trace is a distinct, more visceral representation of the same underlying entries.

- **The pulse travels in chronological order, drawing the constellation as it goes.** Each point appears when the pulse reaches it, so the animation reads as "progress through time," not a static plot revealed all at once.

- **The trace ends on the ghost pin.** The final, most-recent point of the trace is the same ghost pin the mirror state already shows at the last coordinate — closing the loop between the two states rather than layering an unrelated overlay.

- **Recent bounded window, not all-time.** One playback traces only a recent span of entries, keeping every playback short and the field uncluttered (density is a standing concern for this project). The exact span is deferred to planning, defaulting to the mirror's rhythm-strip window for consistency.

- **Persist + tappable end state.** After the trace completes, the constellation stays on screen and each point is tappable, opening that entry via the existing session-detail surface. Dismissing returns to the mirror.

- **Two distinct button entrypoints.** The existing tabular-history button is kept as-is; the pulse-trace gets its own separate button with a label that does not collide with "History."

## Requirements

**Trigger and playback**

- R1. A dedicated button on the field/mirror state triggers the pulse-trace; its label is distinct from the existing tabular-history button.
- R2. On trigger, an electric pulse animates across the circumplex, bouncing from point to point in chronological order (oldest first).
- R3. Each entry's point is drawn onto the field as the pulse reaches it, so the constellation builds progressively over the animation.
- R4. Playback covers only a recent bounded window of entries, not the full history.
- R5. The trace's final point is the most-recent entry, coinciding with the mirror state's ghost pin.

**End state**

- R6. When the trace completes, the constellation remains on the field rather than clearing.
- R7. Each point in the persisted constellation is tappable and opens that entry's detail via the existing session-detail surface.
- R8. Dismissing the persisted constellation returns the user to the mirror state.

**Coexistence**

- R9. The existing tabular-history button and view remain unchanged and reachable; the pulse-trace does not replace them.

## Key Flows

- F1. **Play the trace.** From the mirror state, the user taps the pulse button → the pulse animates chronologically across the field, drawing each recent entry as a point → the trace ends on the last coordinate (the ghost pin) → the full recent constellation is now on screen. **Covers R1–R6.**

- F2. **Inspect a point.** With the constellation persisted, the user taps any point → that entry's session detail opens → dismissing detail returns to the persisted constellation. **Covers R7.**

- F3. **Exit.** The user dismisses the constellation → returns to the mirror state (single ghost pin, rail memory). **Covers R8.**

- F4. **Reach the tabular history.** Independently of the pulse-trace, the user opens the existing history view via its own button (or left-swipe). **Covers R9.**

## Acceptance Examples

- AE1. **Given** a user with several recent entries, **when** they tap the pulse button, **then** a pulse animates from the oldest in-window entry to the newest, drawing each point as it arrives, and finishes on the point coinciding with the ghost pin. **Covers R2, R3, R5.**
- AE2. **Given** an entry from before the bounded window, **when** the trace plays, **then** that entry is not drawn. **Covers R4.**
- AE3. **Given** the trace has completed and the constellation persists, **when** the user taps one of its points, **then** that entry's detail opens; **when** they dismiss it, **then** the constellation is still shown. **Covers R6, R7.**
- AE4. **Given** the persisted constellation is on screen, **when** the user dismisses it, **then** the mirror state returns. **Covers R8.**

## Scope Boundaries

**Deferred for later**
- All-time / full-journey playback with speed-pacing across dense stretches — this brainstorm ships the bounded-window version.
- A user-selectable time range for playback.
- Encoding extra data in the pulse or points (valence-tinted color, pulse speed reflecting time gaps between check-ins) — possible later polish, not committed here.

**Outside this product's identity**
- Any comparison, sharing, or social framing of the journey — `STRATEGY.md` excludes social features; the constellation is the user's own record.
- Scoring or evaluative framing of past entries.

## Outstanding Questions

**Resolve before / during planning**
- Q1. **Pulse-button label.** The literal "Show History" collides with the existing history button. Pick a non-colliding label (e.g., a "replay journey" sense) that reads as motion/reflection, not analytics.
- Q2. **Window size (N).** How many days/entries the bounded window covers. Default assumption: align with the mirror's rhythm-strip span; confirm the exact value.

**Deferred to planning**
- Q3. Pulse aesthetic and timing — how "electric" the pulse reads, per-hop duration, easing, and how a mid-length window paces without dragging.
- Q4. How the persisted constellation and its tap targets coexist with the mirror's ghost pin and the ambient emotion words already on the field (density and hit-testing).
- Q5. Mobile vs desktop placement of the pulse button, consistent with where the mirror's rail/sheet lands.

## Dependencies / Assumptions

- Builds on the returning-mirror state (`docs/brainstorms/2026-07-09-001-empty-state-returning-mirror-requirements.md`); the ghost pin it terminates on is defined there.
- Assumes the session-detail surface used elsewhere in the app can be opened for an arbitrary past entry from a tapped point.
- Assumes recent entries carry usable coordinates for plotting (the same `[-1,1]`→field mapping already shared across the field and `MiniCircumplex`).

## Sources / Research

- `docs/brainstorms/2026-07-09-001-empty-state-returning-mirror-requirements.md` — the mirror state, its single ghost pin, and the deferred constellation/trace this doc realizes.
- `src/App.tsx` — existing `history` button and left-swipe-to-history; the separate entrypoint this feature coexists with.
- `src/components/DiaryHistory/DiaryHistory.tsx` — the tabular Day/Week history view that stays as the deeper surface.
- `src/components/DiaryHistory/MiniCircumplex.tsx` — existing static plotting of entries as dots on a circular field; precedent for coordinate mapping.
- `src/components/DiaryHistory/SessionDetailCard.tsx` — the session-detail surface a tapped point should reuse.
- `STRATEGY.md` — Reflection surface track; social/clinical exclusions.
