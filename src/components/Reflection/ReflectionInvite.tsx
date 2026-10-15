import type { CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FIELD_FONT } from '../EmotionField/EmotionWord';

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
      <p style={{ margin: 0, fontFamily: FIELD_FONT, fontStyle: 'italic', fontSize: 14, lineHeight: 1.45, color: 'var(--ui-text-1)' }}>
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

// The always-visible way into the walk: one line at the foot of the field,
// above "Negative", on every surface (lookBackPrompt decides when). Sentence
// case, a dotted underline and a clear gap from the axis label, so the two
// never read as one item; gold and warmer while the invitation is due, beside
// the louder surfaces that carry Later / Skip this week. The foot of the
// sky is also where the lake's descent will start.
export function LookBackPrompt({ state, onReflect }: { state: 'hidden' | 'quiet' | 'due'; onReflect: () => void }) {
  const reduce = useReducedMotion();
  const due = state === 'due';
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 58, display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 15 }}>
      <AnimatePresence>
        {state !== 'hidden' && (
          <motion.button
            key="look-back"
            type="button"
            onClick={onReflect}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
            style={{
              ...TEXT_BUTTON,
              fontWeight: 400,
              whiteSpace: 'nowrap',
              pointerEvents: 'auto',
              color: due ? 'var(--ui-gold)' : 'var(--ui-text-2)',
              textDecoration: 'underline dotted',
              textUnderlineOffset: 3,
              textShadow: '0 1px 10px rgb(var(--ui-bg-rgb) / 0.95)',
              transition: reduce ? 'none' : 'color 0.6s ease',
            }}
          >
            {due ? 'Your week is ready — look back' : 'Look back on your week'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
