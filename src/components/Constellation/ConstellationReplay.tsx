import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { recentWindow } from '../../utils/recentEntries';
import { SessionDetailCard, type NoteWrites } from '../DiaryHistory/SessionDetailCard';
import { DrawnConstellation } from './DrawnConstellation';
import { SkyReplay } from './SkyReplay';
import { useRevealTuning } from '../../config/revealTuning';
import type { DiaryEntry } from '../../types';

const REPLAY_INSET = { top: 64, bottom: 80 };

interface Props extends NoteWrites {
  entries: DiaryEntry[];
  onDismiss: () => void;
}

// What the replay draws from each entry: its time, pins and named words. A
// journal note changes none of these, so saving one from the detail card
// leaves this key, and therefore the running replay, untouched.
function replayKey(entries: DiaryEntry[]): string {
  return entries
    .map((e) => `${e.id}@${e.timestamp}:${e.pins.map((p) => `${p.id},${p.x},${p.y},${p.recognizedWords.join('|')}`).join(';')}`)
    .join('/');
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
// star by star, then leaves it in place for inspection — tapping a point opens
// its detail; dismissing returns to the mirror. With the night-sky field on
// (skyField), the replay tours the same sky instead (SkyReplay); otherwise it
// draws on the flat plane (DrawnConstellation).
export function ConstellationReplay({ entries, onDismiss, onSetAtTimeNote, onSetLookingBackNote }: Props) {
  // Memoized so its identity is stable across re-renders (e.g. opening a
  // detail card) — the replay timeline keys on this and must not restart.
  // Keyed on what the replay draws rather than the array's identity, since
  // every diary write (a note included) produces a new array.
  const key = replayKey(entries);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures everything recentWindow's output depends on
  const windowed = useMemo(() => recentWindow(entries), [key]);
  // Held by id and resolved at render, so a saved note shows at once.
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const openEntry = openEntryId === null ? null : entries.find((e) => e.id === openEntryId) ?? null;
  const openById = (e: DiaryEntry) => setOpenEntryId(e.id);
  const sky = useRevealTuning().skyField;

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--ui-bg)', overflow: 'hidden' }}>
      {/* Faint crosshairs for spatial context, flat only: in the sky the
          centre is wherever the gaze is. */}
      {!sky && (
        <>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgb(var(--ui-gold-rgb) / 0.1)' }} />
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgb(var(--ui-gold-rgb) / 0.1)' }} />
        </>
      )}
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
        {sky
          // Each check-in is framed clear of the Back button above and the
          // scrubber below.
          ? <SkyReplay entries={windowed} onPointClick={openById} frameInset={REPLAY_INSET} />
          : <DrawnConstellation entries={windowed} onPointClick={openById} />}
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

      <SessionDetailCard
        entry={openEntry}
        onDismiss={() => setOpenEntryId(null)}
        onSetAtTimeNote={onSetAtTimeNote}
        onSetLookingBackNote={onSetLookingBackNote}
      />
    </div>
  );
}
