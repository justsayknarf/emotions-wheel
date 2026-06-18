import type { DiaryEntry } from '../../types';

interface Props {
  entry: DiaryEntry;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function DiaryEntryRow({ entry }: Props) {
  const labels = entry.emotions.map((e) => e.label);
  const displayLabels = labels.length > 7
    ? labels.slice(0, 7).join(', ') + ` +${labels.length - 7} more`
    : labels.join(', ');

  return (
    <div
      style={{
        padding: '16px 0',
        borderBottom: '1px solid rgba(232, 224, 216, 0.08)',
      }}
    >
      <div style={{
        fontSize: 12,
        color: 'rgba(232, 224, 216, 0.35)',
        marginBottom: 6,
        letterSpacing: '0.02em',
      }}>
        {formatDate(entry.timestamp)}
      </div>
      <div style={{
        fontSize: 15,
        color: 'rgba(232, 224, 216, 0.85)',
        lineHeight: 1.5,
      }}>
        {displayLabels}
      </div>
    </div>
  );
}
