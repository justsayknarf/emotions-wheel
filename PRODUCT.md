# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people building an emotional check-in habit. The founding persona is the first-time tracker, someone who wants to pay attention to how they feel but lacks the vocabulary. Confirmed emphasis has shifted toward returning and habitual users: the person who opens a check-in repeatedly and comes back to read their own record.

Their situation is a brief, low-effort moment, often a reflexive one (opening a new tab, a pause in the day), and later a slower moment of looking back at the diary.

## Product Purpose

Constellation makes an emotional check-in as cheap as a thought. The user presses and releases on a 2D field (valence × arousal, the circumplex model) to plant a pin. That coordinate is the record. Emotion words emerge with proximity and dwell as optional recognition aids, never as a gate. Over time the diary and history views make the accumulated record legible, which is where the value compounds.

Underlying thesis: low-friction exposure to emotional vocabulary is a way to build emotional intelligence, and there are no wrong answers.

Success is check-in frequency (the primary habit signal), session completion rate, and recognition breadth (distinct words tapped over time), per STRATEGY.md.

## Positioning

Most check-in tools demand one correct word, which implies feelings fit clean categories, and the habit dies on the precision trap. Here the coordinate is the primary datum and the label is optional annotation, so every entry is complete the moment the pin lands.

## Operating Context

- Check-ins happen in seconds, on a spatial field, by pointer or touch.
- A Chrome new-tab extension (`extension/`) replaces the New Tab page and navigates to the deployed app, so a habitual reach for a tab becomes a check-in.
- Returning users see a mirror of recent entries and a grounding-cue welcome.
- The diary is `localStorage`-backed, append-only, and pruned at a ceiling. It has history views (day and week charts, entry detail), CSV export, and constellation replay.
- Vocabulary is pluggable through the framework registry in `src/data/frameworks/`; an admin emotion editor in `src/admin/` is an authoring tool, not a user-facing surface.
- Deployed to GitHub Pages under `/emotions-wheel/`. No backend, no accounts.

## Capabilities and Constraints

- Words carry an `EmotionDepth`: surface words are always visible; deep words appear near a pin or after roughly 1.2s of stable hover.
- A single pin per check-in; its coordinate is adjustable after planting via sliders on its card.
- Everything is client-side and local. There is no sync, and no plan for one has been stated.
- A native mobile app is an eventual goal, not a current one. Platform stays `web` until that work begins; revisit this record when it does.
- Specs in the frankbrain repo (`wiki/concepts/emotion-selector/`) predate much of what shipped; where they disagree with the code, the code and STRATEGY.md are current.
- Not working on: clinical or diagnostic framing (no scoring, no accuracy requirements, nothing implying the user needs to get it right) and social features (no sharing, comparison, or community layer; the record is for the user only).

## Brand Commitments

Name: Constellation (the app's page title). The repo, the GitHub Pages path `/emotions-wheel/` and the CSV export filename still use `emotions-wheel`; that is a slug, not the name.

Voice: no wrong answers. Copy never implies correctness, scoring, urgency, or that a check-in was done poorly. Warm and non-clinical.

## Evidence on Hand

- STRATEGY.md (target problem, approach, metrics, tracks) and CLAUDE.md (interaction model, what ships today).
- A working app with real diary, history, replay, and CSV export. No user testimonials, usage data, or benchmarks exist in the repo; do not fabricate any.

## Product Principles

1. The coordinate is the truth; words are scaffolding. An entry is complete without a label.
2. No wrong answers. Nothing in the product should make the user feel they must get it right.
3. Friction is the enemy of the habit. Every added step must earn its place against the check-in taking a few seconds.
4. The record is the user's alone. No social layer, no external comparison.
5. Reflection is where value compounds. The history surface should make a returning user's own record feel worth revisiting.
