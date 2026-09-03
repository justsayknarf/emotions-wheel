---
date: 2026-09-02
topic: newtab-departure-float
---

## Summary

Replace the new-tab landing's front-and-center card (shipped in
docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md) with a
card-less pair of departure sliders floating on a frosted glass strip. The
field behind them stays fully visible and legible from the start — no
blur/scale recede — and brightens locally around the live slider coordinate
as it drags, so the field's own words and the previous check-in's ghost pin
teach the coordinate mapping in real time. The moment a pin mints, today's
existing focus-card review experience (tag recognition, caption, Save) takes
over unchanged. Applies to every new-tab session, not just desktop-width
ones. A direct tap on the field no longer mints a pin on this landing.

---

## Problem Frame

The shipped desktop-check-in-focus landing (`desktopLandingActive` in
[App.tsx](../../src/App.tsx), gated on `sideBySide && entrySource ===
'new-tab'`) already does two things right: it puts departure sliders
front-and-center, and it reveals the field behind the card as the user
drags a slider (`desktopFieldProgress` → `recedeProgress`, unblurring and
scaling the field back up).

But as a landing, screenshotted at rest, it reads poorly. The card
([EmotionDrawer.tsx](../../src/components/EmotionPreview/EmotionDrawer.tsx)'s
`shared` style) is a nearly opaque panel — `rgba(12, 14, 18, 0.97)` with a
20px blur — so at rest the field behind it is not just receded, it's
essentially gone: `recedeProgress` starts at 1 (fully blurred + scaled down
to `tuning.fieldRecedeScale`) until a drag begins. What's left on screen is
a small, low-contrast card centered in a mostly empty dark void, with two
competing panels (a "previous check-in" recap and a "draft check-in"
label) and no visible cue that a 2D field exists behind any of it. A
first-time or returning user has no reason to expect that dragging a
slider will reveal anything.

Separately, the reveal mechanic itself is coarse: `recedeProgress` blurs
and scales the *entire* field uniformly. It doesn't brighten words near the
coordinate the slider is actually at — that only happens through
`useProximity`/`dwellCenter` in
[EmotionField.tsx](../../src/components/EmotionField/EmotionField.tsx),
which is driven by hovering/pressing directly on the field, not by the
departure card's own slider drag. So today, dragging a departure slider
reveals *whatever was already sitting there* (crosshairs, the previous
check-in's anchor ring) — not a live, localized "here's what this
coordinate is called" cue.

And the card being solid the whole time (not just the outer panel — the
inner `CoordinateCard` does fade to translucent during its own drag via
`CARD_DRAG_BACKGROUND`, but that only reveals the *outer panel's own*
opaque background, since it's nested inside it) means the field is never
visible *through* the card at all, even mid-drag — only in the margins
around it.

Root cause: the shipped design's reveal strategy is "recede the whole
field, then un-recede it as a side effect of dragging." This plan's
strategy is different — keep the field visibly present and legible at
rest, and let the *slider's own live coordinate* pull a localized glow and
nearby words toward it, the same way hovering the field itself already
does via `dwellCenter`. The card becomes a frosted strip just large enough
to hold the controls, not a panel that has to be receded to see anything.

---

## Key Decisions

- **Card panel removed, replaced with a frosted control strip.** The
  departure sliders + caption sit on a blurred, translucent glass surface
  (`backdrop-filter: blur(...)`, ~40% fill) sized to the controls
  themselves, not a solid card. It recedes further (more transparent, less
  blur) for the duration of an active drag — mirroring
  `CoordinateCard.tsx`'s existing `CARD_DRAG_BACKGROUND` treatment for the
  ordinary (post-mint) adjust flow — and settles back at rest. This
  replaces `EmotionDrawer`'s opaque `shared` panel, but only for the
  pre-mint departure state (see below) — the panel is untouched everywhere
  else it's used (post-mint 'focus' review, 'rail', 'sheet').
- **The field is never blurred or scaled down pre-mint.** `recedeProgress`
  (App.tsx) stops applying during this landing's resting/departure state —
  the field renders at its normal scale and clarity from the first paint,
  same as any other view. It still applies once a pin mints and the
  existing post-mint 'focus' review card takes over (see below) — that
  card's own recede-behind-it treatment is unchanged and works well; this
  plan only replaces the *pre-mint* experience.
- **Reveal is localized to the live coordinate, not the whole field.** As a
  departure slider drags, a soft glow and the field's own nearby
  words (surface and, within dwell range, deep) brighten toward that exact
  coordinate — reusing the same proximity math `dwellCenter` already drives
  in `EmotionField.tsx`, fed by the slider's live value instead of a
  pointer hover.
- **Post-mint behavior is unchanged.** The instant a departure slider
  commits (release), the existing shipped flow takes over exactly as it
  does today: the minted pin's ordinary `CoordinateCard` (recognize/
  derecognize, caption, Save) renders in today's opaque focus panel, with
  today's `recedeProgress` blur/scale behind it. This plan does not touch
  that review experience — only the moment before a pin exists.
- **Direct field-press no longer mints a pin on this landing.** Today,
  `handleFieldPress` mints a pin from *any* press on the field, even while
  `desktopLandingActive` — including during this pre-mint state. That's now
  suppressed specifically here: the slider is the only way to commit on
  this landing. Elsewhere in the app (ordinary rail/sheet field
  interaction), direct field-press-to-mint is unchanged. This is the first
  concrete application of "pin drops should require confirmation" — scoped
  to this landing only for now; extending it to direct-tap everywhere else
  is a real goal but explicit future work, not part of this plan.
- **Applies to every new-tab session, not just desktop width.** Today
  `desktopLandingActive` requires `sideBySide` — a mobile-width new-tab
  session falls through to the ordinary `'sheet'` variant instead. That
  gate is removed: `entrySource === 'new-tab'` alone is now sufficient,
  regardless of viewport width. This matters more than it did for the
  shipped design, since a floating-sliders-on-a-frosted-strip layout is
  specifically well-suited to a small viewport in a way a wide, opaque
  desktop card wasn't designed to be.
- **Previous check-in anchoring is unchanged.** A returning user's sliders
  still start pre-positioned at their previous check-in's coordinate; a
  first-time user's still start at the neutral (0, 0) center. This is
  `EmotionDrawer`'s existing `departureEligible`/`neutralDepartureEligible`
  + `departureAnchor` (src/data/departure.ts) machinery — untouched.
- **Moving an existing pin stays out of scope.** Unchanged from every prior
  round of this feature.
- **Word-of-mouth "the field is more open than we thought" risk is
  accepted.** Removing the blur/scale recede means a first-time user sees
  the full field's surface words immediately, rather than a mostly-blank
  screen. This is intentional (see Problem Frame) — flagged here since it's
  a visible behavior change from the shipped design, not an oversight.

---

## Requirements

**Pre-mint landing (no draft pins yet)**

- R1. On every new-tab session (`entrySource === 'new-tab'`, any viewport
  width), the pre-mint landing shows two departure sliders on a frosted
  glass strip — no solid card panel.
- R2. The field renders at normal scale and clarity from first paint — no
  blur/scale recede while no pin has been minted.
- R3. Dragging a slider brightens a localized glow and nearby field words
  toward the live coordinate, using the same proximity/dwell math the
  field's own hover interaction already uses.
- R4. The frosted strip recedes further (thinner fill, less blur, no
  border) for the duration of an active drag, and settles back once
  released.
- R5. A returning user's sliders start pre-positioned at their previous
  check-in's coordinate, shown as a dim ghost marker on the field; a
  first-time user's sliders start at the neutral center, with no ghost
  marker.
- R6. A direct press on the field does not mint a pin while in this
  pre-mint state. (Unchanged everywhere else in the app.)

**Transition to post-mint**

- R7. The instant a departure slider commits, the existing shipped
  post-mint 'focus' review experience takes over unchanged — the minted
  pin's ordinary, editable `CoordinateCard` in today's opaque panel, with
  today's field recede-behind-it treatment.

---

## Key Flows

- F1. New-tab departure-float landing
  - **Trigger:** A new-tab session loads (`entrySource === 'new-tab'`),
    any viewport width, with no draft pins yet.
  - **Steps:** The frosted floating sliders render, anchored to the
    previous check-in if one exists (R5) or neutral-centered otherwise.
    The field is fully visible and legible behind them from the start
    (R2). The user drags a slider; the glass strip thins (R4) and a glow +
    nearby words brighten toward the live coordinate on the field (R3).
    Releasing commits the pin (R7), and the existing post-mint focus
    review card takes over from there exactly as it does today — tag
    recognition, caption, Save, and the field's existing recede-behind-it
    treatment.
  - **Outcome:** The landing teaches the field's spatial mapping through
    the act of dragging, rather than presenting an opaque card over a
    blurred, unreadable backdrop.
  - **Covered by:** R1-R7

---

## Scope Boundaries

**Unchanged / explicitly out of scope**

- The post-mint review card, its tag recognition, caption, and Save flow —
  all shipped and working; this plan doesn't touch them.
- `'rail'`/`'sheet'` departure sliders for an ordinary `'web'` visit with an
  empty draft (docs/plans/2026-08-24-001-feat-departure-mark-plan.md) — a
  separate, already-shipped affordance this plan does not touch.
- Extending pin-drop confirmation-gating to direct field-tap outside this
  landing (rail/sheet, or the post-mint review field) — a real future goal,
  not part of this plan.
- Moving an existing pin.
- Any change to the main web app's own direct-visit landing.

**Deferred to Planning**

- Whether `desktopLandingActive`/`desktopFieldProgress`/`desktopCardProgress`
  and friends get renamed now that "desktop" no longer describes when they
  apply, or whether that's a separate cleanup pass.
- Exact frosted-strip fill/blur values at rest vs. mid-drag (a validated
  starting point exists from design exploration — see Sources).

---

## Dependencies / Assumptions

- Builds directly on the shipped
  docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md machinery
  (`desktopLandingActive`, `departureEligible`/`neutralDepartureEligible`,
  `departureAnchor`, `handleDepartureDragProgress`) rather than replacing
  it — this is a follow-up plan, not a rewrite.
- Assumes `EmotionField`'s existing `dwellCenter`/`useProximity` machinery
  can be driven by an externally-supplied coordinate (the live departure
  drag value) without a structural rework — confirmed by reading
  EmotionField.tsx; the wiring itself is new (see the plan doc).

---

## Sources / Research

- [src/App.tsx](../../src/App.tsx) — `desktopLandingActive`,
  `desktopFieldProgress`/`recedeProgress`, `handleDepartureDragProgress`,
  `handleFieldPress`, `handleDepart` — confirmed the shipped mechanism this
  plan builds on and what actually renders at rest.
- [src/components/EmotionPreview/EmotionDrawer.tsx](../../src/components/EmotionPreview/EmotionDrawer.tsx) —
  confirmed the `shared` opaque panel style, the `'focus'` variant's
  content structure, and that departure-mode cards also render in
  `'rail'`/`'sheet'` independent of this landing (the 2026-08-24
  departure-mark feature) — out of scope here.
- [src/components/EmotionPreview/CoordinateCard.tsx](../../src/components/EmotionPreview/CoordinateCard.tsx) —
  confirmed `CARD_DRAG_BACKGROUND`/`CARD_DRAG_BORDER` precedent for the
  drag-recede treatment, and that `onDepartureDragProgress` currently
  reports only a 0-1 progress float, not the live coordinate.
- [src/components/EmotionField/EmotionField.tsx](../../src/components/EmotionField/EmotionField.tsx) —
  confirmed `dwellCenter`/`useProximity` drive word brightening from a
  pointer-hover coordinate today, with no existing path for an externally
  supplied (slider-driven) coordinate.
- [src/hooks/useFieldGesture.ts](../../src/hooks/useFieldGesture.ts) —
  confirmed the dwell-reveal timing/proximity model this plan reuses.
- [src/data/source.ts](../../src/data/source.ts) — `entrySource`
  resolution, unaffected by this plan.
- docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md — the
  shipped baseline this plan builds on; its own comments in App.tsx note
  that it superseded docs/brainstorms/2026-08-26-newtab-minimal-ritual-
  requirements.md before that plan shipped.
- docs/plans/2026-08-24-001-feat-departure-mark-plan.md — the general
  departure-slider affordance (rail/sheet, any empty-draft state), which
  this plan's card-less/frosted treatment does not extend to.
- In-session design exploration (frosted floating-sliders vs. card+minimap
  mockup) — validated the frosted-strip-with-drag-recede treatment this
  plan's R4 specifies.
