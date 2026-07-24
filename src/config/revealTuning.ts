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
  /** Draw a tether at all. When false, revealed words just appear in place. */
  showTethers: boolean;
  /** Keep tethers on screen instead of fading them after the draw. */
  keepTethers: boolean;
  /** How many nearest emotions to prompt as tags when recording a check-in. */
  tagCount: number;
  /**
   * How firmly the field recedes everyone *except* the card's two named
   * emotions while a check-in card is selected. 0 = off (nothing recedes);
   * 1 = maximum. A built-in floor keeps receded words legible even at 1, so
   * the surrounding context — and the meaning of "the closest two" — is never
   * lost. Applied to revealed deep words only; surface landmarks stay put.
   */
  recedeStrength: number;
}

export const DEFAULT_TUNING: RevealTuning = {
  arcScale: 1,
  ringBase: 48,
  ringGap: 16,
  tetherDuration: 1.5,
  staggerStep: 0.07,
  showTethers: true,
  keepTethers: false,
  tagCount: 6,
  recedeStrength: 0.55,
};

const KEY = 'reveal-tuning';
const EVENT = 'reveal-tuning-change';

// Accept a persisted value only when it matches the default's type (and, for
// numbers, is finite). A wrong-typed or NaN knob would otherwise flow into the
// fan geometry and animation and make revealed labels vanish. Unknown/invalid
// fields fall back to the default.
function sanitize(parsed: unknown): RevealTuning {
  const out: Record<string, unknown> = { ...DEFAULT_TUNING };
  if (parsed && typeof parsed === 'object') {
    const src = parsed as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_TUNING) as Array<keyof RevealTuning>) {
      const dv = DEFAULT_TUNING[key];
      const pv = src[key];
      if (typeof dv === 'number' && typeof pv === 'number' && Number.isFinite(pv)) {
        out[key] = pv;
      } else if (typeof dv === 'boolean' && typeof pv === 'boolean') {
        out[key] = pv;
      }
    }
  }
  return out as unknown as RevealTuning;
}

export function loadTuning(): RevealTuning {
  if (typeof localStorage === 'undefined') return DEFAULT_TUNING;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_TUNING;
    return sanitize(JSON.parse(raw));
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
