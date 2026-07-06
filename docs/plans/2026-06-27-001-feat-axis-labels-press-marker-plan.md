---
title: "feat: Axis Labels and Coordinate Press Marker"
type: feat
date: 2026-06-27
origin: none
tags: [ux, visual, axis, coordinates, spatial, circumplex]
---

# feat: Axis Labels and Coordinate Press Marker

## Summary

Two small, independent additions to the EmotionField that reinforce its identity as a 2D coordinate space rather than a word cloud. Axis labels anchor the four edges of the field with the circumplex dimensions (arousal on the vertical axis, valence on the horizontal). A coordinate press marker leaves a persistent dot at each press-release point, making the user's spatial selections visible throughout the session.

---

## Problem Frame

The field currently presents emotion words floating in space with no explicit coordinate reference — the underlying circumplex model is invisible to the user. Two visible reinforcements close that gap:

1. **Axis labels** give the field a navigational frame. Users learn that up = energized, down = calm, right = pleasant, left = unpleasant, without needing to understand the term "circumplex."
2. **Press markers** show that each press selects a *point in space*, not just a word. When a word is selected, the marker confirms the press location. When no word is nearby, the marker communicates that the press was still recorded — a location was chosen, even without a label.

These are visual additions only. Neither changes the selection model, the data schema, or downstream components.

---

## Scope Boundaries

**In scope:**
- Static axis label overlays inside EmotionField (no interactivity)
- Persistent dot markers at press-release coordinates, one per release, accumulating per session
- Session reset clears markers

**Out of scope / Deferred to Follow-Up Work:**
- Axis grid lines across the field interior (deferred per `docs/plans/2026-06-24-002-feat-coordinate-first-flag-plan.md`)
- Coordinate-first selection model (covered by the flag plan)
- Animated or pulsing markers
- Marker interactivity (tap to deselect)
- Coordinate labels in the drawer or session record

---

## Key Technical Decisions

**Axis labels are static JSX, not coordinate-mapped.** They are anchored to the container's CSS edges (`position: absolute` with `top/bottom/left/right` offsets), not derived from the `toPercent` coordinate formula. This is simpler and correct: the label is at the physical edge of the field, not at coordinate (0, 1). Left and right labels use `transform: rotate(-90deg)` and `rotate(90deg)` respectively, applied on a wrapper to avoid affecting layout flow.

**Marker state lives in App.tsx alongside `selectedEmotions`.** Markers persist until session reset, which is handled in App's `handleNewSession`. Lifting the state to App avoids adding a reset callback prop to EmotionField and keeps the session lifecycle collocated. App passes `markerCoords` (read-only array) and `onMarkerAdd` (callback) as new props to EmotionField. This keeps EmotionField's own state minimal.

**Markers accumulate per session.** Each press-release appends one `{x, y}` entry to `markerCoords`. There is no deduplication or cap — the expected number of markers per session is small (typically 1-5). If the coordinate-first flag plan ships later, marker state can be folded into the `SelectedEmotion` schema at that point; keeping it separate now avoids a premature schema change.

**Marker fires on all press-releases, not only the no-word case.** The user explicitly selects a point in space; the word (if any) is the label. The dot reinforces the spatial action regardless of word proximity. This means both branches of `handleRelease` call `onMarkerAdd`.

**Coordinate label format: `x, y` in 1-decimal-place notation.** E.g. `"0.3, -0.6"`. Concise and legible. Tabular-numeral font variant for alignment stability during hover updates.

---

## Implementation Units

### U1. Add axis labels to EmotionField

**Goal:** Render four static pill badges at the field edges labeling the circumplex axes.

**Dependencies:** None.

**Files:**
- `src/components/EmotionField/EmotionField.tsx` (modify)

**Approach:**
Four `<div>` elements added directly inside the field container div, before the `emotions.map(...)` block. Each has `position: absolute`, `pointerEvents: 'none'`, `zIndex: 5`, and edge anchoring:
- Top: `top: 12, left: '50%', transform: 'translateX(-50%)'` → label "activated"
- Bottom: `bottom: 12, left: '50%', transform: 'translateX(-50%)'` → label "calm"
- Left: `left: 12, top: '50%', transform: 'translateY(-50%) rotate(-90deg)'` → label "negative"
- Right: `right: 12, top: '50%', transform: 'translateY(-50%) rotate(90deg)'` → label "positive"

Pill style matches the existing hint pill visual language: `background: rgba(30, 26, 22, 0.75)`, `border: '1px solid rgba(232, 224, 216, 0.15)'`, `borderRadius: 20`, `padding: '4px 12px'`, `fontSize: 11`, `color: rgba(232, 224, 216, 0.4)`, `letterSpacing: '0.06em'`. No animation — static on mount.

These live outside the `size.width > 0` guard since they don't depend on container dimensions.

**Patterns to follow:** History button style in `src/App.tsx` (muted text, dark surface, subtle border, small `letterSpacing`).

**Test scenarios:**
- All four labels are present in the DOM when EmotionField mounts
- Top label reads "activated", bottom reads "calm", left reads "negative", right reads "positive"
- Labels do not respond to pointer events (verify `pointerEvents: none` so they don't interfere with gesture capture)
- Labels are visible at small viewport sizes (300×500) without overflowing the container

**Verification:** Open the app — four labeled pills appear at the field edges. Hover and press over the labels: no interference with word reveal or selection. Labels are legible but visually recede behind the emotion words (muted color).

---

### U2. Add press marker state to App and render in EmotionField

**Goal:** After each press-release on the field, display a persistent dot at the exact coordinate and clear all dots on session reset.

**Dependencies:** None (independent of U1).

**Files:**
- `src/App.tsx` (modify — add `markerCoords` state, `handleMarkerAdd`, pass to EmotionField, clear in `handleNewSession`)
- `src/components/EmotionField/EmotionField.tsx` (modify — accept `markerCoords` and `onMarkerAdd` props, call `onMarkerAdd` in `handleRelease`, render markers)

**Approach:**

*App.tsx changes:*
- Add `const [markerCoords, setMarkerCoords] = useState<Array<{x: number; y: number}>>([])` alongside `selectedEmotions`
- Add `const handleMarkerAdd = useCallback((coord: {x: number; y: number}) => setMarkerCoords(prev => [...prev, coord]), [])`
- Add `setMarkerCoords([])` inside `handleNewSession`
- Pass `markerCoords` and `onMarkerAdd={handleMarkerAdd}` to EmotionField

*EmotionField.tsx changes:*
- Add `markerCoords: Array<{x: number; y: number}>` and `onMarkerAdd: (coord: {x: number; y: number}) => void` to the Props interface
- In `handleRelease`, call `onMarkerAdd(center)` in both branches (word found and no word found), before the selection toggle logic
- Inside the `size.width > 0` guard, render a sibling block after `emotions.map(...)`:

```
markerCoords.map((coord, i) => {
  const px = toPercent(coord.x) / 100 * containerWidth
  const py = toPercent(-coord.y) / 100 * containerHeight   // Y inverted
  render a <div> at { position: absolute, left: px, top: py, transform: translate(-50%, -50%) }
    containing:
    - a dot: width 6, height 6, borderRadius '50%', background rgba(232,224,216,0.5), flexShrink 0
    - a label below: fontSize 10, color rgba(232,224,216,0.4), fontVariantNumeric 'tabular-nums'
      content: `${coord.x.toFixed(1)}, ${coord.y.toFixed(1)}`
})
```

Use the same `toPercent` helper already present in EmotionWord (copy inline into EmotionField, or extract to a shared utility — either is acceptable).

**Patterns to follow:** `EmotionWord.tsx` — `toPercent` formula, `position: absolute`, `transform: translate(-50%, -50%)`, `pointerEvents: 'none'`.

**Test scenarios:**
- After one press-release, one dot appears at the corresponding pixel position on the field
- After three press-releases, three dots are visible simultaneously
- Dot position matches the `toPercent` coordinate mapping (e.g., coordinate (0, 0) → center of field at ~50%, ~50%)
- Pressing on a word also adds a marker at the press coordinate (not at the word's coordinate)
- Opening History view and returning to field: markers are still visible (state persists across view changes)
- Tapping "New check-in" (session reset): all markers are gone
- Dot label reads in `X.X, Y.Y` format (one decimal place each)
- Markers have `pointerEvents: none` and do not interfere with gesture capture

**Verification:** Open the app, press several locations including one near a word and one in open space. After each release, a small dot appears at the press point with a coordinate label. Select emotions and tap Done → session complete. Tap "new check-in" → field is empty, all markers gone. Markers don't prevent the next press from working normally.

---

## System-Wide Impact

EmotionField gains two new props (`markerCoords`, `onMarkerAdd`). All current call sites in `App.tsx` must be updated (there is one — the always-mounted instance). No other components are affected.

---

## Sources & Research

- `src/components/EmotionField/EmotionField.tsx` — handleRelease else branch comment reserves this extension point; container sizing pattern
- `src/components/EmotionField/EmotionWord.tsx` — `toPercent` formula and absolute-positioning pattern for coordinate-mapped elements
- `src/App.tsx` — session reset (handleNewSession) and selectedEmotions state pattern
- `docs/plans/2026-06-24-002-feat-coordinate-first-flag-plan.md` — axis labels explicitly deferred in that plan's scope boundaries; this plan addresses the deferred item in a simpler form
