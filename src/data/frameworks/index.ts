import type { Framework } from './types';
import { circumplexCustom } from './circumplex-custom';

export type { Emotion, EmotionDepth, Framework } from './types';

// Registry of every available vocabulary framework, keyed by id.
export const frameworks: Record<string, Framework> = {
  [circumplexCustom.id]: circumplexCustom,
};

// The framework currently driving the field. A constant for now —
// a runtime switcher is deferred to follow-up work.
export const activeFrameworkId = 'circumplex-custom';

export const activeFramework: Framework = frameworks[activeFrameworkId];
