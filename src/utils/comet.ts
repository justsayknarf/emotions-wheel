// Pure timing for the night sky's light trails: the tag lines, drawn in the
// constellation replay's look (src/components/Constellation/cometStyle.ts),
// and the departure comet from the previous check-in to a newly committed pin
// (DepartureTrace's timeline, redrawn on the sky canvas so it stays on the
// dome as the camera moves). No DOM, so scripts/test-comet.ts can run it
// under Node. SkyBackdrop turns these fractions into canvas strokes.

// anime.js's power eases, so the canvas matches the replay's timeline.
export const easeIn2 = (t: number) => t * t;
export const easeOut2 = (t: number) => 1 - (1 - t) * (1 - t);
export const easeOut3 = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut2 = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface SegmentDraw {
  /** How far along the segment the head has ridden (0..1). */
  head: number;
  /** How far the streak's tail has caught up (0..1); the streak spans tail..head. */
  tail: number;
  /** How much of the quiet line has drawn in (0..1); it draws with the head and stays. */
  quiet: number;
  /** The head circle's opacity: in over the first 120ms, out over 300ms from just before arrival. */
  headAlpha: number;
}

/**
 * One segment's replay timeline at `elapsedMs` after it appeared: the streak
 * draws '0 0' → '0 1' over lineMs (inOut(2)) while the head rides, then
 * '0 1' → '1 1' over tailMs (in(2)) as the tail catches up. The quiet line
 * draws in with the head and stays. The head fades in over min(120, 0.3 ×
 * lineMs) and out over 300ms (out(2)) from 40ms before it arrives.
 */
export function segmentDraw(elapsedMs: number, lineMs: number, tailMs: number): SegmentDraw {
  const e = Math.max(0, elapsedMs);
  const head = lineMs > 0 ? easeInOut2(clamp01(e / lineMs)) : 1;
  const tail = e <= lineMs ? 0 : tailMs > 0 ? easeIn2(clamp01((e - lineMs) / tailMs)) : 1;
  const fadeIn = Math.min(120, lineMs * 0.3);
  const rise = fadeIn > 0 ? clamp01(e / fadeIn) : 1;
  const fall = 1 - easeOut2(clamp01((e - (lineMs - 40)) / 300));
  return { head, tail, quiet: head, headAlpha: Math.min(rise, fall) };
}

/** When a segment's animation is over and it can draw at rest. */
export function segmentDone(elapsedMs: number, lineMs: number, tailMs: number): boolean {
  return elapsedMs >= Math.max(lineMs + tailMs, lineMs - 40 + 300);
}

// The old canvas streak erased `trail` of itself every frame (~60fps); its
// visible length was the time until that decay left ~5%. The tail's catch-up
// reuses that lifetime, so the admin slider keeps its meaning: higher
// `trail` → shorter streak.
export function departureTailMs(trail: number): number {
  const d = Math.min(Math.max(trail, 0.01), 0.9);
  const frames = Math.log(0.05) / Math.log(1 - d);
  return Math.min(Math.max((frames / 60) * 1000, 150), 2500);
}

// The arrival bloom's spring: stiffness 170, damping 24, mass 1 (ζ ≈ 0.92,
// the pin landing's firm settle), solved in closed form so the canvas matches
// anime.js's spring({ stiffness: 170, damping: 24 }).
const SPRING_W = Math.sqrt(170);
const SPRING_Z = 24 / (2 * SPRING_W);
const SPRING_WD = SPRING_W * Math.sqrt(1 - SPRING_Z * SPRING_Z);
export function settleSpring(ms: number): number {
  const t = Math.max(0, ms) / 1000;
  return 1 - Math.exp(-SPRING_Z * SPRING_W * t) * (Math.cos(SPRING_WD * t) + ((SPRING_Z * SPRING_W) / SPRING_WD) * Math.sin(SPRING_WD * t));
}

export interface DepartureTiming {
  /** The head's flight, anchor to pin, ms. */
  travelMs: number;
  /** The tail's catch-up after arrival, ms (departureTailMs). */
  tailMs: number;
  /** The bloom's steady hold once it arrives, ms. */
  holdMs: number;
  /** The bloom's final dissolve, ms. */
  fadeMs: number;
}

export interface DepartureDraw {
  /** How far along the arc the head has ridden (0..1). */
  head: number;
  /** How far the streak's tail has caught up (0..1); the streak spans tail..head. */
  tail: number;
  /** The head circle's opacity. */
  headAlpha: number;
  /** The arrival bloom at the pin: scale 0..~1 (a firm spring) and opacity 0..0.9. */
  bloomScale: number;
  bloomAlpha: number;
  /** The gold halo ring: scale 0.3 → 2.2, and its fade 1 → 0 (times the halo's strength-scaled alpha). */
  haloScale: number;
  haloFade: number;
  /** Everything has faded: nothing left to draw. */
  done: boolean;
}

/**
 * DepartureTrace's anime.js timeline at `elapsedMs` after play: the streak
 * draws in over travelMs (inOut(2)) while the head rides, then the tail
 * catches up over tailMs (in(2)). The head fades in over min(150, 0.2 ×
 * travel) and out over 450ms from 50ms before it arrives, handing off to a
 * bloom that springs in, holds for holdMs and dissolves over fadeMs (out(2)),
 * and a gold halo that spreads and fades over max(600, 0.9 × fadeMs) (out(3)).
 */
export function departureDraw(elapsedMs: number, t: DepartureTiming): DepartureDraw {
  const e = Math.max(0, elapsedMs);
  const T = Math.max(t.travelMs, 50);
  const arrive = T - 50;
  const holdEnd = arrive + t.holdMs;
  const fade = Math.max(t.fadeMs, 1);
  const haloMs = Math.max(600, fade * 0.9);
  const end = Math.max(T + t.tailMs, holdEnd + fade, arrive + 50 + haloMs);

  const head = easeInOut2(clamp01(e / T));
  const tail = e <= T ? 0 : t.tailMs > 0 ? easeIn2(clamp01((e - T) / t.tailMs)) : 1;
  const fadeIn = Math.min(150, T * 0.2);
  const headAlpha = e < arrive ? easeOut2(clamp01(e / fadeIn)) : 1 - easeOut2(clamp01((e - arrive) / 450));

  const bloomScale = e < arrive ? 0 : settleSpring(e - arrive);
  const bloomAlpha = e < arrive ? 0 : e < holdEnd ? 0.9 * easeOut2(clamp01((e - arrive) / 180)) : 0.9 * (1 - easeOut2(clamp01((e - holdEnd) / fade)));

  const h = e < arrive + 50 ? 0 : easeOut3(clamp01((e - arrive - 50) / haloMs));
  const haloScale = 0.3 + 1.9 * h;
  const haloFade = e < arrive + 50 ? 0 : 1 - h;

  return { head, tail, headAlpha, bloomScale, bloomAlpha, haloScale, haloFade, done: e >= end };
}

/** DepartureTrace's sizes for a strength (0.40 is the tuned default, which reproduces the sketch). */
export function departureSizes(strength: number) {
  const s = Math.max(strength, 0.05) / 0.4;
  return {
    glowWidth: 7 * s,
    glowAlpha: Math.min(0.35 * s, 0.8),
    headR: 4.5 * s,
    coreR: Math.max(1.4, 2.2 * Math.sqrt(s)),
    bloomR: 6 * s,
    haloR: 16 * s,
    haloAlpha: Math.min(0.5 * s, 0.85),
  };
}
