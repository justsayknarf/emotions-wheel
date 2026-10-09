import { AnimatePresence, motion } from 'framer-motion';
import { labelForId } from '../../data/emotions';
import { WordTag } from '../EmotionPreview/WordTag';
import { formatDate } from '../../utils/formatDate';
import { MiniCircumplex } from './MiniCircumplex';
import { NoteEditor } from '../Journal/NoteEditor';
import { atTimeNote, lookingBackNotes } from '../../data/journal';
import type { DiaryEntry } from '../../types';

// Journal note writes (docs/plans/2026-10-09-001-feat-weekly-reflection-
// journal-plan.md, U3). Each returns whether the write landed. Without them
// the card shows no note controls.
export interface NoteWrites {
  onSetAtTimeNote?: (entryId: string, text: string) => boolean;
  onSetLookingBackNote?: (entryId: string, walkId: string, text: string) => boolean;
}

interface Props extends NoteWrites {
  entry: DiaryEntry | null;
  onDismiss: () => void;
}

export function SessionDetailCard({ entry, onDismiss, onSetAtTimeNote, onSetLookingBackNote }: Props) {
  return (
    <AnimatePresence>
      {entry && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(12,14,18,0.7)',
              zIndex: 10,
            }}
          />

          {/* Card — bottom sheet */}
          <motion.div
            key="card"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--ui-surface)',
              borderRadius: '16px 16px 0 0',
              padding: '20px 20px 32px',
              zIndex: 11,
              touchAction: 'pan-y',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{
                fontSize: 10,
                color: 'var(--ui-text-3)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}>
                {formatDate(entry.timestamp)}
              </span>
              <button
                onClick={onDismiss}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ui-text-2)',
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: '0 0 2px',
                }}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <MiniCircumplex pins={entry.pins} />

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Words (R13: omit row when no recognized words) */}
                <WordRow entry={entry} />

                {/* Region description */}
                {entry.pins.length > 0 && (
                  <p style={{
                    fontSize: 13,
                    color: 'var(--ui-text-2)',
                    margin: 0,
                    lineHeight: 1.5,
                    fontWeight: 300,
                  }}>
                    {entry.pins[0].regionDescription.relational.replace(/\*/g, '')}
                  </p>
                )}

                <Notes entry={entry} onSetAtTimeNote={onSetAtTimeNote} onSetLookingBackNote={onSetLookingBackNote} />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function WordRow({ entry }: { entry: DiaryEntry }) {
  const ids = [...new Set(entry.pins.flatMap(p => p.recognizedWords))];
  const labels = ids.map(labelForId).filter(Boolean);
  if (labels.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
      {labels.map(label => (
        <WordTag key={label} label={label} named />
      ))}
    </div>
  );
}

// At-the-time note first, then looking-back notes oldest first, each labelled
// with the date it was written (a note from a walk left early has no recorded
// reflection to take a date from). Both kinds can be edited or cleared.
function Notes({ entry, onSetAtTimeNote, onSetLookingBackNote }: { entry: DiaryEntry } & NoteWrites) {
  const atTime = atTimeNote(entry);
  const lookingBack = lookingBackNotes(entry);
  if (!onSetAtTimeNote && !atTime && lookingBack.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
      {onSetAtTimeNote ? (
        <NoteEditor
          key={`${entry.id}-at-time`}
          note={atTime?.text ?? ''}
          onSave={(text) => onSetAtTimeNote(entry.id, text)}
          label="A note on this check-in"
          caption="At the time"
          placeholder="What's going on?"
        />
      ) : atTime && (
        <ReadOnlyNote caption="At the time" text={atTime.text} />
      )}
      {lookingBack.map((n) =>
        onSetLookingBackNote && n.walkId ? (
          <NoteEditor
            key={n.id}
            note={n.text}
            onSave={(text) => onSetLookingBackNote(entry.id, n.walkId!, text)}
            label="A note looking back"
            caption={`Looking back · ${shortDate(n.writtenAt)}`}
          />
        ) : (
          <ReadOnlyNote key={n.id} caption={`Looking back · ${shortDate(n.writtenAt)}`} text={n.text} />
        ),
      )}
    </div>
  );
}

function ReadOnlyNote({ caption, text }: { caption: string; text: string }) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--ui-text-3)', marginBottom: 4 }}>
        {caption}
      </span>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: 'var(--ui-text-1)', whiteSpace: 'pre-wrap' }}>{text}</p>
    </div>
  );
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
