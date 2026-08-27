import type { DiaryEntry, PinEntry } from '../types';
import type { Emotion } from './emotions';
import { getRegionDescription } from './regions';
import { startOfDay } from '../utils/formatDate';

// Pure logic for the departure mark (docs/plans/2026-08-24-001-feat-departure-mark-plan.md).
// No storage access, so it's importable directly under `npx tsx` for
// scripts/test-departure.ts — the repo has no test runner, matching why
// src/data/checkIn.ts exists as its own pure-logic seam (see its file header).

/**
 * Which pin today departs from — the previous check-in's newest pin. Matches
 * resolveActiveSelection's own case-4 fallback (src/data/checkIn.ts) so the
 * card and the field can never disagree about which pin is the anchor (LC2).
 *
 * U2 (docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md): when
 * there's no previous check-in at all, this now returns a synthetic pin at
 * the neutral center of both axes (`id: 'neutral-anchor'`) rather than null
 * — the desktop landing's neutral-centered first-time variant (R2) departs
 * from this same synthetic pin the same way a returning user's card departs
 * from their own last entry. `emotions` is only needed for this synthetic
 * case's `regionDescription` (getRegionDescription's own signature); a real
 * previousCheckIn's own anchor pin already carries its own stored
 * regionDescription and ignores it. The empty-pins case (a previousCheckIn
 * that somehow holds zero pins — unreachable via the UI, since Save is
 * disabled at zero pins) is left returning null, unchanged from before this
 * unit: only the *no previousCheckIn* case gained the synthetic pin.
 */
export function departureAnchor(previousCheckIn: DiaryEntry | null, emotions: Emotion[]): PinEntry | null {
  if (previousCheckIn) {
    if (previousCheckIn.pins.length === 0) return null;
    return previousCheckIn.pins[previousCheckIn.pins.length - 1];
  }
  return {
    id: 'neutral-anchor',
    x: 0,
    y: 0,
    recognizedWords: [],
    regionDescription: getRegionDescription(0, 0, emotions),
  };
}

/**
 * U2/KTD1: the landing state — draft empty, previous check-in exists, not
 * mid-reopen. Matches App's `showMirror` exactly (the departure card only
 * ever renders inside that same view). Exported so this predicate is
 * Node-testable and EmotionDrawer.tsx can import it rather than re-deriving
 * the same three conditions locally, where they could drift apart from this
 * definition.
 */
export function isDepartureEligible(
  isReopened: boolean,
  draftPinCount: number,
  previousCheckIn: DiaryEntry | null,
): boolean {
  return !isReopened && draftPinCount === 0 && previousCheckIn !== null;
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

/**
 * Whether `from`/`to` differ enough on either axis to be worth naming (R9) —
 * the same NAME_THRESHOLD describeDelta itself uses. Exported so the card
 * (U3) can suppress its delta line entirely when the two ticks coincide,
 * rather than rendering describeDelta's neutral "about where you were"
 * phrasing, which would just restate a tick position the card already shows.
 */
export function hasNotableDelta(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  return Math.abs(to.x - from.x) >= NAME_THRESHOLD || Math.abs(to.y - from.y) >= NAME_THRESHOLD;
}

/**
 * U3 (drag-triggered progressive transition,
 * docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md): how far a
 * departure-card slider has traveled from the anchor's own value on one axis
 * (`origin` — the same value the departure card's tick mark already draws
 * at, `origin={pin.x}`/`origin={pin.y}` in CoordinateCard.tsx), normalized
 * to 0..1 against `fullTravel`. `fullTravel` is deliberately a fixed
 * fraction of the full -1..1 track (CoordinateCard's own
 * `DEPARTURE_DRAG_TRAVEL`, currently 1) rather than the track's own full
 * end-to-end span — requiring the whole track's length to reach full
 * progress would make the transition feel unreachable for an ordinary drag.
 * Shared by CoordinateCard's dragDeparture/commitDeparture (the live,
 * per-frame value reported every drag frame) and cancelDeparture (which
 * reports the PEAK of this same function reached across the gesture, not
 * just wherever the thumb ended up when the browser cancelled it — see its
 * own comment). Pure so it's exercised directly here rather than only live
 * in a drag; this repo has no test runner beyond these scripts.
 */
export function departureDragProgress(origin: number, current: number, fullTravel: number): number {
  if (fullTravel <= 0) return current === origin ? 0 : 1;
  return Math.max(0, Math.min(1, Math.abs(current - origin) / fullTravel));
}

/**
 * U3: the drag-commit decision — at or above `commitThreshold`
 * (RevealTuning's `focusDragCommitThreshold`), the desktop landing's
 * transition completes to focused/rail; below it, it eases back to
 * receded/centered. Shared by every settle path App.tsx's
 * handleDepartureDragProgress runs (an ordinary release, and a cancel
 * reporting its ratcheted peak progress) so that comparison lives in one
 * tested place rather than repeated per call site.
 */
export function isDepartureDragCommitted(progress: number, commitThreshold: number): boolean {
  return progress >= commitThreshold;
}

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

// TODAY/YESTERDAY don't read as dates at all — "than earlier" / "than
// before" — since naming the day the check-in itself happened on reads as
// redundant. Every other label (a weekday abbreviation or a coarse
// week/month/year bucket) stays uppercase, read as a compact token rather
// than prose ("than TUE").
function sentenceTail(dayLabel: string): string {
  if (dayLabel === 'TODAY') return 'earlier';
  if (dayLabel === 'YESTERDAY') return 'before';
  return dayLabel;
}

/**
 * The card's plain-language delta (R9) — e.g. "A little more activated and
 * much more positive than TUE," or "than earlier"/"than before" when the
 * anchor is today's/yesterday's own check-in. `dayLabel` is relativeDayLabel's
 * own output, passed in rather than recomputed, so the card and the field
 * read the same value. Phrasing carried from the prototype study (LC6) —
 * cheap to revise.
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
    const prep = dayLabel === 'TODAY' || dayLabel === 'YESTERDAY' ? '' : ' on';
    return `About where you were${prep} ${tail}.`;
  }

  const sentence = `${parts.join(' and ')} than ${tail}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
