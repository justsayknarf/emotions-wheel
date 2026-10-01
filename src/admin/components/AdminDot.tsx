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
  readOnly?: boolean;
  showLabel?: boolean;
  color?: string;
  mapRef: { current: HTMLDivElement | null };
  onUpdate: (id: string, patch: Partial<AdminEmotion>) => void;
  onSelect: (id: string) => void;
}

export function AdminDot({ emotion, selected, dimmed, readOnly, showLabel, color, mapRef, onUpdate, onSelect }: Props) {
  const startRef = useRef<{ x: number; y: number }>({ x: emotion.x, y: emotion.y });

  const bind = useDrag(
    ({ first, movement: [mx, my], tap }) => {
      if (tap) {
        onSelect(emotion.id);
        return;
      }
      if (readOnly) return;
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
        cursor: readOnly ? 'pointer' : 'grab',
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
        background: selected ? 'var(--ui-gold)' : (color ?? 'rgb(var(--ui-gold-rgb) / 0.45)'),
        border: selected
          ? '2px solid var(--ui-gold)'
          : emotion.depth === 'surface'
            ? '1.5px solid var(--ui-text-1)'
            : `1px solid ${color ? 'transparent' : 'rgb(var(--ui-gold-rgb) / 0.3)'}`,
        transition: 'width 0.1s, height 0.1s, background 0.1s',
      }} />
      {(selected || showLabel) && (
        <div style={{
          position: 'absolute',
          top: selected ? 14 : 9,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 9,
          whiteSpace: 'nowrap',
          color: selected ? 'var(--ui-gold)' : (color ?? 'var(--ui-text-2)'),
          fontWeight: selected || emotion.depth === 'surface' ? 600 : 400,
          opacity: selected ? 1 : 0.85,
          pointerEvents: 'none',
        }}>
          {emotion.label}
        </div>
      )}
    </div>
  );
}
