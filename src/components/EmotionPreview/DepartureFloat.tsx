import { forwardRef, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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

// docs/plans/2026-09-04-001-feat-newtab-first-checkin-simplify-plan.md,
// "animate the transition" follow-up: used twice below (the caption's own
// text swap, and the Save/Discard row mounting) — both need the same
// "measure this child's natural height, animate a wrapper to it" trick
// CoordinateCard.tsx's own captionHeight already uses, so it's pulled out
// here rather than duplicated twice in one file.
function useMeasuredHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // observe() fires once immediately, which supplies the initial
    // measurement — so no setState in the effect body (same convention as
    // CoordinateCard.tsx's own captionHeight effect).
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, height };
}

interface Props {
  // The previous check-in's anchor pin, or the synthetic neutral (0,0) pin
  // when there's none yet (App.tsx's departureAnchor already resolves this).
  // Only ever read before `pin` exists — see `pin` below.
  anchor: PinEntry;
  // docs/plans/2026-09-04-001-feat-newtab-first-checkin-simplify-plan.md,
  // "one continuous card" follow-up: the session's own minted pin, once one
  // exists — null before the first slider release. This component now
  // stays mounted for the whole first-ever new-tab session (mint through
  // Save), not just the pre-mint moment, so the same instance that showed
  // "move the sliders" keeps going instead of handing off to a differently
  // sized card in a different container the instant a pin lands (the
  // "reads like a new component" problem a live screenshot surfaced).
  // While non-null, dragging adjusts THIS pin (onAdjust/onAdjustDraft)
  // instead of minting a new one (onDepart/onDepartureDrag), and the
  // caption swaps to describe it instead of showing the instruction or
  // the anchor's own description.
  pin: PinEntry | null;
  onDepart: (x: number, y: number) => void;
  // Live coordinate while a slider is being dragged (field preview only);
  // null once released or cancelled. Distinct from CoordinateCard's own
  // onDepartureDragProgress — that prop is unrelated to this one and stays
  // wired to the ordinary rail/sheet departure-mark card exactly as before.
  onDepartureDrag?: (coord: { x: number; y: number } | null) => void;
  // Commit an adjusted coordinate for `pin` (a slider was released while
  // `pin` already exists) — the same callback CoordinateCard's own slider
  // uses, reused rather than reinvented.
  onAdjust: (pinId: string, x: number, y: number) => void;
  // Live coordinate while adjusting `pin` (field preview only) — the same
  // shape/callback CoordinateCard's own slider uses (onAdjustDraft),
  // reused so the field's ghost/travel overlay behaves identically
  // regardless of which card is doing the adjusting.
  onAdjustDraft?: (coord: { pinId: string; x: number; y: number } | null) => void;
  // Shown, with Save, only once `pin` exists.
  onDiscard: () => void;
  onSave: () => void;
  // True when `anchor` is the synthetic (0,0) neutral pin rather than a real
  // previous check-in (EmotionDrawer's own isFirstEverCheckIn). A returning
  // user's anchor.regionDescription.relational is genuine context ("last
  // time you were near X") — but for a brand-new user it's always the same
  // fixed description of the untouched center point, which reads as an
  // opaque, unexplained label rather than anything they did. Swaps the
  // pre-mint caption for a plain instruction in that case only. (Only ever
  // true alongside a non-null `pin` too, once one exists — a returning
  // user's session never keeps this component mounted past mint; see
  // EmotionDrawer's own render condition.)
  firstTime?: boolean;
}

export const DepartureFloat = forwardRef<HTMLDivElement, Props>(function DepartureFloat(
  { anchor, pin, onDepart, onDepartureDrag, onAdjust, onAdjustDraft, onDiscard, onSave, firstTime = false },
  ref,
) {
  const reduced = useReducedMotion();

  // Live drag draft — mirrors CoordinateCard's own draft/draftRef pattern so
  // the untouched axis is taken from the latest in-flight value even when
  // both axes are dragged in the same tick. Based on `pin` once it exists
  // (adjusting that pin in place), `anchor` before it does (previewing a
  // fresh departure) — same base either way, just which coordinate is being
  // moved.
  const base = pin ?? anchor;
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const draftRef = useRef<{ x: number; y: number } | null>(null);
  const [draggingAxis, setDraggingAxis] = useState<'x' | 'y' | null>(null);
  const curX = draft?.x ?? base.x;
  const curY = draft?.y ?? base.y;
  // The origin tick: `anchor`'s own position pre-mint (marking what's being
  // departed from), `pin`'s own drop coordinate once it exists (marking
  // travel since the mint, same convention CoordinateCard's own slider
  // uses) — not `anchor` forever, which would freeze at the neutral center
  // and stop reflecting any adjustment made after the first drop.
  const originX = pin ? (pin.origin?.x ?? pin.x) : anchor.x;
  const originY = pin ? (pin.origin?.y ?? pin.y) : anchor.y;

  const nextFrom = (axis: 'x' | 'y', v: number) => {
    const from = draftRef.current ?? { x: base.x, y: base.y };
    return { x: axis === 'x' ? v : from.x, y: axis === 'y' ? v : from.y };
  };

  const dragDeparture = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = next;
    setDraft(next);
    setDraggingAxis(axis);
    if (pin) onAdjustDraft?.({ pinId: pin.id, ...next });
    else onDepartureDrag?.(next);
  };
  const commitDeparture = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = null;
    setDraft(null);
    setDraggingAxis(null);
    if (pin) {
      onAdjustDraft?.(null);
      onAdjust(pin.id, next.x, next.y);
    } else {
      onDepartureDrag?.(null);
      onDepart(next.x, next.y);
    }
  };
  const cancelDeparture = () => {
    draftRef.current = null;
    setDraft(null);
    setDraggingAxis(null);
    if (pin) onAdjustDraft?.(null);
    else onDepartureDrag?.(null);
  };

  const dragging = draggingAxis !== null;

  // Frozen at release, deliberately not live during a drag (matches every
  // other caption in this app — CoordinateCard's own "wordless" caption and
  // this component's own pre-mint anchor description both hold steady
  // through a drag and only resolve on commit): reads `pin`'s own committed
  // regionDescription, never the live `draft` overlay above.
  const caption = pin
    ? pin.regionDescription.relational
    : firstTime
      ? 'Move the sliders to match how you feel.'
      : anchor.regionDescription.relational;

  const { ref: captionRef, height: captionHeight } = useMeasuredHeight();
  const { ref: buttonsRef, height: buttonsHeight } = useMeasuredHeight();

  return (
    <motion.div
      ref={ref}
      tabIndex={-1}
      // Mirrors EmotionDrawer's own post-mint focus-card entrance (opacity
      // 0 -> 1, scale 0.96 -> 1) so this landing always animates in — on
      // the very first mount, and again whenever it remounts after a
      // discarded draft hands the panel back to it (EmotionDrawer's
      // isFocus/pins.length===0 branch swap has no AnimatePresence around
      // it, so only this component's own mount animation can cover that
      // return trip). Stays mounted through mint/adjust/Save now (see
      // `pin` above) — this only ever plays once per landing, not again at
      // the mint moment, since the component itself never unmounts there
      // any more.
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 35 }}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        translate: '-50% -50%',
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
          // translate's own -50%/-50% resolves against this box's current
          // size on every paint, so as the height transitions below make
          // this box taller (a new caption, the Save/Discard row mounting),
          // it grows while staying visually centered for free — no extra
          // position animation needed here.
          transition: reduced
            ? 'none'
            : 'background 0.28s ease, backdrop-filter 0.28s ease, border-color 0.28s ease, box-shadow 0.28s ease',
        }}
      >
        <AxisSlider
          labelLow="Calm"
          labelHigh="Activated"
          value={curX}
          origin={originX}
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
          origin={originY}
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
        {/* Caption dissolve — same shape as CoordinateCard.tsx's own
            caption: an outer wrapper animates to the incoming text's
            measured height (mode="popLayout" pulls the outgoing text out
            of flow first, so the box eases to its new height once instead
            of collapsing into the gap and springing back), while the text
            itself cross-fades on a `key={caption}` swap — any time the
            caption's actual words change (instruction -> placement hint,
            or one placement hint -> the next after an adjustment), not
            just on the firstTime/pin transition. The drag-dim (0.45
            opacity while a slider is live) stays a plain CSS transition on
            this same wrapper, same separation CoordinateCard's own caption
            keeps between "dim while stale" and "dissolve on a real
            change". */}
        <motion.div
          animate={{ height: reduced ? 'auto' : captionHeight ?? 'auto' }}
          transition={{ duration: reduced ? 0 : 0.26, ease: 'easeOut' }}
          style={{
            overflow: 'hidden',
            opacity: dragging ? 0.45 : 1,
            transition: reduced ? 'none' : 'opacity 0.2s ease-out',
          }}
        >
          <div ref={captionRef}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={caption}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.26 } }}
                transition={{ duration: 0.3, delay: 0.05 }}
                style={{
                  margin: 0,
                  fontFamily: FIELD_SERIF,
                  fontSize: 13.5,
                  fontStyle: 'italic',
                  color: 'var(--ui-text-2)',
                  textAlign: 'center',
                }}
              >
                {caption}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
        {/* Save/Discard, appended below the caption once `pin` exists.
            This wrapper stays mounted the whole time (so its own
            ResizeObserver above never disconnects/reconnects) and animates
            between 0 and its measured natural height instead of the row
            simply appearing — the same "animate the real height" approach
            as the caption above, for the same reason: a `layout`-driven
            scale would squash the buttons' text along the way rather than
            growing the box straight down. The content inside fades in on
            its own slight delay, once the height has room for it, and
            fades out first on Discard. Styled to match EmotionDrawer's own
            actionBar buttons exactly (this replaces that bar for the whole
            first-ever session — EmotionDrawer's early return means
            actionBar is never reached while this component is what's
            rendering). */}
        <motion.div
          animate={{ height: reduced ? (pin ? 'auto' : 0) : pin ? buttonsHeight ?? 'auto' : 0 }}
          transition={{ duration: reduced ? 0 : 0.32, ease: 'easeOut' }}
          style={{ overflow: 'hidden' }}
        >
          <div
            ref={buttonsRef}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 18,
              borderTop: '1px solid var(--ui-border)',
              opacity: pin ? 1 : 0,
              transition: reduced ? 'none' : `opacity 0.25s ease-out ${pin ? '0.08s' : '0s'}`,
            }}
          >
            <button
              onClick={onDiscard}
              tabIndex={pin ? 0 : -1}
              style={{
                background: 'none',
                border: '1px solid var(--ui-border)',
                borderRadius: 6,
                padding: '7px 14px',
                color: 'var(--ui-text-2)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Discard Draft
            </button>
            <button
              onClick={onSave}
              tabIndex={pin ? 0 : -1}
              style={{
                background: 'var(--ui-gold)',
                border: 'none',
                borderRadius: 6,
                padding: '7px 18px',
                color: '#0D0F14',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Save  ·  1
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
});
