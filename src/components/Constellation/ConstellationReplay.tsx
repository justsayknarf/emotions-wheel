import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { recentWindow } from '../../utils/recentEntries';
import { SessionDetailCard } from '../DiaryHistory/SessionDetailCard';
import { PulseTrace } from './PulseTrace';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];
  onDismiss: () => void;
}

const AXIS_LABEL: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  fontSize: 9,
  fontWeight: 500,
  color: 'rgba(237,232,223,0.35)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

// Full-surface takeover (view === 'constellation'). Plays the pulse-trace over
// the recent window, then leaves the constellation in place for inspection —
// tapping a point opens its detail; dismissing returns to the mirror.
export function ConstellationReplay({ entries, onDismiss }: Props) {
  // Memoized so its identity is stable across re-renders (e.g. opening a
  // detail card) — the pulse animation keys on this and must not restart.
  const windowed = useMemo(() => recentWindow(entries), [entries]);
  const [openEntry, setOpenEntry] = useState<DiaryEntry | null>(null);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--oura-bg)', overflow: 'hidden' }}>
      {/* Faint crosshairs + axes for spatial context */}
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(201,168,124,0.1)' }} />
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(201,168,124,0.1)' }} />
      <div style={{ ...AXIS_LABEL, top: 16, left: '50%', transform: 'translateX(-50%)' }}>Positive</div>
      <div style={{ ...AXIS_LABEL, bottom: 16, left: '50%', transform: 'translateX(-50%)' }}>Negative</div>
      <div style={{ ...AXIS_LABEL, left: 16, top: '50%', transform: 'translateY(-50%) rotate(-90deg)' }}>Calm</div>
      <div style={{ ...AXIS_LABEL, right: 16, top: '50%', transform: 'translateY(-50%) rotate(90deg)' }}>Activated</div>

      {/* The animated constellation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <PulseTrace entries={windowed} onPointClick={setOpenEntry} />
      </motion.div>

      {/* Header */}
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 12, zIndex: 20 }}>
        <button
          onClick={onDismiss}
          style={{
            background: 'rgba(22,24,32,0.8)',
            border: '1px solid var(--oura-border)',
            borderRadius: 8,
            padding: '7px 13px',
            color: 'var(--oura-text-2)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            letterSpacing: '0.06em',
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--oura-gold-dim)' }}>
          Recent journey
        </span>
      </div>

      <SessionDetailCard entry={openEntry} onDismiss={() => setOpenEntry(null)} />
    </div>
  );
}
