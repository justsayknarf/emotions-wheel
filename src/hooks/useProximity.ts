import { useMemo } from 'react';
import type { Emotion } from '../data/emotions';

export const VISIBILITY_RADIUS = 0.35;
export const SELECTION_RADIUS = 0.15;
export const APPROACH_RADIUS = SELECTION_RADIUS + 0.05;

export interface ProximityResult {
  opacity: number;
  scale: number;
  isApproaching: boolean;
}

function euclidean(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function useProximity(
  emotions: Emotion[],
  pinX: number,
  pinY: number,
  selectedIds: Set<string>,
): Map<string, ProximityResult> {
  return useMemo(() => {
    const results = new Map<string, ProximityResult>();

    for (const emotion of emotions) {
      const dist = euclidean(emotion.x, emotion.y, pinX, pinY);
      const isSelected = selectedIds.has(emotion.id);
      const isApproaching = !isSelected && dist <= APPROACH_RADIUS;

      if (isSelected) {
        // Selected words always visible regardless of pin position
        results.set(emotion.id, { opacity: 1, scale: 1, isApproaching: false });
      } else if (dist > VISIBILITY_RADIUS) {
        results.set(emotion.id, { opacity: 0, scale: 0.8, isApproaching: false });
      } else {
        // Interpolate: dist=VISIBILITY_RADIUS → opacity=0, scale=0.8; dist=0 → opacity=1, scale=1.1
        const t = 1 - dist / VISIBILITY_RADIUS; // 0 at edge, 1 at center
        const opacity = t;
        const scale = 0.8 + t * 0.3; // 0.8 → 1.1
        results.set(emotion.id, { opacity, scale, isApproaching });
      }
    }

    return results;
  }, [emotions, pinX, pinY, selectedIds]);
}

export function euclideanDist(
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  return euclidean(x1, y1, x2, y2);
}
