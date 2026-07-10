import { AnimatePresence, motion } from 'framer-motion';
import { labelForId } from '../../data/emotions';
import { formatDate } from '../../utils/formatDate';
import { MiniCircumplex } from './MiniCircumplex';
import type { DiaryEntry } from '../../types';

interface Props {
  entry: DiaryEntry | null;
  onDismiss: () => void;
}

export function SessionDetailCard({ entry, onDismiss }: Props) {
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
              background: 'var(--oura-surface)',
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
                color: 'var(--oura-text-3)',
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
                  color: 'var(--oura-text-2)',
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
                    color: 'var(--oura-text-2)',
                    margin: 0,
                    lineHeight: 1.5,
                    fontWeight: 300,
                  }}>
                    {entry.pins[0].regionDescription.relational.replace(/\*/g, '')}
                  </p>
                )}
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
        <span
          key={label}
          style={{
            fontSize: 11,
            color: 'var(--oura-text-1)',
            background: 'rgba(201,168,124,0.12)',
            border: '1px solid rgba(201,168,124,0.25)',
            borderRadius: 5,
            padding: '3px 8px',
            letterSpacing: '0.03em',
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
