---
date: 2026-08-26
topic: newtab-minimal-ritual
superseded-by: docs/brainstorms/2026-09-02-newtab-departure-float-requirements.md
---

> **Superseded.** This direction (sliders-only, field entirely absent
> pre-check-in) was reconsidered before it shipped — see App.tsx's own
> comment on `desktopLandingActive` (search "review-fix (product
> direction)"). What actually shipped instead was
> docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md: a
> front-and-center card with the field receded (blurred/scaled), not absent,
> behind it — for desktop new-tab sessions only. This document is kept for
> historical record only; do not build against it.
> [2026-09-02-newtab-departure-float-requirements.md](2026-09-02-newtab-departure-float-requirements.md)
> is current.

## Summary

The new-tab entry point gets its own minimal landing: only the two departure sliders, no field, no ghosted words. Completing a check-in there reveals the constellation replay with the full history list alongside it, with a link from that reveal into the ordinary full field view. The main web app's own landing is unchanged.

---

## Problem Frame

The new-tab entry point (shipped 2026-08-25) currently loads the exact same landing the main web app shows: a full-screen field with its surface emotion words rendered at rest, plus a side rail or sheet carrying the previous check-in's card. That card already carries two departure sliders, added specifically because the field asks users to *generate* a coordinate — a recall task — while a slider only asks them to *adjust* one, which is recognition and therefore lower-friction.

On the new-tab surface specifically, that combined density (a field's worth of words plus a full card) reads as too much to look at before any decision to engage has even been made. The failure mode isn't hesitation over what to touch — it's bouncing off the tab entirely, closing it or navigating away before touching anything. That's a first-impression problem: for a surface meant to catch someone acting on autopilot, anything requiring parsing before the first touch works against the surface's own purpose.

---

## Key Decisions

- **Scoped to new-tab only.** The main web app's own landing (direct site visits) is untouched. This narrows R3 from docs/brainstorms/2026-08-25-newtab-checkin-entry-requirements.md ("same field/pin/card interaction as the main app, not a separate compact variant") to apply to direct web visits only — the new-tab entry point is now a deliberate exception, not a reopening of that decision generally.
- **Sliders-only landing, no field.** The new-tab pre-check-in state renders only the two departure sliders (and the relational caption, when one is available). The field and its surface words don't render at all until after a check-in completes.
- **Neutral center for first-time users.** A previous check-in anchors the sliders to its coordinate, same as today. With no previous check-in, the sliders start at the neutral center of each axis instead.
- **Constellation + history as the reward.** Completing the ritual replaces today's generic completion screen (new-tab entries only) with the constellation replay plus the full history list alongside it — a bigger payoff than a bare "saved" confirmation, and a moment that lets the user see their pattern.
- **Full field stays one step away, not gone.** From the constellation reveal, a link opens the ordinary full field view in the same tab, for anyone who wants to linger past the minimal ritual.
- **Direct field-press is dropped from new-tab pre-check-in.** Today's field supports minting a pin directly, without touching a slider. That gesture isn't available on the new-tab landing once the field stops rendering there; it's unaffected everywhere else.

---

## Requirements

**Landing (pre-check-in)**
- R1. The new-tab entry point's pre-check-in landing shows only the two departure sliders (and the relational caption, when available) — no field, no ghosted words, no drawer chrome.
- R2. When no previous check-in exists, the sliders start at the neutral center of each axis.
- R3. When a previous check-in exists, the sliders start pre-positioned at that entry, consistent with today's departure-slider behavior.
- R4. The main web app's own landing (direct site visits, not through the new-tab extension) is unchanged and continues showing today's full field + card.

**Completion & reveal**
- R5. Completing the minimal ritual (touching a slider) records the check-in, tagged with its new-tab source, and transitions to the constellation replay rather than today's generic completion screen — for new-tab-sourced entries specifically.
- R6. The constellation reveal shows the full history list alongside the replay, not just a recent window.
- R7. From the constellation reveal, the user can open the ordinary full field view within the same tab.

---

## Key Flows

- F1. New-tab minimal ritual
  - **Trigger:** User opens a new browser tab.
  - **Steps:** The sliders-only landing renders — anchored to the previous entry if one exists (R3), otherwise neutral-centered (R2). The user either touches a slider, which mints and records the check-in (R5), or navigates away untouched, leaving no record (per R4 of the original newtab-checkin-entry brainstorm). On completion, the constellation replay renders with the full history alongside it (R6); from there the user may open the full field view (R7) or navigate away.
  - **Outcome:** A completed ritual leaves a source-tagged entry and a reflection moment; a bypassed tab leaves nothing.
  - **Covered by:** R1-R7

---

## Acceptance Examples

- AE1. Given a returning user with a previous check-in opens a new tab, when the tab loads, then the sliders render pre-positioned at that entry with no field visible. Covers R1, R3.
- AE2. Given a first-time user with no previous check-ins opens a new tab, when the tab loads, then the sliders render at the neutral center with no field visible. Covers R1, R2.
- AE3. Given the sliders-only landing, when the user touches a slider, then the check-in mints, records with a new-tab source, and the constellation replay renders with the full history list alongside it. Covers R5, R6.
- AE4. Given the constellation reveal after a check-in, when the user selects the link to the full field, then the ordinary field + drawer view opens in the same tab. Covers R7.
- AE5. Given a direct visit to the deployed site (not through the new-tab extension), when the page loads, then today's unchanged full field + card landing renders, not the sliders-only version. Covers R4.

---

## Success Criteria

The change is judged qualitatively rather than against a numeric target (no baseline exists yet): new-tab-sourced check-ins should complete more often relative to tabs opened than under today's full-field landing, consistent with STRATEGY.md's check-in frequency and session completion rate metrics — the signal that the "bounce off entirely" problem is actually fixed, not just relocated.

---

## Scope Boundaries

**Deferred for later**
- A frequency or staleness gate on the new-tab interstitial — already deferred in the original newtab-checkin-entry brainstorm, unchanged here.
- Final treatment of the existing welcome overlay's somatic-cue text on the sliders-only screen — see Outstanding Questions.

**Outside this product's identity**
- Applying the sliders-only landing to the main web app's own entry point. The web app keeps its full field + card landing; this is a new-tab-specific exception, not a redesign of the product's primary surface.

---

## Dependencies / Assumptions

- Reuses the existing `ConstellationReplay` and history-list view rather than building new components for the reveal.
- Assumes the entry source and previous-check-in state are both available at the point the landing renders, consistent with how the new-tab entry point already resolves its source tag today.

---

## Outstanding Questions

**Deferred to Planning**
- Whether the welcome overlay's somatic-cue text still appears over the sliders-only screen, is replaced with something else, or is dropped for new-tab entries.
- How the relational caption sources its text when the sliders start at a neutral center (first-time users) — today's caption reads from a stored previous entry's description, which won't exist in that case.

---

## Sources / Research

- docs/brainstorms/2026-08-25-newtab-checkin-entry-requirements.md — R3, the "same interaction as the main app" decision this brainstorm narrows to web-only
- docs/plans/2026-08-24-001-feat-departure-mark-plan.md — rationale for making the departure sliders prominent (adjust vs. generate, recognition vs. recall)
- src/App.tsx, src/components/EmotionPreview/CoordinateCard.tsx, src/components/EmotionField/EmotionField.tsx, src/components/Constellation/ConstellationReplay.tsx, src/components/Welcome/WelcomeOverlay.tsx — current landing composition and the components this reuses
- STRATEGY.md — check-in frequency and session completion rate as the habit-formation metrics this entry point serves
