import { isSameDay, formatWeekdayAndDate } from '../../utils/formatDate';

interface Props {
  date: Date;
  onPrev: () => void;
  onNext: () => void;
}

const chevronStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--ui-text-2)',
  fontSize: 20,
  lineHeight: 1,
  padding: '4px 8px',
  cursor: 'pointer',
};

export function DayTabHeader({ date, onPrev, onNext }: Props) {
  const isToday = isSameDay(date, new Date());

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 12px 4px',
    }}>
      <button onClick={onPrev} style={chevronStyle}>‹</button>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ui-text-2)',
      }}>
        {formatWeekdayAndDate(date)}
      </span>
      <button
        onClick={onNext}
        disabled={isToday}
        style={{ ...chevronStyle, opacity: isToday ? 0.25 : 1, pointerEvents: isToday ? 'none' : 'auto' }}
      >
        ›
      </button>
    </div>
  );
}
