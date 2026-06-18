import { useRef } from 'react';
import { useDrag } from '@use-gesture/react';
import { emotions } from '../data/emotions';
import { euclideanDist, SELECTION_RADIUS } from './useProximity';
import type { SelectedEmotion } from '../types';

const DRAG_SCALE = 0.2;
const TAP_MAX_MOVEMENT = 0.015; // in coordinate space (≈ 8px at typical screen)

interface Options {
  pinX: number;
  pinY: number;
  setPinX: (x: number) => void;
  setPinY: (y: number) => void;
  selectedEmotions: SelectedEmotion[];
  onSelectionChange: (emotions: SelectedEmotion[]) => void;
  containerRef: React.RefObject<HTMLElement | null>;
  onFirstInteraction?: () => void;
  hasInteracted: boolean;
}

function clamp(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

// Convert pixel delta to coordinate delta given container dimensions
function pixelToCoord(px: number, containerPx: number): number {
  // Container maps [5%, 95%] → [-1, 1], so 90% of container = 2 coord units
  return (px / (containerPx * 0.9)) * 2;
}

export function useGesturePin({
  pinX,
  pinY,
  setPinX,
  setPinY,
  selectedEmotions,
  onSelectionChange,
  containerRef,
  onFirstInteraction,
  hasInteracted,
}: Options) {
  const startCoordRef = useRef({ x: pinX, y: pinY });
  const accumulatedRef = useRef({ x: pinX, y: pinY });
  const interactedRef = useRef(hasInteracted);
  interactedRef.current = hasInteracted;

  const bind = useDrag(
    ({ first, delta: [dx, dy], movement: [mx, my], tap, memo }) => {
      const container = containerRef.current;
      const w = container?.clientWidth ?? 375;
      const h = container?.clientHeight ?? 667;

      if (first) {
        if (!interactedRef.current) onFirstInteraction?.();
        startCoordRef.current = { x: pinX, y: pinY };
        accumulatedRef.current = { x: pinX, y: pinY };
        return { startX: pinX, startY: pinY };
      }

      if (tap) {
        // Convert pixel movement to coordinate movement for tap detection
        const movedCoord = Math.sqrt(
          pixelToCoord(mx, w) ** 2 + pixelToCoord(my, h) ** 2,
        );

        if (movedCoord < TAP_MAX_MOVEMENT) {
          // Find nearest emotion within SELECTION_RADIUS
          let nearest: (typeof emotions)[0] | null = null;
          let nearestDist = Infinity;

          for (const em of emotions) {
            const d = euclideanDist(em.x, em.y, pinX, pinY);
            if (d < SELECTION_RADIUS && d < nearestDist) {
              nearest = em;
              nearestDist = d;
            }
          }

          if (nearest) {
            const alreadySelected = selectedEmotions.some((e) => e.id === nearest!.id);
            if (alreadySelected) {
              onSelectionChange(selectedEmotions.filter((e) => e.id !== nearest!.id));
            } else {
              onSelectionChange([
                ...selectedEmotions,
                { id: nearest.id, label: nearest.label, x: nearest.x, y: nearest.y, cluster: nearest.cluster },
              ]);
            }
          }
        }
        return memo;
      }

      // Drag: scale delta and add to last pin position
      const coordDx = pixelToCoord(dx, w) * DRAG_SCALE;
      const coordDy = pixelToCoord(dy, h) * DRAG_SCALE;

      accumulatedRef.current = {
        x: clamp(accumulatedRef.current.x + coordDx),
        y: clamp(accumulatedRef.current.y - coordDy), // invert Y: drag down → lower arousal
      };

      setPinX(accumulatedRef.current.x);
      setPinY(accumulatedRef.current.y);

      return memo;
    },
    {
      filterTaps: false,
      threshold: 0,
      pointer: { touch: true },
    },
  );

  return bind;
}
