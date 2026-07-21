---
title: "Emotion Field: Coordinate-Anchored Words"
type: requirements
tags: [ux, emotion-field, coordinates, dots, tether, deep-emotions, density]
date: 2026-07-20
project: emotions-wheel
---

## The reframe

Today the field is a field of **words** that happen to sit at positions. This document
proposes inverting the primitive: the field becomes a field of **coordinates** — points —
where words are the *names that surface on those points*.

The dot is the truth. The word is its label. This is the same principle the project already
holds ("the coordinate captures the truth; words are scaffolding") — made visible as the
core visual primitive rather than left implicit.

Why the inversion pays for itself:

- **A moving label stops being a lie.** The point never moves. When a label must nudge to
  avoid overlapping a neighbor, it reads as a callout for a fixed point, not a relocation of
  the emotion. Tethers become the natural grammar instead of an exception.
- **Reveal stops being "spawning."** A deep word does not pop into existence as clutter — its
  point was there (or its arrival is understood as a point naming itself). Appearance =
  labeling, not creation.
- **Two kinds of mark in one space, kept distinct.** A pin is a *gold* mark the **user**
  places — a precise coordinate they chose. An emotion is a *bone* point the **system**
  provides — a named piece of vocabulary. They share the coordinate space but are deliberately
  different kinds of thing; the visual language should keep them distinct, not merge them.

## Problem

In a dense zone, dwelling reveals up to `DEEP_REVEAL_CAP` (6) deep words **at their true
coordinates**, on top of the already-bright surface words in the same patch. The result is
physically overlapping labels — a wall of stacked text rather than a legible neighborhood.
Dimming alone cannot fix this: two labels at the same point are still stacked.

The deep reveal is **informational, not a selection menu**. Its job is to show the user that
*this coordinate is close to what they are feeling* — "you're here, and these are the feelings
around here." So what matters is that the whole revealed cluster reads cleanly as a
description of the spot, not that any one word is easy to click.

## Model

### At rest (no dwell, no pins)

- **Surface points** (39): render as **dot + label**. Landmarks — permanently named so there
  is no recall cost (recognition principle preserved).
- **Deep points** (149): **fully hidden**. No dot, no label.
- Dots **encode depth**: surface dots are the brighter/larger tier. (Deep dots, when they
  appear on dwell, render dimmer/smaller — so even as bare dots the map shows its
  landmark-vs-detail hierarchy.)

### On dwell / pin (a neighborhood lights up)

- The nearby **deep points arrive** — dot first, label attaching. Nearest-first cascade
  (existing dwell behavior).
- Revealed labels are **de-overlapped**: colliding labels nudge apart so the cluster is
  legible. The **dot stays at the true coordinate**; the label is the callout.
- When a label is pushed past a small threshold from its dot, a **faint hairline tether**
  connects label → dot, so the coordinate stays truthful and visible.
- Surface labels in the neighborhood brighten (existing proximity behavior). The far field
  stays at the ambient floor (existing behavior already provides most of the "spotlight").

## Goals

1. A dense-zone reveal reads as a legible little constellation, not stacked text.
2. Every visible word is understood as anchored to a fixed coordinate — primed by the
   always-present surface dots, made explicit by tethers when labels move.
3. The dot is always at the true coordinate; nothing about de-overlap compromises the truth
   the pin/marker records.
4. The resting field stays calm — surface dots + labels only; no deep noise.

## Success Criteria

- At rest: 39 surface dots with labels; surface dots visibly a brighter/larger tier than any
  dot that later appears; no deep dots or labels present.
- On dwell in a dense zone: no two revealed labels visibly overlap.
- Any label displaced more than the threshold shows a hairline tether back to its dot; labels
  within the threshold show no tether (quiet nudge only).
- The dot of every revealed/persistent word sits exactly at its coordinate at all times.
- `lint:spacing` still passes (the dot layer and standoff must not assume tighter packing).

## Resolved decisions

- **D1. Label standoff — resolved.** Labels anchor to their dot with a small default offset
  (label sits just above the dot) so the dot is visible at rest and the "label attached to
  point" grammar is established from the first glance. De-overlap grows this offset; tether
  draws when it exceeds the threshold. *Cost:* changes resting surface layout slightly —
  re-check `lint:spacing`.
- **D2. Bone dots, gold pins — resolved.** Emotion dots render in the neutral **bone** tone;
  the user's **pins stay gold**. The two are kept deliberately distinct (see the reframe): a
  gold pin is a coordinate the user chose; a bone point is system vocabulary.
- **D3. Nudge deep only; surface labels stay fixed.** De-overlap moves the newly-arriving deep
  labels around the stable surface landmarks, not vice versa. *Rationale:* surface words are
  the map's stable reference; moving them would make the whole field feel unstable.
- **D4. Tether reuses `Tether.tsx` visual vocabulary** (hairline, low opacity) already
  established by the pin→card work.

## Open questions

- **Q1.** Does the deep dot appear a beat *before* its label (dot leads, label follows), or do
  they arrive together? Dot-leads reinforces "the point was always there."
- **Q2.** Should surface labels also de-overlap against each other at rest, or is the existing
  static spacing lint sufficient (deep-only nudging)? (Leaning: static lint is enough — D3.)
- **Q3.** Tether threshold and dot sizes — tune by eye once prototyped.
- **Q4.** On a placed pin (persistent), do the revealed deep labels stay nudged+tethered
  indefinitely, or settle differently than the transient dwell case?

## Future direction: emotions as zones, not points

A system point may eventually be better expressed as a **soft area with a radius** than a
precise coordinate. An emotion occupies a *region* of valence/arousal space: "sort of angry"
is a zone the user gravitates toward and then **moves within** to modulate — a little more
positive than angry, a little calmer than furious. This matches the informational goal: the
system is not asserting one exact point for a feeling, it is offering a neighborhood to settle
into.

Not built in this iteration, but this iteration should not preclude it:

- The bone "dot" can later grow a faint surrounding halo (the zone's radius) without changing
  the anchoring grammar — the label still attaches to the zone's center, the tether still
  points home.
- Keep the dot rendering isolated enough that swapping a hard dot for a soft radial zone is a
  contained change.
- The user's gold pin stays a precise point — the point/zone distinction reinforces D2
  (user-chosen coordinate vs. system-offered region).

## Implementation surface (rough)

- `EmotionField.tsx` — render the dot layer (surface always; deep on reveal); compute the
  de-overlap offsets for the revealed label set; pass offset + tether info down.
- `EmotionWord.tsx` — render dot + label with standoff; accept a layout offset; render/receive
  the tether when displaced. Depth-tiered dot styling.
- New small module for the de-overlap pass (bounding-box separation over the revealed set).
- `Tether.tsx` — reuse or adapt for label→dot hairlines.
- `useProximity.ts` / constants — unchanged logic; possibly a tether-threshold constant.
- Re-run `scripts/lint-emotion-spacing.mjs` after the standoff change.

## Relationship to the four 07-08 plans

This subsumes and reframes two of them:

- **Typographic depth** (`...-003`) becomes the *label styling* layer of this model — still
  wanted, but one layer, not the whole fix.
- **Spotlight reveal** (`...-002`) is largely already provided by existing proximity (far field
  at ambient floor); this model leans on that rather than adding a separate dimming pass.
- **Link pills to field** (`...-004`) stays separate but gains a natural target: a card pill can
  pulse the *dot*.
- **Companion-rail tray** (`...-001`) is an unrelated layout change — untouched.
