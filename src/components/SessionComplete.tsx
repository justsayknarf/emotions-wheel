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
  const count = entry.pins.length;
  const label = count === 1 ? 'moment' : 'moments';

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
        background: 'var(--oura-bg)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.05 }}
        style={{ textAlign: 'center', maxWidth: 320 }}
      >
        {/* Ring checkmark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            border: '1.5px solid rgba(201, 168, 124, 0.5)',
            background: 'rgba(201, 168, 124, 0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 28px',
            color: 'var(--oura-gold)',
            fontSize: 20,
            fontWeight: 300,
          }}
        >
          ✓
        </motion.div>

        {/* Eyebrow */}
        <div style={{
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--oura-gold-dim)',
          marginBottom: 10,
        }}>
          Saved
        </div>

        {/* Summary */}
        <p style={{
          fontSize: 22,
          fontWeight: 300,
          color: 'var(--oura-text-1)',
          margin: '0 0 8px',
          letterSpacing: '-0.01em',
        }}>
          {count} {label} recorded
        </p>
        <p style={{
          fontSize: 12,
          color: 'var(--oura-text-3)',
          margin: '0 0 44px',
          letterSpacing: '0.03em',
        }}>
          {formatTimestamp(entry.timestamp)}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={onNewSession}
            style={{
              padding: '12px 32px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--oura-gold)',
              color: '#0D0F14',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            New check-in
          </button>

          <button
            onClick={onViewHistory}
            style={{
              padding: '12px 32px',
              borderRadius: 6,
              border: '1px solid var(--oura-border)',
              background: 'transparent',
              color: 'var(--oura-text-2)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
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
