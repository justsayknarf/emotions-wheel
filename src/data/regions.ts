import { VISIBILITY_RADIUS } from '../hooks/useProximity';
import type { Emotion } from './emotions';
import type { RegionDescription } from '../types';

// 9-zone narrative lookup: [arousal band][valence band]
// Arousal bands: 0 = low (x < -0.33), 1 = moderate, 2 = high (x > 0.33)
// Valence bands: 0 = negative (y < -0.33), 1 = neutral, 2 = positive (y > 0.33)
const NARRATIVE: Record<number, Record<number, string>> = {
  2: { 0: 'stirred up, on edge',      1: 'activated, restless',  2: 'energized, bright'   },
  1: { 0: 'unsettled, a little heavy', 1: 'present, steady',      2: 'warm, at ease'       },
  0: { 0: 'flat, withdrawn',           1: 'quiet, settled',       2: 'calm, content'       },
};

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

function arousalBand(x: number): number {
  if (x > 0.33) return 2;
  if (x < -0.33) return 0;
  return 1;
}

function valenceBand(y: number): number {
  if (y > 0.33) return 2;
  if (y < -0.33) return 0;
  return 1;
}

export function getRegionDescription(
  x: number,
  y: number,
  emotions: Emotion[],
): RegionDescription {
  // Collect up to 2 nearest words within VISIBILITY_RADIUS, sorted by distance
  const nearby: Array<{ label: string; dist: number }> = [];
  for (const em of emotions) {
    const d = euclidean(x, y, em.x, em.y);
    if (d <= VISIBILITY_RADIUS) {
      nearby.push({ label: em.label, dist: d });
    }
  }
  nearby.sort((a, b) => a.dist - b.dist);
  const top = nearby.slice(0, 2);

  let relational: string;
  if (top.length >= 2) {
    relational = `between *${top[0].label}* and *${top[1].label}*`;
  } else if (top.length === 1) {
    relational = `near *${top[0].label}*`;
  } else {
    // Axis-based fallback when no words are in range
    const arousalWord = x > 0.33 ? 'activated' : x < -0.33 ? 'calm' : 'in between';
    const valenceWord = y > 0.33 ? 'positive' : y < -0.33 ? 'negative' : 'neutral';
    relational = `${arousalWord}, ${valenceWord}`;
  }

  const narrative = NARRATIVE[arousalBand(x)][valenceBand(y)];

  return { relational, narrative };
}
