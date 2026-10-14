import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { JournalNotice, NoteField } from '../Journal/NoteEditor';
import { FIELD_FONT } from '../EmotionField/EmotionWord';

// The weekly reflection walk's cards (docs/plans/2026-10-09-001-feat-weekly-
// reflection-journal-plan.md, U4): the opening card shown when the walk comes
// from an invitation, one card per moment, and the closing card.

const CAPTION: CSSProperties = {
  display: 'block',
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: 'var(--ui-text-3)',
};

const HEADING: CSSProperties = {
  margin: '6px 0 0',
  fontFamily: FIELD_FONT,
  fontWeight: 400,
  fontSize: 19,
  lineHeight: 1.35,
  color: 'var(--ui-text-1)',
  outline: 'none',
};

// 44px tall, quiet: a filled primary and a text secondary. The primary has a
// floor on its width, so Skip, Next and Done are the same size.
function WalkButton({ children, onClick, primary = false }: { children: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: 44,
        minWidth: primary ? 88 : undefined,
        padding: '0 18px',
        borderRadius: 10,
        border: primary ? '1px solid rgb(var(--ui-gold-rgb) / 0.45)' : '1px solid transparent',
        background: primary ? 'rgb(var(--ui-gold-rgb) / 0.12)' : 'none',
        color: primary ? 'var(--ui-gold)' : 'var(--ui-text-2)',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '0.02em',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>{children}</div>;
}

// A moment or closing card fills the card panel, so its StepActions can sit
// at the panel's foot.
const STEP_CARD: CSSProperties = { display: 'flex', flexDirection: 'column', flex: '1 0 auto' };

// The walk's step row: a quieter action on the left when there is one, the
// forward action pinned to the right, and the row pinned to the foot of the
// card panel. Next / Skip / Done never move from card to card, however long
// a prompt runs and whether or not the left action is showing.
function StepRow({ left, children }: { left: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 18 }}>
      {left ?? <span aria-hidden="true" />}
      {children}
    </div>
  );
}

function StepActions({ onBack, children }: { onBack: (() => void) | null; children: ReactNode }) {
  return <StepRow left={onBack ? <WalkButton onClick={onBack}>Back</WalkButton> : null}>{children}</StepRow>;
}

// Move focus to the card's heading whenever `focusKey` changes, so keyboard
// and screen-reader users land on each new card. preventScroll keeps the
// sky from jumping.
function useHeadingFocus(focusKey: string | number) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [focusKey]);
  return ref;
}

export function OpeningCard({ onBegin, onLater, onSkipWeek }: { onBegin: () => void; onLater: () => void; onSkipWeek: () => void }) {
  const heading = useHeadingFocus('opening');
  return (
    <div>
      <span style={CAPTION}>Your week</span>
      <h2 ref={heading} tabIndex={-1} style={HEADING}>
        Look back at the last seven days, as they happened.
      </h2>
      <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--ui-text-2)' }}>
        A few moments, a question at each. Write as little as you like, or nothing at all.
      </p>
      <Actions>
        <WalkButton primary onClick={onBegin}>Begin</WalkButton>
        <WalkButton onClick={onLater}>Later</WalkButton>
        <WalkButton onClick={onSkipWeek}>Skip this week</WalkButton>
      </Actions>
    </div>
  );
}

export function ReplayingCard({ stop, total, hint, onNext, onSkip }: {
  /** The check-in in view, or -1 before the first arrives. */
  stop: number;
  total: number;
  hint: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  const heading = useHeadingFocus('replaying');
  return (
    <div style={STEP_CARD}>
      <span style={CAPTION} aria-live="polite">{stop >= 0 ? `Your week · ${stop + 1} of ${total}` : 'Your week'}</span>
      <h2 ref={heading} tabIndex={-1} style={HEADING}>
        Step through your week, or let it play.
      </h2>
      <p style={{ margin: '10px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--ui-text-3)' }}>{hint}</p>
      <StepRow
        left={
          <button
            type="button"
            onClick={onSkip}
            style={{ minHeight: 44, background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--ui-text-3)', cursor: 'pointer' }}
          >
            Skip to the moments
          </button>
        }
      >
        <WalkButton primary onClick={onNext}>Next</WalkButton>
      </StepRow>
    </div>
  );
}

interface MomentProps {
  index: number;
  total: number;
  when: string;
  prompt: string;
  thenNote: string | null;
  draft: string;
  onDraft: (value: string) => void;
  onBack: (() => void) | null;
  onForward: () => void;
  failed: boolean;
}

export function MomentCard({ index, total, when, prompt, thenNote, draft, onDraft, onBack, onForward, failed }: MomentProps) {
  const heading = useHeadingFocus(index);
  return (
    <div style={STEP_CARD}>
      <span style={CAPTION}>{`${index + 1} of ${total}`}</span>
      <h2 ref={heading} tabIndex={-1} style={{ ...HEADING, fontSize: 13, fontFamily: 'inherit', color: 'var(--ui-text-2)', letterSpacing: '0.02em' }}>
        {when}
      </h2>

      {thenNote && (
        <div style={{ marginTop: 12, paddingLeft: 10, borderLeft: '1px solid var(--ui-recorded-dim)' }}>
          <span style={CAPTION}>You wrote then</span>
          <p style={{ margin: '4px 0 0', fontFamily: FIELD_FONT, fontSize: 13.5, lineHeight: 1.5, color: 'var(--ui-text-2)', whiteSpace: 'pre-wrap' }}>
            {thenNote}
          </p>
        </div>
      )}

      <p aria-live="polite" style={{ margin: '14px 0 14px', fontFamily: FIELD_FONT, fontSize: 18, lineHeight: 1.4, color: 'var(--ui-text-1)' }}>
        {prompt}
      </p>

      <NoteField value={draft} onChange={onDraft} label="Looking back" placeholder="A line is plenty." />
      {/* Keyed by moment: the card stays mounted across moments, and the
          notice reads its seen flag on mount, so a note saved on one moment
          hides it from the next. */}
      <JournalNotice key={index} />
      {failed && (
        <p role="alert" style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--ui-text-2)' }}>
          Couldn't save that note.
        </p>
      )}

      <StepActions onBack={onBack}>
        <WalkButton primary onClick={onForward}>{draft.trim() ? 'Next' : 'Skip'}</WalkButton>
      </StepActions>
    </div>
  );
}

interface ClosingProps {
  openLine: string;
  onOpenLine: (value: string) => void;
  weekName: string;
  onWeekName: (value: string) => void;
  onBack: (() => void) | null;
  onDone: () => void;
  /** The last Done couldn't save the reflection; the walk stays open to try again. */
  failed: boolean;
}

export function ClosingCard({ openLine, onOpenLine, weekName, onWeekName, onBack, onDone, failed }: ClosingProps) {
  const heading = useHeadingFocus('closing');
  return (
    <div style={STEP_CARD}>
      <span style={CAPTION}>The whole week</span>
      <h2 ref={heading} tabIndex={-1} style={HEADING}>
        Anything you noticed?
      </h2>
      <div style={{ marginTop: 14 }}>
        <NoteField value={openLine} onChange={onOpenLine} label="What stood out" placeholder="Optional." />
      </div>
      {/* A question of its own, as large as "Anything you noticed?": a small
          caption read as a label and left people unsure what the field was for. */}
      <label style={{ ...HEADING, display: 'block', margin: '26px 0 10px' }} htmlFor="reflection-week-name">
        What would you call this week?
      </label>
      <input
        id="reflection-week-name"
        value={weekName}
        onChange={(e) => onWeekName(e.target.value)}
        placeholder="Optional, like “the long one”"
        maxLength={60}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          minHeight: 40,
          padding: '8px 11px',
          borderRadius: 8,
          border: '1px solid var(--ui-border)',
          background: 'rgb(var(--ui-bg-rgb) / 0.45)',
          color: 'var(--ui-text-1)',
          fontFamily: FIELD_FONT,
          fontSize: 14,
        }}
      />
      {failed && (
        <p role="alert" style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--ui-text-2)' }}>
          Couldn't save this week.
        </p>
      )}
      <StepActions onBack={onBack}>
        <WalkButton primary onClick={onDone}>Done</WalkButton>
      </StepActions>
    </div>
  );
}

export function EmptyWeekCard({ onClose }: { onClose: () => void }) {
  const heading = useHeadingFocus('empty');
  return (
    <div>
      <h2 ref={heading} tabIndex={-1} style={HEADING}>
        Nothing recorded this week yet.
      </h2>
      <Actions>
        <WalkButton onClick={onClose}>Close</WalkButton>
      </Actions>
    </div>
  );
}
