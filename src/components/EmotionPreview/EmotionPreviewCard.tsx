import { emotions } from '../../data/emotions';
import { getDescription } from '../../data/descriptions';
import type { SelectedEmotion } from '../../types';

interface Props {
  emotion: SelectedEmotion;
  onDeselect: () => void;
}

export function EmotionPreviewCard({ emotion, onDeselect }: Props) {
  const { description, relatedIds } = getDescription(emotion.id);

  const relatedLabels = relatedIds
    .slice(0, 3)
    .map((rid) => emotions.find((e) => e.id === rid)?.label)
    .filter(Boolean) as string[];

  return (
    <div
      style={{
        background: 'rgba(24, 20, 16, 0.96)',
        border: '1px solid rgba(232, 224, 216, 0.12)',
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 300,
            color: '#fbbf24',
          }}
        >
          {emotion.label}
        </span>
        <button
          onClick={onDeselect}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(232, 224, 216, 0.4)',
            fontSize: 20,
            cursor: 'pointer',
            padding: 12,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 44,
            minHeight: 44,
          }}
          aria-label="Deselect emotion"
        >
          ×
        </button>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 15,
          color: 'rgba(232, 224, 216, 0.85)',
          lineHeight: 1.6,
          margin: '12px 0 0',
        }}
      >
        {description}
      </p>

      {/* Related words */}
      {relatedLabels.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(232, 224, 216, 0.35)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
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
    </div>
  );
}
