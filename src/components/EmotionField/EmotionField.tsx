import { useRef, useState, useEffect, useCallback } from 'react';
import { emotions } from '../../data/emotions';
import { useProximity, SELECTION_RADIUS } from '../../hooks/useProximity';
import { useFieldGesture } from '../../hooks/useFieldGesture';
import { EmotionWord } from './EmotionWord';
import type { SelectedEmotion } from '../../types';

interface Props {
  selectedEmotions: SelectedEmotion[];
  onSelectionChange: (emotions: SelectedEmotion[]) => void;
  onFirstInteraction?: () => void;
  hasInteracted: boolean;
}

export function EmotionField({
  selectedEmotions,
  onSelectionChange,
  onFirstInteraction,
  hasInteracted,
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
      // word found — toggle selection
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
      // no-op in this plan — coordinate-only case
      // NOTE: the coordinate-first flag plan extends this branch to plant a coordinate flag.
      // Do NOT implement as an early return before this point.
    }
  }, [selectedEmotions, onSelectionChange]);

  const { isPressed, revealCenter, handlers } = useFieldGesture({
    containerRef,
    size,
    onRelease: handleRelease,
    onFirstInteraction,
    hasInteracted,
  });

  const selectedIds = new Set(selectedEmotions.map((e) => e.id));
  const proximity = useProximity(emotions, revealCenter, isPressed, selectedIds);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: 'none', overscrollBehavior: 'none', cursor: 'crosshair' }}
    >
      {size.width > 0 &&
        emotions.map((emotion) => (
          <EmotionWord
            key={emotion.id}
            emotion={emotion}
            proximity={proximity.get(emotion.id)!}
            isSelected={selectedIds.has(emotion.id)}
            containerWidth={size.width}
            containerHeight={size.height}
          />
        ))}

    </div>
  );
}
