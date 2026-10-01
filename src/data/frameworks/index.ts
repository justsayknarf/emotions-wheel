import type { Framework } from './types';
import { circumplexCustom } from './circumplex-custom';
import { radialIntensity } from './radial-intensity';

export type { Emotion, EmotionDepth, Framework } from './types';

// Registry of every available vocabulary framework, keyed by id.
export const frameworks: Record<string, Framework> = {
  [circumplexCustom.id]: circumplexCustom,
  [radialIntensity.id]: radialIntensity,
};

// The vocabulary the app ships with.
export const DEFAULT_FRAMEWORK_ID = 'radial-intensity';

// The admin page's vocabulary switcher saves its choice here (same pattern as
// the theme in src/config/theme.ts). It is read once, at module load: the
// field partitions its words when its modules load, so a change takes effect
// on reload — src/main.tsx reloads open app tabs when the key changes.
export const VOCABULARY_STORAGE_KEY = 'constellation-vocabulary';

// A saved id if it names a registered framework, else the default.
export function resolveFrameworkId(raw: string | null | undefined): string {
  return raw && Object.prototype.hasOwnProperty.call(frameworks, raw) ? raw : DEFAULT_FRAMEWORK_ID;
}

function readSavedFrameworkId(): string | null {
  // No localStorage under the Node check scripts, or when storage is blocked.
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(VOCABULARY_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveFrameworkId(id: string): void {
  try {
    if (id === DEFAULT_FRAMEWORK_ID) localStorage.removeItem(VOCABULARY_STORAGE_KEY);
    else localStorage.setItem(VOCABULARY_STORAGE_KEY, resolveFrameworkId(id));
  } catch {
    // Storage unavailable: the choice can't persist, so nothing changes.
  }
}

// The framework currently driving the field.
export const activeFrameworkId = resolveFrameworkId(readSavedFrameworkId());

const active = frameworks[activeFrameworkId];
if (!active) {
  throw new Error(
    `activeFrameworkId "${activeFrameworkId}" is not registered in the framework registry.`,
  );
}
export const activeFramework: Framework = active;
