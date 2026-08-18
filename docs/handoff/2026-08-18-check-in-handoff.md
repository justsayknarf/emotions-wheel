# Check-in unit of record — state of play

**2026-08-18.** Planned and reviewed, not yet built.

## The documents

| | |
|---|---|
| Why | [`docs/brainstorms/2026-08-17-check-in-state-legibility-requirements.md`](../brainstorms/2026-08-17-check-in-state-legibility-requirements.md) |
| What | [`docs/plans/2026-08-17-001-feat-check-in-unit-of-record-plan.md`](../plans/2026-08-17-001-feat-check-in-unit-of-record-plan.md) — eight units |
| How it lands | [`docs/plans/2026-08-18-001-chore-check-in-work-handoff-plan.md`](../plans/2026-08-18-001-chore-check-in-work-handoff-plan.md) — phases and gates |

Start at the handoff plan's **Delivery Sequence**. It says which units land together, in what order, and what has to be true before each phase is done. Don't re-derive that from the dependency lists.

Both plans went through `ce-doc-review`; findings are applied, so read them as current rather than as drafts.

## What's decided elsewhere — don't re-litigate

The origin plan's **Open Questions** already holds the three unresolved calls (session duration on a re-save, the recorded-card visual treatment, how loudly an activated recorded pin should light the field). Its **Risks & Dependencies** holds the `SelectionControls.tsx` reachability concern. Those live there, not here, so they stay current as the work resolves them.

## What lives only here

**The recorded-pin hue is a proposal, not a decision.** The origin plan names `--oura-recorded: #7C93A8` for distinguishing recorded pins from draft pins. It was derived by rotating the existing gold cool at comparable luminance — it has never been seen in the app. Look at it before treating it as settled.

**Two things the reviewers raised that never became findings:**

- `useDiary` seeds `entries` once from storage and never listens for `storage` events. Under append-only that only meant two tabs interleaved. Once entries can be updated in place, a second tab's "previous check-in" can be stale relative to what an update wrote.
- `updateEntry` no-ops silently on a missing id, by design. Nothing specifies what the UI does when a save-with-carried-id matches nothing. It is hard to reach — pruning removes oldest entries and can never reach the newest — but the failure mode is a user's edit vanishing while the interface implies it saved.

## Repo state as of this writing

`main` has the planning artifacts and repaired guidance. The caption work is in PR #19, awaiting merge — land it before starting the check-in units, since it touches `CoordinateCard.tsx`, which units six and seven also touch.
