# emotions-wheel

A web app for emotion check-ins via spatial traversal of a 2D affect field.

> **Repo conventions live in [AGENTS.md](AGENTS.md).** Read it before writing code — it covers the test-script convention, the testing split, and what this repo does *not* have.

## Spec Source

Product specs live in the **frankbrain** repo, under `wiki/concepts/emotion-selector/`.
**When prompted, re-read those files before building or updating anything** — they evolve over time.

Files to check:
- `EmotionSelector.md` — high-level concept, interaction model, scope
- `EmotionSelector-Interaction.md` — input mechanics
- `EmotionSelector-FieldVocabulary.md` — circumplex layout, vocabulary set by quadrant
- `EmotionSelector-VisualMotion.md` — rendering, depth cues, word emergence, color
- `EmotionSelector-Aesthetic.md` — visual tone and what to avoid
- `EmotionSelector-DataModel.md` — what each session records
- `EmotionSelector-SessionHabitLoop.md` — session structure, habit mechanics

Note that the specs predate much of what shipped; where they disagree with the code, the code and `STRATEGY.md` are current.

## Product Summary

**Core thesis:** Low-friction emotional vocabulary exposure as a Trojan horse for emotional intelligence development. Selection doesn't have to be "right." No wrong answers.

**Interaction model:**
- 2D spatial field anchored by valence (x) × arousal (y) axes (circumplex model)
- Press and release anywhere on the field to plant a **pin** at that coordinate
- Emotion words emerge with proximity and dwell — not shown all at once. Words carry an `EmotionDepth`: surface words are always visible, deep words are revealed near a pin or after ~1.2s of stable hover (`DWELL_DELAY_MS` in `src/hooks/useFieldGesture.ts`)
- A pin's coordinate is adjustable after planting, via sliders on its card
- Words are *recognized* against a pin as optional annotation, never required to complete a check-in

**Aesthetic:** Warm but grounded. Soft animations. Z-axis transitions. No chart aesthetics, no clinical grids, no urgency colors. Oura-inspired dark palette; design tokens are CSS custom properties in `src/index.css`.

**Data model:** Coordinate (x, y) is the primary datum, not the label. Labels are optional annotation. A recorded entry holds a set of pins. The diary is `localStorage`-backed and append-only today, pruned at a ceiling.

**Vocabulary is pluggable.** `src/data/emotions.ts` is a thin re-export; which words load is decided by the framework registry in `src/data/frameworks/`. Add or swap a vocabulary there, not in the re-export.

**What ships today:** the field and pin-planting loop, the card tray with adjustable pins, a returning-user mirror, the diary with history views (day/week charts, entry detail), CSV export, constellation replay, a grounding-cue welcome, and an admin emotion editor at `src/admin/`.

## Tech Stack

React 19 · TypeScript · Vite · framer-motion · @use-gesture/react · Tailwind 4. No backend, no accounts — everything is client-side and `localStorage`-backed. Deployed to GitHub Pages; `vite.config.ts` sets `base: '/emotions-wheel/'`.
