import { useRef, useState } from 'react';
import { VISIBILITY_RADIUS } from './useProximity';

const DWELL_DELAY_MS = 1200;
const DWELL_RESET_THRESHOLD = 0.04;
// Mirrors useGesturePin.ts's TAP_MAX_MOVEMENT — below this, a press-release is
// a tap (place/select a pin, no drag), not a drag worth peeking the tray for.
const GESTURE_MOVEMENT_THRESHOLD = 0.015; // in coordinate space (≈ 8px at typical screen)

interface Options {
  containerRef: React.RefObject<HTMLElement | null>;
  size: { width: number; height: number };
  onRelease: (center: { x: number; y: number }) => void;
  onFirstInteraction?: () => void;
  hasInteracted: boolean;
  // Fires once a press crosses the movement threshold (a real drag, not a
  // tap), and again with `false` on release or cancel. Optional — callers
  // that don't care about the tap/drag distinction can omit it.
  onGestureActiveChange?: (active: boolean) => void;
}

function pixelToCoord(
  px: number,
  py: number,
  rect: DOMRect,
  W: number,
  H: number,
): { x: number; y: number } {
  const relX = px - rect.left;
  const relY = py - rect.top;
  const coordX = ((relX / W - 0.05) / 0.9) * 2 - 1;
  const coordY = -(((relY / H - 0.05) / 0.9) * 2 - 1);
  return { x: coordX, y: coordY };
}

export function useFieldGesture({
  containerRef,
  size,
  onRelease,
  onFirstInteraction,
  hasInteracted,
  onGestureActiveChange,
}: Options) {
  const [isPressed, setIsPressed] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [revealCenter, setRevealCenter] = useState<{ x: number; y: number } | null>(null);
  const [dwellCenter, setDwellCenter] = useState<{ x: number; y: number } | null>(null);

  const isPressedRef = useRef(false);
  const isHoveringRef = useRef(false);
  const revealCenterRef = useRef<{ x: number; y: number } | null>(null);
  const hasInteractedRef = useRef(hasInteracted);
  hasInteractedRef.current = hasInteracted;
  // Press-start coordinate, held steady (unlike revealCenterRef, which tracks
  // the live position) so movement since press-start can be measured.
  const pressStartCoordRef = useRef<{ x: number; y: number } | null>(null);
  // Whether this press has already crossed the movement threshold and fired
  // onGestureActiveChange(true) — guards against firing it more than once per
  // press, and tells release/cancel whether a matching `false` is owed.
  const gestureActiveRef = useRef(false);

  function endGestureActive() {
    if (gestureActiveRef.current) {
      gestureActiveRef.current = false;
      onGestureActiveChange?.(false);
    }
  }

  const dwellTimerRef = useRef<number | null>(null);
  const lastStablePosRef = useRef<{ x: number; y: number } | null>(null);
  const dwellCenterRef = useRef<{ x: number; y: number } | null>(null);

  function clearDwellTimer() {
    if (dwellTimerRef.current !== null) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }

  function startDwellTimer(pos: { x: number; y: number }) {
    clearDwellTimer();
    lastStablePosRef.current = pos;
    dwellTimerRef.current = window.setTimeout(() => {
      const center = { ...lastStablePosRef.current! };
      dwellCenterRef.current = center;
      setDwellCenter(center);
      dwellTimerRef.current = null;
    }, DWELL_DELAY_MS);
  }

  function clearDwell() {
    clearDwellTimer();
    dwellCenterRef.current = null;
    setDwellCenter(null);
    lastStablePosRef.current = null;
  }

  function getCoord(e: React.PointerEvent) {
    if (size.width === 0 || size.height === 0) return null;
    const rect = containerRef.current!.getBoundingClientRect();
    return pixelToCoord(e.clientX, e.clientY, rect, size.width, size.height);
  }

  function fireFirstInteraction() {
    if (!hasInteractedRef.current) onFirstInteraction?.();
  }

  const handlers = {
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return;
      isHoveringRef.current = true;
      setIsHovering(true);
      const coord = getCoord(e);
      if (coord) {
        revealCenterRef.current = coord;
        setRevealCenter(coord);
        if (!isPressedRef.current) startDwellTimer(coord);
      }
      fireFirstInteraction();
    },

    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return;
      isHoveringRef.current = false;
      setIsHovering(false);
      if (!isPressedRef.current) {
        revealCenterRef.current = null;
        setRevealCenter(null);
      }
      clearDwell();
    },

    onPointerDown: (e: React.PointerEvent) => {
      if (size.width === 0 || size.height === 0) return;

      e.currentTarget.setPointerCapture(e.pointerId);

      const coord = getCoord(e);
      if (!coord) return;

      isPressedRef.current = true;
      revealCenterRef.current = coord;
      pressStartCoordRef.current = coord;
      gestureActiveRef.current = false;
      setIsPressed(true);
      setRevealCenter(coord);
      clearDwell();

      fireFirstInteraction();
    },

    onPointerMove: (e: React.PointerEvent) => {
      // Mouse: always track (hover + press); touch: only while pressed
      if (e.pointerType === 'touch' && !isPressedRef.current) return;

      const coord = getCoord(e);
      if (!coord) return;

      revealCenterRef.current = coord;
      setRevealCenter(coord);

      // Once a press moves past the tap threshold, it's a real drag — fire
      // onGestureActiveChange(true) exactly once per press (R14: a plain tap
      // never triggers this, so it never visibly peeks-then-restores).
      if (isPressedRef.current && !gestureActiveRef.current && pressStartCoordRef.current) {
        const start = pressStartCoordRef.current;
        const moved = Math.sqrt((coord.x - start.x) ** 2 + (coord.y - start.y) ** 2);
        if (moved >= GESTURE_MOVEMENT_THRESHOLD) {
          gestureActiveRef.current = true;
          onGestureActiveChange?.(true);
        }
      }

      // Dwell tracking — only during hover, not during drag
      if (!isPressedRef.current) {
        const activeDwell = dwellCenterRef.current;
        if (activeDwell) {
          // Dwell is active — keep it until cursor leaves the reveal radius
          const dist = Math.sqrt((coord.x - activeDwell.x) ** 2 + (coord.y - activeDwell.y) ** 2);
          if (dist > VISIBILITY_RADIUS) {
            clearDwell();
            startDwellTimer(coord);
          }
        } else {
          // No active dwell — track stable position to start the timer
          const lastPos = lastStablePosRef.current;
          if (lastPos) {
            const dist = Math.sqrt((coord.x - lastPos.x) ** 2 + (coord.y - lastPos.y) ** 2);
            if (dist > DWELL_RESET_THRESHOLD) {
              startDwellTimer(coord);
            }
          } else {
            startDwellTimer(coord);
          }
        }
      }
    },

    onPointerUp: (_e: React.PointerEvent) => {
      if (!isPressedRef.current) return;
      onRelease(revealCenterRef.current!);
      isPressedRef.current = false;
      pressStartCoordRef.current = null;
      // Deliberately does NOT call onGestureActiveChange(false) here — the
      // caller's onRelease (above) already decides the post-release tray
      // state itself (R5: re-expand on a new pin; R6: stay peeked on
      // selecting an existing one), and firing it here would run after and
      // clobber a same-tick re-expand. Just reset the internal flag so the
      // next press starts clean; onPointerCancel (below) is the only path
      // that restores the tray on this hook's own initiative, since a
      // cancelled gesture never reaches onRelease at all.
      gestureActiveRef.current = false;
      setIsPressed(false);
      // Keep revealCenter alive if mouse is still hovering over the field
      if (!isHoveringRef.current) {
        revealCenterRef.current = null;
        setRevealCenter(null);
      } else {
        // Restart dwell timer from current position after drag ends
        const pos = revealCenterRef.current;
        if (pos) startDwellTimer(pos);
      }
    },

    onPointerCancel: () => {
      if (!isPressedRef.current) return;
      // The browser took the gesture away mid-press (OS gesture, notification,
      // palm on glass) — the same interruption class AxisSlider already
      // handles. No release ever fires, so nothing commits/selects; just
      // reset press state and let endGestureActive() restore the tray if it
      // had been peeked for this gesture.
      isPressedRef.current = false;
      pressStartCoordRef.current = null;
      endGestureActive();
      setIsPressed(false);
      if (!isHoveringRef.current) {
        revealCenterRef.current = null;
        setRevealCenter(null);
      }
    },
  };

  const isRevealed = isPressed || isHovering;
  return { isPressed, isRevealed, revealCenter, dwellCenter, handlers };
}
