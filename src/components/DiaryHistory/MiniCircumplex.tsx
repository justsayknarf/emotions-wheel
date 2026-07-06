import type { PinEntry } from '../../types';

interface Props {
  pins: PinEntry[];
  size?: number;
}

// Same formula as EmotionField: maps [-1,1] → [5,95]%
function toPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}

export function MiniCircumplex({ pins, size = 80 }: Props) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: '1px solid var(--oura-border)',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {pins.map(pin => (
        <div
          key={pin.id}
          style={{
            position: 'absolute',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--oura-gold)',
            left: `${toPercent(pin.x)}%`,
            top: `${toPercent(-pin.y)}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}
