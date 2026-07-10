import { RECENT_WINDOW_DAYS } from '../../utils/recentEntries';
import type { DiaryEntry } from '../../types';

const DAY_MS = 24 * 60 * 60 * 1000;

// A compact dot-per-day strip conveying recent check-in cadence. One dot per
// day across the shared recent window (oldest left, today right); a day with
// check-ins glows gold, brighter with more, an empty day stays faint.
export function RhythmStrip({ entries }: { entries: DiaryEntry[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const counts: number[] = [];
  for (let i = RECENT_WINDOW_DAYS - 1; i >= 0; i--) {
    const dayStart = today.getTime() - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    counts.push(
      entries.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return t >= dayStart && t < dayEnd;
      }).length,
    );
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {counts.map((n, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background:
              n > 0
                ? `rgba(201,168,124,${Math.min(0.4 + n * 0.25, 1)})`
                : 'rgba(237,232,223,0.12)',
          }}
        />
      ))}
    </div>
  );
}
