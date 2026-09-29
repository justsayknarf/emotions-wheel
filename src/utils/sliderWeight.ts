// Weighted AxisSlider motion (docs/plans/2026-09-28-001-feat-night-sky-field-plan.md).
// Grabbing the thumb pulls it toward the pointer at a capped speed that
// tightens as it heads outward; tapping the track further away flies it there
// on an eased curve. Values are field units in [-1, 1].

export interface SliderWeight {
  speed: number;         // field units/s near the middle
  edge: number;          // 0..1, how much outward speed drops at the ends
  gain: number;          // 1/s, proportional pull before the speed cap bites
  grabPx: number;        // a press this close to the thumb grabs it
  flightBase: number;    // seconds, the shortest flight
  flightPerUnit: number; // seconds added per field unit travelled
}

// `weight` is the single Light(0) - Heavy(1) knob from the tuning page.
export function sliderWeightFrom(weight: number, grabPx = 24, flightBase = 0.6, flightPerUnit = 0.35): SliderWeight {
  return { speed: 1 - 0.8 * weight, edge: 0.75, gain: 3.5, grabPx, flightBase, flightPerUnit };
}

export function stepWeighted(v: number, target: number, dt: number, w: SliderWeight): number {
  const d = target - v;
  // Snap once within ~0.2px on a phone-width track, so a held-still thumb
  // stops reporting sub-pixel steps within a moment of reaching the pointer.
  if (Math.abs(d) < 1e-3) return target;
  const outward = Math.sign(d) === Math.sign(v) ? Math.abs(v) : 0;
  const vmax = w.speed * (1 - w.edge * outward * outward) * dt;
  return v + Math.max(-vmax, Math.min(vmax, d * w.gain * dt));
}

export function isGrab(pointerX: number, thumbX: number, grabPx: number): boolean {
  return Math.abs(pointerX - thumbX) <= grabPx;
}

export function flightDuration(from: number, to: number, w: SliderWeight): number {
  return w.flightBase + w.flightPerUnit * Math.abs(to - from);
}

export function easeInOut(k: number): number {
  const c = Math.max(0, Math.min(1, k));
  return 0.5 - 0.5 * Math.cos(Math.PI * c);
}

export function flightValue(from: number, to: number, elapsed: number, duration: number): number {
  return from + (to - from) * easeInOut(elapsed / duration);
}
