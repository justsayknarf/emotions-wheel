import { useState } from 'react';
import { emotions } from '../../data/emotions';
import { nearbyEmotions } from '../../data/regions';
import { MiniCircumplex } from '../DiaryHistory/MiniCircumplex';
import type { PinEntry } from '../../types';

// Matches CoordinateCard.tsx's own FIELD_SERIF — this surface is for
// recording a feeling, not reading data — same warm serif as the field's
// own words and every other caption in this app.
const FIELD_SERIF = "'Palatino', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

// How many nearby words to offer as suggestions, at most.
const SUGGESTION_COUNT = 3;

interface Props {
  pin: PinEntry;
  // Accept a suggestion — writes through to the saved entry (App.tsx's
  // handleRecognizeSaved). Dismissing is local-only and never reaches
  // this prop.
  onRecognize: (emotionId: string) => void;
  // "Add tags" — reopens the existing full slider + tag editor, same
  // mechanism a returning user's own reopen already uses.
  onReopen: () => void;
  // Disables the "Add tags" control while a different draft already has
  // pins — same guard the ordinary read-only CoordinateCard's own Reopen
  // button gets (reopenDisabled={canSave}). Without it, reopening while a
  // separate draft is in progress would silently no-op (handleReopen's
  // own defensive `if (pins.length > 0) return;`), and this card's rail
  // placement (hideHistory never hides it there) makes that reachable.
  reopenDisabled?: boolean;
}

// docs/plans/2026-09-04-002-feat-saved-checkin-confirmation-card-plan.md,
// U4: the just-saved entry's confirmation card — a read-only mini-map
// (reusing MiniCircumplex, gold dot and all; see the plan's own KTD on why
// it isn't forked to match this card's recorded-blue language instead —
// showAxes is its one opt-in addition, since a single unfamiliar instance
// here needs its axes legible at a glance, unlike the dense diary-history
// grid that component was originally built for),
// plus a few nearby-word suggestions the user can accept or dismiss
// (Linear-style proposed labels on an already-saved record). Rendered by
// EmotionDrawer in place of the ordinary read-only CoordinateCard only
// while this entry is the just-saved one — every other previous check-in
// keeps rendering that ordinary card, unchanged.
export function SavedCheckInSummary({ pin, onRecognize, onReopen, reopenDisabled = false }: Props) {
  // Seeded once per mount (the caller keys this component by the pin's id
  // AND coordinate, so a new saved entry — or the same entry's pin moved
  // via a reopen — gets a fresh candidate list rather than this one being
  // recomputed as chips resolve) — a dismissed chip is removed from this
  // fixed list, not backfilled from a 4th candidate.
  const [candidates] = useState(() => nearbyEmotions(pin.x, pin.y, emotions, SUGGESTION_COUNT));
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = candidates.filter((c) => !dismissed.has(c.id));

  const dismiss = (id: string) => setDismissed((prev) => new Set(prev).add(id));

  return (
    <div
      style={{
        padding: '10px 14px 14px',
        display: 'flex',
        gap: 14,
        // Matches CoordinateCard's own outer shell (background, radius,
        // and — per the same recent change there — an always-visible
        // recordedDim border rather than one that only appears once
        // something is selected). This card had neither before, and read
        // as unbounded content floating on the rail rather than its own
        // card; giving it the identical treatment keeps every card in
        // this list built from one shell, not two.
        background: 'var(--ui-surface)',
        border: '1px solid var(--ui-recorded-dim)',
        borderRadius: 12,
      }}
    >
      <MiniCircumplex pins={[pin]} size={72} showAxes />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: '2px 0 10px',
            fontFamily: FIELD_SERIF,
            fontStyle: 'italic',
            fontSize: 13.5,
            lineHeight: 1.5,
            color: 'var(--ui-text-2)',
          }}
        >
          {pin.regionDescription.relational}
        </p>

        {visible.length > 0 && (
          <>
            {/* "Do any of these fit, too?" — matches CoordinateCard's own
                "Does X or Y fit?" question voice rather than inventing a
                third caption register alongside it and the plain
                "between X and Y" line above. */}
            <span
              style={{
                display: 'block',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
                color: 'var(--ui-text-3)',
                marginBottom: 8,
              }}
            >
              Do any of these fit, too?
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
              {visible.map((c) => {
                const accepted = pin.recognizedWords.includes(c.id);
                return (
                  <span
                    key={c.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: accepted ? '4px 10px 4px 12px' : '4px 5px 4px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      color: accepted ? 'var(--ui-recorded)' : 'var(--ui-text-2)',
                      background: accepted ? 'rgba(124,147,168,0.18)' : 'transparent',
                      border: accepted ? '1px solid var(--ui-recorded-dim)' : '1px dashed var(--ui-recorded-dim)',
                    }}
                  >
                    {c.label.toLowerCase()}
                    {!accepted && (
                      <>
                        <button
                          onClick={() => onRecognize(c.id)}
                          aria-label={`Name this ${c.label.toLowerCase()}`}
                          style={{
                            width: 16, height: 16, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, cursor: 'pointer', flexShrink: 0,
                            border: '1px solid var(--ui-border)',
                            background: 'transparent', color: 'var(--ui-text-3)',
                          }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => dismiss(c.id)}
                          aria-label={`Dismiss ${c.label.toLowerCase()}`}
                          style={{
                            width: 16, height: 16, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 8, cursor: 'pointer', flexShrink: 0,
                            border: '1px solid var(--ui-border)',
                            background: 'transparent', color: 'var(--ui-text-3)',
                          }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={onReopen}
          disabled={reopenDisabled}
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: 11, fontWeight: 500, letterSpacing: '0.03em',
            color: 'var(--ui-text-3)',
            cursor: reopenDisabled ? 'default' : 'pointer',
            opacity: reopenDisabled ? 0.5 : 1,
            borderBottom: reopenDisabled ? 'none' : '1px dotted var(--ui-text-3)',
            paddingBottom: 1,
          }}
        >
          + Add tags
        </button>
      </div>
    </div>
  );
}
