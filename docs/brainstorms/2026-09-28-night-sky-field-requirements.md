---
date: 2026-09-28
topic: night-sky-field
---

# Night-Sky Field

## Summary

Render the emotion field as the inside of a night-sky dome, seen by someone lying on their back and looking up. The wordless still point is the zenith. Intensity comes down toward the horizon, and the quality of a feeling is its compass bearing. Every word is a star, and tagged words are joined into a constellation from the user's pin. The saved datum is unchanged: the pin's flat (x, y). The dome is only a way of drawing it.

The card's sliders become weighted. A drag pulls the thumb toward the pointer at a capped speed, and a tap further along the track flies the pin there on an eased curve. The sky's camera carries continuous motion along and glides over jumps, so the view never lurches.

## Problem Frame

The flat field shows the whole vocabulary at once, as a chart would. The product thesis is that feelings start amorphous and names give them edges. The flat plane can't express that, and the product is named Constellation without the field ever looking like one. Three throwaway mocks were feel-tested on 2026-09-27/28 (artifact: https://claude.ai/artifact/XX25pz9Gyk2UCwdzRo8h9D):

- **Word sphere and gravity well, seen from outside:** rejected ("No not quite").
- **Dome seen from inside, with the view free to yaw:** liked, but turning round mirror-flips the sky, which was disorienting.
- **Dome with a fixed orientation, tilt-only gaze, weighted pan and weighted sliders with tap-to-fly:** approved as the direction to build.

## Key Decisions

- **Fixed orientation, tilt only.** Screen-right is always Activated and screen-up is always Positive, wherever the gaze tilts. The camera never yaws, so the sky never mirrors.
- **The sky is a projection, not new data.** `DiaryEntry`, `PinEntry`, the reveal radius, the deep-reveal cap, tag suggestion and CSV export all stay in flat field coordinates.
- **Every word is a star.** Unrevealed deep words show as dim stars without names, so the whole sky is present before any word is legible. Names appear through the existing reveal rules (surface always, deep near a pin or after a dwell).
- **Tags draw a constellation.** A chain runs from the pin through its recognized words in tag order, drawn along the dome's great circles.
- **Weighted sliders over a drift pad.** A joystick-style drift pad was mocked alongside and not chosen.
- **Continuous motion carries the sky; jumps glide.** If the camera's target moves continuously (a weighted drag or a flight), the view moves with it one-for-one. If the target jumps (a field press planting a pin elsewhere), the camera eases there on a no-bounce spring with its speed capped.
- **Ships behind a flag.** The flat field stays the default until the sky has been lived with. Frank treats product decisions as revisable, so the comparison has to stay one toggle away.

## Requirements

**Sky geometry**

- R1. Field coordinate (x, y) maps to a dome direction. Azimuth is `atan2(y, x)`. Elevation is `90° − min(r, √2)/√2 · 86°`, where `r = hypot(x, y)`. The field centre is the zenith, and the square's corners sit just above the horizon.
- R2. The camera's gaze is a field coordinate `look`, clamped to radius 1.2. Screen-right is the world direction of +x (Activated) and screen-up is +y (Positive), both orthonormalised against the gaze. No yaw exists.
- R3. The field of view (across the larger stage dimension) is 84° at rest and narrows to 64° ("lean in") while a draft pin exists.
- R4. A press on the sky maps back to a field coordinate through the inverse projection and is clamped to the square. A press below 2° of elevation is ignored.

**Sky rendering**

- R5. Behind the words, a canvas paints the sky: a gradient darkest at the zenith, a seeded starfield, a faint milky-way band and a warm haze near the horizon. The theme shader background is not rendered in sky mode.
- R6. Every emotion renders as a star at its projected position. Surface stars are brighter. Unrevealed deep stars are dim and nameless. Tagged stars take the recorded (teal) hue. Stars twinkle unless reduced motion is on.
- R7. Word labels keep the existing DOM rendering, reveal rules, radial fan, word tethers and tag pulse, positioned at the projected star plus their current offsets. In sky mode the label drops its own dot, because the star is drawn on the canvas.
- R8. Constellation lines join the emphasized pin (or the only draft pin) to its recognized words in order, as a chain. They draw along great circles and never cross behind the camera.
- R9. The flat-only layers (crosshairs, `FieldAura`, `FieldSignal`, `AxisRadiance` and the reveal-centre edge ticks) are hidden in sky mode. The four axis labels stay at the stage edges.
- R10. The pin, the previous-check-in ring and label, the live-draft glow, the departure comet and the card tether all sit at projected positions. The departure comet is re-projected every frame (drawn on the sky canvas along the great circle), so both of its ends stay on their stars while the camera glides to the new pin.

**Camera motion**

- R11. The camera follows one resolved target. In order of preference: the live slider/departure draft, then the emphasized pin, then the newest draft pin, then the previous check-in anchor, then the zenith.
- R12. If the target moved by 0.12 field units or less since the last frame, the camera moves by the same delta (carry). The remaining offset closes on a critically damped spring (ω = 1.6/s), with speed capped at 25° of sky per second.
- R13. Reduced motion snaps the camera to its target and the field of view to its goal every frame.

**Weighted sliders (the card's `AxisSlider`, sky mode only)**

- R14. A press within 24px of the thumb grabs it. While held, the value chases the pointer at speed `speed · (1 − 0.75 · v²)` when heading outward and `speed` when heading inward, where `speed = 1 − 0.8 · weight` field units per second and `weight = 0.6` by default. `onDrag` reports the weighted value every frame.
- R15. Releasing commits the thumb's current value, not the pointer's. A pointer cancel reverts as it does today.
- R16. A press further than 24px from the thumb starts a flight to the pressed value. It is eased in-out (cosine), lasts `0.6 + 0.35 · |Δ|` seconds, reports `onDrag` each frame and commits on arrival.
- R17. Pressing the thumb mid-flight stops the flight at its current value and continues as a weighted drag. Unmounting mid-flight reverts through `onCancel`.
- R18. While held, a faint gold ring marks the pointer's value and a tether joins it to the thumb.
- R19. ~~A fading comet trail follows the live draft across the sky while it moves.~~ Dropped 2026-09-29 at Frank's request: a slider drag leaves no trail.

**Rollout**

- R20. A `skyField` tuning flag (default `false`) switches the whole treatment. It's toggled from the admin reveal-tuning page, or with `?field=sky` / `?field=flat` on any app URL, which persists the choice.
- R21. The flat field's behaviour and appearance are unchanged when the flag is off.

## Acceptance Examples

- AE1. **Covers R1, R2.** With `look = (0, 0)`, a pin at (0, 0) draws at the stage centre. A pin at (0.5, 0) draws right of centre, and one at (0, 0.5) draws above centre.
- AE2. **Covers R2.** With `look = (−0.9, −0.8)`, a star at `look + (0.1, 0)` still draws to the right of one at `look`.
- AE3. **Covers R4.** A press at any on-screen point returns a coordinate whose projection lands within 1px of the press.
- AE4. **Covers R12.** A target that jumps from (0, 0) to (1, 1) moves the camera no faster than 25°/s, and the camera never passes the target on the way.
- AE5. **Covers R12, R16.** During a 1-second flight, the pin's on-screen position varies by less than 2px from frame to frame.
- AE6. **Covers R14, R15.** Grab the Calm–Activated thumb at 0, drag the pointer past the right end and hold. The value passes 0.3 before 1s, stays under 0.9 at 2s, and a release at 1.5s commits the value shown at release.
- AE7. **Covers R16, R17.** A tap 80% along the track flies there and commits once. Grabbing the thumb mid-flight commits nothing until that drag is released.
- AE8. **Covers R21.** With `skyField` off, the field, the sliders and every `check:*` script behave exactly as on `main`.

## Scope Boundaries

- **Deferred:** idle gaze drift, drag-on-sky to look around (a field press-drag keeps its placing behaviour), tapping a star to tag it, keyboard control of the sliders, sky versions of the history mini-map, replay and landing page.
- **Not doing:** the drift pad, a yawing camera, the sphere and well forms, and any change to the data model or CSV.
