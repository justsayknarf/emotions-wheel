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
  /** Seconds for the axis emphasis to fade in/out (highlight ↔ resting). */
  axisFade: number;
  /**
   * Seconds after the axis emphasis begins (i.e. after the welcome text is
   * fully visible) before the guiding pulse starts on the vertical axis.
   */
  axisPulseDelay: number;
  /** Seconds between the vertical-axis pulse and the horizontal-axis pulse. */
  axisPulseStagger: number;
  /** Seconds for one axis-label pulse to rise and settle back. */
  axisPulseDuration: number;
  /** How strong the guiding pulse reads: scales its warm glow + brightness. 0 = off. */
  axisPulseStrength: number;
  /**
   * The check-in card's words re-resolve on a coordinate commit by dissolving:
   * the guess slots + tags fade out, hold a beat, then ease back in — a soft
   * re-suggestion rather than a snap. These three tune that transition (seconds).
   */
  captionFadeOut: number;
  captionFadeIn: number;
  /** The empty beat held between fade-out and fade-in — the "re-suggest" pause. */
  captionHold: number;
  /**
   * The departure connector (U6/R6): a soft glow that travels from the
   * previous check-in's anchor to the newly committed pin, leaving a
   * dissipating trail, then dissolves — shown once on commit. Chosen over an
   * arrow via a live canvas comparison (prototype:
   * wiki/concepts/emotion-selector/prototype-departure-pulse.html), tuned
   * live in that same comparison — not derived from first principles.
   */
  /** Seconds the glow takes to travel from the anchor to the pin. */
  departureTravel: number;
  /** Per-frame trail decay (0..1) — higher fades the streak faster/shorter. */
  departureTrail: number;
  /** Seconds the glow holds, steady, once it reaches the pin. */
  departureHold: number;
  /** Seconds the remaining glow takes to dissolve after the hold. */
  departureFadeOut: number;
  /** Glow intensity/size multiplier. */
  departureStrength: number;
  /**
   * U1 (desktop check-in focus): the field's whole-container recede
   * treatment — a scale + blur applied to the field's wrapper, driven by a
   * single `recedeProgress` (0 = focused, 1 = fully receded behind the
   * front-and-center card). Distinct from `recedeStrength` above, which
   * dims individual words while a card names a specific pair; this recedes
   * the entire field as one plane. U2-U5 drive `recedeProgress` itself —
   * these three only tune its target scale/blur and the base ease duration.
   */
  /** Scale factor at recedeProgress = 1 (1 = no shrink). */
  fieldRecedeScale: number;
  /** Blur radius (px) at recedeProgress = 1. */
  fieldRecedeBlur: number;
  /** Seconds for the base recede/return transition to ease. */
  fieldRecedeDuration: number;
  /**
   * U3 (desktop check-in focus, drag-triggered progressive transition): the
   * drag-progress fraction (0-1, see `departureDragProgress` in
   * src/data/departure.ts) a front-and-center card's slider drag must reach
   * before release/cancel settles the transition forward to focused/rail
   * rather than back to receded/centered. Distinct from the `fieldRecede*`
   * knobs above, which tune the recede treatment's own scale/blur/duration —
   * this only tunes the commit/revert decision itself.
   */
  focusDragCommitThreshold: number;
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
  axisFade: 1.2,
  axisPulseDelay: 1.1,
  axisPulseStagger: 1.0,
  axisPulseDuration: 2.2,
  axisPulseStrength: 0.025,
  captionFadeOut: 0.3,
  captionFadeIn: 0.6,
  captionHold: 0.05,
  // Frank's own tuning, live in the departure-pulse comparison prototype.
  departureTravel: 0.85,
  departureTrail: 0.050,
  departureHold: 1.40,
  departureFadeOut: 1.80,
  departureStrength: 0.40,
  fieldRecedeScale: 0.92,
  fieldRecedeBlur: 6,
  fieldRecedeDuration: 0.5,
  focusDragCommitThreshold: 0.5,
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
