import { emotions } from './emotions';
import { getRegionDescription } from './regions';
import type { PinEntry } from '../types';

// Pure pin transforms, kept beside regions.ts so App and the check script share
// one source of truth for how a pin is stamped and adjusted.

/**
 * Stamp a freshly dropped pin's origin — the coordinate it was first placed at.
 * x/y stays the authoritative record; origin is secondary metadata (the field
 * anchor + history) and is never overwritten by later adjustments. Idempotent:
 * a pin that already carries an origin keeps it.
 */
export function withOrigin(entry: PinEntry): PinEntry {
  return { ...entry, origin: entry.origin ?? { x: entry.x, y: entry.y } };
}

/**
 * Move a pin to a new coordinate and refresh its description. regionDescription
 * is a stored snapshot, so it must be recomputed here or the card goes stale.
 * origin and recognizedWords are deliberately preserved.
 */
export function adjustPin(pin: PinEntry, x: number, y: number): PinEntry {
  return { ...pin, x, y, regionDescription: getRegionDescription(x, y, emotions) };
}
