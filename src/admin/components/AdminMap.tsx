import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type { AdminEmotion } from '../types';
import { AdminDot } from './AdminDot';

interface Props {
  emotions: AdminEmotion[];
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
  color: 'rgba(201,168,124,0.25)',
  pointerEvents: 'none',
};

export function AdminMap({ emotions, selectedId, visibleIds, onSelect, onUpdate }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{
      flex: '0 0 50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRight: '1px solid var(--oura-border)',
      overflow: 'hidden',
    }}>
      <div
        ref={mapRef}
        style={{
          height: '100%',
          aspectRatio: '1 / 1',
          maxWidth: '100%',
          position: 'relative',
          background: 'var(--oura-surface)',
          borderRadius: 8,
          border: '1px solid var(--oura-border)',
          overflow: 'hidden',
        }}
      >
        {/* Axis lines */}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(201,168,124,0.07)', transform: 'translateX(-0.5px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(201,168,124,0.07)', transform: 'translateY(-0.5px)', pointerEvents: 'none' }} />

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
            mapRef={mapRef}
            onSelect={onSelect}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  );
}
