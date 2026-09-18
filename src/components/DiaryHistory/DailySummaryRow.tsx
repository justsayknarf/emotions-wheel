import { useMemo } from 'react';
import { sessionAverage, capDots } from '../../utils/diaryAggregation';
import { isSameDay, formatWeekdayAndDate } from '../../utils/formatDate';
import { dayTags } from '../../utils/dayTags';
import { labelForId } from '../../data/emotions';
import type { DiaryEntry } from '../../types';

interface Props {
  date: Date;
  sessions: DiaryEntry[];
  onSelect: (date: Date) => void;
}

// One row per day in the week screen's daily summary list. It is the sole
// navigation surface into a day (see plan Key Technical Decisions), so it
// must be keyboard-operable, unlike DiaryEntryRow which is only one of
// several paths to an entry.
export function DailySummaryRow({ date, sessions, onSelect }: Props) {
  const isToday = isSameDay(date, new Date());
  // Zero-pin entries have no sessionAverage -- they don't render a dot and
  // don't count toward the cap, matching DayChart's null-filtering.
  const renderableCount = sessions.filter(e => sessionAverage(e) !== null).length;
  const { shown, overflow } = capDots(renderableCount);
  const isEmpty = renderableCount === 0;
  // Lowercased so tag words and the "between X and Y" fallback read as one line of prose.
  const tags = useMemo(() => dayTags(sessions, id => labelForId(id).toLowerCase()), [sessions]);

  return (
    <button
      onClick={() => onSelect(date)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        padding: '12px 0',
        borderBottom: '1px solid var(--ui-border)',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        background: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      {/* Spans, not divs -- a button's content model is phrasing-only. */}
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 500,
          color: isEmpty ? 'var(--ui-text-3)' : 'var(--ui-text-2)',
          opacity: isEmpty ? 0.5 : 1,
        }}>
          {formatWeekdayAndDate(date)}
          {isToday && (
            <span style={{
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: 'var(--ui-gold)',
              border: '1px solid var(--ui-gold-dim)',
              borderRadius: 4,
              padding: '1px 4px',
            }}>
              TODAY
            </span>
          )}
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isEmpty ? (
            <span style={{ fontSize: 11, color: 'var(--ui-text-3)', fontWeight: 300 }}>
              No check-ins
            </span>
          ) : (
            <>
              {Array.from({ length: shown }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--ui-gold)',
                  }}
                />
              ))}
              {overflow > 0 && (
                <span style={{ fontSize: 9, color: 'var(--ui-text-3)', marginLeft: 2 }}>
                  +{overflow}
                </span>
              )}
            </>
          )}
        </span>
      </span>

      {tags.shown.length > 0 && (
        <span style={{ paddingLeft: 12, fontSize: 13, color: 'var(--ui-text-2)', fontWeight: 300, lineHeight: 1.5 }}>
          {tags.shown.join(', ')}
          {tags.overflow > 0 && (
            <span style={{ fontSize: 11, color: 'var(--ui-text-3)' }}> +{tags.overflow}</span>
          )}
        </span>
      )}
    </button>
  );
}
