import { toPercent } from '../../utils/fieldGeometry';
import type { PinEntry } from '../../types';

interface Props {
  pins: PinEntry[];
  size?: number;
  // A faint crosshair through the center, clipped to the circle by the
  // same overflow:hidden as the dots — off by default so existing
  // call sites are unaffected; opt in where a single, unfamiliar
  // instance needs its axes legible at a glance rather than implied.
  showAxes?: boolean;
  // Makes each pin's dot tappable — off by default (undefined) so the two
  // existing read-only call sites (SessionDetailCard, SavedCheckInSummary)
  // are unaffected, same reasoning as showAxes above.
  onPinTap?: (pinId: string) => void;
}

export function MiniCircumplex({ pins, size = 80, showAxes = false, onPinTap }: Props) {
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      {/* Visual layer — clipped to the circle */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        border: '1px solid var(--ui-border)',
        overflow: 'hidden',
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

      {/* Tap-target layer — deliberately unclipped, so an enlarged hit
          area near the circle's edge isn't cut off by the visual layer's
          overflow:hidden above. */}
      {onPinTap && pins.map(pin => (
        <button
          key={pin.id}
          onClick={() => onPinTap(pin.id)}
          aria-label={`Open check-in at ${pin.x.toFixed(2)}, ${pin.y.toFixed(2)}`}
          style={{
            position: 'absolute',
            width: 20,
            height: 20,
            left: `${toPercent(pin.x)}%`,
            top: `${toPercent(-pin.y)}%`,
            transform: 'translate(-50%, -50%)',
            background: 'transparent',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}
