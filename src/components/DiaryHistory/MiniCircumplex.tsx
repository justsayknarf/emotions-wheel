import { toPercent } from '../../utils/fieldGeometry';
import type { PinEntry } from '../../types';

interface Props {
  pins: PinEntry[];
  size?: number;
  // A faint crosshair through the center, clipped to the circle by the
  // same overflow:hidden as the dots — off by default so the existing
  // diary-history call site (a dense grid of these) is unaffected;
  // opt in where a single, unfamiliar instance needs its axes legible
  // at a glance rather than implied.
  showAxes?: boolean;
}

export function MiniCircumplex({ pins, size = 80, showAxes = false }: Props) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      border: '1px solid var(--ui-border)',
      position: 'relative',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {showAxes && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--ui-border)' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'var(--ui-border)' }} />
        </>
      )}
      {pins.map(pin => (
        <div
          key={pin.id}
          style={{
            position: 'absolute',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--ui-gold)',
            left: `${toPercent(pin.x)}%`,
            top: `${toPercent(-pin.y)}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
}
