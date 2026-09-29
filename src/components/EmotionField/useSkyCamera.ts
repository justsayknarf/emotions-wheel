import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { flatProjection, skyProjection, type FieldCoord, type FieldProjection, type SkyViewport } from '../../utils/skyProjection';
import { initialCamera, isSettled, stepCamera, type CameraParams, type CameraState } from '../../utils/skyCamera';

// Steps the night-sky camera toward `target` on requestAnimationFrame and
// hands back the projection for this frame. Local to EmotionField on purpose:
// a camera frame re-renders the field only, never App. The loop sleeps once
// the camera settles and wakes when the target or lean changes.
//
// `viewport` is the part of the stage the viewer can see (the phone tray
// covers the bottom of it); omitted, the whole stage. When it changes — the
// tray peeks, expands, grows with a pin — the gaze's centre eases to the new
// band instead of jumping the whole sky.
const BAND_RATE = 5; // 1/s, exponential ease of the visible band's edges
export function useSkyCamera(opts: {
  enabled: boolean;
  target: FieldCoord;
  lean: boolean;
  params: CameraParams;
  size: { width: number; height: number };
  viewport?: SkyViewport | null;
}): { proj: FieldProjection; look: FieldCoord; fovDeg: number } {
  const { enabled, target, lean, params, size, viewport = null } = opts;
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
  return { proj, look: cam.look, fovDeg: cam.fovDeg };
}
