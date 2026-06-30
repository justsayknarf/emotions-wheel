import { useRef, useState, useEffect, useCallback } from 'react';
import { emotions } from '../../data/emotions';
import { useProximity, SELECTION_RADIUS } from '../../hooks/useProximity';
import { useFieldGesture } from '../../hooks/useFieldGesture';
import { EmotionWord } from './EmotionWord';
import type { SelectedEmotion } from '../../types';

function toPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}

const AXIS_PILL: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: 5,
  background: 'rgba(30, 26, 22, 0.75)',
  border: '1px solid rgba(232, 224, 216, 0.15)',
  borderRadius: 20,
  padding: '4px 12px',
  fontSize: 11,
  color: 'rgba(232, 224, 216, 0.4)',
  letterSpacing: '0.06em',
  whiteSpace: 'nowrap',
};

interface Props {
  selectedEmotions: SelectedEmotion[];
  onSelectionChange: (emotions: SelectedEmotion[]) => void;
  onFirstInteraction?: () => void;
  hasInteracted: boolean;
  markerCoords: Array<{ x: number; y: number }>;
  onMarkerAdd: (coord: { x: number; y: number }) => void;
}

export function EmotionField({
  selectedEmotions,
  onSelectionChange,
  onFirstInteraction,
  hasInteracted,
  markerCoords,
  onMarkerAdd,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleRelease = useCallback((center: { x: number; y: number }) => {
    onMarkerAdd(center);

    let nearest: (typeof emotions)[0] | null = null;
    let nearestDist = Infinity;

    for (const em of emotions) {
      const d = Math.sqrt((em.x - center.x) ** 2 + (em.y - center.y) ** 2);
      if (d < SELECTION_RADIUS && d < nearestDist) {
        nearest = em;
        nearestDist = d;
      }
    }

    if (nearest) {
      const alreadySelected = selectedEmotions.some((e) => e.id === nearest!.id);
      if (alreadySelected) {
        onSelectionChange(selectedEmotions.filter((e) => e.id !== nearest!.id));
      } else {
        onSelectionChange([
          ...selectedEmotions,
          { id: nearest.id, label: nearest.label, x: nearest.x, y: nearest.y, cluster: nearest.cluster },
        ]);
      }
    } else {
      // NOTE: the coordinate-first flag plan extends this branch to plant a coordinate flag.
      // Do NOT implement as an early return before this point.
    }
  }, [selectedEmotions, onSelectionChange, onMarkerAdd]);

  const { isRevealed, revealCenter, handlers } = useFieldGesture({
    containerRef,
    size,
    onRelease: handleRelease,
    onFirstInteraction,
    hasInteracted,
  });

  const selectedIds = new Set(selectedEmotions.map((e) => e.id));
  const proximity = useProximity(emotions, revealCenter, isRevealed, selectedIds);

  return (
    <div
      ref={containerRef}
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={handlers.onPointerLeave}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: 'none', overscrollBehavior: 'none', cursor: 'crosshair' }}
    >
      {/* Axis labels */}
      <div style={{ ...AXIS_PILL, top: 12, left: '50%', transform: 'translateX(-50%)' }}>
        activated
      </div>
      <div style={{ ...AXIS_PILL, bottom: 12, left: '50%', transform: 'translateX(-50%)' }}>
        calm
      </div>
      <div style={{ ...AXIS_PILL, left: 12, top: '50%', transform: 'translateY(-50%) rotate(-90deg)' }}>
        negative
      </div>
      <div style={{ ...AXIS_PILL, right: 12, top: '50%', transform: 'translateY(-50%) rotate(90deg)' }}>
        positive
      </div>

      {size.width > 0 && (
        <>
          {emotions.map((emotion) => (
            <EmotionWord
              key={emotion.id}
              emotion={emotion}
              proximity={proximity.get(emotion.id)!}
              isSelected={selectedIds.has(emotion.id)}
              containerWidth={size.width}
              containerHeight={size.height}
            />
          ))}

          {markerCoords.map((coord, i) => {
            const px = (toPercent(coord.x) / 100) * size.width;
            const py = (toPercent(-coord.y) / 100) * size.height;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: px,
                  top: py,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  zIndex: 10,
                }}
              >
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'rgba(232, 224, 216, 0.5)',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 10,
                  color: 'rgba(232, 224, 216, 0.4)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.02em',
                }}>
                  {coord.x.toFixed(1)}, {coord.y.toFixed(1)}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
