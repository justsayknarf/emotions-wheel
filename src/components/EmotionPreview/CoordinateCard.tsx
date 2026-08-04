import { useState, useRef } from 'react';
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
  // Commit an adjusted coordinate for this pin (a slider was released).
  onAdjust: (pinId: string, x: number, y: number) => void;
  // Live draft coordinate during a slider drag (field preview only). Optional.
  onAdjustDraft?: (coord: { x: number; y: number } | null) => void;
}

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));
// Coordinate [-1, 1] → [0%, 100%] across a full-width slider track.
const pct = (v: number) => ((v + 1) / 2) * 100;

const endLabelStyle = {
  fontSize: 8,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--oura-text-3)',
};

// A single draggable axis. Reports the value live while dragging (onDrag) and
// once more on release (onCommit) — the card commits on release. The origin tick
// marks where the pin was first dropped, so travel from the felt drop is visible.
function AxisSlider({
  labelLow,
  labelHigh,
  value,
  origin,
  onDrag,
  onCommit,
}: {
  labelLow: string;
  labelHigh: string;
  value: number;
  origin: number;
  onDrag: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const valueAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return value;
    return clampUnit(((clientX - r.left) / r.width) * 2 - 1);
  };
  const p = pct(value);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={endLabelStyle}>{labelLow}</span>
        <span style={endLabelStyle}>{labelHigh}</span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          draggingRef.current = true;
          trackRef.current?.setPointerCapture(e.pointerId);
          onDrag(valueAt(e.clientX));
        }}
        onPointerMove={(e) => { if (draggingRef.current) onDrag(valueAt(e.clientX)); }}
        onPointerUp={(e) => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          trackRef.current?.releasePointerCapture(e.pointerId);
          onCommit(valueAt(e.clientX));
        }}
        onPointerCancel={() => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          onCommit(value);
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          height: 5,
          borderRadius: 3,
          background: 'rgba(237,232,223,0.09)',
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        {/* fill runs from the center out to the thumb */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            borderRadius: 3,
            background: 'rgba(201,168,124,0.12)',
            left: value >= 0 ? '50%' : `${p}%`,
            right: value >= 0 ? `${100 - p}%` : '50%',
          }}
        />
        {/* origin tick — where this pin was dropped */}
        <div style={{ position: 'absolute', top: -3, bottom: -3, width: 1, background: 'var(--oura-text-3)', left: `${pct(origin)}%` }} />
        {/* thumb */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            width: 15,
            height: 15,
            marginTop: -7.5,
            marginLeft: -7.5,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 35%, #f0d9b5, var(--oura-gold) 62%)',
            boxShadow: '0 0 0 4px rgba(201,168,124,0.12), 0 2px 8px rgba(201,168,124,0.35)',
            left: `${p}%`,
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
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

export function CoordinateCard({ pin, highlightedIds, isSelected, isEntering = false, onSelect, onRecognize, onDerecognize, onRemove, onAdjust, onAdjustDraft }: Props) {
  const recognizedSet = new Set(pin.recognizedWords);
  const pillIds = highlightedIds.filter((id) => !recognizedSet.has(id));
  // Hold off the selected look while the card is still animating in, so the
  // highlight eases in as the tether lands rather than popping on arrival.
  const showSelected = isSelected && !isEntering;

  // While a slider is dragged, the thumbs follow this local draft; the committed
  // pin coordinate (and its words) hold until release.
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const curX = draft?.x ?? pin.x;
  const curY = draft?.y ?? pin.y;
  const originX = pin.origin?.x ?? pin.x;
  const originY = pin.origin?.y ?? pin.y;

  const dragAxis = (axis: 'x' | 'y', v: number) => {
    const next = { x: axis === 'x' ? v : curX, y: axis === 'y' ? v : curY };
    setDraft(next);
    onAdjustDraft?.(next);
  };
  const commitAxis = (axis: 'x' | 'y', v: number) => {
    const next = { x: axis === 'x' ? v : curX, y: axis === 'y' ? v : curY };
    setDraft(null);
    onAdjustDraft?.(null);
    onAdjust(pin.id, next.x, next.y);
  };

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

      {/* Main metric block — sliders on top, then the (read-only for now) words */}
      <div style={{ padding: '10px 14px 14px' }}>
        {/* Adjust sliders — nudge the pin after the fact; commit on release */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 15 }}
        >
          <AxisSlider
            labelLow="Calm"
            labelHigh="Activated"
            value={curX}
            origin={originX}
            onDrag={(v) => dragAxis('x', v)}
            onCommit={(v) => commitAxis('x', v)}
          />
          <AxisSlider
            labelLow="Negative"
            labelHigh="Positive"
            value={curY}
            origin={originY}
            onDrag={(v) => dragAxis('y', v)}
            onCommit={(v) => commitAxis('y', v)}
          />
        </div>

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
