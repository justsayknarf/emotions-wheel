import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { flatProjection, skyProjection, type FieldCoord, type FieldProjection } from '../../utils/skyProjection';
import { initialCamera, isSettled, stepCamera, type CameraParams, type CameraState } from '../../utils/skyCamera';

// Steps the night-sky camera toward `target` on requestAnimationFrame and
// hands back the projection for this frame. Local to EmotionField on purpose:
// a camera frame re-renders the field only, never App. The loop sleeps once
// the camera settles and wakes when the target or lean changes.
export function useSkyCamera(opts: {
  enabled: boolean;
  target: FieldCoord;
  lean: boolean;
  params: CameraParams;
  size: { width: number; height: number };
}): { proj: FieldProjection; look: FieldCoord; fovDeg: number } {
  const { enabled, target, lean, params, size } = opts;
  const reduced = !!useReducedMotion();
  const [cam, setCam] = useState<CameraState>(() => initialCamera(target, lean, params));
  const camRef = useRef(cam);
  const targetRef = useRef(target);
  const prevTargetRef = useRef<FieldCoord | null>(null);
  // The previous tick's timestamp. Lives across effect restarts: the effect
  // restarts on every target change (each slider onDrag), and re-seeding the
  // clock there would hand the next tick a fraction of a frame, stalling the
  // spring and the fov ease for as long as the target keeps moving. Null
  // means the loop is asleep; only a wake seeds it.
  const lastRef = useRef<number | null>(null);
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
  }, [enabled, target.x, target.y, lean, reduced, params]);

  const proj = useMemo(
    () => (enabled ? skyProjection({ look: cam.look, fovDeg: cam.fovDeg, width: size.width, height: size.height }) : flatProjection(size)),
    [enabled, cam.look, cam.fovDeg, size],
  );
  return { proj, look: cam.look, fovDeg: cam.fovDeg };
}
