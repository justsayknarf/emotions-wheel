import type { DiaryEntry, Reflection, ReflectionInviteState } from '../types';
import { entriesInWindow, last7Days } from '../utils/diaryAggregation';

// Pure logic for the weekly reflection: which check-ins a walk covers, which
// moments it pauses on, and whether the invitation is due. No storage, so
// scripts/test-reflection.ts runs it under Node at a fixed clock.
// docs/plans/2026-10-09-001-feat-weekly-reflection-journal-plan.md, U2.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days between invitations. */
export const INVITE_INTERVAL_DAYS = 7;

/** A walk pauses on at most this many moments. */
export const MAX_MOMENTS = 3;

/**
 * The check-ins a reflection covers: History's last-7-days window (today and
 * the six days before it) ending on `now`, oldest first. Shared with the week
 * view so the two never disagree about what "this week" holds (KTD5).
 */
export function reflectionWindow(entries: DiaryEntry[], now: Date): DiaryEntry[] {
  return [...entriesInWindow(entries, last7Days(now))].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

/**
 * Where a check-in sits for the walk: its last pin, the same point the replay
 * draws (DrawnConstellation), so a picked moment and its highlighted star
 * always match. Null for an entry with no pins.
 */
export function momentPoint(entry: DiaryEntry): { x: number; y: number } | null {
  const pin = entry.pins.at(-1);
  return pin ? { x: pin.x, y: pin.y } : null;
}

/**
 * The moments a walk pauses on (R11), in time order. With three or fewer
 * placeable check-ins, all of them. Otherwise three chosen for contrast: the
 * most pleasant (highest y), the least pleasant (lowest y), and the one
 * furthest from the week's average point. One check-in fills at most one
 * slot; ties go to the earlier check-in. `windowEntries` is oldest first.
 */
export function pickMoments(windowEntries: DiaryEntry[]): DiaryEntry[] {
  const placed = windowEntries
    .map((entry) => ({ entry, p: momentPoint(entry) }))
    .filter((c): c is { entry: DiaryEntry; p: { x: number; y: number } } => c.p !== null);
  if (placed.length <= MAX_MOMENTS) return placed.map((c) => c.entry);

  const meanX = placed.reduce((s, c) => s + c.p.x, 0) / placed.length;
  const meanY = placed.reduce((s, c) => s + c.p.y, 0) / placed.length;
  const chosen = new Set<DiaryEntry>();

  // Strict comparisons over an oldest-first list keep the earliest on a tie.
  const best = (score: (c: (typeof placed)[number]) => number) => {
    let top: (typeof placed)[number] | null = null;
    for (const c of placed) {
      if (chosen.has(c.entry)) continue;
      if (top === null || score(c) > score(top)) top = c;
    }
    if (top) chosen.add(top.entry);
  };

  best((c) => c.p.y);
  best((c) => -c.p.y);
  best((c) => Math.hypot(c.p.x - meanX, c.p.y - meanY));

  return placed.filter((c) => chosen.has(c.entry)).map((c) => c.entry);
}

/**
 * When the invitation's 7-day timer started: the latest invited reflection
 * or skip, else the first check-in. On-demand reflections don't count (KTD15).
 * Null with no check-ins at all.
 */
export function inviteAnchor(
  entries: DiaryEntry[],
  reflections: Reflection[],
  inviteState: ReflectionInviteState,
): number | null {
  const marks = [
    ...reflections.filter((r) => r.opened === 'invite').map((r) => Date.parse(r.completedAt)),
    ...(inviteState.lastSkippedAt ? [Date.parse(inviteState.lastSkippedAt)] : []),
  ].filter((t) => !Number.isNaN(t));
  if (marks.length > 0) return Math.max(...marks);
  if (entries.length === 0) return null;
  return Math.min(...entries.map((e) => Date.parse(e.timestamp)));
}

/**
 * Whether the weekly invitation shows (R7, R9): at least 7 days since its
 * anchor, at least one check-in in the last 7 days, and not snoozed.
 * Derived at render, never stored (KTD11).
 */
export function inviteStatus(
  entries: DiaryEntry[],
  reflections: Reflection[],
  inviteState: ReflectionInviteState,
  now: Date,
): 'due' | 'hidden' {
  const anchor = inviteAnchor(entries, reflections, inviteState);
  if (anchor === null) return 'hidden';
  if (now.getTime() - anchor < INVITE_INTERVAL_DAYS * DAY_MS) return 'hidden';
  if (reflectionWindow(entries, now).length === 0) return 'hidden';
  const snoozed = inviteState.snoozedUntil ? Date.parse(inviteState.snoozedUntil) : NaN;
  if (!Number.isNaN(snoozed) && now.getTime() < snoozed) return 'hidden';
  return 'due';
}

/** "Later": the next local midnight. */
export function laterUntil(now: Date): Date {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next;
}

/** History's "look back" is offered once there are two check-ins to look across (R18). */
export function canLookBack(entries: DiaryEntry[]): boolean {
  return entries.length >= 2;
}
