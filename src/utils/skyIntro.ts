import type { FieldCoord } from './skyProjection';

// The opening camera move of the night-sky field
// (docs/plans/2026-09-28-002-feat-living-sky-plan.md): while the welcome cue
// shows, the gaze starts low over the Negative horizon and rises to the
// still point overhead. Pure, so check:intro can prove it stays under its
// own speed ceiling (skyIntroMaxDeg) and lands exactly.

export interface IntroSpec {
  from: FieldCoord;
  to: FieldCoord;
  delayS: number;
  durationS: number;
}

// Low over the Negative horizon: screen-down is always Negative, so rising
// from here reads as lifting your eyes from the horizon to the sky overhead.
export function introStart(lookMax: number): FieldCoord {
  return { x: 0, y: -lookMax };
}

export function introLook(elapsedS: number, spec: IntroSpec): { look: FieldCoord; done: boolean } {
  const k = Math.max(0, Math.min(1, (elapsedS - spec.delayS) / spec.durationS));
  const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
  return {
    look: { x: spec.from.x + (spec.to.x - spec.from.x) * e, y: spec.from.y + (spec.to.y - spec.from.y) * e },
    done: k >= 1,
  };
}

// Peak gaze speed of the eased rise, field units per second.
export function introPeakSpeed(spec: IntroSpec): number {
  const dist = Math.hypot(spec.to.x - spec.from.x, spec.to.y - spec.from.y);
  return (Math.PI / 2) * (dist / spec.durationS);
}

// The spec with its duration lengthened, if need be, so the peak speed
// stays at or under maxSpeed (field units per second) — R13 holds at any
// admin setting, not just the defaults.
export function clampIntroDuration(spec: IntroSpec, maxSpeed: number): IntroSpec {
  if (!(maxSpeed > 0) || !Number.isFinite(maxSpeed)) return spec;
  const dist = Math.hypot(spec.to.x - spec.from.x, spec.to.y - spec.from.y);
  // A hair over the exact bound, so rounding never lands the peak above it.
  const minDuration = ((Math.PI / 2) * dist / maxSpeed) * (1 + 1e-9);
  return spec.durationS >= minDuration ? spec : { ...spec, durationS: minDuration };
}
