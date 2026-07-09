import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { AdminEmotion } from '../types';

interface Props {
  emotion: AdminEmotion;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<AdminEmotion>) => void;
  onRemove: () => void;
}

function cell(extra: CSSProperties = {}): CSSProperties {
  return {
    background: 'var(--oura-bg)',
    border: '1px solid var(--oura-border)',
    borderRadius: 4,
    color: 'var(--oura-text-1)',
    fontSize: 11,
    padding: '3px 6px',
    outline: 'none',
    height: 24,
    boxSizing: 'border-box',
    ...extra,
  };
}

export function AdminRow({ emotion, selected, onSelect, onUpdate, onRemove }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [selected]);

  return (
    <div
      ref={rowRef}
      onClick={onSelect}
      style={{
        background: selected ? 'rgba(201,168,124,0.14)' : 'transparent',
        borderBottom: '1px solid var(--oura-border)',
        cursor: 'default',
      }}
    >
      {/* Compact row */}
      <div style={{ display: 'flex', alignItems: 'center', height: 34, padding: '0 8px', gap: 5, fontSize: 11 }}>
        {/* ID — read-only */}
        <div style={{ width: 90, flexShrink: 0, color: 'var(--oura-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 10 }}>
          {emotion.id}
        </div>
        {/* Label */}
        <input
          value={emotion.label}
          onChange={e => onUpdate({ label: e.target.value })}
          onClick={e => e.stopPropagation()}
          style={cell({ width: 110, flexShrink: 0 })}
        />
        {/* X */}
        <input
          type="number"
          value={+emotion.x.toFixed(2)}
          step={0.01}
          min={-1}
          max={1}
          onChange={e => onUpdate({ x: parseFloat(e.target.value) || 0 })}
          onClick={e => e.stopPropagation()}
          style={cell({ width: 60, flexShrink: 0, textAlign: 'right' })}
        />
        {/* Y */}
        <input
          type="number"
          value={+emotion.y.toFixed(2)}
          step={0.01}
          min={-1}
          max={1}
          onChange={e => onUpdate({ y: parseFloat(e.target.value) || 0 })}
          onClick={e => e.stopPropagation()}
          style={cell({ width: 60, flexShrink: 0, textAlign: 'right' })}
        />
        {/* Depth */}
        <select
          value={emotion.depth}
          onChange={e => onUpdate({ depth: e.target.value as 'surface' | 'deep' })}
          onClick={e => e.stopPropagation()}
          style={cell({ width: 72, flexShrink: 0 })}
        >
          <option value="surface">surface</option>
          <option value="deep">deep</option>
        </select>
        {/* Cluster */}
        <input
          value={emotion.cluster}
          onChange={e => onUpdate({ cluster: e.target.value })}
          onClick={e => e.stopPropagation()}
          style={cell({ flex: 1, minWidth: 0 })}
        />
        {/* Delete */}
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          title="Remove"
          style={{
            width: 22,
            height: 22,
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            color: 'var(--oura-text-3)',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            borderRadius: 4,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>

      {/* Description — expanded when selected */}
      {selected && (
        <div style={{ padding: '0 8px 10px', paddingLeft: 90 + 5 + 8 }}>
          <textarea
            value={emotion.description}
            onChange={e => onUpdate({ description: e.target.value })}
            onClick={e => e.stopPropagation()}
            placeholder="Description…"
            rows={2}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--oura-bg)',
              border: '1px solid var(--oura-border)',
              borderRadius: 4,
              color: 'var(--oura-text-1)',
              fontSize: 11,
              padding: '6px 8px',
              resize: 'vertical',
              fontFamily: 'Inter, sans-serif',
              outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  );
}
