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
  const [revealCenter, setRevealCenter] = useState<{ x: number; y: number } | null>(null);

  const isPressedRef = useRef(false);
  const revealCenterRef = useRef<{ x: number; y: number } | null>(null);
  const hasInteractedRef = useRef(hasInteracted);
  hasInteractedRef.current = hasInteracted;

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (size.width === 0 || size.height === 0) return;

      e.currentTarget.setPointerCapture(e.pointerId);

      const rect = containerRef.current!.getBoundingClientRect();
      const coord = pixelToCoord(e.clientX, e.clientY, rect, size.width, size.height);

      isPressedRef.current = true;
      revealCenterRef.current = coord;
      setIsPressed(true);
      setRevealCenter(coord);

      if (!hasInteractedRef.current) {
        onFirstInteraction?.();
      }
    },

    onPointerMove: (e: React.PointerEvent) => {
      if (!isPressedRef.current) return;

      const rect = containerRef.current!.getBoundingClientRect();
      const coord = pixelToCoord(e.clientX, e.clientY, rect, size.width, size.height);

      revealCenterRef.current = coord;
      setRevealCenter(coord);
    },

    onPointerUp: (_e: React.PointerEvent) => {
      onRelease(revealCenterRef.current!);
      isPressedRef.current = false;
      revealCenterRef.current = null;
      setIsPressed(false);
      setRevealCenter(null);
    },
  };

  return { isPressed, revealCenter, handlers };
}
