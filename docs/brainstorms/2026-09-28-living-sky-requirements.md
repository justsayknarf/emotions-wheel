---
date: 2026-09-28
topic: living-sky
---

# Living Sky

## Summary

Give the night-sky field a living background: a slowly shifting milky way and a low aurora, painted by a GPU shader that pans and tilts with the dome. It starts with the Starry Night theme's colours, and every sky colour and strength can be edited per theme on the admin Color themes page. On load, while the welcome cue shows, the camera starts low over the horizon and rises to the still point overhead.

Builds on the night-sky field (`docs/brainstorms/2026-09-28-night-sky-field-requirements.md`) and applies only when `skyField` is on.

## Problem Frame

The dome's sky is currently a static 2D gradient with a dotted band. Frank wants the living quality the old shader-gradient background had, without breaking the dome or pulling attention from the words. The old `@shadergradient/react` background is camera-unaware, so it would drift against the stars. A mock with a three.js `ShaderMaterial` that inverts the dome projection per pixel was feel-tested on 2026-09-28 (https://claude.ai/artifact/LgiPFHtqTVKcboqobmfKkB) and approved: "Let's add all of this."

## Key Decisions

- **One shader, attached to the sky.** A full-screen quad whose fragment shader turns each pixel into a dome direction using the camera frame the stars use. The milky way and aurora are defined in dome coordinates.
- **`@react-three/fiber` hosts it.** It's already in the bundle. Per-frame camera values reach the shader through a ref and `useFrame`, never React props, which is what caused the recompile-per-render bug fixed in `e209c75`.
- **The sky's settings live in the theme's shader block** (`ShaderTheme` in `src/config/theme.ts`). That way the existing per-theme override, admin editing, "Save to file" handoff and `useTheme` merge all apply unchanged. Starry Night and Northern Lights spell out their mock-tested skies; every other theme derives one from its shader stops.
- **The 2D canvas keeps the crisp things** (stars, constellation lines, comet trail). The shader takes the soft things (sky gradient, horizon warmth, band). The 2D band and haze remain only as the fallback when WebGL is unavailable.
- **The aurora is quiet by design.** It hangs low and fades out before the zenith, its added brightness is capped, it dims while the user drags, and it freezes under reduced motion.
- **The save swell** is a one-shot anime.js moment through `useAnimeScope`: a brief brightening of the aurora on each saved check-in. It is an acknowledgement, not a reward.
- **The opening pan** is a scripted, eased rise from the Negative horizon (screen-down) to the zenith. It is slower than the camera's pan cap, so it can't disorient. It is cancelled the moment the user touches anything.

## Requirements

**Sky shader**

- R1. In sky mode, a WebGL layer behind the star canvas paints the sky, derived per pixel from the camera frame (the sky projection's `f`, `r`, `u`, focal length and centre, including the phone viewport band). It pans and tilts exactly with the stars.
- R2. The layer paints:
  - a base gradient from `skyZenith` overhead to `skyHorizon` near the horizon;
  - a warm glow of `skyWarm` × `skyWarmth` that lives only near the horizon;
  - a milky way band tinted `skyBand` × `skyBandStrength`, with dust lanes, along a great circle with normal ∝ (0.42, 0.62, −0.66);
  - aurora curtains rising from the horizon, coloured from `skyAuroraLow` to `skyAuroraHigh` and fading out by `skyAuroraReach` degrees.
- R3. The aurora's added brightness is capped at `skyAuroraCap`, and multiplied by `skyAuroraStrength`.
- R4. Shader time advances at `skyAuroraSpeed` seconds per second. Under reduced motion it doesn't advance, and the layer renders only when the camera or theme changes.
- R5. While the user is pressing the field or a live draft is active (slider drag or flight), the aurora eases down to `skyMovingDim` of its strength, and back afterwards.
- R6. The layer renders at `skyRenderScale` of the device pixel ratio.
- R7. If WebGL is unavailable, the existing 2D sky (gradient, horizon haze, dot band) draws instead. Otherwise the 2D canvas draws no sky gradient, haze or band.

**Theme and admin**

- R8. `ShaderTheme` gains `skyZenith`, `skyHorizon`, `skyWarm`, `skyAuroraLow`, `skyAuroraHigh`, `skyBand` (hex) and `skyAuroraStrength`, `skyAuroraSpeed`, `skyAuroraReach`, `skyAuroraCap`, `skyBandStrength`, `skyWarmth`, `skyMovingDim`, `skySwell`, `skyRenderScale` (numbers).
  - Defaults: strength 0.5, speed 0.97, reach 34, cap 0.26, band 0.96, warmth 0.26, moving dim 0.45, swell 0.9, render scale 0.5.
  - Starry Night colours: zenith #060B16, horizon #16304D, warm #5C4E1F, aurora low #8FC1C4, aurora high #EAD9A8, band #AFC0DC.
  - Northern Lights colours: zenith #07090D, horizon #133329, warm #3A2350, aurora low #9FE0C2, aurora high #B79FE0, band #C8D6DA.
  - Other themes derive their colours from their shader stops.
- R9. The admin Color themes page's shader Details panel gains a "Night sky" section. It has a hue field per sky colour and a slider per sky number, using the same per-theme override, "Reset shader" and "Save to file" flow as the other shader fields.
- R10. Changing the theme or its sky override repaints the sky live, including in another tab.

**Save swell**

- R11. Each saved check-in plays one swell: aurora brightness rises to (1 + `skySwell`)× over about 0.8s and settles back over about 2.4s. There is no swell under reduced motion.

**Opening pan**

- R12. On app load in sky mode, while the welcome cue shows, the camera starts with its gaze at the tilt limit over the Negative horizon, look (0, −1.2), with the horizon in view. After `skyIntroDelay` (0.4s) it rises on a cosine ease over `skyIntroDuration` (5.5s) to the still point (0, 0).
- R13. The rise is never faster than the camera's pan cap (25°/s).
- R14. Any field press or live draft during the rise ends it on the spot. The camera then follows its normal target with no jump.
- R15. After the rise the camera resumes its normal target rules. A returning user's previous check-in may pull it on from the zenith with the usual glide.
- R16. Reduced motion skips the pan; the camera starts where it normally would.
- R17. `skyIntro` (on), `skyIntroDelay` and `skyIntroDuration` are reveal-tuning knobs on the admin reveal-tuning page.

## Acceptance Examples

- AE1. **Covers R1.** With the gaze tilted toward Activated, the aurora and band move with the stars when the camera pans. A star sitting on a band feature stays on it.
- AE2. **Covers R3, R5.** At strength 1.5 the aurora never brightens a pixel by more than the cap. While dragging a slider, the aurora dims.
- AE3. **Covers R9, R10.** Changing Starry Night's aurora-low hue in admin repaints the aurora in an open app tab without a reload. "Reset shader" restores #8FC1C4.
- AE4. **Covers R12, R13.** A fresh load in sky mode shows the horizon in the lower part of the stage. About 6s later the zenith is centred, and at no frame does the gaze move faster than 25°/s.
- AE5. **Covers R14.** Pressing the field 1s into the rise stops it there. The pin plants under the finger, and the camera glides to it from where it was.
- AE6. **Covers R11.** Saving a check-in brightens the aurora once and settles within about 3.2s.
- AE7. **Covers R7.** With WebGL disabled, the sky still draws, as the current 2D sky.
- AE8. **Covers R21 of the night-sky spec.** With `skyField` off, nothing changes: no WebGL sky layer, no pan, flat field identical.

## Scope Boundaries

- **Not doing:** a sky for the flat field, the landing page or history; per-user controls for the aurora (admin-only); sound; a different aurora per emotional region.
- **Deferred:** phone-specific field of view (the night-sky follow-up), and profiling on a real phone once this lands.
