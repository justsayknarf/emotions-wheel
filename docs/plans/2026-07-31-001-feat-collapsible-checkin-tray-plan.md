---
title: "feat: Collapsible last-check-in tray on mobile (Option A)"
date: 2026-07-31
type: feat
origin: docs/brainstorms/2026-07-31-collapsible-checkin-tray-requirements.md
---

# feat: Collapsible last-check-in tray on mobile (Option A)

## Summary

On mobile, the returning-mirror `MirrorCard` bottom sheet ("Last check-in")
docks at the bottom of the field, content-height, and swallows pointer input over
its whole box — so on load it occludes and deadens the low-arousal bottom band of
the field. This implements **Option A** from the brainstorm: the mobile sheet
gains a **default-collapsed peek** (a short handle bar showing "Last check-in" +
relative time) that leaves the field fully pinnable beneath it, and **expands on
an explicit tap** to reveal the full mirror content. Collapse is reversible via
the handle and by starting an interaction with the field. Desktop's rail variant
is untouched.

## Problem Frame

`showMirror` in `src/App.tsx` (history present, no pins yet) renders `MirrorCard`
with `variant='sheet'` on mobile (`useSidePanelLayout()` false → coarse pointer /
narrow viewport). The sheet (`src/components/EmotionMirror/MirrorCard.tsx:98`) is
`position:absolute; bottom:0; left:0; right:0`, **content-height** (no
`maxHeight`, unlike `EmotionDrawer`'s `46vh`), and carries
`onPointerDown={(e) => e.stopPropagation()}` so nothing under it reaches the
field gesture layer. Net effect on a phone at load: the bottom slice of the field
— the low-arousal ("calm") band, already the thinnest part of the vocabulary — is
both visually covered and functionally dead. See origin:
`docs/brainstorms/2026-07-31-collapsible-checkin-tray-requirements.md`.

The constraint: the mirror is *context*, not the task, so it must default to out
of the way while staying one tap from full detail — without introducing an
ambient swipe that fights the field's press-and-drag pin gesture (the same class
of conflict just removed in the field swipe-to-history fix).

## Key Technical Decisions

- **Collapse must shrink the element's box, not just translate it.** Because the
  sheet's `stopPropagation` dead zone equals its rendered box, a collapsed state
  that keeps the full body mounted and merely offsets it with `y` would leave the
  dead zone in place. So the collapsed state **renders only the peek bar** (the
  full body is unmounted / height-collapsed), making the element genuinely short
  and freeing the field beneath. This is the core requirement-satisfying decision
  (R2, R3).
- **Tap-to-toggle, not drag-to-expand.** Expansion is a tap on the peek handle;
  collapse is a tap on the handle or the start of a field interaction. A
  drag/snap-point sheet is deferred (Open Questions) specifically to avoid a
  vertical swipe on the field competing with press-and-drag pin-drop — the lesson
  carried from the removed swipe-to-history gesture.
- **Collapse state lives in `App`, passed to `MirrorCard` as `expanded` +
  `onToggle`.** This mirrors how `App` already owns field-chrome lifecycle state
  (`showWelcome`, `pins`, `selectedPinId`) and lets a field-interaction handler
  collapse the tray cleanly (the field plane and the tray are siblings, so a
  field touch does not route through the tray's `stopPropagation`). The peek
  handle's own tap uses a normal `onClick` on the tray, isolated from the field.
- **A collapse-by-field-touch is consumed and must NOT drop a pin.** When an
  expanded tray is dismissed by pressing the field, that press is a *dismiss*, not
  a check-in — it must not leave a pin. The field's pin handlers are React
  synthetic props (`onPointerDown={handlers.onPointerDown}`) on the `EmotionField`
  element, which is a descendant of the `fieldPlaneRef` wrapper. So the collapse
  listener is attached as `onPointerDownCapture` on that wrapper and, only while
  `mirrorExpanded`, calls `setMirrorExpanded(false)` **and `e.stopPropagation()`**
  — the capture-phase stop prevents the event from reaching `EmotionField`, so no
  gesture starts and no pin is created (a pin needs the field's own
  `onPointerDown` → `onPointerUp`). While already collapsed the handler is inert
  and a field press drops a pin normally.
- **Mobile-only; rail variant unchanged.** Everything is guarded behind the sheet
  variant (`!isRail`). On desktop the mirror docks as a side rail beside the
  field with no occlusion, so it has no collapse affordance and no behavior
  change (R9).
- **Reuse the sheet's existing spring and the app's reduced-motion pattern.** The
  expand/collapse animates the sheet height with the current
  `spring {stiffness:300, damping:35}`; under `useReducedMotion` it snaps with no
  animation, matching `FieldAura.tsx` / `Tether.tsx`.
- **`MirrorCard` only this pass; shared `CollapsibleSheet` deferred.**
  `EmotionDrawer` shares the sheet pattern and is a strong candidate to adopt the
  same collapse mechanism, but it only appears *after* a pin exists, so it is not
  the load-time blocker. Extracting a shared wrapper is a fast follow, not this
  pass (Scope Boundaries).

## Requirements

Carried from the origin requirements doc:

- R1. On mobile load with the returning mirror, the tray renders collapsed, not
  expanded. → U1, U2
- R2. In the collapsed state, the field above the peek bar is fully interactive
  for dropping a pin, including the band the expanded tray would cover. → U1, U2
- R3. Touch-swallowing (`stopPropagation`) is limited to the peek bar's bounds in
  the collapsed state, not the full expanded footprint. → U1
- R4. The user can expand the tray to full content via an explicit, discoverable
  tap affordance. → U1, U2
- R5. The user can collapse an expanded tray back to the peek via the handle and
  by starting an interaction with the field. → U2
- R6. Expand/collapse animates with the existing calm sheet motion and respects
  reduced motion. → U1
- R7. The collapsed peek shows a meaningful digest (at least "Last check-in" +
  relative time), not a blank bar. → U1
- R8. The expanded state shows the same content the sheet shows today (time,
  relational line, word pills, recent rhythm). → U1
- R9. Desktop (rail variant) behavior is unchanged. → U1
- R10. Collapsing the tray never drops a pin: the handle tap is isolated inside
  the tray, and a collapse-by-field-touch is consumed (no pin created). → U2

---

## Implementation Units

### U1. Collapsible sheet shell in `MirrorCard` (mobile variant)

- **Goal:** The mobile `MirrorCard` sheet renders either a short peek bar
  (collapsed) or the full body under a handle (expanded), driven by an `expanded`
  prop, animating between the two with the existing spring and respecting reduced
  motion. Only the rendered box carries `stopPropagation`.
- **Requirements:** R1, R2, R3, R4, R6, R7, R8, R9
- **Dependencies:** none
- **Files:**
  - Modify `src/components/EmotionMirror/MirrorCard.tsx` — add `expanded: boolean`
    and `onToggle: () => void` props (sheet variant only); split the sheet render
    into a peek bar (always shown at sheet bottom) plus the existing `body`
    (rendered only when `expanded`); wire the toggle; keep the rail branch
    untouched.
- **Approach:**
  - Add a **peek bar** as the sheet's top region: a grabber affordance (a short
    centered pill) and a single digest line — "Last check-in" (reuse
    `MICRO_LABEL`) with `formatRelative(entry.timestamp)` — and a chevron whose
    direction reflects `expanded`. Make it a real button/`role="button"` with
    `aria-expanded`, a ≥44px touch target, and `onClick={onToggle}`. It stays
    within the sheet's `stopPropagation` so a tap on it never reaches the field.
  - **Collapsed:** render *only* the peek bar. The `motion.div`'s box is then just
    the bar height + `env(safe-area-inset-bottom)` padding, so `stopPropagation`
    covers just the bar and the field above is live (R2, R3).
  - **Expanded:** render the peek bar as a header/handle above the existing
    `body` (unchanged content — R8).
  - **Animation:** animate the sheet height between collapsed and expanded using
    the existing `spring {stiffness:300, damping:35}` (e.g. framer `layout` /
    animated height). Keep the initial mount `y:'100%'→0` entrance. Under
    `useReducedMotion`, drop the height animation (instant), matching
    `FieldAura.tsx`/`Tether.tsx`.
  - Guard all of the above behind `!isRail`; the rail branch returns exactly as
    today (R9).
  - Default-collapsed is enforced by the caller (U2); if `expanded` is omitted,
    treat as collapsed.
- **Patterns to follow:** the existing sheet branch in this file (positioning,
  spring, `env(safe-area-inset-bottom)`); `MICRO_LABEL` for the digest label;
  `EmotionDrawer.tsx` rail/sheet split for the variant-guard shape;
  `useReducedMotion` in `FieldAura.tsx`.
- **Test scenarios:**
  - `Covers R3.` Collapsed: the rendered sheet box equals the peek bar height (the
    body is not in layout), so a press just above the bar reaches the field.
  - `Covers R7.` Collapsed peek shows "Last check-in" + a relative time, never
    blank.
  - `Covers R8.` Expanded shows time, relational line, word pills, rhythm strip —
    identical to today's sheet.
  - `Covers R9.` Rail variant renders unchanged (no peek bar, no toggle).
  - Reduced motion: toggling shows no height animation.
- **Verification:** Live in-browser at a mobile viewport (repo has no component
  test runner; UI/interaction confirmed live, per prior units). Toggle expands and
  collapses; collapsed box is short; rail unaffected.

### U2. Default-collapsed wiring + field-interaction collapse in `App`

- **Goal:** The mobile mirror loads collapsed, toggles from its handle, and
  collapses when the user starts interacting with the field — proving the
  load-time dead zone is gone — and a collapse-by-field-touch never leaves a pin.
- **Requirements:** R1, R2, R4, R5, R10
- **Dependencies:** U1
- **Files:**
  - Modify `src/App.tsx` — add `mirrorExpanded` state (default `false`); pass
    `expanded={mirrorExpanded}` and `onToggle` to `MirrorCard`; collapse on field
    interaction; re-collapse whenever the mirror (re)appears.
- **Approach:**
  - Add `const [mirrorExpanded, setMirrorExpanded] = useState(false)` so every
    load / return to the mirror starts collapsed (R1). Reset to `false` when
    `showMirror` transitions to true (e.g. in the same place a new check-in / view
    change re-enters the mirror), so an expanded tray from a previous glance never
    persists into a fresh landing.
  - Pass `expanded={mirrorExpanded}` and `onToggle={() => setMirrorExpanded(v =>
    !v)}` to the `MirrorCard` sheet.
  - **Collapse on field interaction, without dropping a pin (R5, R10):** add an
    `onPointerDownCapture` on the `fieldPlaneRef` wrapper `<div>`. Only while
    `mirrorExpanded`, it calls `setMirrorExpanded(false)` **and
    `e.stopPropagation()`** so the capture-phase stop keeps the pointerdown from
    reaching `EmotionField` — the dismiss press is consumed and no pin gesture
    starts. While collapsed it does nothing, so a field press drops a pin as
    usual. (Capture, not bubble: the field's handlers are synthetic props on a
    descendant, so only a capture-phase stop on the wrapper can pre-empt them.)
    The peek-bar tap stays isolated inside the tray's own `stopPropagation`, so it
    never reaches this wrapper — no toggle/dismiss conflict.
  - Note the existing root-level `onPointerDownCapture` (welcome/axis-pulse
    dismissal) fires first and is unaffected; it only tears down overlays and does
    not create pins, so stopping propagation at the inner wrapper afterward is
    safe.
  - No change to the rail path — desktop never sets/reads a meaningful
    `mirrorExpanded` (the sheet-only props are ignored by the rail branch).
- **Patterns to follow:** existing `App.tsx` chrome-state ownership
  (`showWelcome`, `selectedPinId`); the `fieldPlaneRef` div already wrapping
  `EmotionField`.
- **Test scenarios:**
  - `Covers R1, R2.` Fresh mobile load with history, no pins: the tray is
    collapsed and a pin drops in the lower band the expanded tray would cover.
  - `Covers R4.` Tapping the peek handle expands to full content; tapping again
    collapses.
  - `Covers R5, R10.` With the tray expanded, pressing the field collapses the
    tray and does **not** drop a pin (the dismiss press is consumed); the pin
    count is unchanged after the press-release.
  - `Covers R2, R10.` With the tray already collapsed, pressing the field drops a
    pin normally (the consume path is inert when collapsed).
  - Regression: desktop rail shows the full mirror with no collapse behavior.
- **Verification:** Live at a mobile viewport — load lands collapsed with a
  pinnable lower band; handle toggles; a field press collapses an expanded tray;
  desktop rail unchanged.

---

## Scope Boundaries

Carried from origin, plus plan-local deferrals:

- **`EmotionDrawer` collapse / shared `CollapsibleSheet` extraction** — deferred
  fast follow; the drawer only appears after a pin exists and is not the load-time
  blocker.
- **Desktop rail variant** — out of scope; unchanged.
- **Reworking the mirror's *content*** (what the last check-in shows) — out of
  scope; only the collapse/expand shell changes.
- **Persisting collapsed/expanded across sessions** — out of scope; default
  collapsed on each load is sufficient.

### Deferred to Follow-Up Work

- Adopting the collapse mechanism in `EmotionDrawer`, likely by extracting a
  shared `CollapsibleSheet` wrapper once this pass proves the interaction.
- An optional auto-collapse-on-first-touch refinement (brainstorm Option B) as a
  complement, if default-collapsed alone reads as under-informative.

## Open Questions

Deferred to implementation:

- Exact peek height and digest copy ("Last check-in · 2h ago" vs. label-only vs.
  a bare grabber) — tune live for a comfortable touch target.
- Whether to add a **drag** with a live snap-point (collapsed ↔ expanded) later;
  kept tap-only here to avoid any vertical-swipe conflict with the field's
  press-and-drag pin gesture.
- The chevron/grabber visual treatment and whether the whole peek bar or just the
  chevron is the tap target (lean: whole bar, for a larger target).
