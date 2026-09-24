import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { recentWindow } from '../../utils/recentEntries';
import { SessionDetailCard } from '../DiaryHistory/SessionDetailCard';
import { DrawnConstellation } from './DrawnConstellation';
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
  color: 'rgb(var(--ui-text-rgb) / 0.35)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

// Full-surface takeover (view === 'constellation'). Draws the recent window in
// star by star (DrawnConstellation), then leaves it in place for inspection —
// tapping a point opens its detail; dismissing returns to the mirror.
export function ConstellationReplay({ entries, onDismiss }: Props) {
  // Memoized so its identity is stable across re-renders (e.g. opening a
  // detail card) — the replay timeline keys on this and must not restart.
  const windowed = useMemo(() => recentWindow(entries), [entries]);
  const [openEntry, setOpenEntry] = useState<DiaryEntry | null>(null);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--ui-bg)', overflow: 'hidden' }}>
      {/* Faint crosshairs + axes for spatial context */}
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgb(var(--ui-gold-rgb) / 0.1)' }} />
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgb(var(--ui-gold-rgb) / 0.1)' }} />
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
        <DrawnConstellation entries={windowed} onPointClick={setOpenEntry} />
      </motion.div>

      {/* Header */}
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', alignItems: 'center', gap: 12, zIndex: 20 }}>
        <button
          onClick={onDismiss}
          style={{
            background: 'rgb(var(--ui-surface-rgb) / 0.8)',
            border: '1px solid var(--ui-border)',
            borderRadius: 8,
            padding: '7px 13px',
            color: 'var(--ui-text-2)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
            letterSpacing: '0.06em',
          }}
        >
          ← Back
        </button>
        <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ui-gold-dim)' }}>
          Recent journey
        </span>
      </div>

      <SessionDetailCard entry={openEntry} onDismiss={() => setOpenEntry(null)} />
    </div>
  );
}
