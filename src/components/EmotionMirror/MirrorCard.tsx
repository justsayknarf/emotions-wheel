import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { labelForId } from '../../data/emotions';
import { formatRelative } from '../../utils/formatDate';
import { RAIL_WIDTH } from '../EmotionPreview/EmotionDrawer';
import { RhythmStrip } from './RhythmStrip';
import type { DiaryEntry } from '../../types';

type Variant = 'rail' | 'sheet';

interface Props {
  entry: DiaryEntry;      // most recent entry
  entries: DiaryEntry[];  // full history, for the rhythm strip
  variant: Variant;
  // Sheet variant only: whether the tray is expanded to full content, and a
  // toggle for the peek handle. Ignored by the rail (never collapsible).
  expanded?: boolean;
  onToggle?: () => void;
}

const MICRO_LABEL: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--oura-text-3)',
};

// The returning-mirror surface: last check-in + recent rhythm. Docks as a rail
// on desktop and a compact bottom peek on mobile, mirroring EmotionDrawer. On
// mobile the sheet defaults to a collapsed peek so the field stays pinnable, and
// expands on a tap of the handle.
export function MirrorCard({ entry, entries, variant, expanded = false, onToggle }: Props) {
  const isRail = variant === 'rail';
  const reduce = useReducedMotion();
  const words = [...new Set(entry.pins.flatMap((p) => p.recognizedWords))]
    .map(labelForId)
    .filter(Boolean);
  const relational = entry.pins[0]?.regionDescription.relational.replace(/\*/g, '');
  const timeLabel = formatRelative(entry.timestamp);

  const relationalLine = relational && (
    <span style={{ fontSize: 15, fontWeight: 300, color: 'var(--oura-text-1)', lineHeight: 1.45 }}>
      {relational}
    </span>
  );

  // Word pills + recent rhythm — identical across both variants. The relational
  // line and the "last check-in" label/timestamp are placed per-variant (grouped
  // with the time on the rail; under the peek header on the sheet).
  const detail = (
    <>
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
    </>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px' }}>
          <div style={MICRO_LABEL}>Last check-in</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--oura-text-2)', letterSpacing: '0.01em' }}>
              {timeLabel}
            </span>
            {relationalLine}
          </div>
          {detail}
        </div>
      </motion.div>
    );
  }

  // Sheet (mobile): a collapsed peek handle that leaves the field pinnable, and
  // the full detail revealed on expand. Collapsed renders only the peek, so the
  // element's box — and its stopPropagation dead zone — shrinks to the handle.
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
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse last check-in' : 'Expand last check-in'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          minHeight: 44,
          padding: '10px 18px 8px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        {/* Grabber */}
        <span
          aria-hidden
          style={{
            alignSelf: 'center',
            width: 34,
            height: 4,
            borderRadius: 2,
            background: 'var(--oura-border)',
          }}
        />
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={MICRO_LABEL}>Last check-in</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--oura-text-2)', letterSpacing: '0.01em' }}>
              {timeLabel}
            </span>
          </span>
          {/* Chevron — points up to expand, down when expanded (to collapse) */}
          <motion.span
            aria-hidden
            animate={{ rotate: expanded ? 0 : 180 }}
            transition={reduce ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
            style={{ display: 'inline-flex', color: 'var(--oura-text-3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 8.5L7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 35 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 18px 16px' }}>
              {relationalLine}
              {detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
