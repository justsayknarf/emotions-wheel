import { useRef, useState } from 'react';

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

  const isPressedRef = useRef(false);
  const isHoveringRef = useRef(false);
  const revealCenterRef = useRef<{ x: number; y: number } | null>(null);
  const hasInteractedRef = useRef(hasInteracted);
  hasInteractedRef.current = hasInteracted;

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

      fireFirstInteraction();
    },

    onPointerMove: (e: React.PointerEvent) => {
      // Mouse: always track (hover + press); touch: only while pressed
      if (e.pointerType === 'touch' && !isPressedRef.current) return;

      const coord = getCoord(e);
      if (!coord) return;

      revealCenterRef.current = coord;
      setRevealCenter(coord);
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
      }
    },
  };

  const isRevealed = isPressed || isHovering;
  return { isPressed, isRevealed, revealCenter, handlers };
}
