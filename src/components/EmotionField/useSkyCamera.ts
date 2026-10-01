import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useReducedMotion } from 'framer-motion';
import { flatProjection, skyProjection, type FieldCoord, type FieldProjection, type SkyViewport } from '../../utils/skyProjection';
import { coastStart, initialCamera, isSettled, panLook, stepCamera, stepCoast, type CameraParams, type CameraState } from '../../utils/skyCamera';
import { introLook, type IntroSpec } from '../../utils/skyIntro';

// Steps the night-sky camera toward `target` on requestAnimationFrame and
// hands back the projection for this frame. Local to EmotionField on purpose:
// a camera frame re-renders the field only, never App. The loop sleeps once
// the camera settles and wakes when the target or lean changes.
//
// `viewport` is the part of the stage the viewer can see (the phone tray
// covers the bottom of it); omitted, the whole stage. When it changes — the
// tray peeks, expands, grows with a pin — the gaze's centre eases to the new
// band instead of jumping the whole sky.
//
// `intro` (read once at mount) is the opening pan: the gaze starts at
// `intro.from` and rises along introLook's eased curve, ignoring the spring,
// until it lands or `interruptRef` goes true (a field press or live draft),
// which ends the rise where it is. Either way the spring then glides from
// there to the normal target. Reduced motion skips it entirely.
//
// `pan` is drag-to-pan: while a drag holds the sky, the gaze follows the
// finger one-for-one, and on release it glides on with the finger's speed
// and slows to rest. The gaze then stays where the user left it until the
// target moves (a new pin, a slider drag, another pin selected), when the
// spring takes it back as usual.
const BAND_RATE = 5; // 1/s, exponential ease of the visible band's edges
export function useSkyCamera(opts: {
  enabled: boolean;
  target: FieldCoord;
  lean: boolean;
  params: CameraParams;
  size: { width: number; height: number };
  viewport?: SkyViewport | null;
  intro?: IntroSpec | null;
  interruptRef?: RefObject<boolean>;
}): { proj: FieldProjection; look: FieldCoord; fovDeg: number; pan: SkyPan } {
  const { enabled, target, lean, params, size, viewport = null, intro = null, interruptRef } = opts;
  const reduced = !!useReducedMotion();
  // Mount-only: later renders' arguments are ignored.
  // `elapsed` advances by the tick's capped dt, not wall-clock time, so a
  // main-thread stall (they cluster at load, exactly when the rise runs)
  // pauses the rise instead of jumping the sky under the viewer's finger.
  const introRef = useRef<{ spec: IntroSpec; elapsed: number; done: boolean } | null>(
    enabled && intro && !reduced ? { spec: intro, elapsed: 0, done: false } : null,
  );
  const [cam, setCam] = useState<CameraState>(() =>
    initialCamera(enabled && intro && !reduced ? intro.from : target, lean, params),
  );
  const camRef = useRef(cam);
  const targetRef = useRef(target);
  const prevTargetRef = useRef<FieldCoord | null>(null);
  // The previous tick's timestamp. Lives across effect restarts: the effect
  // restarts on every target change (each slider onDrag), and re-seeding the
  // clock there would hand the next tick a fraction of a frame, stalling the
  // spring and the fov ease for as long as the target keeps moving. Null
  // means the loop is asleep; only a wake seeds it.
  const lastRef = useRef<number | null>(null);
  // Set while the user holds the gaze (a drag-pan, its glide, and the rest
  // after it). `targetAt` is the target when the pan began: once the target
  // moves off it, the hold ends.
  const manualRef = useRef<{
    targetAt: FieldCoord;
    dragging: boolean;
    vel: FieldCoord | null;
    samples: Array<{ t: number; look: FieldCoord }>;
  } | null>(null);
  // Bumped to wake the loop when a pan lets go into a glide.
  const [wake, setWake] = useState(0);
  // Written in a layout effect rather than during render (react-hooks/refs);
  // layout effects run before the loop effect below, so its first tick
  // already reads this render's target.
  useLayoutEffect(() => {
    targetRef.current = target;
  });

  useEffect(() => {
    if (!enabled) {
      lastRef.current = null;
      return;
    }
    let raf = 0;
    if (lastRef.current === null) lastRef.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, now - (lastRef.current ?? now)) / 1000);
      lastRef.current = now;
      const ir = introRef.current;
      if (ir && !ir.done) {
        if (interruptRef?.current || reduced) {
          // A touch ends the rise where it is (R14); so does reduced motion
          // switching on mid-rise.
          ir.done = true;
        } else {
          ir.elapsed += dt;
          const { look, done } = introLook(ir.elapsed, ir.spec);
          const stepped = stepCamera(camRef.current, { target: targetRef.current, prevTarget: null, lean, reduced }, dt, params);
          const next = { look, vel: { x: 0, y: 0 }, fovDeg: stepped.fovDeg };
          camRef.current = next;
          setCam(next);
          prevTargetRef.current = null; // the hand-off never "carries" a jump
          if (done) ir.done = true;
          // Keep ticking whatever isSettled would say: the rise owns the gaze.
          raf = requestAnimationFrame(tick);
          return;
        }
        prevTargetRef.current = null;
      }
      const held = manualRef.current;
      if (held && (held.targetAt.x !== targetRef.current.x || held.targetAt.y !== targetRef.current.y)) {
        // The target moved: the spring takes the gaze back from where it is.
        manualRef.current = null;
        prevTargetRef.current = null;
      }
      const m = manualRef.current;
      if (m) {
        let look = camRef.current.look;
        if (m.vel) {
          const c = stepCoast(look, m.vel, dt, params);
          look = c.look;
          m.vel = c.done ? null : c.vel;
        }
        // The spring aimed at the gaze itself only eases the field of view.
        const fovDeg = stepCamera(camRef.current, { target: look, prevTarget: null, lean, reduced }, dt, params).fovDeg;
        const next = { look, vel: { x: 0, y: 0 }, fovDeg };
        camRef.current = next;
        setCam(next);
        prevTargetRef.current = targetRef.current;
        if (!m.vel && isSettled(next, look, lean, params)) lastRef.current = null;
        else raf = requestAnimationFrame(tick);
        return;
      }
      const next = stepCamera(camRef.current, { target: targetRef.current, prevTarget: prevTargetRef.current, lean, reduced }, dt, params);
      prevTargetRef.current = targetRef.current;
      camRef.current = next;
      setCam(next);
      if (isSettled(next, targetRef.current, lean, params)) lastRef.current = null;
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // target.x/y wake the loop; the loop itself reads targetRef.
  }, [enabled, target.x, target.y, lean, reduced, params, interruptRef, wake]);

  // The band's edges as insets from the stage's top and bottom, so a stage
  // resize applies at once while a band change eases.
  const goalTop = viewport ? viewport.top : 0;
  const goalBottom = viewport ? Math.max(0, size.height - viewport.top - viewport.height) : 0;
  const [inset, setInset] = useState({ top: goalTop, bottom: goalBottom });
  const insetRef = useRef(inset);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      const cur = insetRef.current;
      const k = reduced ? 1 : 1 - Math.exp(-dt * BAND_RATE);
      let top = cur.top + (goalTop - cur.top) * k;
      let bottom = cur.bottom + (goalBottom - cur.bottom) * k;
      if (Math.abs(goalTop - top) < 0.25) top = goalTop;
      if (Math.abs(goalBottom - bottom) < 0.25) bottom = goalBottom;
      const next = { top, bottom };
      insetRef.current = next;
      setInset(next);
      if (top !== goalTop || bottom !== goalBottom) raf = requestAnimationFrame(tick);
    };
    if (insetRef.current.top !== goalTop || insetRef.current.bottom !== goalBottom) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, goalTop, goalBottom, reduced]);

  const bandHeight = Math.max(1, size.height - inset.top - inset.bottom);
  const proj = useMemo(
    () => (enabled
      ? skyProjection({
        look: cam.look,
        fovDeg: cam.fovDeg,
        width: size.width,
        height: size.height,
        viewport: inset.top === 0 && inset.bottom === 0 ? undefined : { top: inset.top, height: bandHeight },
      })
      : flatProjection(size)),
    [enabled, cam.look, cam.fovDeg, size, inset.top, inset.bottom, bandHeight],
  );
  const projRef = useRef(proj);
  const paramsRef = useRef(params);
  const reducedRef = useRef(reduced);
  useLayoutEffect(() => {
    projRef.current = proj;
    paramsRef.current = params;
    reducedRef.current = reduced;
  });

  const [pan] = useState<SkyPan>(() => ({
    start: () => {
      if (introRef.current) introRef.current.done = true;
      manualRef.current = {
        targetAt: targetRef.current,
        dragging: true,
        vel: null,
        samples: [{ t: performance.now(), look: camRef.current.look }],
      };
    },
    move: (dxPx, dyPx) => {
      const m = manualRef.current;
      const F = projRef.current.frame?.F;
      if (!m || !m.dragging || !F) return;
      const look = panLook(camRef.current.look, dxPx, dyPx, F, paramsRef.current);
      const now = performance.now();
      m.samples.push({ t: now, look });
      while (m.samples.length > 2 && now - m.samples[0].t > PAN_SAMPLE_MS) m.samples.shift();
      const next = { look, vel: { x: 0, y: 0 }, fovDeg: camRef.current.fovDeg };
      camRef.current = next;
      setCam(next);
    },
    end: () => {
      const m = manualRef.current;
      if (!m || !m.dragging) return;
      m.dragging = false;
      // The finger's speed over its last few moves; a finger that stopped
      // before lifting leaves the sky where it is.
      const now = performance.now();
      const a = m.samples[0];
      const b = m.samples[m.samples.length - 1];
      const span = (b.t - a.t) / 1000;
      if (!reducedRef.current && span > 0.008 && now - b.t < PAN_STILL_MS) {
        m.vel = coastStart({ x: (b.look.x - a.look.x) / span, y: (b.look.y - a.look.y) / span }, paramsRef.current);
      }
      m.samples = [];
      setWake((w) => w + 1);
    },
  }));

  return { proj, look: cam.look, fovDeg: cam.fovDeg, pan };
}

// Velocity window for a drag-pan's release, and how long a finger may rest
// before lifting and still fling the sky.
const PAN_SAMPLE_MS = 100;
const PAN_STILL_MS = 60;

export interface SkyPan {
  start(): void;
  // A pointer move, in stage layout px.
  move(dxPx: number, dyPx: number): void;
  end(): void;
}
