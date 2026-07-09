import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { AdminEmotion } from '../types';
import { AdminRow } from './AdminRow';

interface Props {
  emotions: AdminEmotion[];
  selectedId: string | null;
  visibleIds: Set<string> | null;
  depthFilter: Set<string>;
  clusterFilter: Set<string>;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<AdminEmotion>) => void;
  onAdd: (label: string) => void;
  onRemove: (id: string) => void;
  onToggleDepth: (depth: string) => void;
  onToggleCluster: (cluster: string) => void;
}

const COL: CSSProperties = {
  flexShrink: 0,
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--oura-text-3)',
};

function Pill({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: '2px 9px',
        borderRadius: 10,
        border: active ? '1px solid var(--oura-gold)' : '1px solid var(--oura-border)',
        background: active ? 'rgba(201,168,124,0.18)' : 'transparent',
        color: active ? 'var(--oura-gold)' : 'var(--oura-text-3)',
        fontSize: 10,
        cursor: 'pointer',
        letterSpacing: '0.03em',
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        transition: 'background 0.1s, color 0.1s, border-color 0.1s',
      }}
    >
      {label}
    </button>
  );
}

export function AdminTable({
  emotions,
  selectedId,
  visibleIds,
  depthFilter,
  clusterFilter,
  onSelect,
  onUpdate,
  onAdd,
  onRemove,
  onToggleDepth,
  onToggleCluster,
}: Props) {
  const clusters = useMemo(
    () => [...new Set(emotions.map(e => e.cluster))].sort(),
    [emotions],
  );

  const visibleEmotions = visibleIds === null ? emotions : emotions.filter(e => visibleIds.has(e.id));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Filter bar */}
      <div style={{
        padding: '8px 10px',
        borderBottom: '1px solid var(--oura-border)',
        background: 'var(--oura-surface)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}>
        {/* Depth row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--oura-text-3)', width: 40, flexShrink: 0 }}>Depth</div>
          <Pill label="surface" active={depthFilter.has('surface')} onToggle={() => onToggleDepth('surface')} />
          <Pill label="deep" active={depthFilter.has('deep')} onToggle={() => onToggleDepth('deep')} />
        </div>
        {/* Cluster row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--oura-text-3)', width: 40, flexShrink: 0, paddingTop: 3 }}>Cluster</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {clusters.map(c => (
              <Pill key={c} label={c} active={clusterFilter.has(c)} onToggle={() => onToggleCluster(c)} />
            ))}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 8px',
        borderBottom: '1px solid var(--oura-border)',
        background: 'var(--oura-surface)',
        gap: 5,
        flexShrink: 0,
      }}>
        <div style={{ ...COL, width: 90 }}>ID</div>
        <div style={{ ...COL, width: 110 }}>Label</div>
        <div style={{ ...COL, width: 60, textAlign: 'right' }}>X</div>
        <div style={{ ...COL, width: 60, textAlign: 'right' }}>Y</div>
        <div style={{ ...COL, width: 72 }}>Depth</div>
        <div style={{ ...COL, flex: 1 }}>Cluster</div>
        <div style={{ width: 22 }} />
      </div>

      {/* Scrollable rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visibleEmotions.map(e => (
          <AdminRow
            key={e.id}
            emotion={e}
            selected={selectedId === e.id}
            onSelect={() => onSelect(e.id)}
            onUpdate={patch => onUpdate(e.id, patch)}
            onRemove={() => onRemove(e.id)}
          />
        ))}
      </div>

      {/* Footer toolbar */}
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid var(--oura-border)',
        background: 'var(--oura-surface)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <button
          onClick={() => onAdd('New Emotion')}
          style={{
            background: 'transparent',
            border: '1px solid var(--oura-border)',
            borderRadius: 6,
            color: 'var(--oura-gold-dim)',
            fontSize: 11,
            padding: '5px 14px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          + Add Emotion
        </button>
        <div style={{ fontSize: 10, color: 'var(--oura-text-3)' }}>
          {visibleIds === null ? emotions.length : `${visibleEmotions.length} / ${emotions.length}`} emotions
        </div>
      </div>
    </div>
  );
}
