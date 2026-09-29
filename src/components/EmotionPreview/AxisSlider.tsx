import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { flightDuration, flightValue, isGrab, stepWeighted, type SliderWeight } from '../../utils/sliderWeight';

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
  weight,
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
  // Night-sky mode only: the thumb chases the pointer at a capped speed and a
  // tap away from it flies there. Omitted, the slider jumps to the pointer.
  weight?: SliderWeight;
}) {
  const tone = ACCENT[accent];
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const valueAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return value;
    return clampUnit(((clientX - r.left) / r.width) * 2 - 1);
  };

  // Weighted mode (night sky): the shown value chases the pointer instead of
  // jumping to it, and a tap away from the thumb flies there. `shown` is what
  // the thumb, fill and onDrag report; `value` from the parent stays the
  // committed value between gestures.
  const [shown, setShown] = useState(value);
  const [pull, setPull] = useState<number | null>(null); // pointer's value while held
  const motion = useRef<
    | { kind: 'idle' }
    | { kind: 'held'; target: number }
    | { kind: 'flight'; from: number; to: number; t0: number; dur: number }
  >({ kind: 'idle' });
  const shownRef = useRef(value);
  const rafRef = useRef(0);
  // The frame loop outlives the render that started it, so it calls the
  // parent through a ref and never holds a stale onDrag/onCommit/onCancel.
  const cb = useRef({ onDrag, onCommit, onCancel });
  useEffect(() => {
    cb.current = { onDrag, onCommit, onCancel };
  });

  // Follow the parent's value while idle (a field press moved the pin).
  useEffect(() => {
    if (motion.current.kind === 'idle') { shownRef.current = value; setShown(value); }
  }, [value]);

  const run = (w: SliderWeight) => {
    cancelAnimationFrame(rafRef.current);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = motion.current;
      if (m.kind === 'idle') return;
      let v = shownRef.current;
      if (m.kind === 'held') v = stepWeighted(v, m.target, dt, w);
      else v = flightValue(m.from, m.to, (now - m.t0) / 1000, m.dur);
      shownRef.current = v;
      setShown(v);
      cb.current.onDrag(v);
      if (m.kind === 'flight' && now - m.t0 >= m.dur * 1000) {
        motion.current = { kind: 'idle' };
        cb.current.onCommit(m.to);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Unmount mid-gesture reverts rather than commits (R17). The refs are read
  // at unmount on purpose: they hold the live gesture, not a DOM node.
  useEffect(() => {
    const motionRef = motion;
    const raf = rafRef;
    const callbacks = cb;
    return () => {
      cancelAnimationFrame(raf.current);
      if (motionRef.current.kind !== 'idle') callbacks.current.onCancel();
    };
  }, []);

  const thumbPx = (v: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    return r ? r.left + ((v + 1) / 2) * r.width : 0;
  };

  const weightedHandlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation(); e.preventDefault();
      if (!weight) return;
      onGrab?.();
      const v = valueAt(e.clientX);
      if (isGrab(e.clientX, thumbPx(shownRef.current), weight.grabPx)) {
        // Grabbing mid-flight stops the flight where it is (R17).
        motion.current = { kind: 'held', target: v };
        trackRef.current?.setPointerCapture(e.pointerId);
        draggingRef.current = true;
        setPull(v);
        run(weight);
      } else if (reducedMotion) {
        // Reduced motion: a tap lands at once instead of flying. The held
        // drag above stays weighted — that's control, not decoration.
        cancelAnimationFrame(rafRef.current);
        motion.current = { kind: 'idle' };
        shownRef.current = v;
        setShown(v);
        cb.current.onDrag(v);
        cb.current.onCommit(v);
      } else {
        const from = shownRef.current;
        motion.current = { kind: 'flight', from, to: v, t0: performance.now(), dur: flightDuration(from, v, weight) };
        run(weight);
      }
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current || motion.current.kind !== 'held') return;
      const v = valueAt(e.clientX);
      motion.current = { kind: 'held', target: v };
      setPull(v);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      trackRef.current?.releasePointerCapture(e.pointerId);
      setPull(null);
      motion.current = { kind: 'idle' };
      cancelAnimationFrame(rafRef.current);
      cb.current.onCommit(shownRef.current); // where the thumb is, not the pointer (R15)
    },
    onPointerCancel: () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setPull(null);
      motion.current = { kind: 'idle' };
      cancelAnimationFrame(rafRef.current);
      cb.current.onCancel();
    },
  };

  // Today's jump-to-pointer slider, untouched, for flat mode and the landing page.
  const flatHandlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      // Select this pin as the drag begins so the field's adjust ghost/travel
      // overlay anchors to the pin actually being moved (not whichever card
      // happened to be selected).
      onGrab?.();
      draggingRef.current = true;
      trackRef.current?.setPointerCapture(e.pointerId);
      onDrag(valueAt(e.clientX));
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => { if (draggingRef.current) onDrag(valueAt(e.clientX)); },
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      trackRef.current?.releasePointerCapture(e.pointerId);
      onCommit(valueAt(e.clientX));
    },
    onPointerCancel: () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      // The browser took the gesture away — a notification, the OS reading
      // the drag as a system swipe, a palm on the glass. The user never let
      // go, so there is nothing to commit: revert rather than record a
      // coordinate they didn't choose.
      onCancel();
    },
  };
  const handlers = weight ? weightedHandlers : flatHandlers;

  const drawn = weight ? shown : value;
  const p = pct(drawn);

  return (
    <div style={{ opacity, transition: reducedMotion ? 'none' : 'opacity 0.25s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={endLabelStyle}>{labelLow}</span>
        <span style={endLabelStyle}>{labelHigh}</span>
      </div>
      <div
        ref={trackRef}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
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
            left: drawn >= 0 ? '50%' : `${p}%`,
            right: drawn >= 0 ? `${100 - p}%` : '50%',
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
        {/* pull marker — where the pointer is while the thumb chases it */}
        {pull !== null && (
          <>
            <div style={{ position: 'absolute', top: '50%', height: 1, marginTop: -0.5, left: `${Math.min(pct(drawn), pct(pull))}%`, width: `${Math.abs(pct(pull) - pct(drawn))}%`, background: 'rgb(var(--ui-gold-rgb) / 0.4)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: '50%', width: 11, height: 11, marginTop: -5.5, marginLeft: -5.5, left: `${pct(pull)}%`, borderRadius: '50%', border: '1px solid rgb(var(--ui-gold-rgb) / 0.55)', pointerEvents: 'none' }} />
          </>
        )}
      </div>
    </div>
  );
}
