---
date: 2026-07-29
topic: diary-csv-export
---

# Diary CSV Export — Requirements

## Summary

Add a one-tap CSV export of the user's check-in history, downloaded as a file that opens cleanly in any spreadsheet. Each emotion-pin becomes one row (its coordinate, region phrase, and recognized words) carrying its parent session's timestamp and id. The action lives in the existing history view and exports the full diary.

## Problem Frame

The diary's value compounds over time — the Reflection Surface track exists because past entries mean more in aggregate than any single check-in. Today that record is trapped: it lives only as a JSON blob under `localStorage` (`emotion-selector-diary`), readable only through the app's own `DiaryHistory` view. A user who wants to look at their patterns a different way — chart arousal over a month, count which words they reach for, keep a copy next to a journaling doc — has no way to get the data into a tool that does that. The in-app charts answer the questions the app anticipated; a spreadsheet answers the ones it didn't.

This is not disaster-recovery. The user framed the need as reflection, not protection against loss, so the goal is a readable, analyzable copy — not a reloadable backup.

## Key Decisions

- **One row per pin, not per session.** A check-in holds multiple pins, each with its own coordinate and word list. Flattening to one row per pin makes every coordinate a clean, chartable data point; the session is preserved as a shared `session_id` + timestamp across its rows. Per-session rows would cram coordinates into a single cell and defeat the analysis use case.
- **Human-readable CSV, not re-importable JSON.** The export optimizes for spreadsheet legibility (flat columns, joined word lists), not a machine round-trip. This trades away restore-into-app in exchange for a file the user can actually read and chart. Import is explicitly out of scope (see Scope Boundaries).
- **Export everything, no filtering.** v1 exports the whole diary in one action. No date-range picker, no per-session selection — the spreadsheet is where filtering happens.
- **Placement in the reflection view.** The export action lives in `DiaryHistory`, the surface the user is already in when thinking about their history — not the field or the session-complete screen.

## Requirements

**Trigger and placement**

- R1. The history view (`src/components/DiaryHistory/`) presents an export action that produces a CSV download of the diary.
- R2. When the diary is empty, the export action is unavailable (hidden or disabled) — there is no empty-file download.
- R3. Activating the action downloads a file locally; nothing is sent off-device (consistent with the product's for-the-user-only stance).

**CSV shape and contents**

- R4. The file has one row per pin across all entries, plus a header row.
- R5. Each row carries, at minimum: the parent entry's timestamp (ISO 8601), a session identifier shared by pins from the same entry, the pin's arousal (`x`) and valence (`y`) coordinates, the region relational phrase, the region narrative, and the pin's recognized words.
- R6. A pin's recognized-words list renders as a single cell with a stable in-cell separator (e.g. semicolon), so a multi-word pin stays one row.
- R7. Rows are ordered chronologically (oldest first), so a spreadsheet reads top-to-bottom as time.

**Correctness**

- R8. Field values containing commas, quotes, or newlines are quoted/escaped so the file parses correctly — the region narrative routinely contains commas (e.g. "calm, settled").
- R9. The exported coordinates preserve the stored values without lossy rounding that would distort a plotted point; the coordinate space is `x` = arousal (−1 calm → +1 activated), `y` = valence (−1 negative → +1 positive).
- R10. The downloaded file has a recognizable, collision-resistant name (e.g. dated), and a `.csv` extension so spreadsheets associate it correctly.

## Acceptance Examples

- AE1. Covers R4, R5. **Given** a session with two pins and a later session with one pin, **when** the user exports, **then** the file has three data rows: the first two share the earlier session's id and timestamp, the third carries the later session's.
- AE2. Covers R6. **Given** a pin whose recognized words are `content`, `calm`, `at ease`, **when** exported, **then** those appear in one cell as a single separated value, not as three columns or three rows.
- AE3. Covers R8. **Given** a region narrative of `calm, settled`, **when** exported and reopened in a spreadsheet, **then** it lands in one cell — the internal comma does not split the row.
- AE4. Covers R2. **Given** no recorded check-ins, **when** the user opens the history view, **then** the export action is not offered.

## Scope Boundaries

- **Import / restore** — deferred. A reloadable backup is a different feature (round-trip fidelity, merge/overwrite semantics, format versioning) serving a different goal (data-loss protection). If that need surfaces later, it's its own brainstorm.
- **Date-range or filtered export** — deferred. The spreadsheet is the filtering tool for v1.
- **Non-CSV formats** (JSON, PDF, Markdown journal) — out of scope; CSV serves the stated spreadsheet-loading goal.
- **Automatic / scheduled backups** — out of scope; export is a manual, user-initiated action.
- **Cloud sync or off-device transfer** — outside the product's for-the-user-only identity.

## Outstanding Questions

Deferred to planning:

- Exact column set and header names beyond the R5 minimum — e.g. whether to include `session_duration`, entry `id` separately from a synthesized `session_id`, or split timestamp into date/time columns for easier pivoting.
- Whether coordinates export as raw −1..1 floats or also as the app's percentage projection (`toPercent` in `src/utils/fieldGeometry.ts`); raw is the R9 default unless planning finds a reason otherwise.
- The concrete download affordance (button label, placement within `DiaryHistory`'s existing header/tab structure).
