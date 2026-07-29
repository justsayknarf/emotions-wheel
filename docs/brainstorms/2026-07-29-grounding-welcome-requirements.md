---
date: 2026-07-29
topic: grounding-welcome
---

# Grounding Welcome — Requirements

## Summary

Open every check-in with a brief grounding welcome: a short rotating somatic cue ("notice your breath", "feel your feet on the ground") paired with a soft glow on the field axes that orients how to drop a pin. It is non-blocking — it auto-dissolves after a beat and any touch on the field skips straight through, so it is a ritual beat, never a gate. On a first-time user's first load it leads into the existing `FirstRunDemo` gesture lesson; returning users go welcome → field.

## Problem Frame

Today the app mounts and drops the user straight onto a cold field (`src/main.tsx` renders `<App/>` with no intervening state). There is no moment to arrive. The product's whole thesis is that recording a feeling should be as low-cost as a thought — but the harder, upstream problem is that the user often hasn't actually *noticed* what they feel before they're asked to place it. A check-in that starts cold tends to record a guess from the head rather than a read from the body.

A grounding beat addresses that: a cue to notice the body and surroundings shifts the user into contact with their actual state before the field asks them to locate it. The risk is that any beat before the field reads as friction and erodes the low-cost promise — so the beat must never block, and must not go stale from daily repetition.

## Key Decisions

- **Grounding cue as ritual, not friction.** The beat before the field is reframed as arriving in the body, which serves check-in quality. The low-friction bar is honored by making the beat non-blocking (auto-dissolve, skip-on-touch), not by removing it.
- **Rotating pool over a single fixed line.** Because the welcome shows every check-in, a single message would fade into wallpaper. A small curated pool keeps it alive.
- **Welcome is the universal front door; `FirstRunDemo` stays.** The welcome shows on every check-in. The existing first-run gesture demo is kept and plays after the welcome on a new user's first load, forming a natural arc rather than being replaced.
- **Welcome precedes every check-in, including in-app resets.** "Every check-in" means each time the field is entered to begin a check-in — both a browser page load and the in-app "new check-in" reset — not only hard reloads. The non-blocking dissolve/skip keeps repeated check-ins in one sitting from grating.

## Key Flows

- F1. Returning user, standard check-in
  - **Trigger:** The field is entered to start a check-in (page load or in-app "new check-in").
  - **Steps:** A rotating grounding cue fades in; the field axes glow softly. The welcome auto-dissolves after a beat into the ready field — or the user touches the field, which skips the welcome immediately and begins the check-in.
  - **Outcome:** The user lands on the field, grounded, with no forced wait.
  - **Covered by:** R1, R2, R3, R4, R6, R7

- F2. First-time user, first load
  - **Trigger:** First-ever load, before the onboarded flag is set (`emotion-selector-onboarded`).
  - **Steps:** The grounding welcome plays as in F1, then dissolves into the existing `FirstRunDemo` gesture lesson, then the ready field.
  - **Outcome:** The new user is grounded, then taught the pin-drop gesture, in one arc.
  - **Covered by:** R5

## Requirements

**Welcome content**

- R1. On entering the field for a check-in, the app shows a grounding cue drawn from a curated pool of short somatic prompts.
- R2. The cue shown is selected to vary across successive appearances, so the same prompt does not repeat every time.
- R3. The field axes are softly emphasized while the welcome is present, orienting the user toward how a pin is placed.

**Dismissal and non-blocking behavior**

- R4. The welcome auto-dissolves into the ready field after a short beat without any user action.
- R6. Touching the field while the welcome is present skips it immediately and begins the check-in — the welcome never blocks interaction.
- R7. Dismissal (auto or by touch) leaves the field fully interactive with no residual overlay.

**First-run integration**

- R5. On a first-time user's first load, the welcome plays first and then leads into the existing `FirstRunDemo` gesture lesson; returning users get the welcome without the demo.

## Acceptance Examples

- AE1. Covers R2. **Given** a user who checks in on two consecutive loads, **when** the welcome appears each time, **then** the second cue is not the same prompt as the first.
- AE2. Covers R4, R6. **Given** the welcome is showing, **when** the user does nothing, **then** it dissolves into the field on its own; **when** instead the user touches the field, **then** the welcome disappears at once and the touch begins the check-in.
- AE3. Covers R5. **Given** a brand-new user on first load, **when** the welcome finishes, **then** the `FirstRunDemo` gesture lesson plays before the field settles; **given** a returning user, **then** no demo plays after the welcome.
- AE4. Covers R7. **Given** the welcome has dissolved, **when** the user drops a pin, **then** no welcome overlay intercepts or dims the interaction.

## Scope Boundaries

- **Pre-mount boot-flash coverage** — out of scope. The welcome is a React surface that appears once the app mounts; the raw blank flash before the JS bundle parses is a separate concern (an `index.html`-level splash) and is not addressed here.
- **Time- or context-aware copy** (greetings by time of day, nods to the last check-in) — deferred. The pool is a flat rotating set for now.
- **Personalization or authored cue editing** — out of scope; the pool is curated in code.
- **Replacing or reworking `FirstRunDemo`** — out of scope; it is kept as-is and sequenced after the welcome.

## Outstanding Questions

Deferred to planning:

- The auto-dissolve duration and the welcome's enter/exit motion (timings tune against the app's existing calm-motion language and reduced-motion handling).
- The initial pool of grounding cues (exact copy and count) and the rotation mechanism (random vs. cycling, and whether to avoid immediate repeats across a single device).
- Whether the axis glow reuses `EmotionField`'s existing `axisEmphasis` affordance (the same one `FirstRunDemo` drives) or a distinct treatment.
