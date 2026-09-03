import { forwardRef, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { AxisSlider } from './AxisSlider';
import type { PinEntry } from '../../types';

// Matches CoordinateCard.tsx's own FIELD_SERIF — this surface is for
// recording a feeling, not reading data — same warm serif as the field's
// own words and every other caption in this app.
const FIELD_SERIF = "'Palatino', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

// docs/plans/2026-09-02-001-feat-newtab-departure-float-plan.md, U3/KTD4 —
// values validated live against an interactive mockup during design
// exploration. Frosted, not solid: the field still reads through as soft
// color and motion, rather than text and thumbs sitting directly on
// whatever word or glow happens to be behind them.
const RESTING_BACKGROUND = 'rgba(13,15,20,0.42)';
const RESTING_BLUR = 'blur(18px) saturate(1.15)';
const DRAGGING_BACKGROUND = 'rgba(13,15,20,0.14)';
const DRAGGING_BLUR = 'blur(7px) saturate(1.05)';

interface Props {
  // The previous check-in's anchor pin, or the synthetic neutral (0,0) pin
  // when there's none yet (App.tsx's departureAnchor already resolves this).
  anchor: PinEntry;
  onDepart: (x: number, y: number) => void;
  // Live coordinate while a slider is being dragged (field preview only);
  // null once released or cancelled. Distinct from CoordinateCard's own
  // onDepartureDragProgress — that prop is unrelated to this one and stays
  // wired to the ordinary rail/sheet departure-mark card exactly as before.
  onDepartureDrag?: (coord: { x: number; y: number } | null) => void;
  // True when `anchor` is the synthetic (0,0) neutral pin rather than a real
  // previous check-in (EmotionDrawer's own neutralDepartureEligible). A
  // returning user's anchor.regionDescription.relational is genuine context
  // ("last time you were near X") — but for a brand-new user it's always the
  // same fixed description of the untouched center point, which reads as an
  // opaque, unexplained label rather than anything they did. Swaps the
  // caption for a plain instruction in that case only.
  firstTime?: boolean;
}

export const DepartureFloat = forwardRef<HTMLDivElement, Props>(function DepartureFloat(
  { anchor, onDepart, onDepartureDrag, firstTime = false },
  ref,
) {
  const reduced = useReducedMotion();

  // Live drag draft — mirrors CoordinateCard's own draft/draftRef pattern so
  // the untouched axis is taken from the latest in-flight value even when
  // both axes are dragged in the same tick.
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const draftRef = useRef<{ x: number; y: number } | null>(null);
  const [draggingAxis, setDraggingAxis] = useState<'x' | 'y' | null>(null);
  const curX = draft?.x ?? anchor.x;
  const curY = draft?.y ?? anchor.y;

  const nextFrom = (axis: 'x' | 'y', v: number) => {
    const base = draftRef.current ?? { x: anchor.x, y: anchor.y };
    return { x: axis === 'x' ? v : base.x, y: axis === 'y' ? v : base.y };
  };

  const dragDeparture = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = next;
    setDraft(next);
    setDraggingAxis(axis);
    onDepartureDrag?.(next);
  };
  const commitDeparture = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = null;
    setDraft(null);
    setDraggingAxis(null);
    onDepartureDrag?.(null);
    onDepart(next.x, next.y);
  };
  const cancelDeparture = () => {
    draftRef.current = null;
    setDraft(null);
    setDraggingAxis(null);
    onDepartureDrag?.(null);
  };

  const dragging = draggingAxis !== null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(380px, 92vw)',
        zIndex: 40,
        outline: 'none',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          padding: '20px 22px 22px',
          borderRadius: 20,
          background: dragging ? DRAGGING_BACKGROUND : RESTING_BACKGROUND,
          backdropFilter: dragging ? DRAGGING_BLUR : RESTING_BLUR,
          WebkitBackdropFilter: dragging ? DRAGGING_BLUR : RESTING_BLUR,
          border: `1px solid ${dragging ? 'transparent' : 'var(--ui-border)'}`,
          boxShadow: dragging ? 'none' : '0 10px 30px rgba(0,0,0,0.28)',
          transition: reduced
            ? 'none'
            : 'background 0.28s ease, backdrop-filter 0.28s ease, border-color 0.28s ease, box-shadow 0.28s ease',
        }}
      >
        <AxisSlider
          labelLow="Calm"
          labelHigh="Activated"
          value={curX}
          origin={anchor.x}
          accent="recorded"
          onDrag={(v) => dragDeparture('x', v)}
          onCommit={(v) => commitDeparture('x', v)}
          onCancel={cancelDeparture}
          opacity={draggingAxis !== null && draggingAxis !== 'x' ? 0.3 : 1}
          reducedMotion={!!reduced}
        />
        <AxisSlider
          labelLow="Negative"
          labelHigh="Positive"
          value={curY}
          origin={anchor.y}
          accent="recorded"
          onDrag={(v) => dragDeparture('y', v)}
          onCommit={(v) => commitDeparture('y', v)}
          onCancel={cancelDeparture}
          opacity={draggingAxis !== null && draggingAxis !== 'y' ? 0.3 : 1}
          reducedMotion={!!reduced}
        />
        {/* No "reopen this entry instead" link here — this landing is
            centered, alone, with nothing to distinguish it from an ordinary
            docked card the way the rail's own departure-mark card has (that
            one, in CoordinateCard.tsx's readOnly+departure body, keeps its
            link unchanged). Reopening the previous check-in is still
            reachable from its own card once this landing hands off to the
            post-mint view. */}
        <p
          style={{
            margin: 0,
            fontFamily: FIELD_SERIF,
            fontSize: 13.5,
            fontStyle: 'italic',
            color: 'var(--ui-text-2)',
            textAlign: 'center',
            opacity: dragging ? 0.45 : 1,
            transition: 'opacity 0.2s ease',
          }}
        >
          {firstTime ? 'Move the sliders to match how you feel.' : anchor.regionDescription.relational}
        </p>
      </div>
    </div>
  );
});
