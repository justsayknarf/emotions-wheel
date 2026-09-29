import type { ThemeChannel } from '../../config/themeColor';

// The constellation replay's light trail, as shared constants: a bright
// streak and its blurred glow ride a line behind a small white head, then the
// tail catches up and only a quiet line stays. DrawnConstellation draws it in
// SVG; the night sky's slider-drag trail and tag lines (SkyBackdrop) draw the
// same look on canvas. Timing stays in replaySchedule (covered by
// check:replay) and is re-exported here so callers take the look from one place.

export { LINE_MS, TAIL_MS } from './replaySchedule';

/** The streak's soft glow under the core: the departure comet's proportions. */
export const STREAK_GLOW_WIDTH = 5;
export const STREAK_GLOW_OPACITY = 0.35;
/** The streak's bright core. */
export const STREAK_CORE_WIDTH = 1.75;
/** Blur softening the glow and the head's halo (SVG feGaussianBlur stdDeviation, px). */
export const GLOW_BLUR = 3;
/** The head: a blurred halo and a solid core, both in the text channel. */
export const HEAD_GLOW_R = 4.5;
export const HEAD_CORE_R = 2.2;
/** The quiet constellation line the streak leaves behind (recorded channel). */
export const QUIET_LINE_WIDTH = 1.2;
export const QUIET_LINE_OPACITY = 0.45;

export interface CometStop {
  /** 0 = the tail end, 1 = the head. */
  at: number;
  channel: ThemeChannel;
  alpha: number;
}

/** Teal tail → gold → a text-white head. */
export const STREAK_STOPS: readonly CometStop[] = [
  { at: 0, channel: 'recorded', alpha: 0.25 },
  { at: 0.55, channel: 'recorded', alpha: 0.8 },
  { at: 0.85, channel: 'gold', alpha: 0.95 },
  { at: 1, channel: 'text', alpha: 1 },
];
