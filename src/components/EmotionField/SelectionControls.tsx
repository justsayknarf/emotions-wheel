import { motion, AnimatePresence } from 'framer-motion';
import type { SelectedEmotion } from '../../types';

interface Props {
  selectedEmotions: SelectedEmotion[];
  onClear: () => void;
  onDone: () => void;
}

export function SelectionControls({ selectedEmotions, onClear, onDone }: Props) {
  const hasSelections = selectedEmotions.length > 0;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 32,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <AnimatePresence>
        {hasSelections && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ display: 'flex', gap: 12, pointerEvents: 'auto' }}
          >
            <button
              onClick={onClear}
              style={{
                padding: '10px 20px',
                borderRadius: 24,
                border: '1px solid rgba(232, 224, 216, 0.25)',
                background: 'rgba(30, 26, 22, 0.8)',
                color: 'rgba(232, 224, 216, 0.7)',
                fontSize: 14,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
              }}
            >
              Clear
            </button>

            <button
              onClick={onDone}
              style={{
                padding: '10px 24px',
                borderRadius: 24,
                border: 'none',
                background: 'rgba(251, 191, 36, 0.9)',
                color: '#111111',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Done ✓ ({selectedEmotions.length})
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
