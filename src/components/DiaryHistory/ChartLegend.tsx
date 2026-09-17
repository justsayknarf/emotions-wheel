import type { CSSProperties } from 'react';

// Two lines share the same y-range on these charts, so color alone can't
// carry both "which series" and "what the ends mean" — this spells out both,
// reusing the low/high pole wording already established by AxisSlider.
interface Props {
  style?: CSSProperties;
}

const ROW_STYLE: CSSProperties = {
  display: 'flex',
  gap: 16,
  flexWrap: 'wrap',
};

const ITEM_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const LABEL_STYLE: CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ui-text-3)',
  whiteSpace: 'nowrap',
};

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={ITEM_STYLE}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={LABEL_STYLE}>{label}</span>
    </div>
  );
}

export function ChartLegend({ style }: Props) {
  return (
    <div style={{ ...ROW_STYLE, ...style }}>
      <LegendItem color="var(--ui-gold)" label="Negative · Positive" />
      <LegendItem color="var(--ui-recorded)" label="Calm · Activated" />
    </div>
  );
}
