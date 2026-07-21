import type { Framework } from './types';
import { circumplexCustom } from './circumplex-custom';
import { radialIntensity } from './radial-intensity';

export type { Emotion, EmotionDepth, Framework } from './types';

// Registry of every available vocabulary framework, keyed by id.
export const frameworks: Record<string, Framework> = {
  [circumplexCustom.id]: circumplexCustom,
  [radialIntensity.id]: radialIntensity,
};

// The framework currently driving the field. A constant for now —
// a runtime switcher is deferred to follow-up work.
export const activeFrameworkId = 'radial-intensity';

export const activeFramework: Framework = frameworks[activeFrameworkId];
