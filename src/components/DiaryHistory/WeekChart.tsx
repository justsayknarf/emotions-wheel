import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { last30Days, dailyAggregates } from '../../utils/diaryAggregation';
import type { DiaryEntry } from '../../types';

interface Props {
  entries: DiaryEntry[];
  onDayTap: (date: Date) => void;
}

const COL_WIDTH = 14;
const TOTAL_COLS = 30;
const SVG_W = COL_WIDTH * TOTAL_COLS; // 420
const SVG_H = 80;
const MARGIN_Y = 10;
const CHART_H = SVG_H - MARGIN_Y * 2 - 14; // 14px for day labels

function yForValue(v: number): number {
  return MARGIN_Y + ((1 - v) / 2) * CHART_H;
}

function colCenterX(i: number): number {
  return i * COL_WIDTH + COL_WIDTH / 2;
}

export function WeekChart({ entries, onDayTap }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setContainerWidth(e.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const days = last30Days();
  const aggregates = dailyAggregates(entries);

  // Build per-day data keyed by array index
  type DayData = { valence: number; arousal: number } | null;
  const data: DayData[] = days.map(d => {
    const key = toDateKey(d);
    return aggregates.get(key) ?? null;
  });

  // Build polyline segments (break on null days)
  const valenceSegments = buildSegments(data, d => d?.valence);
  const arousalSegments = buildSegments(data, d => d?.arousal);

  const maxDrag = Math.max(0, SVG_W - containerWidth);

  return (
    <div ref={containerRef} style={{ overflow: 'hidden', position: 'relative' }}>
      <motion.div
        drag="x"
        dragConstraints={{ left: -maxDrag, right: 0 }}
        dragElastic={0.05}
        initial={{ x: -maxDrag }}
        animate={{ x: -maxDrag }}
        style={{ width: SVG_W, cursor: 'grab' }}
        onPointerDown={e => e.currentTarget.style.cursor = 'grabbing'}
        onPointerUp={e => e.currentTarget.style.cursor = 'grab'}
      >
        <svg width={SVG_W} height={SVG_H} style={{ display: 'block', overflow: 'visible' }}>
          {/* Zero line */}
          <line
            x1={0} y1={yForValue(0)}
            x2={SVG_W} y2={yForValue(0)}
            stroke="var(--oura-border)"
            strokeWidth={1}
          />

          {/* Valence polyline segments */}
          {valenceSegments.map((seg, i) => (
            <polyline
              key={`vs-${i}`}
              points={seg.map(({ idx }) => `${colCenterX(idx)},${yForValue(data[idx]!.valence)}`).join(' ')}
              fill="none"
              stroke="var(--oura-gold)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
            />
          ))}

          {/* Arousal polyline segments */}
          {arousalSegments.map((seg, i) => (
            <polyline
              key={`as-${i}`}
              points={seg.map(({ idx }) => `${colCenterX(idx)},${yForValue(data[idx]!.arousal)}`).join(' ')}
              fill="none"
              stroke="var(--oura-gold-dim)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Dots */}
          {data.map((d, i) => d === null ? null : (
            <g key={`dots-${i}`}>
              <circle cx={colCenterX(i)} cy={yForValue(d.valence)} r={3.5} fill="var(--oura-gold)" />
              <circle cx={colCenterX(i)} cy={yForValue(d.arousal)} r={3.5} fill="var(--oura-gold-dim)" />
            </g>
          ))}

          {/* Day labels every 7 columns */}
          {days.map((day, i) => i % 7 === 0 && (
            <text
              key={`lbl-${i}`}
              x={colCenterX(i)}
              y={SVG_H - 3}
              textAnchor="middle"
              fontSize={7}
              fill="var(--oura-text-3)"
              fontFamily="inherit"
            >
              {day.getDate()}
            </text>
          ))}

          {/* Per-column tap targets */}
          {days.map((day, i) => (
            <rect
              key={`hit-${i}`}
              x={i * COL_WIDTH}
              y={0}
              width={COL_WIDTH}
              height={SVG_H - 14}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onDayTap(day)}
            />
          ))}
        </svg>
      </motion.div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Split a data array into contiguous runs of non-null values. */
function buildSegments<T>(
  data: (T | null)[],
  _getValue: (d: T | null) => number | undefined
): Array<Array<{ idx: number }>> {
  const segments: Array<Array<{ idx: number }>> = [];
  let current: Array<{ idx: number }> | null = null;

  for (let i = 0; i < data.length; i++) {
    if (data[i] !== null) {
      if (!current) { current = []; segments.push(current); }
      current.push({ idx: i });
    } else {
      current = null;
    }
  }
  return segments;
}
