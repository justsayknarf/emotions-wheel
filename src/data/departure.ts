import type { DiaryEntry, PinEntry } from '../types';

// Pure logic for the departure mark (docs/plans/2026-08-24-001-feat-departure-mark-plan.md).
// No storage access, so it's importable directly under `npx tsx` for
// scripts/test-departure.ts — the repo has no test runner, matching why
// src/data/checkIn.ts exists as its own pure-logic seam (see its file header).

/**
 * Which pin today departs from — the previous check-in's newest pin. Matches
 * resolveActiveSelection's own case-4 fallback (src/data/checkIn.ts) so the
 * card and the field can never disagree about which pin is the anchor (LC2).
 */
export function departureAnchor(previousCheckIn: DiaryEntry | null): PinEntry | null {
  if (!previousCheckIn || previousCheckIn.pins.length === 0) return null;
  return previousCheckIn.pins[previousCheckIn.pins.length - 1];
}

const WEEKDAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * A compact label for how long ago `timestamp` was, relative to `now`. Feeds
 * both the anchor ring's on-field label (U4) and describeDelta's sentence
 * tail below (R9) — the same value in both places, so the two surfaces can
 * never disagree about how long ago the departure point was.
 *
 * 2–6 days back names the weekday; 7+ days moves to a coarse week/month/year
 * bucket rather than a weekday, since a weekday label a full week or more out
 * would land on today's own weekday and read as ambiguous. Format carried
 * from the prototype study (LC4) — untested against real long-gap cases.
 */
export function relativeDayLabel(timestamp: string, now: Date): string {
  const then = new Date(timestamp);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);

  if (diffDays <= 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays <= 6) return WEEKDAY_ABBR[then.getDay()];
  if (diffDays <= 13) return '1 WK';
  if (diffDays <= 27) return `${Math.floor(diffDays / 7)} WK`;
  if (diffDays <= 364) return `${Math.max(1, Math.round(diffDays / 30))} MO`;
  return `${Math.max(1, Math.round(diffDays / 365))} YR`;
}

// Below this magnitude on an axis, the movement isn't worth naming — the
// axis is omitted entirely rather than reported as "a little." Above it,
// three bands: "a little" / plain / "much". Edges carried from the
// prototype study (LC6) — tuned by eye, never against real diary data.
const NAME_THRESHOLD = 0.10;
const LITTLE_EDGE = 0.32;
const MUCH_EDGE = 0.62;

function band(delta: number): 'little' | 'plain' | 'much' | null {
  const a = Math.abs(delta);
  if (a < NAME_THRESHOLD) return null;
  if (a < LITTLE_EDGE) return 'little';
  if (a < MUCH_EDGE) return 'plain';
  return 'much';
}

function qualify(b: 'little' | 'plain' | 'much', word: string): string {
  if (b === 'little') return `a little ${word}`;
  if (b === 'much') return `much ${word}`;
  return word;
}

// TODAY/YESTERDAY read as ordinary words inline ("than today"); every other
// label (a weekday abbreviation or a coarse week/month/year bucket) stays
// uppercase, read as a compact token rather than prose ("than TUE").
function sentenceTail(dayLabel: string): string {
  if (dayLabel === 'TODAY') return 'today';
  if (dayLabel === 'YESTERDAY') return 'yesterday';
  return dayLabel;
}

/**
 * The card's plain-language delta (R9) — e.g. "A little more activated and
 * much more positive than TUE." `dayLabel` is relativeDayLabel's own output,
 * passed in rather than recomputed, so the card and the field read the same
 * value. Phrasing carried from the prototype study (LC6) — cheap to revise.
 */
export function describeDelta(
  from: { x: number; y: number },
  to: { x: number; y: number },
  dayLabel: string,
): string {
  const tail = sentenceTail(dayLabel);
  const parts: string[] = [];

  const bx = band(to.x - from.x);
  if (bx) parts.push(qualify(bx, to.x > from.x ? 'more activated' : 'calmer'));

  const by = band(to.y - from.y);
  if (by) parts.push(qualify(by, to.y > from.y ? 'more positive' : 'more negative'));

  if (parts.length === 0) {
    const prep = tail === 'today' || tail === 'yesterday' ? '' : ' on';
    return `About where you were${prep} ${tail}.`;
  }

  const sentence = `${parts.join(' and ')} than ${tail}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
