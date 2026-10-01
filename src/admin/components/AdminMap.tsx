import { useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { activeFrameworkId, frameworks } from '../../data/frameworks';
import type { AdminEmotion } from '../types';
import { AdminDot } from './AdminDot';

interface Props {
  emotions: AdminEmotion[];
  mapSet: string;
  onMapSetChange: (id: string) => void;
  readOnly: boolean;
  selectedId: string | null;
  visibleIds: Set<string> | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<AdminEmotion>) => void;
}

const AXIS_LABEL: CSSProperties = {
  position: 'absolute',
  fontSize: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'rgb(var(--ui-gold-rgb) / 0.25)',
  pointerEvents: 'none',
};

const CONTROL: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 10,
  color: 'var(--ui-text-2)',
  cursor: 'pointer',
  userSelect: 'none',
};

// Coordinate [-1,1] → percent of the map, matching AdminDot and the flat field.
const pct = (v: number) => 5 + ((v + 1) / 2) * 90;

// Evenly spaced hues, one per cluster in first-seen order. Admin-only: the
// field itself never colours by cluster.
function clusterColors(list: AdminEmotion[]): Map<string, string> {
  const order: string[] = [];
  for (const e of list) if (!order.includes(e.cluster)) order.push(e.cluster);
  return new Map(order.map((c, i) => [c, `hsl(${Math.round((i * 360) / order.length)} 70% 66%)`]));
}

export function AdminMap({ emotions, mapSet, onMapSetChange, readOnly, selectedId, visibleIds, onSelect, onUpdate }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [showClusters, setShowClusters] = useState(false);
  const [showMoves, setShowMoves] = useState(true);

  const colors = useMemo(() => (showClusters ? clusterColors(emotions) : null), [showClusters, emotions]);

  // Viewing a set other than the one the field renders: offer each word's move
  // from where the field draws it today.
  const moveFrom = readOnly && mapSet !== activeFrameworkId ? frameworks[activeFrameworkId] : null;
  const fromById = useMemo(
    () => new Map((moveFrom?.emotions ?? []).map(e => [e.id, e])),
    [moveFrom],
  );

  const setOptions = [
    { id: 'base', label: 'Base (editable)' },
    ...Object.values(frameworks).map(f => ({
      id: f.id,
      label: f.id === activeFrameworkId ? `${f.name} — field today` : f.name,
    })),
  ];

  return (
    <div style={{
      flex: '0 0 50%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: 16,
      borderRight: '1px solid var(--ui-border)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, alignSelf: 'stretch' }}>
        <select
          value={mapSet}
          onChange={e => onMapSetChange(e.target.value)}
          style={{
            background: 'var(--ui-surface)',
            color: 'var(--ui-text-1)',
            border: '1px solid var(--ui-border)',
            borderRadius: 6,
            fontSize: 11,
            padding: '3px 6px',
          }}
        >
          {setOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <label style={CONTROL}>
          <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} />
          All labels
        </label>
        <label style={CONTROL}>
          <input type="checkbox" checked={showClusters} onChange={e => setShowClusters(e.target.checked)} />
          Cluster colours
        </label>
        {moveFrom && (
          <label style={CONTROL}>
            <input type="checkbox" checked={showMoves} onChange={e => setShowMoves(e.target.checked)} />
            Moves from field today (new words ringed)
          </label>
        )}
        {readOnly && <span style={{ fontSize: 10, color: 'var(--ui-text-3)' }}>read-only</span>}
      </div>

      {/* Size container, so the map is the largest square that fits. */}
      <div style={{
        flex: 1,
        minHeight: 0,
        alignSelf: 'stretch',
        containerType: 'size',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <div
        ref={mapRef}
        style={{
          width: 'min(100cqw, 100cqh)',
          height: 'min(100cqw, 100cqh)',
          position: 'relative',
          background: 'var(--ui-surface)',
          borderRadius: 8,
          border: '1px solid var(--ui-border)',
          overflow: 'hidden',
        }}
      >
        {/* Axis lines */}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgb(var(--ui-gold-rgb) / 0.07)', transform: 'translateX(-0.5px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgb(var(--ui-gold-rgb) / 0.07)', transform: 'translateY(-0.5px)', pointerEvents: 'none' }} />

        {/* Guides — the unit circle and the wordless core — plus each word's move */}
        <svg
          viewBox="0 0 100 100"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        >
          <circle cx={50} cy={50} r={45} fill="none" stroke="rgb(var(--ui-gold-rgb) / 0.08)" strokeWidth={0.25} />
          <circle cx={50} cy={50} r={45 * 0.18} fill="none" stroke="rgb(var(--ui-gold-rgb) / 0.08)" strokeWidth={0.25} strokeDasharray="0.8 0.8" />
          {moveFrom && showMoves && emotions.map(e => {
            const from = fromById.get(e.id);
            const dimmed = visibleIds !== null && !visibleIds.has(e.id);
            // A word the field doesn't have today: ring it instead of drawing a move.
            if (!from) {
              return (
                <circle
                  key={e.id}
                  cx={pct(e.x)} cy={pct(-e.y)} r={1.3}
                  fill="none" stroke="var(--ui-recorded)" strokeWidth={0.3}
                  opacity={dimmed ? 0.1 : 0.9}
                />
              );
            }
            return (
              <g key={e.id} opacity={dimmed ? 0.1 : 1}>
                <line
                  x1={pct(from.x)} y1={pct(-from.y)} x2={pct(e.x)} y2={pct(-e.y)}
                  stroke={colors?.get(e.cluster) ?? 'rgb(var(--ui-gold-rgb) / 0.35)'}
                  strokeOpacity={0.35}
                  strokeWidth={0.2}
                />
                <circle cx={pct(from.x)} cy={pct(-from.y)} r={0.35} fill="var(--ui-text-3)" />
              </g>
            );
          })}
        </svg>

        {/* Axis labels */}
        <div style={{ ...AXIS_LABEL, top: 7, left: '50%', transform: 'translateX(-50%)' }}>Positive</div>
        <div style={{ ...AXIS_LABEL, bottom: 7, left: '50%', transform: 'translateX(-50%)' }}>Negative</div>
        <div style={{ ...AXIS_LABEL, left: 7, top: '50%', transform: 'translateY(-50%) rotate(-90deg)', transformOrigin: 'center center' }}>Calm</div>
        <div style={{ ...AXIS_LABEL, right: 7, top: '50%', transform: 'translateY(-50%) rotate(90deg)', transformOrigin: 'center center' }}>Activated</div>

        {/* Emotion dots */}
        {emotions.map(e => (
          <AdminDot
            key={e.id}
            emotion={e}
            selected={selectedId === e.id}
            dimmed={visibleIds !== null && !visibleIds.has(e.id)}
            readOnly={readOnly}
            showLabel={showLabels}
            color={colors?.get(e.cluster)}
            mapRef={mapRef}
            onSelect={onSelect}
            onUpdate={onUpdate}
          />
        ))}
      </div>
      </div>
    </div>
  );
}
