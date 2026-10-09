import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { markJournalNoticeSeen, readJournalNoticeSeen } from '../../store/reflections';
import { QUIET_BUTTON } from './noteStyles';
import { FIELD_FONT } from '../EmotionField/EmotionWord';

// The private journal's note controls (docs/plans/2026-10-09-001-feat-weekly-
// reflection-journal-plan.md, U3). NoteField is the bare autosizing textarea,
// shared with the reflection walk, which commits on Next/Back rather than a
// Save button. NoteEditor wraps it for the saved check-in card and History's
// entry detail: collapsed affordance → editing → saved, with an explicit Save.

// Scroll only the nearest scrolling list (the rail, the mobile sheet's card
// list) so a just-opened field is in view. scrollIntoView would also scroll
// App's overflow-hidden root, which is why focus uses preventScroll.
function revealInScroller(el: HTMLElement) {
  let scroller = el.parentElement;
  while (scroller) {
    const { overflowY } = getComputedStyle(scroller);
    if ((overflowY === 'auto' || overflowY === 'scroll') && scroller.scrollHeight > scroller.clientHeight) break;
    scroller = scroller.parentElement;
  }
  if (!scroller) return;
  const box = scroller.getBoundingClientRect();
  const target = el.getBoundingClientRect();
  if (target.bottom > box.bottom) scroller.scrollTop += target.bottom - box.bottom + 12;
  else if (target.top < box.top) scroller.scrollTop -= box.top - target.top + 12;
}

interface FieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

/** Autosizing textarea with a visible label. */
export function NoteField({ value, onChange, label, placeholder, autoFocus, onKeyDown }: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // Focus without scrolling: the plain autoFocus attribute scrolls every
  // overflow-hidden ancestor to reveal the field, which shoved App's whole
  // root container up by most of a screen. The field opens where its
  // affordance was, so it is already in view.
  useEffect(() => {
    const el = ref.current;
    if (!autoFocus || !el) return;
    el.focus({ preventScroll: true });
    // Editing an existing note: continue from its end, not its start.
    el.setSelectionRange(el.value.length, el.value.length);
    revealInScroller(el.parentElement ?? el);
    // Mount-only: focus once when the field opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.13em',
          textTransform: 'uppercase',
          color: 'var(--ui-text-3)',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        value={value}
        rows={2}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          resize: 'none',
          overflow: 'hidden',
          padding: '9px 11px',
          borderRadius: 8,
          border: '1px solid var(--ui-border)',
          background: 'rgb(var(--ui-bg-rgb) / 0.45)',
          color: 'var(--ui-text-1)',
          fontFamily: FIELD_FONT,
          fontSize: 14,
          lineHeight: 1.5,
        }}
      />
    </div>
  );
}

/**
 * The one-time line about where the journal lives (R6). Shown under a note
 * field until the user has saved their first note anywhere.
 */
export function JournalNotice() {
  const [seen] = useState(() => readJournalNoticeSeen());
  if (seen) return null;
  return (
    <p style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.5, color: 'var(--ui-text-3)' }}>
      Notes stay in this browser. Clearing browser data erases them, so export from History to keep a copy.
    </p>
  );
}

interface EditorProps {
  /** The saved note's text, or '' when there is none. */
  note: string;
  /** Write the note (blank clears it). Returns whether the write landed. */
  onSave: (text: string) => boolean;
  label: string;
  addLabel?: string;
  placeholder?: string;
  /** Small caption above saved text, e.g. "Looking back · Oct 9". */
  caption?: string;
}

/**
 * Collapsed "+ Add a note" → editing (Save / Cancel; Escape cancels) →
 * saved (text with a quiet Edit). Blur leaves a draft open and unsaved.
 */
export function NoteEditor({ note, onSave, label, addLabel = '+ Add a note', placeholder, caption }: EditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [failed, setFailed] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  // After leaving edit mode, hand focus back to the control that opened it.
  useEffect(() => {
    if (!editing && returnFocus.current) {
      returnFocus.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  const open = () => {
    setDraft(note);
    setFailed(false);
    setEditing(true);
  };
  const cancel = () => {
    returnFocus.current = true;
    setFailed(false);
    setEditing(false);
  };
  const save = () => {
    if (!onSave(draft)) {
      setFailed(true);
      return;
    }
    if (draft.trim()) markJournalNoticeSeen();
    returnFocus.current = true;
    setFailed(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <NoteField
          value={draft}
          onChange={setDraft}
          label={label}
          placeholder={placeholder}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              cancel();
            }
          }}
        />
        {failed && (
          <p role="alert" style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--ui-text-2)' }}>
            Couldn't save that note.
          </p>
        )}
        <JournalNotice />
        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
          <button type="button" onClick={save} style={{ ...QUIET_BUTTON, color: 'var(--ui-text-2)' }}>
            Save
          </button>
          <button type="button" onClick={cancel} style={QUIET_BUTTON}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <button ref={editButtonRef} type="button" onClick={open} style={QUIET_BUTTON}>
        {addLabel}
      </button>
    );
  }

  return (
    <div>
      <SavedNote caption={caption} text={note} />
      <button ref={editButtonRef} type="button" onClick={open} style={QUIET_BUTTON} aria-label={`Edit ${label.toLowerCase()}`}>
        Edit
      </button>
    </div>
  );
}

/** A saved note as text, with an optional small caption above it. */
export function SavedNote({ caption, text }: { caption?: string; text: string }) {
  return (
    <div>
      {caption && (
        <span
          style={{
            display: 'block',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: 'var(--ui-text-3)',
            marginBottom: 4,
          }}
        >
          {caption}
        </span>
      )}
      <p
        style={{
          margin: 0,
          fontFamily: FIELD_FONT,
          fontSize: 13.5,
          lineHeight: 1.5,
          color: 'var(--ui-text-1)',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </p>
    </div>
  );
}
