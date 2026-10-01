---
date: 2026-09-30
topic: word-definition-tooltips
---

# Word Definition Tooltips

## Summary

Show a word's definition on the field while the user is still choosing. Rest on a star, or on a word in the card, for 500ms and a definition card draws out from the star on a hairline tether, the way a star chart names a star off to one side. One tooltip at a time. On mobile the tooltip sits in a band at the top of the visible sky, and opens when the pin comes to rest or when a word in the tray is tapped.

Feel-tested in an interactive mock before this doc was written: <https://claude.ai/artifact/AvsenaNj9FWQc4d5976oH6> (updated to the 500ms delay this doc settles on).

## Problem Frame

The product's thesis is vocabulary exposure: a check-in should leave the user knowing a few more words for what they feel. Today nothing outside admin shows what a word means. Hand-written definitions exist in `src/data/descriptions.ts`, but the only flow that showed them (`DefinitionCardSequence`, behind "Done") is unreachable. The v1 UX findings (June 18) recorded a first-time user expecting a definition on hover and named an inline definition on approach as the open candidate.

Definitions help most *before* a word is chosen, when the user is weighing "anxious" against "apprehensive". So the primary moment is exploration, not confirmation.

Two constraints shape the design. The field is dense, and a definition must not cover the neighbouring words the user is comparing. And hovering the field already does something: dwelling ~1.2s reveals deep words (`DWELL_DELAY_MS`). The tooltip has to coexist with that, and must never fire as the cursor casually passes over words or tags.

## Key Decisions

- **Exploration first.** Definitions appear on hover/approach, before tagging. Tagging does not pin a tooltip permanently; that idea was set aside because several permanent tooltips would cover the field the user is reading.
- **Tethered, not adjacent.** The tooltip sits a standoff distance from its star in the least crowded direction, joined by a hairline. This keeps the star's neighbours readable and reads as star-chart annotation.
- **One tooltip at a time,** whether opened from the field or from the card.
- **500ms delay, then instant hand-off.** A pass across stars or tags shows nothing. Once a tooltip is open, moving to another word switches immediately; leaving all words closes it after a short grace and the delay re-arms. This is native-tooltip behaviour and makes scanning neighbours cheap.
- **Card tags light their star immediately.** Hovering a word in the card highlights its star on the field with no delay, so the card-to-field correlation is instant; the definition follows after the delay.
- **Mobile uses the same component in a fixed band.** No hover on touch, and tapping the field plants the pin, so a field word can't double as a "define" target. The tooltip sits at the top of the visible sky with the tether reaching down to the star, and opens on pin rest or on tapping a tray word.
- **Every word gets a definition before this ships.** 103 of the 188 radial-intensity words have none. The tooltip is the feature's whole surface, so a "no definition" state is not acceptable in production.

## Requirements

**Content**

- R1. Every word in the active framework (`radial-intensity`) has a definition in `src/data/descriptions.ts`. The 103 missing definitions are written in the existing voice: plain, second person, one or two sentences, describing how the feeling sits rather than a dictionary gloss. Claude drafts them; Frank reviews before merge.
- R2. A check script fails when any word in the active framework lacks a definition, following the repo's `check:*` convention.
- R3. The tooltip shows the word's label, a short meta line naming its region and intensity (e.g. "calm · pleasant · mild", derived from the coordinate and radius), and the definition.

**Desktop triggers**

- R4. Resting the pointer on a visible field word (its label or its star) for 500ms opens that word's tooltip.
- R5. Resting the pointer, or keyboard focus, on a word in the card (suggested or tagged) for 500ms opens that word's tooltip on the field. Hovering it highlights the star immediately, and reveals it for the duration if it is a currently hidden deep word.
- R6. Moving off a target before the delay elapses cancels it; nothing opens.
- R7. While a tooltip is open, moving onto another field word or card word switches the tooltip to it immediately, with no second delay.
- R8. Leaving all targets while a tooltip is open starts a 300ms grace. Reaching a target within the grace switches to it (R7); otherwise the tooltip closes and the next open waits the full delay again.
- R9. Any press suppresses tooltips: a field press or drag, a pin drag, or a slider drag closes an open tooltip immediately and cancels a pending one. Hover resumes on the first pointer move after release.

**Mobile triggers** (touch / tray layout)

- R10. When the pin comes to rest after a field press, drag or slider release, and stays still for 500ms, the tooltip opens for the nearest visible word within a reveal-radius threshold. If no word is near enough, nothing opens.
- R11. Tapping a suggested word in the tray tags it and opens its tooltip immediately. Tapping a tagged word opens its tooltip; its remove control untags it.
- R12. Any field press closes the tooltip (R9).

**Placement**

- R13. Desktop: the tooltip sits ~95px from its star in the direction that best avoids word labels, the pin, the previous-check-in ring and the stage edges, preferring upward directions when scores tie.
- R14. Mobile: the tooltip spans the visible field minus gutters, anchored to the top of the area above the tray (in sky mode, the band above `skyOccluderTop`). If the star sits under where the tooltip would be, the tooltip anchors to the bottom of the band instead.
- R15. The tooltip and tether position through the same projection the field's words use (`proj`), so in sky mode they follow the star as the camera moves, and they stay within the visible area.

**Motion and look**

- R16. Opening: the tether draws out from the star (~220ms, ease-out), then the tooltip fades in with a slight lift and scale at its end (~260ms). Switching: the tether re-anchors and the tooltip slides to its new spot with critically damped smoothing, text crossfading. Closing: the tooltip fades (~110ms), then the tether retracts (~130ms). No overshoot or bounce anywhere.
- R17. Under reduced motion, no draw, slide or lift; the tooltip and tether appear and disappear with a short fade.
- R18. The tether is a hairline that runs from bone at the star to gold at the tooltip, in the visual family of `WordTethers` (bone, label-to-dot) and visibly distinct from the user's gold pin-to-card `Tether`. The star of the open word takes the highlight treatment. Colours come from theme tokens, never hardcoded (`check:theme`).

**Accessibility**

- R19. Card words expose their definition to assistive tech (e.g. `aria-describedby` pointing at the open tooltip), and keyboard focus follows the same delay and hand-off rules as hover.

## Acceptance Examples

- AE1. **Covers R6.** Given no tooltip is open, when the cursor sweeps across seven card words in under a second, then no tooltip opens.
- AE2. **Covers R4, R7.** Given the cursor rests on "Anxious" for 500ms, then its tooltip opens. When the cursor then moves straight onto "Apprehensive", then the tooltip switches to "Apprehensive" without waiting.
- AE3. **Covers R8.** Given a tooltip is open, when the cursor moves onto empty sky for longer than 300ms, then the tooltip closes, and resting on another word afterwards waits the full 500ms.
- AE4. **Covers R5.** Given "Apprehensive" is a hidden deep word suggested in the card, when the user hovers it in the card, then its star appears and lights at once, and its tooltip opens on the field 500ms later.
- AE5. **Covers R9.** Given a tooltip is open, when the user presses the field to move the pin, then the tooltip closes on press and none opens during the drag.
- AE6. **Covers R10, R14.** On a phone, given the user releases the arousal slider and the pin rests near "Content", then after 500ms the tooltip for "Content" appears at the top of the visible sky with a tether down to its star.
- AE7. **Covers R2.** Given a word is added to `radial-intensity` with no entry in `descriptions.ts`, when the check runs, then it fails and names the word.

## Scope Boundaries

- No definitions in the saved check-in card, history, entry detail or replay in this round. They may follow once the field version has been lived with.
- No contrast pairs ("anxious vs. nervous") built from `relatedIds`.
- No change to which words are suggested, how deep words reveal, or how tagging records.
- The new-tab `DepartureFloat` (sliders-only first check-in) gets no tooltips; it has no field words to point at.
- Both fields are in scope: the flat field (the default) and the night-sky field (behind `skyField`). One component serves both, placing itself through the field's shared projection.

## Open Questions for Planning

- Where the shared tooltip state lives so card words and field words drive one tooltip (likely a hook owned near `App`, with the field rendering the tooltip).
- Hit-testing stars in sky mode, where the star is drawn on canvas and only the label is DOM: a radius around the projected star point, or the label alone.
- How "mobile" is decided: the existing tray layout switch, or `pointer: coarse`.
- Whether the delay, grace and standoff belong in admin reveal tuning alongside the dwell settings.
- How the open tooltip interacts with `WordTethers`' persistent label-to-dot tethers and the radial fan when the opened word is fanned out from its dot (the tether should start at the label's dot, the true coordinate).
