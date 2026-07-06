---
date: 2026-07-05
topic: diary-history-review
actors:
  - A1: User (single person, mobile-first, also desktop)
---

# Diary History Review

## Summary

A swipe-left History panel for EmotionSelector with Day and Week tabs. Each tab shows separate trend lines for valence and arousal over time. The Day tab plots sessions hour by hour and lists them below for drill-down. The Week tab shows a 30-day scrollable chart of daily averages; tapping a day switches to that day in the Day tab.

## Problem Frame

The LocalStorage diary stores coordinate-primary entries but surfaces them only as a flat reverse-chronological list. The signal the diary accumulates — how valence and arousal shift across hours, across days, across weeks — is invisible to the user. STRATEGY.md identifies the reflection surface as the track where "the value of the record compounds over time." This doc specifies the first version of that surface.

## Key Decisions

**Swipe-left drawer over a dedicated route.** The existing `AppView` enum includes `'history'`; the existing transition mechanism handles the panel slide. Adding a route would require a router dependency with no other use. The drawer keeps the field always present behind the panel.

**Tabs (Day | Week) over a drill-down hierarchy.** Both views are independently navigable. The cross-tab tap (tapping a day in the Week chart jumps to the Day tab for that date) provides the drill-in moment without forcing the user through the weekly view to reach a specific day.

**Session-level aggregation.** Each `DiaryEntry` may contain multiple pins. For charting purposes, each session plots as one dot whose position is the mean of all its pins' (x, y) values. Individual pin-level dots within a session are not shown on the trend charts.

**30-day rolling window for the Week tab.** Right edge anchors to today. The user pans left to see older data, up to 30 days. Days with no sessions break the trend line without interpolation; gaps are not filled or estimated.

## Requirements

### Navigation

R1. The history panel opens when the user swipes left from the emotion field and closes by swiping right or tapping a back control.

R2. The panel contains a Day tab and a Week tab. Day is selected by default. Tab selection persists within the session only.

### Day Tab

R3. The Day tab shows two trend lines — valence and arousal — plotted against an hourly x-axis for the selected date.

R4. Each dot on the Day chart represents one session. Its x-position is the session timestamp. Its valence y-value is the mean of all pins' `x` values in that session; its arousal y-value is the mean of all pins' `y` values.

R5. The Day tab shows a `< date >` header. Tapping `<` navigates to the previous day; tapping `>` navigates to the next day. `>` is disabled when the selected date is today.

R6. Below the trend chart, the Day tab lists sessions for the selected date in chronological order. Each row shows the session time and a summary: recognized emotion words if any, otherwise the first pin's `regionDescription.relational` text.

R7. Tapping a session row or chart dot opens a session detail card for that session.

### Week Tab

R8. The Week tab shows two trend lines — valence and arousal — over a 30-day window with one dot per day per line. Each day's dot is the mean of all pins across all sessions recorded that day.

R9. The Week chart is horizontally scrollable. The right edge anchors to today; dragging left reveals older data up to 30 days back.

R10. Days with no recorded sessions show no dot. The trend line breaks across gaps without interpolating missing values.

R11. Tapping a day on the Week chart switches to the Day tab with that date selected.

### Session Detail

R12. The session detail card shows: the session date and time; a non-interactive mini circumplex with each pin plotted as a dot at its (x, y) position; recognized emotion words from all pins (deduplicated, displayed horizontally); and the first pin's `regionDescription.relational` text.

R13. When a session has no recognized words across any pin, the detail card omits the word row and shows only the coordinate position and region description.

R14. The detail card is dismissed by tapping outside it or tapping a close control.

## Key Flows

F1. **Open history from field.** User swipes left on the field → history panel slides in → Day tab is shown for today's date → sessions for today are listed.

F2. **Navigate between days.** User taps `<` or `>` in the Day tab header → the selected date changes → the trend chart and session list update for the new date.

F3. **Jump from Week to a specific day.** User drags the Week chart to find a date of interest → taps that day's dot cluster → Day tab activates with that date selected.

F4. **Review a session.** User taps a session row or chart dot in the Day tab → session detail card appears → user reads words and position → taps outside to dismiss.

## Acceptance Examples

AE1. **Gap in Week trend line.** A day with no sessions shows no dot on the Week chart. The trend lines for valence and arousal do not connect across that day — the line ends at the last session before the gap and resumes at the first session after it. **Covers R8, R10.**

AE2. **Session with multiple pins, no words.** A session with three pins at (0.2, 0.4), (−0.1, 0.3), (0.0, 0.2) plots as one dot at approximately (0.03, 0.30) on the Day chart. If none of the pins have recognized words, the detail card shows only the region description and mini circumplex — no word row. **Covers R4, R13.**

AE3. **Cross-tab date carries through.** User taps June 30 in the Week chart → Day tab shows `< June 30 >`. User taps `<` → Day tab shows `< June 29 >`. **Covers R5, R11.**

AE4. **Tap parity.** Tapping a chart dot and tapping the corresponding session row in the list below the chart open the same session detail card. **Covers R7.**

## Scope Boundaries

**Deferred for later:**
- Month view or calendar heatmap
- Entry editing or deletion
- Data export (CSV, JSON, or similar)
- Longitudinal analytics beyond the two trend lines (zone distribution, convex hull, daily centroid, pattern detection)
- Cloud sync — LocalStorage remains the sole store

**Outside this product's identity:**
- Social sharing of history data

## Dependencies and Assumptions

- `DiaryEntry` schema (`src/types.ts`): `{ id, timestamp, pins: PinEntry[], sessionDurationMs }`. `PinEntry`: `{ id, x, y, recognizedWords: string[], regionDescription: RegionDescription }`. Sessions with zero recognized words are valid first-class records (coordinate-only).
- `AppView` at `src/types.ts` already includes `'history'`. The existing `DiaryHistory` component (`src/components/DiaryHistory/`) renders a flat list and is the starting point to replace or extend.
- `Emotion.x` = valence (−1 negative → +1 positive); `Emotion.y` = arousal (−1 calm → +1 activated). Pin coordinates follow the same convention.
- No charting library exists in the repo (`package.json` has Framer Motion, React 19, uuid — no recharts, visx, or D3). Planning must choose between custom SVG and adding a dependency; the 30-day scrollable Week chart is the case where custom SVG becomes labor-intensive.

## Outstanding Questions

**Deferred to planning:**
- Day chart x-axis range: cover the full calendar day (midnight to midnight) or clip to the actual time range of sessions recorded on that date?
- Charting library: custom SVG or add recharts (or equivalent)?
- Mini circumplex in the detail card: exact dimensions, dot size, and whether axis labels (positive / negative, activated / calm) appear.
- Swipe gesture threshold and animation curve for the drawer: coordinate with existing Framer Motion patterns in `src/App.tsx`.
