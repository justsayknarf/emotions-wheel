---
date: 2026-09-17
topic: history-unified-week-view
---

# History: Unified Week View

## Summary

Replace History's Day/Week tabs with one screen: a 7-day rolling-window trend chart on top, and a reverse-chronological list of daily summary rows below it. Tapping a day's row drills into that day's existing hour-scale detail as a child view, not a sibling screen, with back-button support to return.

## Problem Frame

Splitting Check-in History into Day and Week tabs asserts a false symmetry — it implies each deserves an equally-weighted screen, when in practice the Day view only earns its keep for someone checking in more than twice in a day, which is rare. The split also works against the thing History exists to show: a sense of pattern over time. Seeing that pattern today requires manually flipping between two disconnected screens, and the disconnect gets worse exactly when check-in frequency is irregular — the same case the sparse-checkin-legibility work (merged, now on `main`) made more legible within each screen but didn't resolve across them. The point-cloud panel added in that work compounded the problem: a third representation of the same week's data, sized and composed inconsistently with the trend chart beside it.

## Key Decisions

- **Point-cloud panel retired, not adapted.** `WeekPointCloud` (`src/components/DiaryHistory/WeekPointCloud.tsx`) is dropped rather than carried forward or reworked. Its "see the week's check-ins spatially" purpose is redundant with the existing Constellation Replay feature; no replacement panel takes its place.
- **Trend chart becomes read-only.** The chart's day-points lose their tap target. Daily summary rows are the single navigation surface into a day — one way in, not two.
- **Per-check-in dots, not an averaged dot.** A daily summary row plots one dot per check-in rather than a single day-average, prioritizing "distinct moments happened" over a statistical summary.
- **Rows read newest-first.** The summary list orders today at the top, oldest at the bottom (reverse-chronological). The trend chart above it keeps its existing left-to-right, oldest-to-newest time axis unchanged — each component uses the convention that reads best for its own shape.
- **Empty days stay visible and tappable.** A zero-check-in day is not hidden or collapsed out of the list. It renders dimmed but still occupies a row, and tapping it opens day-detail's existing empty state (with its "Start a check-in" prompt) rather than doing nothing — keeps the week's shape honest without turning absence into a dead end.
- **No cross-link to Constellation Replay.** The two features stay independently reachable, as they are today. Bridging them was considered and set aside as speculative until there's evidence users want to move between the two.

## Requirements

**Week screen**

- R1. The History screen defaults to a single view showing a rolling 7-day window (today minus 6 through today), replacing the current Day/Week tab split.
- R2. The existing trend chart (gap-weighted fading line chart, `src/components/DiaryHistory/WeekChart.tsx`) renders at the top of the screen with its current visual logic unchanged, but is purely visual — its day-points are no longer tap targets.
- R3. Below the trend chart, one daily summary row renders per day in the 7-day window, newest day first.

**Daily summary rows**

- R4. Each row shows the day's date label and one small dot per check-in recorded that day, positioned and colored per that check-in's averaged valence/arousal (reusing the existing per-entry averaging).
- R5. A day with zero check-ins renders as a dimmed, dot-less row — it still occupies its place in the 7-row list rather than being hidden or collapsed.
- R6. A day with more check-ins than fit legibly in a row shows a capped number of dots plus an overflow indicator (e.g. "+2") for the remainder. The exact cap is a visual-tuning number, left to planning.

**Day detail (child view)**

- R7. Tapping a daily summary row opens the existing day-detail view (hour-scale chart, that day's session list) as a child of the week screen rather than as a sibling tab.
- R8. Day-detail retains its current prev/next day paging, unclamped — a user can page backward past the 7-day window indefinitely, same as today.
- R9. When the opened day has more than one check-in, day-detail additionally shows a small `MiniCircumplex` (reusing the existing component) of just that day's pins, to convey within-day spatial spread. It does not render for a day with exactly one check-in, where it would be redundant with the point already visible elsewhere on the screen.

**Navigation**

- R10. From day-detail, a back action (system/browser back, or an in-app back control) first returns to the week screen. A second back action from the week screen exits History. Day-detail dismissal and History dismissal are two distinct steps, not one.
- R11. No entry point to Constellation Replay is added to this screen. The two features remain reachable only through their current, independent paths.

## Acceptance Examples

- AE1. **Covers R4, R5.** Given a 7-day window where 3 days have zero check-ins, when the screen renders, then those 3 rows show only a dimmed date label and no dots, each still occupying its row position in the list.
- AE2. **Covers R4, R6.** Given a day whose check-in count exceeds the display cap, when that day's row renders, then it shows the capped number of dots plus a "+k" marker, where k is the remaining count.
- AE3. **Covers R5, R7.** Given a day with zero check-ins, when the user taps that day's row, then day-detail opens showing the existing empty state ("No check-ins on this day" / "Start a check-in") rather than doing nothing.
- AE4. **Covers R8.** Given the user is viewing day-detail for the oldest day in the 7-day window, when they tap "previous", then day-detail navigates to the day before the window without error or being blocked.
- AE5. **Covers R9.** Given a day with 3 check-ins, when day-detail opens for that day, then a `MiniCircumplex` renders showing all 3 pins. Given a day with exactly 1 check-in, when day-detail opens, then no `MiniCircumplex` renders.
- AE6. **Covers R10.** Given the user has drilled into day-detail from the week screen, when they trigger back, then they land on the week screen. When they trigger back again from the week screen, then they exit History entirely.

## Scope Boundaries

- Infinite or scrollable browsing of daily summaries beyond the 7-day window (Oura-style) is not built now. The daily-summary list should be implemented as a plain reverse-chronological array render (not a fixed 7-slot layout) so this is additive later rather than a rewrite.
- No cross-link between History and Constellation Replay is added (R11) — revisit only if there's evidence users want to move between the two.
- `SessionDetailCard`, CSV export, and day-detail's own hour-scale chart and session list are unchanged — this work re-parents day-detail's navigation, not its content.

## Dependencies / Assumptions

- Depends on `dailyAggregates`, `sessionAverage`, `entriesInWindow`, and `last7Days` in `src/utils/diaryAggregation.ts` — all already exist from the merged sparse-checkin-legibility work.
- Depends on `MiniCircumplex`'s existing `onPinTap`/`showAxes` props (`src/components/DiaryHistory/MiniCircumplex.tsx`) — already exist.
- Assumes the existing overlay-back-button mechanism (`useViewHistory`, `src/hooks/useViewHistory.ts`, keyed on the `AppView` union in `src/types.ts`) can be extended or mirrored to support day-detail as a child state under `history`. The behavior this depends on (R10) is fixed; the exact mechanism is not (see Outstanding Questions).

## Outstanding Questions

**Deferred to Planning**

- Mechanism for back-button support of day-detail-as-a-child-of-week: extend the `AppView` union with a new state, or give `DiaryHistory` its own local push/pop stack independent of the top-level hook. R10's behavior is fixed either way.
- Exact per-row dot cap before the overflow indicator kicks in (R6) — a visual-tuning number, same category as the existing gap-weight constants tuned by eye in `DayChart.tsx`/`WeekChart.tsx`.
