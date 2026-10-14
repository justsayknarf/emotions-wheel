import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { stopHeading, stripPlayhead, weekFraction, type TourCursor } from '../../data/reflection';
import { last7Days } from '../../utils/diaryAggregation';
import { formatWeekdayShort } from '../../utils/formatDate';
import type { DiaryEntry } from '../../types';

// The week as a strip along the foot of the walk's sky, on desktop only (a
// phone's shorter sky can't spare the height): seven days, a dot per check-in
// at its time, and a playhead that rides with the replay's tour. During the
// replay a dot is a button that goes to that check-in; during the moments the
// playhead rests on the one being looked at.
//
// Not a chart (DESIGN.md: no axes, no grids): no baseline or ticks, just the
// days, the dots and the same faint dotted path the sky draws through the
// week. Colors follow the Two Hues Rule: the check-in in view is gold, the
// ones already passed are the recorded teal, the ones still to come are
// hollow teal rings.

interface Props {
  /** The replay's check-ins, oldest first. */
  entries: DiaryEntry[];
  /** The walk's start: the strip's seven days end on this one. */
  now: Date;
  /** The check-in the replay has reached; later ones are still to come. */
  arrived: number;
  /** The replay's live position, read every frame. */
  cursor: RefObject<TourCursor | null>;
  /** During a moment: the playhead rests on this check-in instead. */
  held: number | null;
  /** During the replay: go to this check-in. */
  onPick: ((index: number) => void) | null;
}

export function WeekStrip({ entries, now, arrived, cursor, held, onPick }: Props) {
  const fractions = useMemo(() => entries.map((e) => weekFraction(e.timestamp, now)), [entries, now]);
  const days = useMemo(() => last7Days(now), [now]);

  // The playhead follows the tour without re-rendering the walk each frame.
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const c = held !== null ? { from: held, to: held, along: 1 } : cursor.current;
      const el = head.current;
      if (el) {
        el.style.opacity = c ? '1' : '0';
        if (c) el.style.left = `${stripPlayhead(fractions, c) * 100}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fractions, cursor, held]);

  return (
    <div
      aria-hidden={onPick ? undefined : true}
      role={onPick ? 'group' : undefined}
      aria-label={onPick ? 'Your week, day by day' : undefined}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2,
        padding: '18px 32px 16px',
        background: 'linear-gradient(to top, rgb(var(--ui-bg-rgb) / 0.9), rgb(var(--ui-bg-rgb) / 0.75) 60%, transparent)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative', height: 44 }}>
        {/* Day columns: a tick at each midnight and the day's name. */}
        {days.map((d, i) => (
          <div
            key={d.getTime()}
            style={{
              position: 'absolute',
              left: `${(i / 7) * 100}%`,
              width: `${100 / 7}%`,
              top: 0,
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.04em',
              color: i === days.length - 1 ? 'var(--ui-text-2)' : 'var(--ui-text-3)',
            }}
          >
            {i === days.length - 1 ? 'Today' : `${formatWeekdayShort(d)} ${d.getDate()}`}
          </div>
        ))}

        {/* The week's path, dotted as on the sky. */}
        {fractions.length > 1 && (
          <svg style={{ position: 'absolute', left: 0, top: 26, width: '100%', height: 8, overflow: 'visible' }}>
            <line
              x1={`${fractions[0] * 100}%`}
              x2={`${fractions[fractions.length - 1] * 100}%`}
              y1={4}
              y2={4}
              style={{ stroke: 'rgb(var(--ui-recorded-rgb) / 0.4)', strokeWidth: 1, strokeDasharray: '2 6' }}
            />
          </svg>
        )}

        {fractions.map((f, i) => {
          const current = held ?? arrived;
          const inView = i === current;
          const passed = held !== null ? !inView : i < arrived;
          const dot = (
            <span
              style={{
                display: 'block',
                width: inView ? 8 : 6,
                height: inView ? 8 : 6,
                borderRadius: '50%',
                boxSizing: 'border-box',
                background: inView ? 'var(--ui-gold)' : passed ? 'rgb(var(--ui-recorded-rgb))' : 'transparent',
                border: inView || passed ? 'none' : '1px solid rgb(var(--ui-recorded-rgb) / 0.6)',
                boxShadow: inView ? '0 0 8px rgb(var(--ui-gold-rgb) / 0.5)' : 'none',
              }}
            />
          );
          const place = { position: 'absolute' as const, left: `${f * 100}%`, top: 30, transform: 'translate(-50%, -50%)' };
          if (!onPick) return <span key={entries[i].id} style={place}>{dot}</span>;
          const h = stopHeading(entries[i].timestamp, now);
          return (
            <button
              key={entries[i].id}
              type="button"
              aria-label={`${h.day}, ${h.detail}`}
              onClick={(e) => { e.stopPropagation(); onPick(i); }}
              style={{
                ...place,
                width: 28,
                height: 28,
                padding: 0,
                border: 'none',
                background: 'none',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
            >
              {dot}
            </button>
          );
        })}

        <div
          ref={head}
          style={{
            position: 'absolute',
            top: 17,
            width: 1.5,
            height: 24,
            marginLeft: -0.75,
            background: 'rgb(var(--ui-gold-rgb) / 0.8)',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}
