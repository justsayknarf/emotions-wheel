import { useEffect, useState } from 'react';

// Live-tunable knobs for the radial-fan reveal. Persisted to localStorage so
// the admin page can drive them; the field subscribes and re-reads on change.
// Because the `storage` event fires in *other* tabs, tuning in the admin tab
// updates the field open in a second tab/window in real time.

export interface RevealTuning {
  /** Multiplies the fan arc width (spread of the labels around the focus). */
  arcScale: number;
  /** Minimum ring radius (px) labels are seated on. */
  ringBase: number;
  /** Extra ring radius (px) beyond the farthest revealed dot. */
  ringGap: number;
  /** Total tether draw + hold + fade time (seconds). */
  tetherDuration: number;
  /** Per-word draw delay (seconds) — nearer words draw first. */
  staggerStep: number;
  /** Keep tethers on screen instead of fading them after the draw. */
  keepTethers: boolean;
}

export const DEFAULT_TUNING: RevealTuning = {
  arcScale: 1,
  ringBase: 48,
  ringGap: 16,
  tetherDuration: 1.5,
  staggerStep: 0.07,
  keepTethers: false,
};

const KEY = 'reveal-tuning';
const EVENT = 'reveal-tuning-change';

export function loadTuning(): RevealTuning {
  if (typeof localStorage === 'undefined') return DEFAULT_TUNING;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_TUNING;
    return { ...DEFAULT_TUNING, ...(JSON.parse(raw) as Partial<RevealTuning>) };
  } catch {
    return DEFAULT_TUNING;
  }
}

export function saveTuning(t: RevealTuning): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
    // Notify listeners in *this* tab (storage events only fire in other tabs).
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // localStorage unavailable — tuning stays at its in-memory value.
  }
}

/** Subscribe to the persisted tuning, updating on same-tab and cross-tab change. */
export function useRevealTuning(): RevealTuning {
  const [tuning, setTuning] = useState<RevealTuning>(loadTuning);
  useEffect(() => {
    const refresh = () => setTuning(loadTuning());
    window.addEventListener('storage', refresh);
    window.addEventListener(EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(EVENT, refresh);
    };
  }, []);
  return tuning;
}
