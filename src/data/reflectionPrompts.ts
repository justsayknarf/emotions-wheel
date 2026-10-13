import { startOfDay } from '../utils/formatDate';

// Observer-style prompts for the weekly reflection walk (R12). Each names
// where a moment sat and asks what was going on, looking at it from the
// outside. None asks "why" — Kross's self-distancing work finds that a
// self-immersed "why did I feel that way?" feeds rumination
// (docs/brainstorms/2026-10-09-weekly-reflection-journal-requirements.md,
// Research 5). scripts/test-reflection.ts enforces the "no why" rule.
//
// Position words follow the field's own axis labels (Positive/Negative,
// Calm/Activated) rather than naming the feeling, so the prompt describes
// where the user put the pin, never what they felt (ask, never assert).

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Beyond this distance from the middle on an axis, the axis gets named.
// Tuned by eye against the field's layout; not validated on real diaries.
export const AXIS_BAND = 0.2;

/** "today", "yesterday", or the weekday name, for a moment within the week. */
export function dayPhrase(timestamp: string, now: Date): string {
  const then = new Date(timestamp);
  const diffDays = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return WEEKDAYS[then.getDay()];
}

/**
 * Where a coordinate sat, in the field's axis words: "pleasant and calm",
 * "on the unpleasant side", "even and activated", "near the middle".
 * y is valence (pleasant up), x is arousal (activated right).
 */
export function positionPhrase(x: number, y: number): string {
  const val = y >= AXIS_BAND ? 'pleasant' : y <= -AXIS_BAND ? 'unpleasant' : null;
  const aro = x >= AXIS_BAND ? 'activated' : x <= -AXIS_BAND ? 'calm' : null;
  if (val && aro) return `${val} and ${aro}`;
  if (val) return `on the ${val} side`;
  if (aro) return `even and ${aro}`;
  return 'near the middle';
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Template = (day: string, pos: string) => string;

export const PROMPT_TEMPLATES: Template[] = [
  (day, pos) => `${capitalize(day)} sat ${pos}. What was going on?`,
  (day, pos) => `Look at ${day}: ${pos}. What was the day holding?`,
  (day, pos) => `${capitalize(day)}, ${pos}. Where were you, and who was around?`,
  (day, pos) => `This one is from ${day}, ${pos}. What led up to it?`,
  (day, pos) => `${capitalize(day)} landed ${pos}. What was happening around then?`,
];

/**
 * The prompt for the `index`-th moment of a walk. Wording rotates by a fixed
 * offset (seed + index) mod template count, so one walk never repeats a
 * template across its three moments and two walks start differently.
 */
export function momentPrompt(
  point: { x: number; y: number },
  timestamp: string,
  index: number,
  seed: number,
  now: Date,
): string {
  const n = PROMPT_TEMPLATES.length;
  const t = PROMPT_TEMPLATES[(((seed + index) % n) + n) % n];
  return t(dayPhrase(timestamp, now), positionPhrase(point.x, point.y));
}
