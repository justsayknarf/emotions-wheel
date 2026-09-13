import { sessionAverage, buildWeightedSegments } from '../../utils/diaryAggregation';
import { ChartLegend } from './ChartLegend';
import type { DiaryEntry } from '../../types';

interface Props {
  sessions: DiaryEntry[];
  onDotTap: (entry: DiaryEntry) => void;
}

// SVG coordinate mapping
const SVG_W = 280;
const SVG_H = 80;
const MARGIN_X = 14;
const MARGIN_Y = 10;
const CHART_W = SVG_W - MARGIN_X * 2;
const CHART_H = SVG_H - MARGIN_Y * 2 - 16; // 16px reserved for x-axis labels

const HOUR_MS = 60 * 60 * 1000;
// Check-ins within 6h render at full weight; a same-day 15h gap renders
// visibly faded, not gone. Suggested starting values (see plan U3) --
// tune by eye against real data.
const DAY_FULL_WEIGHT_MS = 6 * HOUR_MS;
const DAY_DECAY_MS = 18 * HOUR_MS;

function xForHour(fractionalHour: number): number {
  return MARGIN_X + (fractionalHour / 23) * CHART_W;
}

function yForValue(v: number): number {
  // v ∈ [−1, 1]; +1 → top (small y), −1 → bottom (large y)
  return MARGIN_Y + ((1 - v) / 2) * CHART_H;
}

const TICK_HOURS = [0, 6, 12, 18];
const TICK_LABELS: Record<number, string> = { 0: '12a', 6: '6a', 12: '12p', 18: '6p' };

// Valence and arousal render identically apart from color and ceiling
// opacity -- one series list drives both the segment and dot loops so
// the two can't silently drift apart.
const SERIES = [
  { key: 'valence' as const, color: 'var(--ui-gold)', opacityMul: 0.9 },
  { key: 'arousal' as const, color: 'var(--ui-recorded)', opacityMul: 1 },
];

export function DayChart({ sessions, onDotTap }: Props) {
  // Build data points: sorted by time, with session average
  type Point = { entry: DiaryEntry; hour: number; valence: number; arousal: number };
  const points: Point[] = [];

  for (const entry of [...sessions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )) {
    const avg = sessionAverage(entry);
    if (avg === null) continue;
    const d = new Date(entry.timestamp);
    const hour = d.getHours() + d.getMinutes() / 60;
    points.push({ entry, hour, valence: avg.valence, arousal: avg.arousal });
  }

  // Connect each consecutive pair of check-ins, weighting the segment by
  // how many hours separate them -- an 8am/11pm pair now reads as thin
  // evidence instead of a confident, continuous line.
  const daySegments = buildWeightedSegments(
    points.map((_, i) => i),
    (i, j) => (points[j].hour - points[i].hour) * HOUR_MS,
    DAY_FULL_WEIGHT_MS,
    DAY_DECAY_MS,
  );

  return (
    <div style={{
      margin: '0 16px 4px',
      background: 'var(--ui-surface)',
      borderRadius: 12,
      padding: '10px 0 0',
      overflow: 'hidden',
    }}>
      <ChartLegend style={{ padding: '0 14px 8px' }} />
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ display: 'block' }}
      >
        {/* X-axis tick labels */}
        {TICK_HOURS.map(h => (
          <text
            key={h}
            x={xForHour(h)}
            y={SVG_H - 4}
            textAnchor="middle"
            fontSize={8}
            fill="var(--ui-text-3)"
            fontFamily="inherit"
            letterSpacing="0.06em"
          >
            {TICK_LABELS[h]}
          </text>
        ))}

        {/* Zero line (faint) */}
        <line
          x1={MARGIN_X} y1={yForValue(0)}
          x2={SVG_W - MARGIN_X} y2={yForValue(0)}
          stroke="var(--ui-border)"
          strokeWidth={1}
        />

        {/* Segments, one pass per series */}
        {SERIES.flatMap(s => daySegments.map(({ i, j, weight }) => (
          <line
            key={`${s.key}-seg-${i}-${j}`}
            x1={xForHour(points[i].hour)} y1={yForValue(points[i][s.key])}
            x2={xForHour(points[j].hour)} y2={yForValue(points[j][s.key])}
            stroke={s.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={s.opacityMul * weight}
          />
        )))}

        {/* Dots, one pass per series */}
        {SERIES.flatMap(s => points.map(p => (
          <g key={`${s.key}-${p.entry.id}`}>
            <circle cx={xForHour(p.hour)} cy={yForValue(p[s.key])} r={4} fill={s.color} />
            {/* Transparent hit target */}
            <circle
              cx={xForHour(p.hour)}
              cy={yForValue(p[s.key])}
              r={12}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onDotTap(p.entry)}
            />
          </g>
        )))}
      </svg>
    </div>
  );
}
