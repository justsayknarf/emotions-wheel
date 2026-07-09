import { useRef } from 'react';
import { useDrag } from '@use-gesture/react';
import type { AdminEmotion } from '../types';

function toPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

interface Props {
  emotion: AdminEmotion;
  selected: boolean;
  dimmed: boolean;
  mapRef: { current: HTMLDivElement | null };
  onUpdate: (id: string, patch: Partial<AdminEmotion>) => void;
  onSelect: (id: string) => void;
}

export function AdminDot({ emotion, selected, dimmed, mapRef, onUpdate, onSelect }: Props) {
  const startRef = useRef<{ x: number; y: number }>({ x: emotion.x, y: emotion.y });

  const bind = useDrag(
    ({ first, movement: [mx, my], tap }) => {
      if (tap) {
        onSelect(emotion.id);
        return;
      }
      if (first) {
        startRef.current = { x: emotion.x, y: emotion.y };
      }
      const rect = mapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (mx / (rect.width * 0.9)) * 2;
      const dy = -(my / (rect.height * 0.9)) * 2;
      onUpdate(emotion.id, {
        x: clamp(startRef.current.x + dx, -1, 1),
        y: clamp(startRef.current.y + dy, -1, 1),
      });
    },
    { filterTaps: true },
  );

  const left = toPercent(emotion.x);
  const top = toPercent(-emotion.y);

  return (
    <div
      {...bind()}
      style={{
        position: 'absolute',
        left: `${left}%`,
        top: `${top}%`,
        transform: 'translate(-50%, -50%)',
        cursor: 'grab',
        zIndex: selected ? 10 : 1,
        userSelect: 'none',
        touchAction: 'none',
        opacity: dimmed ? 0.15 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{
        width: selected ? 10 : 7,
        height: selected ? 10 : 7,
        borderRadius: '50%',
        background: selected ? 'var(--oura-gold)' : 'rgba(201,168,124,0.45)',
        border: selected ? '2px solid var(--oura-gold)' : '1px solid rgba(201,168,124,0.3)',
        transition: 'width 0.1s, height 0.1s, background 0.1s',
      }} />
      {selected && (
        <div style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 9,
          whiteSpace: 'nowrap',
          color: 'var(--oura-gold)',
          fontWeight: 500,
          pointerEvents: 'none',
        }}>
          {emotion.label}
        </div>
      )}
    </div>
  );
}
