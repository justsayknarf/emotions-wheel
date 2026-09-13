import { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { last30Days, dailyAggregates, dateKey, gapWeight, MIN_RENDER_WEIGHT } from '../../utils/diaryAggregation';
import { ChartLegend } from './ChartLegend';
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

const DAY_MS = 24 * 60 * 60 * 1000;
// Adjacent days render at full weight; a 4-day gap renders faint; a 7+ day
// gap falls below MIN_RENDER_WEIGHT and isn't drawn. Suggested starting
// values (see plan U2) -- tune by eye against real data.
const WEEK_FULL_WEIGHT_MS = DAY_MS;
const WEEK_DECAY_MS = 2 * DAY_MS;

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
    const key = dateKey(d);
    return aggregates.get(key) ?? null;
  });

  // Connect each day with data to the next day with data (skipping gaps),
  // weighting each connecting segment by how much time that gap spans.
  // A gap wide enough to fall below MIN_RENDER_WEIGHT draws no segment at
  // all -- the formula's own limiting case, not a separate break rule.
  const presentIndices: number[] = [];
  data.forEach((d, i) => { if (d !== null) presentIndices.push(i); });

  const weekSegments: Array<{ i: number; j: number; weight: number }> = [];
  for (let k = 1; k < presentIndices.length; k++) {
    const i = presentIndices[k - 1];
    const j = presentIndices[k];
    const weight = gapWeight((j - i) * DAY_MS, WEEK_FULL_WEIGHT_MS, WEEK_DECAY_MS);
    if (weight > MIN_RENDER_WEIGHT) weekSegments.push({ i, j, weight });
  }

  const maxDrag = Math.max(0, SVG_W - containerWidth);

  return (
    <div>
      <ChartLegend style={{ padding: '0 16px 8px' }} />
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
              stroke="var(--ui-border)"
              strokeWidth={1}
            />

            {/* Valence segments */}
            {weekSegments.map(({ i, j, weight }) => (
              <line
                key={`vs-${i}-${j}`}
                x1={colCenterX(i)} y1={yForValue(data[i]!.valence)}
                x2={colCenterX(j)} y2={yForValue(data[j]!.valence)}
                stroke="var(--ui-gold)"
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={0.9 * weight}
              />
            ))}

            {/* Arousal segments */}
            {weekSegments.map(({ i, j, weight }) => (
              <line
                key={`as-${i}-${j}`}
                x1={colCenterX(i)} y1={yForValue(data[i]!.arousal)}
                x2={colCenterX(j)} y2={yForValue(data[j]!.arousal)}
                stroke="var(--ui-recorded)"
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={weight}
              />
            ))}

            {/* Dots */}
            {data.map((d, i) => d === null ? null : (
              <g key={`dots-${i}`}>
                <circle cx={colCenterX(i)} cy={yForValue(d.valence)} r={3.5} fill="var(--ui-gold)" />
                <circle cx={colCenterX(i)} cy={yForValue(d.arousal)} r={3.5} fill="var(--ui-recorded)" />
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
                fill="var(--ui-text-3)"
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
    </div>
  );
}

