import { RMAX, ZEN_SPAN, type FieldCoord } from './skyProjection';

// The sky field's camera (docs/plans/2026-09-28-001-feat-night-sky-field-plan.md).
// Continuous target motion (a weighted drag, a flight) carries the gaze
// one-for-one; whatever offset remains closes on a critically damped spring
// with a speed ceiling, so a jump glides and never lurches or overshoots.

export interface CameraState {
  look: FieldCoord;
  vel: FieldCoord;
  fovDeg: number;
}

export interface CameraParams {
  lookMax: number;      // field units from the zenith the gaze may tilt
  omega: number;        // spring stiffness, 1/s
  maxDegPerSec: number; // pan speed ceiling for the spring, degrees of sky/s
  carryStep: number;    // a per-frame target move at or under this is "continuous"
  fovRest: number;      // degrees across the larger stage dimension
  fovLean: number;      // narrower field of view while a draft pin exists
  fovRate: number;      // 1/s, exponential ease of the field of view
}

export const DEFAULT_CAMERA_PARAMS: CameraParams = {
  lookMax: 1.2,
  omega: 1.6,
  maxDegPerSec: 25,
  carryStep: 0.12,
  fovRest: 84,
  fovLean: 64,
  fovRate: 0.9,
};

export function clampLook(c: FieldCoord, max: number): FieldCoord {
  const r = Math.hypot(c.x, c.y);
  return r > max ? { x: (c.x * max) / r, y: (c.y * max) / r } : { x: c.x, y: c.y };
}

// Degrees of sky -> field units, via the zenith-span mapping in skyProjection.
export function degToField(deg: number): number {
  return ((deg * Math.PI) / 180) * (RMAX / ZEN_SPAN);
}

export function initialCamera(target: FieldCoord, lean: boolean, p: CameraParams): CameraState {
  return { look: clampLook(target, p.lookMax), vel: { x: 0, y: 0 }, fovDeg: lean ? p.fovLean : p.fovRest };
}

export function stepCamera(
  s: CameraState,
  input: { target: FieldCoord; prevTarget: FieldCoord | null; lean: boolean; reduced: boolean },
  dt: number,
  p: CameraParams,
): CameraState {
  const fovGoal = input.lean ? p.fovLean : p.fovRest;
  const goal = clampLook(input.target, p.lookMax);
  if (input.reduced) return { look: goal, vel: { x: 0, y: 0 }, fovDeg: fovGoal };

  let look = s.look;
  if (input.prevTarget) {
    const dx = input.target.x - input.prevTarget.x;
    const dy = input.target.y - input.prevTarget.y;
    if (Math.hypot(dx, dy) <= p.carryStep) look = clampLook({ x: look.x + dx, y: look.y + dy }, p.lookMax);
  }

  const w = p.omega;
  let vx = s.vel.x + (w * w * (goal.x - look.x) - 2 * w * s.vel.x) * dt;
  let vy = s.vel.y + (w * w * (goal.y - look.y) - 2 * w * s.vel.y) * dt;
  const vmax = degToField(p.maxDegPerSec);
  const sp = Math.hypot(vx, vy);
  if (sp > vmax) { vx *= vmax / sp; vy *= vmax / sp; }

  let next = { x: look.x + vx * dt, y: look.y + vy * dt };
  // Never pass the goal: if this step crossed it, land on it and stop.
  if ((goal.x - next.x) * (goal.x - look.x) + (goal.y - next.y) * (goal.y - look.y) < 0) {
    next = goal; vx = 0; vy = 0;
  }
  const fovDeg = s.fovDeg + (fovGoal - s.fovDeg) * (1 - Math.exp(-dt * p.fovRate));
  return { look: next, vel: { x: vx, y: vy }, fovDeg };
}

// True once nothing would visibly move, so the animation loop can sleep.
export function isSettled(s: CameraState, target: FieldCoord, lean: boolean, p: CameraParams): boolean {
  const goal = clampLook(target, p.lookMax);
  return (
    Math.hypot(goal.x - s.look.x, goal.y - s.look.y) < 1e-3 &&
    Math.hypot(s.vel.x, s.vel.y) < 1e-3 &&
    Math.abs((lean ? p.fovLean : p.fovRest) - s.fovDeg) < 0.05
  );
}

// Where the gaze should rest: the thing the user is moving, else the thing
// they're looking at, else where they were last time, else straight up.
export function cameraTarget(opts: {
  liveDraft: FieldCoord | null;
  emphasizedPin: FieldCoord | null;
  newestDraftPin: FieldCoord | null;
  recordedAnchor: FieldCoord | null;
}): FieldCoord {
  return opts.liveDraft ?? opts.emphasizedPin ?? opts.newestDraftPin ?? opts.recordedAnchor ?? { x: 0, y: 0 };
}
