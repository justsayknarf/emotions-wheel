---
title: "Traversal v2 — Direct Field Interaction"
status: draft
date: 2026-06-22
tags: [interaction, traversal, ux, v2]
actors:
  - A1: User (single person, mobile-first, also desktop mouse)
---

# Traversal v2 — Direct Field Interaction

## Problem

The v1 press-and-drag model requires too many gestures to cover the emotion space. To select words in different quadrants, a user must complete multiple sustained drag operations to pan the virtual viewport to each region. The words are also concentrated near quadrant centers, leaving large empty areas of screen space.

The result: selecting 2–3 emotions from different regions of the circumplex requires 5–10+ interactions (drag, drag, tap, drag, tap). The interaction cost exceeds the emotional benefit.

## Goal

A user should be able to select any emotion word anywhere in the field with **one press per word** — a single press-and-release gesture on or near a word's position.

## Actors

**A1: User** — a person doing a daily or moment-based emotional check-in. May be on mobile (touch) or desktop (mouse). Primary surface is iPhone; desktop is secondary but should feel equivalent.

## Core Interaction Model

### Direct Field (replaces Virtual Viewport)

The emotion space is mapped directly to the physical screen. There is no virtual camera or pan offset. The user's finger or cursor position corresponds directly to a position in the [-1, 1] × [-1, 1] coordinate space.

- X axis (left → right) = valence (negative → positive)
- Y axis (top → bottom) = arousal (high → low)
- coordToPixel maps [-1, 1] → [5%, 95%] of screen dimension (unchanged)

### Press-Reveal Radius

All emotion words are visible at ambient opacity (~15%) on load. Pressing anywhere activates a **reveal radius** centered on the press point. Words within the radius illuminate to full opacity; the word nearest the center scales up as a selection candidate.

Releasing within SELECTION_RADIUS of a word selects it.

## Key Flows

### F1: Select a single emotion word

1. User presses the field in the region of a word
2. Nearby words illuminate; closest word to press center scales ~1.3×
3. User releases — word is selected (amber highlight)
4. User taps Done to proceed to definition cards

### F2: Select multiple emotion words

1. User presses and selects a word (F1)
2. User presses in a different region to reveal another cluster
3. Repeat until satisfied
4. User taps Done

### F3: Press with no word nearby

1. User presses in empty space (no word within SELECTION_RADIUS at release)
2. Reveal radius illuminates nearby words for orientation
3. Release does nothing — no selection, reveal fades back to ambient

### F4: Deselect a word

1. User presses near an already-selected (amber) word
2. Word is deselected and returns to ambient dim state

## Requirements

**R1 — Ambient visibility.** All emotion words render at ~15% opacity on field load, distributed across the full screen without requiring any gesture to discover.

**R2 — Press-to-reveal.** On pointerdown, a circular reveal radius activates at the press point. Words within VISIBILITY_RADIUS (~0.35 coord units) illuminate to full opacity with a smooth spring transition (baseline: stiffness 120, damping 20 — tune during implementation).

**R3 — Radius follows finger/cursor.** Moving while pressed shifts the reveal center. Words enter and exit the radius continuously as the user moves.

**R4 — Candidate scaling.** The word nearest to the reveal center scales up to ~1.3× while pressed. Only one word is the candidate at a time; scale transitions smoothly as the nearest word changes during movement (same spring baseline as R2). The candidate at the moment of pointerup is the word that gets selected or deselected — the selection does not re-evaluate the nearest word independently at release.

**R5 — Select/deselect toggle on release.** On pointerup within SELECTION_RADIUS of a word: if the word is currently unselected, select it (amber highlight); if the word is currently selected, deselect it (return to ambient dim). This single toggle rule handles both selection (F1) and deselection (F4) without separate logic paths.

**R6 — Empty-space release.** If pointerup has no word within SELECTION_RADIUS, no selection or deselection occurs. The reveal fades back to ambient.

**R7 — Multi-select.** Each press-release cycle selects or deselects one word. Users repeat to select multiple. Done button is disabled at 0 selections and enabled at 1+ selections.

**R9 — No virtual viewport.** There is no drag-to-pan behavior. The press-and-drag model from v1 is removed entirely.

**R10 — Word coordinate spread.** Emotion words should span the [-0.95, 0.95] (symmetric range) on both axes, with words spread across the visible field rather than concentrated at quadrant centers. Before redistributing: audit the current coordinate spread in `src/data/emotions.ts` — coordinates may already be well-distributed; redistribute only if significant quadrant clustering is confirmed.

**R11 — Desktop parity.** The reveal model works identically on desktop mouse. Pointerdown = activate, pointermove while pressed = track, pointerup = commit. No hover-only state required for parity (optional enhancement only).

**R12 — Selection persistence.** Selected words remain at full opacity and amber highlight regardless of where the reveal radius is positioned.

**R13 — Y-axis rendering convention preserved.** Word rendering retains the `-emotion.y` inversion (positive arousal = top of screen). Only the drag-accumulation Y-inversion in `src/hooks/useGesturePin.ts` is removed — word positioning in `src/components/EmotionField/EmotionWord.tsx` and pin positioning in `src/components/EmotionField/EmotionField.tsx` are unchanged.

**R14 — Touch-action none.** The field container must retain `touch-action: none` and `overscroll-behavior: none` to suppress browser scroll/zoom interference during press-move gestures. Already set in v1; confirm it is not removed during the gesture refactor.

**R15 — Pointer capture.** The field must capture the pointer on pointerdown (via `setPointerCapture`) so pointermove and pointerup events are received even if the pointer leaves the field boundary mid-gesture.

## Scope Boundaries

**Out of scope for v2:**
- Passive hover reveal (pointermove without press on desktop) — optional enhancement, not required
- Animated reveal radius ring (visual circle showing the radius boundary)
- Word label resize/reflow based on screen size
- Coordinate axis labels (valence/arousal) on the field

## Success Criteria

- A user can select 3 words from 3 different quadrants in under 6 seconds
- A new user understands the gesture on first attempt without hint text
- All words are reachable in 1 press from any area of the screen

## Open Questions

- Hint text: change "press and drag to explore" to **"press near a word to reveal and select it"** (resolved — update `src/App.tsx` line ~108)
- Should very closely spaced words (< 0.05 coord units apart) be nudged apart to avoid ambiguous tap targets?
- Is a minimum touch target size needed for small screens (e.g., words with fewer than 4 characters)?

## Connections

- Replaces `src/hooks/useGesturePin.ts` (virtual pin + drag-to-pan logic)
- Updates `src/components/EmotionField/EmotionField.tsx` (gesture binding)
- Updates `src/components/EmotionField/EmotionWord.tsx` (opacity/scale from cursor distance)
- Updates `src/data/emotions.ts` (coordinate spread)
- Removes Y-axis inversion from drag-accumulation logic only (word rendering retains `-emotion.y` convention — positive arousal = top of screen; see R13)
