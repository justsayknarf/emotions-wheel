import type { Framework } from './types';
import { circumplexCustom } from './circumplex-custom';
import { radialIntensity } from './radial-intensity';
import { radialSpread } from './radial-spread';
import { radialClustered } from './radial-clustered';
import { radialOrganic } from './radial-organic';

export type { Emotion, EmotionDepth, Framework } from './types';

// Registry of every available vocabulary framework, keyed by id.
export const frameworks: Record<string, Framework> = {
  [circumplexCustom.id]: circumplexCustom,
  [radialIntensity.id]: radialIntensity,
  [radialSpread.id]: radialSpread,
  [radialClustered.id]: radialClustered,
  [radialOrganic.id]: radialOrganic,
};

// The framework currently driving the field. A constant for now —
// a runtime switcher is deferred to follow-up work.
export const activeFrameworkId = 'radial-organic';

// Dev-only preview: ?framework=<id> swaps the vocabulary for one load, so a
// proposed layout can be seen in the real field before it is adopted.
// Typed loosely because this module is also compiled for the node scripts.
const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV;
const search = (globalThis as { location?: { search: string } }).location?.search;
const previewId = isDev && search ? new URLSearchParams(search).get('framework') : null;

const active = (previewId && frameworks[previewId]) || frameworks[activeFrameworkId];
if (!active) {
  throw new Error(
    `activeFrameworkId "${activeFrameworkId}" is not registered in the framework registry.`,
  );
}
export const activeFramework: Framework = active;
