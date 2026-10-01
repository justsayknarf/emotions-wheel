import type { FieldCoord } from '../../utils/skyProjection';
import { clampLook } from '../../utils/skyCamera';
import { easeInOut2, easeOut2, segmentDraw, type SegmentDraw } from '../../utils/comet';
import { TAIL_MS } from './replaySchedule';

// Pure timing for the constellation replay in the night sky (SkyReplay). No
// DOM, no storage, so scripts/test-sky-replay.ts can run it under Node.
//
// The flat replay lands every check-in on one fixed plane in a quick
// ~half-second rhythm. In the sky only part of the dome is in view, so the
// replay becomes a tour: the gaze glides from one check-in to the next while
// the comet rides the great circle between them, the star lands, and its
// tagged words fade in together as a whole constellation (pin → tag → tag,
// the field's own chain, every line at once), so each check-in reads as a
// different constellation found in the sky. It pulses while it is the one in
// view; when the gaze moves on it fades and the next one appears.
//
// Everything is a function of the playhead `t` (ms), so a scrub lands on
// exactly the frame playback would have drawn — camera included.

/** The shortest glide between two check-ins. */
export const HOP_BASE_MS = 900;
/** Added per field unit of distance, so a long hop is slower, not faster. */
export const HOP_PER_UNIT_MS = 650;
/** Longest glide, however far apart two check-ins are. */
export const HOP_MAX_MS = 2600;
/** After a star lands, its constellation starts fading in this much later. */
export const REVEAL_DELAY_MS = 250;
/** The whole constellation, every line and word at once, fading in. */
export const REVEAL_MS = 900;
/** One pulse of a lit constellation: bright → dim → bright. */
export const PULSE_MS = 1600;
/** A check-in with tags holds for one full pulse once it has faded in. */
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
  /** When check-in i's constellation starts fading in. */
  revealAt: number[];
  /** When it has fully faded in and starts to pulse. */
  revealEnd: number[];
  /** When check-in i stops being the one in view (the next glide begins). */
  holdEnd: number[];
  /** Each duration after scaling to fit MAX_SKY_SPAN_MS. */
  revealMs: number;
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
    const revealAt: number[] = [];
    const revealEnd: number[] = [];
    const holdEnd: number[] = [];
    let at = 0;
    stops.forEach((s, i) => {
      const g = i === 0 ? 0 : hopMs(stops[i - 1].pin, s.pin) * k;
      glideStart.push(at);
      glideMs.push(g);
      const l = at + g;
      land.push(l);
      const ra = l + REVEAL_DELAY_MS * k;
      revealAt.push(ra);
      const re = ra + REVEAL_MS * k;
      revealEnd.push(re);
      at = re + (s.tags > 0 ? HOLD_MS : HOLD_BARE_MS) * k;
      holdEnd.push(at);
    });
    return { glideStart, glideMs, land, revealAt, revealEnd, holdEnd, total: n === 0 ? 0 : at };
  };
  const raw = build(1);
  const scale = raw.total > MAX_SKY_SPAN_MS ? MAX_SKY_SPAN_MS / raw.total : 1;
  const plan = scale === 1 ? raw : build(scale);
  return {
    looks,
    ...plan,
    revealMs: REVEAL_MS * scale,
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

/**
 * How present check-in i's constellation is at `t`, 0..1, without the
 * pulse: dark until revealAt, then the whole constellation fades in at once
 * over revealMs (out(2)); once the gaze moves on it fades out over fadeMs.
 * The last check-in never fades: the tour ends on it, lit. Word labels and
 * star cores follow this, so they read steadily while the light pulses.
 */
export function skyReplayPresence(plan: SkyReplayPlan, i: number, t: number): number {
  if (i < 0 || i >= plan.land.length || t < plan.revealAt[i]) return 0;
  const leave = i === plan.land.length - 1 ? Infinity : plan.holdEnd[i];
  if (t >= leave + plan.fadeMs) return 0;
  const appear = t >= plan.revealEnd[i] ? 1 : easeOut2((t - plan.revealAt[i]) / plan.revealMs);
  const fade = t <= leave ? 1 : 1 - (t - leave) / plan.fadeMs;
  return appear * fade;
}

/**
 * How lit check-in i's constellation is at `t`, 0..1: its presence times the
 * pulse. From revealEnd it breathes on a cosine, full → floor → full once per
 * pulse, so a held constellation ends its hold bright. Lines, the halos on
 * its tagged stars and the pin's halo follow this.
 */
export function skyReplayGlow(plan: SkyReplayPlan, i: number, t: number): number {
  const presence = skyReplayPresence(plan, i, t);
  if (presence <= 0) return 0;
  const wave = t <= plan.revealEnd[i] ? 1 : 0.5 + 0.5 * Math.cos((2 * Math.PI * (t - plan.revealEnd[i])) / plan.pulseMs);
  return presence * (PULSE_FLOOR + (1 - PULSE_FLOOR) * wave);
}
