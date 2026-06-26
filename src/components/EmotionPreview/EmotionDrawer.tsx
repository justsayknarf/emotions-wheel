import { motion } from 'framer-motion';
import { EmotionPreviewCard } from './EmotionPreviewCard';
import type { SelectedEmotion } from '../../types';

interface Props {
  selectedEmotions: SelectedEmotion[];
  onDeselect: (id: string) => void;
  onDone: () => void;
  onClear: () => void;
}

export function EmotionDrawer({ selectedEmotions, onDeselect, onDone, onClear }: Props) {
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
        maxHeight: '42vh',
        background: 'rgba(18, 14, 10, 0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(232, 224, 216, 0.10)',
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
          padding: '12px 16px',
          borderBottom: '1px solid rgba(232, 224, 216, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          onClick={onClear}
          style={{
            background: 'none',
            border: '1px solid rgba(232, 224, 216, 0.2)',
            borderRadius: 20,
            padding: '8px 16px',
            color: 'rgba(232, 224, 216, 0.5)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Clear
        </button>

        <button
          onClick={onDone}
          style={{
            background: 'rgba(251, 191, 36, 0.9)',
            border: 'none',
            borderRadius: 20,
            padding: '8px 20px',
            color: '#111111',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {`Done ✓ (${selectedEmotions.length})`}
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
        {[...selectedEmotions].reverse().map((emotion) => (
          <EmotionPreviewCard
            key={emotion.id}
            emotion={emotion}
            onDeselect={() => onDeselect(emotion.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}
