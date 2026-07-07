# emotions-wheel

A web app for emotion check-ins via spatial traversal of a 2D affect field.

## Spec Source

Product specs live in `/Users/frankyang/Documents/frankbrain/wiki/concepts/emotion-selector/`.
**When prompted, re-read those files before building or updating anything** — they evolve over time.

Files to check:
- `EmotionSelector.md` — high-level concept, interaction model, scope
- `EmotionSelector-Interaction.md` — input mechanics (d-pad, tap-to-anchor, loupe)
- `EmotionSelector-FieldVocabulary.md` — circumplex layout, vocabulary set by quadrant
- `EmotionSelector-VisualMotion.md` — rendering, depth cues, word emergence, color
- `EmotionSelector-Aesthetic.md` — visual tone and what to avoid
- `EmotionSelector-DataModel.md` — what each session records
- `EmotionSelector-SessionHabitLoop.md` — session structure, habit mechanics

## Product Summary

**Core thesis:** Low-friction emotional vocabulary exposure as a Trojan horse for emotional intelligence development. Selection doesn't have to be "right." No wrong answers.

**Interaction model:**
- 2D spatial field anchored by valence (x) × arousal (y) axes (circumplex model)
- A pin traverses the field via a d-pad or tap-to-anchor gesture
- Emotion words emerge with proximity/dwell — not shown all at once
- Selection via dwell time, not a button press
- Optional drill-down to a zoomed sub-layer for more specific vocabulary

**Aesthetic:** Warm but grounded. Soft animations. Z-axis transitions. No chart aesthetics, no clinical grids, no urgency colors.

**Data model:** Coordinate (x, y) is the primary datum per session, not the label. Label is optional annotation. See DataModel spec.

**v1 scope:** Web app only. Single interaction: traverse → select. No account required. No text input, no journaling, no history surfaced to user.

## Open Questions (track these; resolve before building affected features)

- Primary v1 input model: d-pad traversal, or tap-to-anchor + drag-to-refine?
- How is the d-pad rendered on desktop (keyboard arrows / on-screen control / trackpad gesture)?
- Word animation: fade-in, scale, float, or simply appear?
- End-of-session state: confirmation animation, or just closes?
- Coordinate system: normalized 0–1 or absolute pixels mapped to canonical size?
- Minimum viable vocabulary set for v1?

## Tech Stack

Not yet decided. Resolve before building.
