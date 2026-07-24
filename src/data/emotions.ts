// Thin re-export of the active vocabulary framework. Consumers import
// `emotions`, the `Emotion`/`EmotionDepth` types, and `labelForId` from here
// exactly as before; which words they get is decided by the framework
// registry in ./frameworks.
import { activeFramework } from './frameworks';

export type { Emotion, EmotionDepth } from './frameworks/types';

export const emotions = activeFramework.emotions;

const emotionById = new Map(emotions.map((e) => [e.id, e]));

// Resolve an emotion id to its display label, falling back to the id itself.
export function labelForId(id: string): string {
  return emotionById.get(id)?.label ?? id;
}
