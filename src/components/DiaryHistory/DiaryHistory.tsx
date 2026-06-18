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
        background: '#111111',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '20px 20px 12px',
        borderBottom: '1px solid rgba(232, 224, 216, 0.08)',
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(232, 224, 216, 0.5)',
            fontSize: 14,
            cursor: 'pointer',
            padding: '6px 0',
            marginRight: 12,
          }}
        >
          ← Back
        </button>
        <h1 style={{
          fontSize: 17,
          fontWeight: 500,
          color: 'rgba(232, 224, 216, 0.9)',
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
            <p style={{ fontSize: 15, color: 'rgba(232, 224, 216, 0.4)', margin: 0 }}>
              No check-ins yet.
            </p>
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#fbbf24',
                fontSize: 14,
                cursor: 'pointer',
                textDecoration: 'underline',
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
