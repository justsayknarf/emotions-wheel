import { motion, AnimatePresence } from 'framer-motion';
import { emotions, labelForId } from '../../data/emotions';
import type { PinEntry } from '../../types';

// Surface emotions are the field's always-visible anchor words. A nearby tag
// that is one gets a whisper of a marker (see the leading dot below).
const surfaceIds = new Set(emotions.filter((e) => e.depth === 'surface').map((e) => e.id));

interface Props {
  pin: PinEntry;
  highlightedIds: string[];
  isSelected: boolean;
  isEntering?: boolean;
  onSelect: () => void;
  onRecognize: (id: string) => void;
  onDerecognize: (id: string) => void;
  onRemove: () => void;
}

// Maps coordinate [-1, 1] to [5%, 95%] for position bar markers
function coordToPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}

function RelationalText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('*') && part.endsWith('*') ? (
          <em key={i} style={{ fontStyle: 'normal', color: 'var(--oura-text-1)', fontWeight: 400 }}>
            {part.slice(1, -1)}
          </em>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

const pillVariants = {
  hidden: { opacity: 0, y: 5, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, type: 'spring' as const, stiffness: 300, damping: 26 },
  }),
};

const chipVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 380, damping: 26 } },
  exit: { opacity: 0, scale: 0.85, transition: { duration: 0.1 } },
};

export function CoordinateCard({ pin, highlightedIds, isSelected, isEntering = false, onSelect, onRecognize, onDerecognize, onRemove }: Props) {
  const recognizedSet = new Set(pin.recognizedWords);
  const pillIds = highlightedIds.filter((id) => !recognizedSet.has(id));
  // Hold off the selected look while the card is still animating in, so the
  // highlight eases in as the tether lands rather than popping on arrival.
  const showSelected = isSelected && !isEntering;

  return (
    <div
      onClick={onSelect}
      style={{
        background: 'var(--oura-surface)',
        border: showSelected ? '1px solid var(--oura-gold-dim)' : '1px solid var(--oura-border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: showSelected ? '0 0 0 1px var(--oura-gold-dim), 0 6px 22px rgba(201,168,124,0.12)' : 'none',
        transition: 'border-color 0.35s ease, box-shadow 0.35s ease',
      }}
    >
      {/* Header band */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px 0',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--oura-gold-dim)',
          }}
        >
          Emotional State
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--oura-text-3)',
            fontSize: 16,
            cursor: 'pointer',
            padding: '0 0 0 8px',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            minWidth: 32,
            minHeight: 32,
            justifyContent: 'center',
          }}
          aria-label="Remove"
        >
          ×
        </button>
      </div>

      {/* Main metric block */}
      <div style={{ padding: '8px 14px 14px' }}>
        <p
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 300,
            color: 'var(--oura-text-2)',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          <RelationalText text={pin.regionDescription.relational} />
        </p>

        <p
          style={{
            margin: '6px 0 0',
            fontSize: 11,
            color: 'var(--oura-text-3)',
            letterSpacing: '0.02em',
          }}
        >
          {pin.regionDescription.narrative}
        </p>

        {/* Axis position bars */}
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Arousal bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--oura-text-3)' }}>Calm</span>
              <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--oura-text-3)' }}>Activated</span>
            </div>
            <div style={{ position: 'relative', height: 2, background: 'rgba(237,232,223,0.08)', borderRadius: 1 }}>
              <div style={{
                position: 'absolute',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'rgba(201,168,124,0.7)',
                top: -2,
                left: `${coordToPercent(pin.x)}%`,
                transform: 'translateX(-50%)',
              }} />
            </div>
          </div>
          {/* Valence bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--oura-text-3)' }}>Negative</span>
              <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--oura-text-3)' }}>Positive</span>
            </div>
            <div style={{ position: 'relative', height: 2, background: 'rgba(237,232,223,0.08)', borderRadius: 1 }}>
              <div style={{
                position: 'absolute',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'rgba(201,168,124,0.7)',
                top: -2,
                left: `${coordToPercent(pin.y)}%`,
                transform: 'translateX(-50%)',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Recognized words + pills — in a slightly recessed band */}
      {(pin.recognizedWords.length > 0 || pillIds.length > 0) && (
        <div
          style={{
            borderTop: '1px solid var(--oura-border)',
            padding: '10px 14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {pin.recognizedWords.length > 0 && (
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--oura-text-3)', marginBottom: 7 }}>
                Recognized
              </div>
              <AnimatePresence mode="popLayout">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {pin.recognizedWords.map((id) => (
                    <motion.button
                      key={id}
                      variants={chipVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      onClick={(e) => { e.stopPropagation(); onDerecognize(id); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 5,
                        border: '1px solid rgba(201, 168, 124, 0.35)',
                        background: 'rgba(201, 168, 124, 0.07)',
                        color: 'var(--oura-gold)',
                        fontSize: 12,
                        fontWeight: 400,
                        cursor: 'pointer',
                        letterSpacing: '0.01em',
                      }}
                    >
                      {labelForId(id)}
                      <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.45 }}>×</span>
                    </motion.button>
                  ))}
                </div>
              </AnimatePresence>
            </div>
          )}

          {pillIds.length > 0 && (
            <div>
              {pin.recognizedWords.length === 0 && (
                <div style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--oura-text-3)', marginBottom: 7 }}>
                  Nearby
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {pillIds.map((id, i) => (
                  <motion.button
                    key={id}
                    custom={i}
                    variants={pillVariants}
                    initial="hidden"
                    animate="visible"
                    onClick={(e) => { e.stopPropagation(); onRecognize(id); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 11px',
                      borderRadius: 5,
                      border: '1px solid rgba(237, 232, 223, 0.12)',
                      background: 'rgba(237, 232, 223, 0.04)',
                      color: 'var(--oura-text-2)',
                      fontSize: 12,
                      fontWeight: 400,
                      cursor: 'pointer',
                      letterSpacing: '0.01em',
                    }}
                  >
                    {surfaceIds.has(id) && (
                      // Anchor tag: a tiny bone dot echoing the word's coordinate
                      // dot in the field. Deliberately near-imperceptible.
                      <span
                        aria-hidden="true"
                        style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(237, 232, 223, 0.4)', flex: 'none' }}
                      />
                    )}
                    {labelForId(id)}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
