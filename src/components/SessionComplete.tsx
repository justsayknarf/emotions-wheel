import { motion } from 'framer-motion';
import type { DiaryEntry } from '../types';

interface Props {
  entry: DiaryEntry;
  onNewSession: () => void;
  onViewHistory: () => void;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function SessionComplete({ entry, onNewSession, onViewHistory }: Props) {
  const count = entry.emotions.length;
  const label = count === 1 ? 'emotion' : 'emotions';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#111111',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.05 }}
        style={{ textAlign: 'center', maxWidth: 320 }}
      >
        {/* Checkmark */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'rgba(251, 191, 36, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: 24,
          }}
        >
          ✓
        </motion.div>

        {/* Summary */}
        <p style={{
          fontSize: 17,
          color: 'rgba(232, 224, 216, 0.9)',
          margin: '0 0 6px',
          fontWeight: 400,
        }}>
          {count} {label} recorded
        </p>
        <p style={{
          fontSize: 13,
          color: 'rgba(232, 224, 216, 0.4)',
          margin: '0 0 40px',
        }}>
          {formatTimestamp(entry.timestamp)}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={onNewSession}
            style={{
              padding: '13px 32px',
              borderRadius: 24,
              border: 'none',
              background: '#fbbf24',
              color: '#111111',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            New check-in
          </button>

          <button
            onClick={onViewHistory}
            style={{
              padding: '13px 32px',
              borderRadius: 24,
              border: '1px solid rgba(232, 224, 216, 0.2)',
              background: 'transparent',
              color: 'rgba(232, 224, 216, 0.7)',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            View history
          </button>
        </div>
      </motion.div>
    </div>
  );
}
