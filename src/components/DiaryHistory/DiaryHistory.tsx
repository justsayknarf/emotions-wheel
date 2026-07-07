import { motion } from 'framer-motion';
import { DiaryEntryRow } from './DiaryEntryRow';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];
  onBack: () => void;
}

export function DiaryHistory({ entries, onBack }: Props) {
  const sorted = [...entries].reverse(); // newest first

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--oura-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '20px 20px 12px',
        borderBottom: '1px solid var(--oura-border)',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--oura-text-2)',
            fontSize: 13,
            cursor: 'pointer',
            padding: '6px 0',
            marginRight: 12,
            letterSpacing: '0.01em',
          }}
        >
          ← Back
        </button>
        <h1 style={{
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--oura-gold-dim)',
          margin: 0,
        }}>
          Check-in history
        </h1>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', touchAction: 'pan-y' }}>
        {sorted.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '60%',
              textAlign: 'center',
              gap: 16,
            }}
          >
            <p style={{ fontSize: 15, color: 'var(--oura-text-3)', margin: 0, fontWeight: 300 }}>
              No check-ins yet.
            </p>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: '1px solid var(--oura-border)',
                borderRadius: 6,
                color: 'var(--oura-gold)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              Start your first check-in
            </button>
          </motion.div>
        ) : (
          sorted.map((entry) => (
            <DiaryEntryRow key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
