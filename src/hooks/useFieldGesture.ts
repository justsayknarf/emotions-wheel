import { useRef, useState } from 'react';
import { VISIBILITY_RADIUS } from './useProximity';

const DWELL_DELAY_MS = 1200;
const DWELL_RESET_THRESHOLD = 0.04;

interface Options {
  containerRef: React.RefObject<HTMLElement | null>;
  size: { width: number; height: number };
  onRelease: (center: { x: number; y: number }) => void;
  onFirstInteraction?: () => void;
  hasInteracted: boolean;
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
  };

  const isRevealed = isPressed || isHovering;
  return { isPressed, isRevealed, revealCenter, dwellCenter, handlers };
}
