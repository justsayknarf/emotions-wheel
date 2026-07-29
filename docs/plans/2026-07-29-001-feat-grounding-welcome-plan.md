---
title: "feat: Grounding welcome on check-in load"
date: 2026-07-29
type: feat
origin: docs/brainstorms/2026-07-29-grounding-welcome-requirements.md
---

# feat: Grounding welcome on check-in load

## Summary

Open every check-in with a brief, non-blocking grounding welcome: a single rotating somatic cue (e.g. "notice your breath") rendered as borderless floating text over the field, paired with a soft glow on the field axes. It auto-dissolves after a beat, and any touch on the field skips it and begins the check-in. On a first-time user's first load it precedes the existing `FirstRunDemo` gesture lesson; returning users get welcome → field.

## Problem Frame

Today `src/main.tsx` mounts `<App/>` and drops the user straight onto a cold field — there is no moment to arrive, and a check-in that starts cold records a guess from the head rather than a read from the body. A grounding beat shifts the user into contact with their actual state before the field asks them to locate it (see origin: `docs/brainstorms/2026-07-29-grounding-welcome-requirements.md`). The constraint is the product's low-friction thesis: the beat must never block, and must not go stale from daily repetition.

## Key Technical Decisions

- **Reuse `axisEmphasis`, don't invent a second glow.** `EmotionField` already exposes `axisEmphasis` (currently `axisEmphasis={showDemo}` in `src/App.tsx`) and `FirstRunDemo` drives it. The welcome folds into the same signal (`axisEmphasis={showDemo || showWelcome}`) so the orientation cue is one affordance, not two competing ones. Resolves the origin's open question toward reuse.
- **First-run "sequence" by layering, not by reworking the demo.** The welcome renders above the existing first-run hint and `FirstRunDemo` (both untouched) at a higher `zIndex`, and reveals them as it dissolves. This delivers the origin's welcome → demo arc with the least disruption to working onboarding code.
- **Cue rotation persists the last-shown cue to `localStorage`.** "No immediate repeat across successive appearances" (origin R2) must hold across page reloads, not just within a session, so the last-shown index is persisted — consistent with the app's existing `localStorage` usage (`emotion-selector-diary`, `emotion-selector-onboarded`, `reveal-tuning`).
- **The welcome is atmosphere, not a dialog — no card chrome.** Per the design review, the cue is `pointerEvents: none` floating text set in the field's Palatino serif (`FIELD_FONT`), sentence case, `--oura-text-1` (warm off-white), with no panel/border/backdrop. This keeps it in the "recording a feeling" type register (distinct from the functional bordered hint in Inter uppercase) and avoids two centered cards stuttering back-to-back on first run. Gold is reserved for actions, so the cue is not gold.
- **Dismissal reuses the existing field-interaction path.** Because `EmotionField` is always mounted beneath the overlay and already reports first touch via `onFirstInteraction`, a field pointer-down both begins the check-in and flips `showWelcome` off. The overlay itself stays `pointerEvents: none`; no interaction is intercepted.

## Requirements

Carried from the origin requirements doc:

- R1. On entering the field for a check-in, show a grounding cue from a curated pool. → U1, U2, U3
- R2. The cue varies across successive appearances (no immediate repeat, across reloads). → U1
- R3. The field axes are softly emphasized while the welcome is present. → U3
- R4. The welcome auto-dissolves into the field after a short beat with no user action. → U3
- R5. First load precedes `FirstRunDemo`; returning users get the welcome without the demo. → U3
- R6. Touching the field while the welcome is present skips it immediately and begins the check-in. → U3
- R7. Dismissal leaves the field fully interactive with no residual overlay. → U2, U3

---

## Implementation Units

### U1. Grounding cue pool + rotation

- **Goal:** A curated pool of short somatic cues and a pure selector that returns one per appearance without immediately repeating the previous one, persisting the last-shown position across reloads.
- **Requirements:** R1, R2
- **Dependencies:** none
- **Files:**
  - Create `src/data/groundingCues.ts` — the cue pool (array of short sentence-case strings) and `nextCue()` returning `{ cue, index }`, reading/writing the last index to `localStorage` (new key, e.g. `emotion-selector-welcome-cue`).
  - Create `scripts/test-grounding-cues.ts` — deterministic check (tsx), matching the `scripts/test-fan.ts` / `scripts/test-csv-export.ts` convention.
  - Modify `package.json` — add a `check:cues` script.
- **Approach:** Keep selection pure and injectable — accept the previous index (or read it from a small storage helper) and return the next, choosing any index != previous. Guard the single-element pool (return it, no infinite loop) and the empty-storage case (any starting cue). Persist the chosen index so the next load avoids it. Do not depend on React here.
- **Patterns to follow:** `src/store/diary.ts` for the try/catch-wrapped `localStorage` read/write shape; `scripts/test-csv-export.ts` for the check-script structure and assertion style.
- **Test scenarios:**
  - Happy path: successive calls seeded with a known previous index never return that index; over many calls every cue in the pool is reachable.
  - Edge: a single-cue pool returns that cue and does not loop or throw.
  - Edge: absent/corrupt stored index falls back to a valid starting cue (no throw).
  - Persistence: after a call, the stored index equals the returned index.
  - `Covers R2.`
- **Verification:** `npm run check:cues` passes; no repeat-in-a-row across a simulated sequence of loads.

### U2. WelcomeOverlay component

- **Goal:** A presentational overlay that renders a single cue as borderless floating text, fades in on mount and dissolves on exit, honoring reduced motion — and never intercepts pointer input.
- **Requirements:** R1, R7
- **Dependencies:** U1
- **Files:**
  - Create `src/components/Welcome/WelcomeOverlay.tsx`.
- **Approach:** Center the cue over the field plane (mirror the existing hint's positioning math in `src/App.tsx`: `top: 50%`, `left: fieldCenterLeft`, translate -50%). Set `pointerEvents: none`, a high `zIndex` (above the first-run hint/demo). Type: `FIELD_FONT` (Palatino), sentence case, `--oura-text-1`, light weight — no border, no backdrop, no panel. Entrance: slow fade with a faint rise/breath (~0.7s easeOut, matching the hint's `transition`). Wrap in `AnimatePresence` at the call site so exit animates. Expose a prop for the two exit speeds (calm auto-dissolve vs. snappy skip-on-touch) OR take an `exitDuration`; the parent decides which by why it unmounted. Under `useReducedMotion`, render a static fade only (no rise/breath) — reuse the pattern in `src/components/EmotionField/FieldAura.tsx` / `Tether.tsx`.
- **Patterns to follow:** the existing first-run hint block in `src/App.tsx` (positioning, `motion.div` fade/`y` transition, blur/border deliberately *omitted* here); `FIELD_FONT` in `src/components/EmotionField/EmotionWord.tsx`; `useReducedMotion` usage in `src/components/EmotionField/FieldAura.tsx`.
- **Test scenarios:** `Test expectation: none — presentational component, no branching logic beyond reduced-motion; verified live in U3.`
- **Verification:** Renders the passed cue as unstyled-panel floating serif text; does not capture clicks (field beneath stays interactive); reduced-motion shows a plain fade.

### U3. Wire the welcome into the app lifecycle

- **Goal:** Show the welcome on each field entry (page load and in-app new check-in), glow the axes while it is up, auto-dissolve after a beat, dismiss on first field touch, and sequence it ahead of the first-run demo.
- **Requirements:** R3, R4, R5, R6, R7
- **Dependencies:** U1, U2
- **Files:**
  - Modify `src/App.tsx` — add `showWelcome` state and the cue selection; render `WelcomeOverlay` inside the existing `view === 'field'` chrome block, above the hint/demo; extend `axisEmphasis`; hook dismissal.
- **Approach:**
  - Add `showWelcome` state, initialized true, and pick the cue via `nextCue()` (U1) when a welcome begins. Begin a welcome on mount and in `handleNewSession` (reset `showWelcome` true + pick a fresh cue) so it precedes every check-in, matching the origin's every-check-in decision.
  - Auto-dissolve: a timer (single `setTimeout`, cleared on unmount/dismiss) flips `showWelcome` false after the beat (exact duration deferred to implementation; tune against the app's calm motion).
  - Skip-on-touch: flip `showWelcome` false from the existing first-field-interaction path (`handleFirstInteraction` / `onFirstInteraction`) and also on a field pointer-down for already-onboarded returning users (whose touch does not go through the first-run `markInteracted`). The overlay stays `pointerEvents: none`, so the touch reaches `EmotionField` normally — this only tears down the overlay.
  - Axis glow: change `axisEmphasis={showDemo}` to `axisEmphasis={showDemo || showWelcome}` (R3).
  - First-run sequence: render `WelcomeOverlay` at a `zIndex` above the first-run hint and `FirstRunDemo` so, on first load, the welcome covers them and reveals them (still looping) as it dissolves (R5). Returning users have no demo, so they get welcome → field. Pass the calm exit duration on auto-dissolve and the snappy one on skip.
- **Execution note:** verify in-browser (dev server) — the repo has no component test runner; behavior here is timing/interaction and is confirmed live, as with prior UI units.
- **Test scenarios:**
  - `Covers R4, R6.` Auto-dissolve: with no interaction the overlay disappears on its own after the beat; on a field touch it disappears at once and the touch begins the check-in.
  - `Covers R5.` First-time user: welcome shows, then the gesture demo is visible after it dissolves; returning user: no demo after the welcome.
  - `Covers R3.` Axes are emphasized while the welcome is present and hand off cleanly (demo keeps them lit on first run; they settle for returning users).
  - `Covers R7.` After dissolve, dropping a pin is uninterrupted — no overlay dims or intercepts.
  - Integration: a new check-in via `handleNewSession` re-shows the welcome with a cue different from the immediately preceding one.
- **Verification:** On a fresh profile, load → grounding cue + axis glow → dissolves into demo → field. On a profile with history, load → cue + glow → field (no demo). Touch during the cue always begins the check-in immediately. Successive loads/new-sessions do not repeat the same cue.

---

## Scope Boundaries

Carried from origin, plus plan-local deferrals:

- **Pre-mount boot-flash coverage** (an `index.html`-level splash) — out of scope; the welcome is a React surface that appears after mount.
- **Time-/context-aware or personalized copy** — deferred; the pool is a flat rotating set.
- **Reworking or replacing `FirstRunDemo` and the existing first-run hint** — out of scope; both are kept and only layered beneath the welcome.

### Deferred to Follow-Up Work

- Tuning the auto-dissolve duration and entrance/exit curves by feel is expected during implementation and after a live pass, not pre-specified here.

## Open Questions

Deferred to implementation:

- Exact auto-dissolve duration and the entrance breath/rise amount — tune live against the app's motion language.
- The initial cue copy and pool size (target ~5–10 short prompts); final wording is a content pass during U1.
- Whether skip-on-touch needs a distinct faster exit curve or the same curve reads fine — decide by feel once wired.
