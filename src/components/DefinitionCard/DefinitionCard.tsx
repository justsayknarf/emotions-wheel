import { motion } from 'framer-motion';
import { emotions } from '../../data/emotions';
import { getDescription } from '../../data/descriptions';
import type { SelectedEmotion } from '../../types';

interface Props {
  emotion: SelectedEmotion;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  isLast: boolean;
}

export function DefinitionCard({ emotion, index, total, onNext, onSkip, isLast }: Props) {
  const { description, relatedIds } = getDescription(emotion.id);

  // Resolve related emotion labels
  const relatedLabels = relatedIds
    .slice(0, 3)
    .map((rid) => emotions.find((e) => e.id === rid)?.label)
    .filter(Boolean) as string[];

  return (
    <motion.div
      key={emotion.id}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      style={{
        background: 'rgba(24, 20, 16, 0.96)',
        border: '1px solid rgba(232, 224, 216, 0.12)',
        borderRadius: 20,
        padding: '28px 24px 24px',
        maxWidth: 360,
        width: '100%',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Progress */}
      <div style={{ fontSize: 12, color: 'rgba(232, 224, 216, 0.4)', marginBottom: 16 }}>
        {index + 1} of {total}
      </div>

      {/* Emotion label */}
      <h2 style={{
        fontSize: 28,
        fontWeight: 300,
        color: '#fbbf24',
        margin: '0 0 16px',
        letterSpacing: '-0.02em',
      }}>
        {emotion.label}
      </h2>

      {/* Description */}
      <p style={{
        fontSize: 15,
        lineHeight: 1.65,
        color: 'rgba(232, 224, 216, 0.85)',
        margin: '0 0 24px',
      }}>
        {description}
      </p>

      {/* Related words */}
      {relatedLabels.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: 'rgba(232, 224, 216, 0.35)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Related
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {relatedLabels.map((label) => (
              <span
                key={label}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  border: '1px solid rgba(232, 224, 216, 0.18)',
                  fontSize: 13,
                  color: 'rgba(232, 224, 216, 0.6)',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={onSkip}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(232, 224, 216, 0.35)',
            fontSize: 13,
            cursor: 'pointer',
            padding: '8px 0',
          }}
        >
          Skip to Record
        </button>

        <button
          onClick={onNext}
          style={{
            padding: '10px 24px',
            borderRadius: 20,
            border: 'none',
            background: '#fbbf24',
            color: '#111111',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isLast ? 'Record ✓' : 'Next →'}
        </button>
      </div>
    </motion.div>
  );
}
