import type { FieldCoord } from '../../utils/skyProjection';
import { clampLook } from '../../utils/skyCamera';
import { easeInOut2, segmentDraw, type SegmentDraw } from '../../utils/comet';
import { TAIL_MS } from './replaySchedule';

// Pure timing for the constellation replay in the night sky (SkyReplay). No
// DOM, no storage, so scripts/test-sky-replay.ts can run it under Node.
//
// The flat replay lands every check-in on one fixed plane in a quick
// ~half-second rhythm. In the sky only part of the dome is in view, so the
// replay becomes a tour: the gaze glides from one check-in to the next while
// the comet rides the great circle between them, the star lands, its tagged
// words draw in as a constellation (pin → tag → tag, the field's own chain),
// and the constellation pulses while it is the one in view. When the gaze
// moves on, that constellation fades and the next one lights.
//
// Everything is a function of the playhead `t` (ms), so a scrub lands on
// exactly the frame playback would have drawn — camera included.

/** The shortest glide between two check-ins. */
export const HOP_BASE_MS = 900;
/** Added per field unit of distance, so a long hop is slower, not faster. */
export const HOP_PER_UNIT_MS = 650;
/** Longest glide, however far apart two check-ins are. */
export const HOP_MAX_MS = 2600;
/** After a star lands, its tag lines start drawing this much later. */
export const TAG_DELAY_MS = 300;
/** One tag line drawing in (head ride); lines draw one after another. */
export const TAG_SEG_MS = 380;
/** One pulse of a lit constellation: bright → dim → bright. */
export const PULSE_MS = 1600;
/** A check-in with tags holds for one full pulse after its lines finish. */
export const HOLD_MS = PULSE_MS;
/** A check-in without tags holds only briefly before the gaze moves on. */
export const HOLD_BARE_MS = 700;
/** A lit constellation fades out over this much of the next glide. */
export const FADE_MS = 700;
/** Lowest point of a pulse, as a share of full brightness. */
export const PULSE_FLOOR = 0.45;
/**
 * Longest the tour may run. A long history scales every duration down to
 * fit rather than playing for minutes.
 */
export const MAX_SKY_SPAN_MS = 40000;

export interface SkyReplayStop {
  /** The check-in's pin. */
  pin: FieldCoord;
  /** How many words were tagged: the constellation has this many lines. */
  tags: number;
}

export interface SkyReplayPlan {
  /** Where the gaze rests for each check-in (its pin, clamped to the camera's reach). */
  looks: FieldCoord[];
  /** When the glide into check-in i starts (i ≥ 1; glideStart[0] is 0). */
  glideStart: number[];
  /** Glide into check-in i; 0 for the first. */
  glideMs: number[];
  /** When check-in i's star lands; the glide ends here. */
  land: number[];
  /** When check-in i's first tag line starts drawing. */
  tagStart: number[];
  /** When check-in i's last tag line has its head home. */
  tagsEnd: number[];
  /** When check-in i stops being the one in view (the next glide begins). */
  holdEnd: number[];
  /** Each duration after scaling to fit MAX_SKY_SPAN_MS. */
  tagSegMs: number;
  pulseMs: number;
  fadeMs: number;
  tailMs: number;
  /** 1 for a short history; below 1 when the tour was compressed to fit. */
  scale: number;
  total: number;
}

export function hopMs(a: FieldCoord, b: FieldCoord): number {
  return Math.min(HOP_MAX_MS, HOP_BASE_MS + HOP_PER_UNIT_MS * Math.hypot(b.x - a.x, b.y - a.y));
}

export function skyReplayPlan(stops: SkyReplayStop[], lookMax: number): SkyReplayPlan {
  const n = stops.length;
  const looks = stops.map((s) => clampLook(s.pin, lookMax));
  const build = (k: number) => {
    const glideStart: number[] = [];
    const glideMs: number[] = [];
    const land: number[] = [];
    const tagStart: number[] = [];
    const tagsEnd: number[] = [];
    const holdEnd: number[] = [];
    let at = 0;
    stops.forEach((s, i) => {
      const g = i === 0 ? 0 : hopMs(stops[i - 1].pin, s.pin) * k;
      glideStart.push(at);
      glideMs.push(g);
      const l = at + g;
      land.push(l);
      const ts = l + TAG_DELAY_MS * k;
      tagStart.push(ts);
      const te = s.tags > 0 ? ts + s.tags * TAG_SEG_MS * k : l;
      tagsEnd.push(te);
      at = te + (s.tags > 0 ? HOLD_MS : HOLD_BARE_MS) * k;
      holdEnd.push(at);
    });
    return { glideStart, glideMs, land, tagStart, tagsEnd, holdEnd, total: n === 0 ? 0 : at };
  };
  const raw = build(1);
  const scale = raw.total > MAX_SKY_SPAN_MS ? MAX_SKY_SPAN_MS / raw.total : 1;
  const plan = scale === 1 ? raw : build(scale);
  return {
    looks,
    ...plan,
    tagSegMs: TAG_SEG_MS * scale,
    pulseMs: PULSE_MS * scale,
    fadeMs: FADE_MS * scale,
    tailMs: TAIL_MS * scale,
    scale,
  };
}

/** The check-in in view at `t`: the last one whose glide has begun. */
export function skyReplayFocus(plan: SkyReplayPlan, t: number): number {
  let i = 0;
  while (i + 1 < plan.land.length && t >= plan.glideStart[i + 1]) i++;
  return plan.land.length ? i : -1;
}

/**
 * The gaze at `t`: resting on a check-in, or partway along the glide to the
 * next one on the same inOut(2) ease the comet head rides, so the head stays
 * near the middle of the view the whole way.
 */
export function skyReplayLook(plan: SkyReplayPlan, t: number): FieldCoord {
  const n = plan.looks.length;
  if (n === 0) return { x: 0, y: 0 };
  const i = skyReplayFocus(plan, t);
  if (i === 0 || t >= plan.land[i]) return plan.looks[i];
  const a = plan.looks[i - 1], b = plan.looks[i];
  const k = easeInOut2(Math.max(0, Math.min(1, (t - plan.glideStart[i]) / plan.glideMs[i])));
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/** The comet from check-in i-1 into check-in i, or null before it sets off. */
export function chainDraw(plan: SkyReplayPlan, i: number, t: number): SegmentDraw | null {
  if (i < 1 || i >= plan.land.length || t < plan.glideStart[i]) return null;
  return segmentDraw(t - plan.glideStart[i], plan.glideMs[i], plan.tailMs);
}

/** Tag line k of check-in i (k = 0 is pin → first word), or null before it starts. */
export function tagDraw(plan: SkyReplayPlan, i: number, k: number, t: number): SegmentDraw | null {
  const start = plan.tagStart[i] + k * plan.tagSegMs;
  if (t < start) return null;
  return segmentDraw(t - start, plan.tagSegMs, plan.tailMs);
}

/**
 * How lit check-in i's constellation is at `t`, 0..1. Full while its lines
 * draw; from the moment they finish it breathes on a cosine, full → floor →
 * full once per pulse, so a held constellation ends its hold bright. Once
 * the gaze moves on it fades out over fadeMs. The last check-in never fades:
 * the tour ends on it, lit.
 */
export function skyReplayGlow(plan: SkyReplayPlan, i: number, t: number): number {
  if (i < 0 || i >= plan.land.length || t < plan.land[i]) return 0;
  const isLast = i === plan.land.length - 1;
  const leave = isLast ? Infinity : plan.holdEnd[i];
  if (t >= leave + plan.fadeMs) return 0;
  const wave = t <= plan.tagsEnd[i] ? 1 : 0.5 + 0.5 * Math.cos((2 * Math.PI * (t - plan.tagsEnd[i])) / plan.pulseMs);
  const breath = PULSE_FLOOR + (1 - PULSE_FLOOR) * wave;
  const fade = t <= leave ? 1 : 1 - (t - leave) / plan.fadeMs;
  return breath * fade;
}
