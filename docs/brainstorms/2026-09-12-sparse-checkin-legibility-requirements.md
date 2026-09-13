---
date: 2026-09-12
topic: sparse-checkin-legibility
---

# Sparse Check-in Legibility

## Summary

Make the Day/Week history charts' line rendering reflect how much time-evidence each segment actually represents, add an invitation-framed note on the Week tab that appears only while check-ins are too sparse to support legible patterns, and add a small point-cloud panel on the Week tab — reusing the existing circumplex-dot rendering — showing where recent check-ins have landed independent of when they happened.

## Problem Frame

The Day and Week charts (`src/components/DiaryHistory/DayChart.tsx`, `WeekChart.tsx`) connect check-ins with a solid line of fixed visual weight, regardless of how much time separates two consecutive points. Unlike a continuously-sampled tracker, this app's check-ins are voluntary and irregular — a gap means no data, not a neutral reading. A line drawn across that gap visually asserts a continuous trend the app never measured.

The two charts are also inconsistent with each other today: `WeekChart` already refuses to connect across a day with zero check-ins (`buildSegments` breaks the line there), but `DayChart` will connect an 8am check-in to an 11pm check-in on the same day with no equivalent rule, implying 15 hours of continuity that was never recorded.

Beyond the charts themselves, the user asked whether consistent check-ins could be encouraged as a way to improve insight quality — but the product has an existing, deliberate stance against shame or artificial-incentive design (no streaks, no urgency framing), reflected in the mirror's Recent Rhythm strip, which was built to show only frequency, never content or "broken chain" framing.

## Key Decisions

- **One continuous density rule, not per-case fixes.** Line weight (opacity/thickness) is a function of the time-gap a segment spans, applied identically to `DayChart` and `WeekChart`. This resolves the two charts' inconsistency by removing the need for a separate hard-break rule — a sufficiently large gap already fades to near-invisible under the same formula.

- **The invitation note is a "not yet" signal, not a reward.** It renders only while check-ins in the visible window fall short of a minimum spread across distinct days, and disappears once that spread is met — it never names a pattern or trend itself, so it carries none of the multiple-comparisons or small-N risk a real pattern claim would. Modeled on Bearable's pattern of gating a feature behind a minimum-logging threshold rather than warning about missing data.

- **No progress counter.** The note's presence or absence is the only signal — no "3 of 5 days" countdown, which would itself start to read as a target to hit.

- **The point-cloud panel is a supplement, not a competitor.** It reuses `MiniCircumplex`'s existing point rendering and sits only on the Week tab. It does not change where the constellation/pulse-trace lives or how it's reached — that surface's role (`docs/brainstorms/2026-07-09-002-history-pulse-trace-requirements.md`) is left exactly as decided.

- **Categorical/contextual pattern breakdowns are deferred, not just gated.** Day-of-week, holiday, and time-of-day pattern extraction were considered and set aside — slicing check-ins into buckets shrinks each bucket's already-thin evidence further, invites a multiple-comparisons problem (some bucket will look "interesting" from noise alone), and is confounded by self-selection: check-in timing is chosen by the user, so "how you feel on Fridays" may really be measuring whatever state prompts a Friday check-in. More volume alone doesn't resolve the confound, and a wrong categorical claim is the kind a user might act on — closer to the diagnostic framing `STRATEGY.md` explicitly excludes.

## Requirements

**Line rendering**

- R1. Both the Day chart and the Week chart render each line segment's visual weight (opacity and/or thickness) as a continuous function of the time-gap it spans, replacing the current fixed weight.
- R2. The Day chart and Week chart use the same underlying weighting rule, so an intra-day gap and a cross-day gap degrade consistently rather than under two different rules.
- R3. A sufficiently large time-gap reduces a segment's visual weight to effectively absent, preserving the existing guarantee that no line implies continuity across a period with zero recorded check-ins.
- R4. Check-in dots keep full, constant visual weight regardless of the gaps around them — only the connecting line's weight varies.

**Invitation note (Week tab)**

- R5. The Week tab shows an invitation note only while check-ins in the visible window fall short of a minimum spread across distinct days; once that spread is met, the note stops rendering.
- R6. The note's copy invites more check-ins for richer legibility and never references missed days, streaks, or an obligation to check in.
- R7. No numeric progress indicator accompanies the note.

**Point-cloud panel (Week tab)**

- R8. The Week tab includes a panel plotting every check-in in the visible 30-day window as a point on a circumplex, reusing `MiniCircumplex`'s existing point rendering, independent of when each check-in occurred.
- R9. Tapping a point in the panel opens that entry's session detail, consistent with how chart dots and list rows elsewhere in history already open detail.
- R10. The panel never gates on a minimum point count — a distribution of points carries no implied continuity, so it renders with as few as one point.

## Key Flows

- F1. **View the week under sparse data.** User opens the Week tab with a few, widely-spaced check-ins → line segments render thin and pale in proportion to their gaps → the invitation note appears below the chart → the point-cloud panel still shows every recorded point at full weight. **Covers R1, R5, R10.**
- F2. **View the week as data densifies.** User accumulates check-ins spread across enough distinct days → line segments render bolder → the invitation note stops rendering. **Covers R1, R5.**
- F3. **Inspect a point-cloud entry.** User taps a point in the panel → that entry's session detail opens, matching existing detail-open behavior elsewhere in history. **Covers R8, R9.**

## Acceptance Examples

- AE1. Two check-ins in one week, four days apart. **Given** this spacing, **when** the Week chart renders, **then** the connecting segment shows near its faintest weight and the invitation note is shown. **Covers R1, R5.**
- AE2. A day with check-ins at 8am and 11pm and no others. **Given** the 15-hour gap, **when** the Day chart renders, **then** the connecting segment's weight reduces the same way a comparable cross-day gap would on the Week chart. **Covers R1, R2.**
- AE3. Check-ins land on 6 distinct days within the visible 30-day window. **Given** this spread, **when** the Week tab renders, **then** the invitation note does not render. **Covers R5.**
- AE4. A week with zero check-ins. **Given** no data in that span, **when** the Week chart renders, **then** no segment's weight implies a connection across it. **Covers R3.**
- AE5. A single check-in exists in the visible window. **Given** one point, **when** the Week tab renders, **then** the point-cloud panel shows that one point and the line chart shows a lone dot with no connecting segment. **Covers R10.**

## Scope Boundaries

**Deferred for later**
- Categorical/contextual breakdowns (day-of-week, holiday, time-of-day patterns) — see Key Decisions for the risk rationale; revisiting this needs materially higher per-bucket volume, per-bucket confidence gating, and strictly non-causal copy, not just more total check-ins.
- Any explicit trend narrative or summary text beyond the line chart itself (e.g., "your mood over the last N weeks").

**Outside this product's identity**
- Streak counters, progress-toward-threshold indicators, or check-in reminder notifications — conflicts with the app's existing no-shame stance and `STRATEGY.md`'s exclusion of clinical/diagnostic framing.
- Any change to where the constellation/pulse-trace lives in navigation, or its role relative to the tabular history view.

## Dependencies and Assumptions

- Builds on the current line rendering in `src/components/DiaryHistory/DayChart.tsx` and `WeekChart.tsx` (fixed-opacity `--ui-gold` / `--ui-recorded` strokes for the valence/arousal series) — this brainstorm changes segment *weight*, not the existing color scheme.
- `src/utils/diaryAggregation.ts` (`dailyAggregates`, `sessionAverage`) is the existing aggregation layer the weighting rule and panel build on.
- The point-cloud panel's 30-day window is scoped to match the Week chart's own range, deliberately not reusing `src/utils/recentEntries.ts`'s `RECENT_WINDOW_DAYS` (14 days, used by the mirror/pulse-trace) — so the panel and the chart above it never disagree about "recent."
- `src/components/DiaryHistory/MiniCircumplex.tsx` is the existing point-rendering component the panel reuses.
- `STRATEGY.md`'s "Not working on" exclusions and the mirror's Recent Rhythm strip (`src/components/EmotionPreview/EmotionDrawer.tsx`) are the governing precedents for every anti-shame decision above.

## Outstanding Questions

**Deferred to planning:**
- Exact opacity/thickness falloff curve and its parameters (e.g., linear vs. exponential decay, the gap duration at which a segment becomes effectively invisible).
- Exact minimum-distinct-days threshold for the invitation note (a working assumption discussed: on the order of 4 days out of the visible 30-day window, not yet validated).
- Exact copy for the invitation note.
- Point-cloud panel's exact placement, size, and dot styling relative to the Week chart above it.

## Sources / Research

- `docs/brainstorms/2026-07-05-002-diary-history-review-requirements.md` — original Day/Week chart spec; explicitly deferred "longitudinal analytics beyond the two trend lines."
- `docs/brainstorms/2026-07-09-002-history-pulse-trace-requirements.md` — the constellation/pulse-trace's decision to stay a distinct, secondary surface alongside the tabular history, which the point-cloud panel here deliberately does not reopen.
- `STRATEGY.md` — Reflection surface track; "Not working on" exclusions (clinical/diagnostic framing, social features).
- `src/components/EmotionPreview/EmotionDrawer.tsx` — the Recent Rhythm strip's "purely 'when' and 'how often,' never a content preview" precedent.
- External research: Correll & Gleicher, "Matching Visual Saliency to Confidence in Plots of Uncertain Data" (confidence-to-visual-weight mapping); Bearable's minimum-logging gate before showing correlation insights; Daylio's explicit confidence tiers on pattern insights; Finch/SevenGrid/Stoic's shift away from streak mechanics.
