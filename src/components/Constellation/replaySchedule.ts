import { relativeDayLabel } from '../../data/departure';

// Pure timing + labelling for the constellation replay ("a week, drawn in").
// No DOM, no storage, so scripts/test-replay-schedule.ts can run it under Node.
// ConstellationReplay turns this into one anime.js timeline.

/** Delay between two stars landing, at its most relaxed (short histories). */
export const STEP_MS = 520;
/** One star's landing: scale 0→1 + opacity, eased 'outBack(2)'. */
export const STAR_MS = 650;
/** The line from the previous star, drawn so it finishes as this star lands. */
export const LINE_MS = 420;
/** The day label trails its star's landing by this much. */
export const LABEL_DELAY_MS = 80;
export const LABEL_MS = 500;
/** A star's words ignite just after it lands, then settle to a faint glow. */
export const WORD_DELAY_MS = 120;
export const WORD_MS = 1300;
/**
 * Longest the arrivals may be spread over. A long history compresses its
 * spacing to fit rather than playing for a minute; a short one keeps STEP_MS.
 */
export const MAX_SPAN_MS = 7000;
/** A line takes at most this share of its step, so it starts after the previous star. */
const LINE_SHARE = 0.85;

export interface ReplaySchedule {
  /** Gap between consecutive star landings. */
  step: number;
  /** Line draw duration (≤ LINE_MS, shrinks with the step). */
  lineMs: number;
  /** When star i begins landing. */
  starAt: (i: number) => number;
  /** When the line into star i (i ≥ 1) begins drawing; it ends at starAt(i). */
  lineAt: (i: number) => number;
  /** Timeline length: the last star's landing and its words fully settled. */
  total: number;
}

export function replaySchedule(count: number): ReplaySchedule {
  const hops = Math.max(0, count - 1);
  const step = hops === 0 ? 0 : Math.min(STEP_MS, MAX_SPAN_MS / hops);
  const lineMs = Math.min(LINE_MS, step * LINE_SHARE);
  const starAt = (i: number) => i * step;
  const lineAt = (i: number) => starAt(i) - lineMs;
  const last = starAt(hops);
  const total = count === 0 ? 0 : last + Math.max(STAR_MS, LABEL_DELAY_MS + LABEL_MS, WORD_DELAY_MS + WORD_MS);
  return { step, lineMs, starAt, lineAt, total };
}

/**
 * One label per day, on the first check-in of it: relativeDayLabel's own
 * vocabulary (TODAY, YESTERDAY, MON, 1 WK…) so the replay names days exactly
 * the way the field's previous-check-in ring does. Consecutive check-ins that
 * resolve to the same label ("1 WK" covers a whole week) only label the first,
 * so a busy day or an older week doesn't stack repeated tags on the sky.
 * `timestamps` must be chronological (recentWindow's order).
 */
export function replayDayLabels(timestamps: string[], now: Date): (string | null)[] {
  let prev: string | null = null;
  return timestamps.map((ts) => {
    const label = relativeDayLabel(ts, now);
    if (label === prev) return null;
    prev = label;
    return label;
  });
}
