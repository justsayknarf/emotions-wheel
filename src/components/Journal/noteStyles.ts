import type { CSSProperties } from 'react';

// Shared by the journal's note controls and the reflection walk.

// Matches the field's own words and every other caption (CoordinateCard.tsx).
export const FIELD_SERIF = "'Palatino', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

// The same quiet dotted-underline text button as SavedCheckInSummary's
// "+ Add tags", so the two read as one family.
export const QUIET_BUTTON: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: '6px 0 1px',
  minHeight: 32,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.03em',
  color: 'var(--ui-text-3)',
  cursor: 'pointer',
  textDecoration: 'underline dotted',
  textUnderlineOffset: 3,
};
