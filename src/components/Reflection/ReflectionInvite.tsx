import type { CSSProperties } from 'react';
import { FIELD_SERIF } from '../Journal/noteStyles';

// The weekly reflection's invitation (docs/plans/2026-10-09-001-feat-weekly-
// reflection-journal-plan.md, U5, KTD12). Quiet by design: the check-in stays
// the primary action on every surface it shares. 'card' sits at the top of
// the web rail/sheet with all three choices; 'link' is the single line beside
// the new-tab sliders, whose Later / Skip this week live on the walk's
// opening card instead (KTD17).

export interface InviteActions {
  onReflect: () => void;
  onLater: () => void;
  onSkipWeek: () => void;
}

const TEXT_BUTTON: CSSProperties = {
  minHeight: 44,
  background: 'none',
  border: 'none',
  padding: '0 2px',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.02em',
  cursor: 'pointer',
};

export function ReflectionInviteCard({ onReflect, onLater, onSkipWeek }: InviteActions) {
  return (
    <section
      aria-label="Look back on your week"
      style={{
        padding: '12px 14px 4px',
        borderRadius: 12,
        background: 'var(--ui-surface)',
        border: '1px solid rgb(var(--ui-gold-rgb) / 0.22)',
      }}
    >
      <p style={{ margin: 0, fontFamily: FIELD_SERIF, fontStyle: 'italic', fontSize: 14, lineHeight: 1.45, color: 'var(--ui-text-1)' }}>
        A week of check-ins. Look back at it?
      </p>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <button type="button" onClick={onReflect} style={{ ...TEXT_BUTTON, color: 'var(--ui-gold)' }}>
          Look back
        </button>
        <button type="button" onClick={onLater} style={{ ...TEXT_BUTTON, color: 'var(--ui-text-3)' }}>
          Later
        </button>
        <button type="button" onClick={onSkipWeek} style={{ ...TEXT_BUTTON, color: 'var(--ui-text-3)' }}>
          Skip this week
        </button>
      </div>
    </section>
  );
}

export function ReflectionInviteLink({ onReflect }: { onReflect: () => void }) {
  return (
    <button
      type="button"
      onClick={onReflect}
      style={{
        ...TEXT_BUTTON,
        alignSelf: 'center',
        color: 'var(--ui-text-3)',
        textDecoration: 'underline dotted',
        textUnderlineOffset: 3,
      }}
    >
      Look back on your week
    </button>
  );
}
