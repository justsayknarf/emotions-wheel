import { sessionAverage } from '../../utils/diaryAggregation';
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

function xForHour(fractionalHour: number): number {
  return MARGIN_X + (fractionalHour / 23) * CHART_W;
}

function yForValue(v: number): number {
  // v ∈ [−1, 1]; +1 → top (small y), −1 → bottom (large y)
  return MARGIN_Y + ((1 - v) / 2) * CHART_H;
}

const TICK_HOURS = [0, 6, 12, 18];
const TICK_LABELS: Record<number, string> = { 0: '12a', 6: '6a', 12: '12p', 18: '6p' };

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

  // Build polyline point strings
  const valencePoints = points.map(p => `${xForHour(p.hour)},${yForValue(p.valence)}`).join(' ');
  const arousalPoints = points.map(p => `${xForHour(p.hour)},${yForValue(p.arousal)}`).join(' ');

  return (
    <div style={{
      margin: '0 16px 4px',
      background: 'var(--oura-surface)',
      borderRadius: 12,
      padding: '8px 0 0',
      overflow: 'hidden',
    }}>
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
            fill="var(--oura-text-3)"
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
          stroke="var(--oura-border)"
          strokeWidth={1}
        />

        {/* Valence polyline */}
        {points.length > 1 && (
          <polyline
            points={valencePoints}
            fill="none"
            stroke="var(--oura-gold)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        )}

        {/* Arousal polyline */}
        {points.length > 1 && (
          <polyline
            points={arousalPoints}
            fill="none"
            stroke="var(--oura-gold-dim)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Dots — valence */}
        {points.map(p => (
          <g key={`v-${p.entry.id}`}>
            <circle
              cx={xForHour(p.hour)}
              cy={yForValue(p.valence)}
              r={4}
              fill="var(--oura-gold)"
            />
            {/* Transparent hit target */}
            <circle
              cx={xForHour(p.hour)}
              cy={yForValue(p.valence)}
              r={12}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onDotTap(p.entry)}
            />
          </g>
        ))}

        {/* Dots — arousal */}
        {points.map(p => (
          <g key={`a-${p.entry.id}`}>
            <circle
              cx={xForHour(p.hour)}
              cy={yForValue(p.arousal)}
              r={4}
              fill="var(--oura-gold-dim)"
            />
            <circle
              cx={xForHour(p.hour)}
              cy={yForValue(p.arousal)}
              r={12}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onDotTap(p.entry)}
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
