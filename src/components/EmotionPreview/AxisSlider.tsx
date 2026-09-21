import { useRef } from 'react';

// Not exported: nothing outside this file needs these — CoordinateCard.tsx
// (the only other consumer of the slider) only ever passes props to
// AxisSlider, never reaches for its internals. Keeping them module-private
// also satisfies react-refresh/only-export-components, which flags a file
// exporting anything beyond components (a non-primitive export like ACCENT
// or a function like pct/clampUnit isn't covered by allowConstantExport).
const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));
// Coordinate [-1, 1] → [0%, 100%] across a full-width slider track.
const pct = (v: number) => ((v + 1) / 2) * 100;

const endLabelStyle = {
  fontSize: 8,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--ui-text-3)',
};

// Thumb/fill tones per accent — gold for an editable draft pin, recorded for
// the departure card's pre-mint sliders: this coordinate isn't yours yet, so
// it borrows the same cool hue the field already uses for a recorded pin
// rather than the warm gold every other slider gets.
const ACCENT = {
  gold: {
    fill: 'rgb(var(--ui-gold-rgb) / 0.12)',
    thumb: 'radial-gradient(circle at 40% 35%, var(--ui-gold-hi), var(--ui-gold) 62%)',
    ring: '0 0 0 4px rgb(var(--ui-gold-rgb) / 0.12), 0 2px 8px rgb(var(--ui-gold-rgb) / 0.35)',
  },
  recorded: {
    fill: 'rgb(var(--ui-recorded-rgb) / 0.12)',
    thumb: 'radial-gradient(circle at 40% 35%, var(--ui-recorded-hi), var(--ui-recorded) 62%)',
    ring: '0 0 0 4px rgb(var(--ui-recorded-rgb) / 0.12), 0 2px 8px rgb(var(--ui-recorded-rgb) / 0.35)',
  },
} as const;

// A single draggable axis. Reports the value live while dragging (onDrag) and
// once more on release (onCommit) — the caller commits on release. An optional
// origin tick marks a reference point (DepartureFloat's previous check-in, or
// its pin's first drop). A gesture the user never finished (onCancel) reverts
// instead of committing.
export function AxisSlider({
  labelLow,
  labelHigh,
  value,
  origin,
  accent = 'gold',
  anchorValue,
  anchorLabel,
  onGrab,
  onDrag,
  onCommit,
  onCancel,
  opacity = 1,
  reducedMotion = false,
}: {
  labelLow: string;
  labelHigh: string;
  value: number;
  // Omitted where an anchor tick already marks the reference point, so the
  // slider never carries two marks.
  origin?: number;
  accent?: 'gold' | 'recorded';
  // The previous check-in's anchor value on this axis, rendered as a second
  // tick — recorded-dim, carrying `anchorLabel` (e.g. "TUE"). Omitted when
  // there's no previous check-in to compare against.
  anchorValue?: number;
  anchorLabel?: string;
  onGrab?: () => void;
  onDrag: (v: number) => void;
  onCommit: (v: number) => void;
  onCancel: () => void;
  // Faded while a sibling axis on the same card is the one being dragged —
  // the axis actually being touched stays at 1 so the user always has a
  // clear, undimmed target.
  opacity?: number;
  reducedMotion?: boolean;
}) {
  const tone = ACCENT[accent];
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const valueAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return value;
    return clampUnit(((clientX - r.left) / r.width) * 2 - 1);
  };
  const p = pct(value);

  return (
    <div style={{ opacity, transition: reducedMotion ? 'none' : 'opacity 0.25s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={endLabelStyle}>{labelLow}</span>
        <span style={endLabelStyle}>{labelHigh}</span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          // Select this pin as the drag begins so the field's adjust ghost/travel
          // overlay anchors to the pin actually being moved (not whichever card
          // happened to be selected).
          onGrab?.();
          draggingRef.current = true;
          trackRef.current?.setPointerCapture(e.pointerId);
          onDrag(valueAt(e.clientX));
        }}
        onPointerMove={(e) => { if (draggingRef.current) onDrag(valueAt(e.clientX)); }}
        onPointerUp={(e) => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          trackRef.current?.releasePointerCapture(e.pointerId);
          onCommit(valueAt(e.clientX));
        }}
        onPointerCancel={() => {
          if (!draggingRef.current) return;
          draggingRef.current = false;
          // The browser took the gesture away — a notification, the OS reading
          // the drag as a system swipe, a palm on the glass. The user never let
          // go, so there is nothing to commit: revert rather than record a
          // coordinate they didn't choose.
          onCancel();
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          height: 5,
          borderRadius: 3,
          background: 'rgb(var(--ui-text-rgb) / 0.09)',
          cursor: 'pointer',
          touchAction: 'none',
        }}
      >
        {/* fill runs from the center out to the thumb */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            borderRadius: 3,
            background: tone.fill,
            left: value >= 0 ? '50%' : `${p}%`,
            right: value >= 0 ? `${100 - p}%` : '50%',
          }}
        />
        {/* origin tick — a plain reference point, where the caller supplies one */}
        {origin !== undefined && (
          <div style={{ position: 'absolute', top: -3, bottom: -3, width: 1, background: 'var(--ui-text-3)', left: `${pct(origin)}%` }} />
        )}
        {/* anchor tick — the previous check-in's own value on this axis. */}
        {anchorValue !== undefined && (
          <>
            <div style={{ position: 'absolute', top: -3, bottom: -3, width: 1.5, background: 'var(--ui-recorded-dim)', left: `${pct(anchorValue)}%` }} />
            {anchorLabel && (
              <span
                style={{
                  position: 'absolute',
                  top: -14,
                  left: `${pct(anchorValue)}%`,
                  transform: 'translateX(-50%)',
                  fontSize: 7,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ui-recorded)',
                  whiteSpace: 'nowrap',
                }}
              >
                {anchorLabel}
              </span>
            )}
          </>
        )}
        {/* thumb */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            width: 15,
            height: 15,
            marginTop: -7.5,
            marginLeft: -7.5,
            borderRadius: '50%',
            background: tone.thumb,
            boxShadow: tone.ring,
            left: `${p}%`,
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
}
