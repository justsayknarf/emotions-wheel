import { useMemo } from 'react';
import type { Emotion } from '../data/emotions';

export const VISIBILITY_RADIUS = 0.35;
export const SELECTION_RADIUS = 0.15;
export const APPROACH_RADIUS = SELECTION_RADIUS + 0.05;
// Max deep words revealed per source (dwell center or pin) — nearest first
export const DEEP_REVEAL_CAP = 6;

export interface ProximityResult {
  opacity: number;
  scale: number;
  isCandidate: boolean;
}

function euclidean(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function useProximity(
  emotions: Emotion[],
  revealCenter: { x: number; y: number } | null,
  isPressed: boolean,
  selectedIds: Set<string>,
): Map<string, ProximityResult> {
  return useMemo(() => {
    // Pre-pass: find candidateId (closest emotion within VISIBILITY_RADIUS when pressed)
    let candidateId: string | null = null;
    if (isPressed && revealCenter !== null) {
      let minDist = Infinity;
      for (const emotion of emotions) {
        const dist = euclidean(emotion.x, emotion.y, revealCenter.x, revealCenter.y);
        if (dist <= VISIBILITY_RADIUS && dist < minDist) {
          minDist = dist;
          candidateId = emotion.id;
        }
      }
    }

    // Per-emotion pass
    const results = new Map<string, ProximityResult>();

    for (const emotion of emotions) {
      // Branch 1: selected — always fully visible, never a candidate
      if (selectedIds.has(emotion.id)) {
        results.set(emotion.id, { opacity: 1, scale: 1, isCandidate: false });
        continue;
      }

      // Branch 2: not pressed or no reveal center — ambient floor
      if (!isPressed || revealCenter === null) {
        results.set(emotion.id, { opacity: 0.05, scale: 1.0, isCandidate: false });
        continue;
      }

      const dist = euclidean(emotion.x, emotion.y, revealCenter.x, revealCenter.y);

      // Branch 3: outside visibility radius — ambient floor
      if (dist > VISIBILITY_RADIUS) {
        results.set(emotion.id, { opacity: 0.05, scale: 1.0, isCandidate: false });
        continue;
      }

      // Branch 4: within visibility radius — interpolate
      const t = 1 - dist / VISIBILITY_RADIUS; // 0 at edge, 1 at center
      const opacity = 0.05 + t * 0.95;        // 0.05 → 1.0
      const scale = 1.0 + t * 0.1;            // 1.0 → 1.1
      results.set(emotion.id, { opacity, scale, isCandidate: emotion.id === candidateId });
    }

    return results;
  }, [emotions, revealCenter, isPressed, selectedIds]);
}

export function euclideanDist(
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  return euclidean(x1, y1, x2, y2);
}
