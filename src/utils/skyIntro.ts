import type { FieldCoord } from './skyProjection';

// The opening camera move of the night-sky field
// (docs/plans/2026-09-28-002-feat-living-sky-plan.md): while the welcome cue
// shows, the gaze starts low over the Negative horizon and rises to the
// still point overhead. Pure, so check:intro can prove it stays under the
// pan speed cap and lands exactly.

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
