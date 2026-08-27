---
date: 2026-08-27
topic: desktop-check-in-focus
---

## Summary

On desktop, the landing recenters around the previous check-in card: shown front and center, with the field receded behind it (scaled down and slightly blurred), replacing today's side-rail placement. First-time users get a neutral-centered variant of the same treatment. The field stays directly touchable throughout; the first touch — a slider drag on the card or a direct field press — starts a continuous transition back to today's full-focus rail layout.

---

## Problem Frame

Today's desktop landing shows the field and the previous-check-in rail side by side, both at full visual weight, the moment the app loads. The rail's card already carries departure sliders — added specifically because adjusting a coordinate (recognition) is lower-friction than generating one from scratch on the field (recall). But the field's own word clutter, rendered at full prominence right next to the card, competes with that lower-friction path for the eye's first landing point. This was observed directly: a real moment of hesitating before dropping a pin on desktop, with the field needing to be visually parsed before the sliders registered as the faster way in.

---

## Key Decisions

- **Depth recede over plain opacity dim.** The field steps back via scale + slight blur, not just fading translucent. This matches the app's own stated aesthetic principle ("Z-axis transitions," per CLAUDE.md) and reads as the field physically receding rather than merely dimming — chosen deliberately over the cheaper opacity-only default.
- **Front-and-center positioning, not just de-emphasis.** Quieting the field alone (while the card stays in its current rail position) was considered and rejected — the card needs to be where the eye lands first, not peripheral, for the CTA to actually win.
- **Symmetric first-time-user variant.** Users with no previous check-in get the same front-and-center treatment with a neutral-centered card, rather than falling back to today's rail. Mirrors the neutral-center pattern already decided for the new-tab landing's first-time case.
- **Field stays directly touchable, no explicit "select from field" control.** The recede is purely visual. A returning user can still press the field directly at any point; no dedicated button teaches this, since it doesn't gate anything new.
- **Scoped to the desktop rail only.** New-tab keeps its separately-decided sliders-only-no-field landing; mobile keeps the collapsed-peek tray from PR #16, a deliberate, opposite bet made for a different reason (there, the tray had to stay out of the field's way; here, the card is the one demanding the eye).

---

## Requirements

**Landing**
- R1. On desktop, the pre-check-in landing shows the previous check-in card front and center, with the field receded behind it (scaled down and slightly blurred), replacing today's side-rail placement.
- R2. When no previous check-in exists, the card renders a neutral-centered variant with sliders at the neutral center of each axis, with the same field-receded treatment behind it.
- R3. Mobile's landing is unchanged — the PR #16 collapsed-peek tray stands.
- R4. The new-tab entry point is unchanged — it continues on the separately-planned sliders-only-no-field landing.

**Interaction**
- R5. The receded field stays directly touchable — a press anywhere on it drops a pin, the same as today.
- R6. No explicit "select from field instead" control is added to the card.

**Transition**
- R7. Starting a slider drag on the front-and-center card begins a continuous transition: the recede reverses and the layout eases toward today's side-rail arrangement as the drag progresses.
- R8. A direct press on the receded field also triggers the same transition, keyed to the press itself rather than a drag phase.
- R9. Once the transition completes, the rest of the check-in flow (draft cards, Save/Discard, history) behaves exactly as it does today.

---

## Key Flows

- F1. Desktop landing, returning user
  - **Trigger:** User opens the desktop app with an existing previous check-in.
  - **Steps:** The card renders front and center, pre-positioned at the previous entry; the field renders receded behind it. The user drags a slider or presses the field directly. The transition begins immediately, easing the field into focus and the layout toward today's rail. The rest of the flow proceeds unchanged.
  - **Outcome:** A pin is dropped through either path, landing back in today's familiar draft flow.
  - **Covered by:** R1, R5, R7, R8, R9

- F2. Desktop landing, first-time user
  - **Trigger:** User with no previous check-ins opens the desktop app.
  - **Steps:** The card renders front and center in its neutral-centered variant, field receded behind it. From the first touch onward, F1 applies.
  - **Outcome:** Same as F1, with no previous-entry anchor.
  - **Covered by:** R2, R5, R7, R8, R9

---

## Acceptance Examples

- AE1. Given a returning desktop user, when they open the app, then the previous check-in card renders front and center, pre-positioned at their last entry, with the field visibly receded (scaled and blurred) behind it. Covers R1.
- AE2. Given a first-time desktop user, when they open the app, then the card renders front and center with sliders at the neutral center, field receded behind it. Covers R2.
- AE3. Given the receded-field landing, when the user presses the field directly instead of touching the card, then a pin drops at that coordinate and the focus transition begins. Covers R5, R8.
- AE4. Given the receded-field landing, when the user begins dragging a card slider, then the field recede reverses progressively as the drag continues, easing toward today's rail layout. Covers R7.
- AE5. Given a mobile session, when the user opens the app, then today's collapsed-peek tray renders unchanged — no front-and-center card, no field recede. Covers R3.
- AE6. Given a new-tab session, when the tab opens, then the separately-planned sliders-only-no-field landing renders, not this front-and-center treatment. Covers R4.

---

## Success Criteria

Judged qualitatively, consistent with the new-tab brainstorm's approach (no baseline exists yet): desktop check-ins should complete more readily, with less pre-touch hesitation, than under today's side-rail landing — aligned with STRATEGY.md's check-in frequency and session completion rate metrics.

---

## Scope Boundaries

**Deferred for later**
- Applying this same front-and-center treatment to the new-tab entry point, or reconciling it with the sliders-only-no-field plan there.
- Exact scale/blur intensity and transition timing — a prototyping and tuning concern.

**Outside this product's identity**
- Reversing the mobile collapsed-peek decision from PR #16. That was a deliberate, separate bet made for mobile's own reasons and stands unchanged here.

---

## Dependencies / Assumptions

- Assumes the field's container can carry a whole-field recede treatment. Today's dimming logic operates per-word inside `EmotionField`, not at the container level — this is new work, not reuse.
- Reuses the existing live-drag-reveal pattern from the mobile sheet (the tray fades to near-transparent while a draft pin's slider is dragged, revealing the field underneath) as prior art for a drag-triggered live transition, generalized here to the opposite direction: the field recedes by default, not the card.

---

## Outstanding Questions

**Deferred to Planning**
- Exact recede parameters (scale factor, blur radius, transition duration and easing).
- How the direct-field-press transition (R8) visually plays out, given that path has no drag phase to key a progressive reveal off of, unlike the slider-drag transition (R7).
- Where the card's Save/Discard/history affordances live while it's front-and-center, since today they belong to the rail's drawer chrome rendered alongside the field, not centered over it.

---

## Sources / Research

- src/App.tsx:125-259, 569-767 — current desktop rail layout (`sideBySide`, `RAIL_WIDTH`, `fieldPlaneRef`), the always-mounted field, and the rail/sheet split this proposal changes for desktop.
- src/components/EmotionPreview/EmotionDrawer.tsx:9-32, 196-275 — the previous-check-in card's current home in the rail, and the existing drag-triggered tray-fade mechanic this proposal's transition generalizes.
- src/components/EmotionField/EmotionField.tsx:37-236 — confirms no existing whole-field opacity or dim control; dimming today is per-word, not container-level.
- docs/plans/2026-08-24-001-feat-departure-mark-plan.md — rationale for the departure sliders as a recognition-based, lower-friction alternative to the field's recall-based interaction, the premise this proposal extends to the desktop landing.
- docs/brainstorms/2026-08-26-newtab-minimal-ritual-requirements.md — the separately-decided new-tab treatment (R4 there) this proposal doesn't touch, and the source of the neutral-center-for-first-time-users pattern this proposal mirrors (R2 here).
- CLAUDE.md — "Z-axis transitions" as an existing stated aesthetic principle, motivating the depth-recede choice over plain opacity dim.
- STRATEGY.md — check-in frequency and session completion rate as the habit-formation metrics this proposal serves.
