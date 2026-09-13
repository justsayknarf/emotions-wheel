import { useState } from 'react';
import { MiniCircumplex } from './MiniCircumplex';
import { nearestPins } from '../../utils/diaryAggregation';
import { formatRelative } from '../../utils/formatDate';
import type { DiaryEntry, PinEntry } from '../../types';

interface Props {
  // Already filtered to the visible window by the caller, which needs the
  // same window for its own coverage check -- computed once, shared here.
  windowEntries: DiaryEntry[];
  onOpenEntry: (entry: DiaryEntry) => void;
}

// Where recent check-ins have landed, independent of when they happened —
// a distribution rather than a time series, so it stays meaningful even
// when the charts above it are too sparse to read as a trend.
export function WeekPointCloud({ windowEntries, onOpenEntry }: Props) {
  const [overlapPicker, setOverlapPicker] = useState<DiaryEntry[] | null>(null);

  const pins: PinEntry[] = windowEntries.flatMap(e => e.pins);
  const entryByPinId = new Map<string, DiaryEntry>();
  for (const entry of windowEntries) {
    for (const pin of entry.pins) entryByPinId.set(pin.id, entry);
  }

  function handlePinTap(pinId: string) {
    const target = pins.find(p => p.id === pinId);
    if (!target) return;

    const distinctEntries: DiaryEntry[] = [];
    const seen = new Set<string>();
    for (const pin of nearestPins(pins, target)) {
      const entry = entryByPinId.get(pin.id);
      if (entry && !seen.has(entry.id)) {
        seen.add(entry.id);
        distinctEntries.push(entry);
      }
    }

    // nearestPins always includes `target` itself, so this is never empty.
    if (distinctEntries.length === 1) {
      onOpenEntry(distinctEntries[0]);
    } else {
      setOverlapPicker(distinctEntries);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 16px', position: 'relative' }}>
      <MiniCircumplex pins={pins} size={112} showAxes onPinTap={handlePinTap} />

      {overlapPicker && (
        <>
          {/* Backdrop — dismiss by tapping outside the picker */}
          <div onClick={() => setOverlapPicker(null)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              marginTop: 8,
              background: 'var(--ui-surface)',
              border: '1px solid var(--ui-border)',
              borderRadius: 10,
              padding: 6,
              zIndex: 11,
              minWidth: 160,
            }}
          >
            {overlapPicker.map(entry => (
              <button
                key={entry.id}
                onClick={() => { onOpenEntry(entry); setOverlapPicker(null); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  color: 'var(--ui-text-1)',
                  fontSize: 12,
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                {formatRelative(entry.timestamp)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
