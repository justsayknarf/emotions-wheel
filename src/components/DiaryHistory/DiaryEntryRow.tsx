import { labelForId } from '../../data/emotions';
import type { DiaryEntry } from '../../types';

interface Props {
  entry: DiaryEntry;
  onClick?: () => void;
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

export function DiaryEntryRow({ entry, onClick }: Props) {
  const recognizedLabels = entry.pins
    .flatMap((p) => p.recognizedWords)
    .map(labelForId);

  let displayText: string;
  if (recognizedLabels.length > 0) {
    const truncated = recognizedLabels.length > 7
      ? recognizedLabels.slice(0, 7).join(', ') + ` +${recognizedLabels.length - 7} more`
      : recognizedLabels.join(', ');
    displayText = truncated;
  } else if (entry.pins.length > 0) {
    // Fall back to the first pin's relational description (strips markdown asterisks)
    displayText = entry.pins[0].regionDescription.relational.replace(/\*/g, '');
  } else {
    displayText = '—';
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: '16px 0',
        borderBottom: '1px solid var(--oura-border)',
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      <div style={{
        fontSize: 10,
        color: 'var(--oura-text-3)',
        marginBottom: 6,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontWeight: 500,
      }}>
        {formatDate(entry.timestamp)}
      </div>
      <div style={{
        fontSize: 15,
        color: 'var(--oura-text-1)',
        lineHeight: 1.5,
        fontWeight: 300,
        letterSpacing: '0.01em',
      }}>
        {displayText}
      </div>
    </div>
  );
}
