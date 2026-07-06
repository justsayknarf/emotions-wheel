import { motion } from 'framer-motion';
import { CoordinateCard } from './CoordinateCard';
import type { PinEntry } from '../../types';

interface Props {
  pins: PinEntry[];
  highlightedIds: Set<string>;
  onRecognize: (emotionId: string) => void;
  onDerecognize: (emotionId: string) => void;
  onPinRemove: (pinId: string) => void;
  onDone: () => void;
  onClear: () => void;
}

export function EmotionDrawer({ pins, highlightedIds, onRecognize, onDerecognize, onPinRemove, onDone, onClear }: Props) {
  const reversedPins = [...pins].reverse();

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '46vh',
        background: 'rgba(12, 14, 18, 0.97)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--oura-border)',
        touchAction: 'pan-y',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Action bar — non-scrollable */}
      <div
        style={{
          padding: '11px 16px',
          borderBottom: '1px solid var(--oura-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: '1px solid var(--oura-border)',
            borderRadius: 6,
            padding: '7px 14px',
            color: 'var(--oura-text-2)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
        <button
          onClick={onDone}
          style={{
            background: 'var(--oura-gold)',
            border: 'none',
            borderRadius: 6,
            padding: '7px 18px',
            color: '#0D0F14',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {`Save  ·  ${pins.length}`}
        </button>
      </div>

      {/* Card area — scrollable */}
      <div
        style={{
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          flex: 1,
          padding: '8px 16px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {reversedPins.map((pin, i) => (
          <CoordinateCard
            key={pin.id}
            pin={pin}
            highlightedIds={i === 0 ? Array.from(highlightedIds) : []}
            onRecognize={onRecognize}
            onDerecognize={onDerecognize}
            onRemove={() => onPinRemove(pin.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}
