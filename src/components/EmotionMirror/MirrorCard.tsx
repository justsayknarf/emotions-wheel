import { motion } from 'framer-motion';
import { emotions } from '../../data/emotions';
import { formatRelative } from '../../utils/formatDate';
import { RAIL_WIDTH } from '../EmotionPreview/EmotionDrawer';
import { RhythmStrip } from './RhythmStrip';
import type { DiaryEntry } from '../../types';

type Variant = 'rail' | 'sheet';

interface Props {
  entry: DiaryEntry;      // most recent entry
  entries: DiaryEntry[];  // full history, for the rhythm strip
  variant: Variant;
}

function labelForId(id: string): string {
  return emotions.find((e) => e.id === id)?.label ?? id;
}

const MICRO_LABEL: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--oura-text-3)',
};

// The returning-mirror surface: last check-in + recent rhythm. Docks as a rail
// on desktop and a compact bottom peek on mobile, mirroring EmotionDrawer.
export function MirrorCard({ entry, entries, variant }: Props) {
  const isRail = variant === 'rail';
  const words = [...new Set(entry.pins.flatMap((p) => p.recognizedWords))]
    .map(labelForId)
    .filter(Boolean);
  const relational = entry.pins[0]?.regionDescription.relational.replace(/\*/g, '');

  const body = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px' }}>
      <div style={MICRO_LABEL}>Last check-in</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--oura-text-2)', letterSpacing: '0.01em' }}>
          {formatRelative(entry.timestamp)}
        </span>
        {relational && (
          <span style={{ fontSize: 15, fontWeight: 300, color: 'var(--oura-text-1)', lineHeight: 1.45 }}>
            {relational}
          </span>
        )}
      </div>

      {words.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {words.map((label) => (
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
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 2 }}>
        <div style={MICRO_LABEL}>Recent rhythm</div>
        <RhythmStrip entries={entries} />
      </div>
    </div>
  );

  const shared: React.CSSProperties = {
    position: 'absolute',
    background: 'rgba(12, 14, 18, 0.97)',
    backdropFilter: 'blur(20px)',
    zIndex: 15,
  };

  if (isRail) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ ...shared, top: 0, right: 0, bottom: 0, width: RAIL_WIDTH, borderLeft: '1px solid var(--oura-border)' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {body}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      style={{
        ...shared,
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: '1px solid var(--oura-border)',
        borderRadius: '16px 16px 0 0',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {body}
    </motion.div>
  );
}
