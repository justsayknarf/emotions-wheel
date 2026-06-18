import { useRef, useState, useEffect } from 'react';
import { emotions } from '../../data/emotions';
import { useProximity } from '../../hooks/useProximity';
import { useGesturePin } from '../../hooks/useGesturePin';
import { EmotionWord } from './EmotionWord';
import { Pin } from './Pin';
import { SelectionControls } from './SelectionControls';
import type { SelectedEmotion } from '../../types';

interface Props {
  selectedEmotions: SelectedEmotion[];
  onSelectionChange: (emotions: SelectedEmotion[]) => void;
  onDone: () => void;
  onFirstInteraction?: () => void;
  hasInteracted: boolean;
}

// Map coordinate [-1, 1] to pixel position using [5%, 95%] of container
function coordToPixel(v: number, containerPx: number): number {
  return (5 + ((v + 1) / 2) * 90) / 100 * containerPx;
}

export function EmotionField({
  selectedEmotions,
  onSelectionChange,
  onDone,
  onFirstInteraction,
  hasInteracted,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pinX, setPinX] = useState(0);
  const [pinY, setPinY] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const selectedIds = new Set(selectedEmotions.map((e) => e.id));
  const proximity = useProximity(emotions, pinX, pinY, selectedIds);

  const bind = useGesturePin({
    pinX,
    pinY,
    setPinX,
    setPinY,
    selectedEmotions,
    onSelectionChange,
    containerRef,
    onFirstInteraction,
    hasInteracted,
  });

  const pinPixelX = size.width > 0 ? coordToPixel(pinX, size.width) : 0;
  const pinPixelY = size.height > 0 ? coordToPixel(-pinY, size.height) : 0; // invert Y

  return (
    <div
      ref={containerRef}
      {...bind()}
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

      {size.width > 0 && <Pin x={pinPixelX} y={pinPixelY} />}

      <SelectionControls
        selectedEmotions={selectedEmotions}
        onClear={() => onSelectionChange([])}
        onDone={onDone}
      />
    </div>
  );
}
