// Pure timing and windowing for the night sky's light trails, drawn in the
// constellation replay's look (src/components/Constellation/cometStyle.ts).
// No DOM, so scripts/test-comet.ts can run it under Node. SkyBackdrop turns
// these fractions into canvas strokes.

export interface TrailPoint {
  x: number;
  y: number;
  /** Timestamp, ms (the canvas loop's rAF clock). */
  t: number;
}

export interface TrailWindow {
  /** Tail → head: the stretch of history to draw as the streak. */
  points: TrailPoint[];
  /** 0..1: 1 while the head is moving, easing to 0 as the tail catches up. */
  head: number;
}

/**
 * The visible slider-drag trail: the part of `history` (oldest first, one
 * point per position change) newer than `tailMs` before `now`. The oldest
 * edge is interpolated to exactly `now - tailMs`, so the tail slides along the
 * path rather than stepping point to point. Once the head has been still for
 * `tailMs` the tail has caught up and nothing is left to draw.
 */
export function trailWindow(history: readonly TrailPoint[], now: number, tailMs: number): TrailWindow {
  if (history.length === 0) return { points: [], head: 0 };
  const last = history[history.length - 1];
  const still = Math.max(0, now - last.t);
  const head = tailMs > 0 ? Math.max(0, 1 - still / tailMs) : 0;
  const cut = now - tailMs;
  let i = history.length - 1;
  while (i > 0 && history[i - 1].t > cut) i--;
  const points = history.slice(i);
  // Interpolate the tail edge between the last dropped point and the first kept.
  if (i > 0 && points[0].t > cut) {
    const a = history[i - 1], b = points[0];
    const k = (cut - a.t) / (b.t - a.t);
    points.unshift({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, t: cut });
  }
  if (head === 0) return { points: [], head: 0 };
  return { points, head };
}

/** Drop history the window can no longer reach (keeps one point before the cut for the interpolated edge). */
export function pruneTrail(history: TrailPoint[], now: number, tailMs: number): TrailPoint[] {
  const cut = now - tailMs;
  let i = 0;
  while (i < history.length - 1 && history[i + 1].t <= cut) i++;
  return i === 0 ? history : history.slice(i);
}

// anime.js's power eases, so the canvas matches the replay's timeline.
export const easeIn2 = (t: number) => t * t;
export const easeOut2 = (t: number) => 1 - (1 - t) * (1 - t);
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
