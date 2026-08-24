import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { emotions, labelForId } from '../../data/emotions';
import { nearbyEmotions, type NearbyEmotion } from '../../data/regions';
import { describeDelta, hasNotableDelta } from '../../data/departure';
import type { PinEntry } from '../../types';

// The caption offers the two nearest words as guesses and this many more beneath
// as a neighborhood of tags. (Made tunable in a later step.)
const NEARBY_TAG_COUNT = 5;
// The question is set in a warm serif — this surface is for recording a feeling,
// not reading data — matching the field's own words.
const FIELD_SERIF = "'Palatino', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

// The card's background while a slider drag is active — low enough to see
// a pin move on the field through the card's own body. Tune here. The
// border is dropped entirely during a drag (see CARD_DRAG_BORDER below)
// rather than faded, so it doesn't outline a box around that same view.
const CARD_DRAG_BACKGROUND = 'rgba(22, 24, 32, 0.15)';
const CARD_DRAG_BORDER = 'none';
// Non-active content (header, the sibling axis slider, caption/tags) fades
// to this opacity — the axis actually being dragged stays at 1.
const CARD_DRAG_CONTENT_OPACITY = 0.3;

interface Props {
  pin: PinEntry;
  isSelected: boolean;
  isEntering?: boolean;
  onSelect: () => void;
  onRecognize: (id: string) => void;
  onDerecognize: (id: string) => void;
  onRemove: () => void;
  // Commit an adjusted coordinate for this pin (a slider was released).
  onAdjust: (pinId: string, x: number, y: number) => void;
  // Live draft coordinate during a slider drag (field preview only), carrying
  // the pin id so a shared handler (App.tsx) can tell which card is dragging.
  // Optional.
  onAdjustDraft?: (coord: { pinId: string; x: number; y: number } | null) => void;
  // Tunable timings (seconds) for the word/tag dissolve on a coordinate commit.
  dissolve?: { fadeOut: number; fadeIn: number; hold: number };
  // Always a one-line collapsed summary (R4), no adjustment, no naming (R5) —
  // never expands on its own tap, since a plain tap only selects. Used for
  // two distinct things that happen to look identical at rest: a genuinely
  // read-only previous-check-in pin (nothing to reveal), and a sibling pin
  // within an in-progress edit that simply hasn't been individually expanded
  // yet (something real to reveal, via the reopen/expand control below).
  readOnly?: boolean;
  // The explicit trigger that flips this card from collapsed to editable —
  // either "reopen this recorded check-in" (R22) or, for a sibling pin
  // already part of an in-progress edit, "expand this one too." Only
  // meaningful when readOnly is true.
  onReopen?: () => void;
  // The label on that trigger — "Reopen" for a genuinely untouched previous
  // check-in, "Edit" for a sibling pin within an edit already in progress
  // (reopening the check-in doesn't need reopening twice).
  reopenLabel?: string;
  // Disabled while a DIFFERENT draft already holds pins — there is one
  // draft, so reopening into a non-empty one would either absorb unsaved
  // pins into an existing record on save or discard them on abandon
  // (R18/R27). Not meaningful for a sibling's own expand trigger, which
  // never starts a new reopen. Rendered disabled rather than hidden, per the
  // plan's "renders disabled until the draft is recorded or discarded."
  reopenDisabled?: boolean;
  // U2/R1-R4: the landing state for the previous check-in's anchor pin only
  // (readOnly && showMirror, resolved by the caller) — pre-positioned,
  // interactive sliders that mint a *new* draft pin rather than editing this
  // one. Only meaningful alongside readOnly; ignored otherwise. LC1: Reopen
  // relocates to a plain link below the sliders in this mode, and the
  // header's top-right corner renders nothing — nothing button-shaped
  // competes with the continuous control.
  departure?: boolean;
  // Fires once, on release of the first departure slider drag (or omitted
  // entirely if the user reopens instead) — mints the new draft pin at the
  // committed coordinate. Only meaningful alongside `departure`.
  onDepart?: (x: number, y: number) => void;
  // U3/R9: the previous check-in's anchor coordinate and its relative-day
  // label, for the draft card's own anchor tick + plain-language delta.
  // Only rendered on the ordinary editable body (not readOnly/departure —
  // Reopen's flow compares against a *different*, older check-in, which is
  // out of this unit's scope). Null/omitted when there's no previous
  // check-in, which leaves the card exactly as it was before this unit.
  anchor?: { x: number; y: number } | null;
  anchorLabel?: string | null;
}

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

// A single draggable axis. Reports the value live while dragging (onDrag) and
// once more on release (onCommit) — the card commits on release. The origin tick
// marks where the pin was first dropped, so travel from the felt drop is visible.
// A gesture the user never finished (onCancel) reverts instead of committing.
// Thumb/fill tones per accent — gold for an editable draft pin, recorded for
// the departure card's pre-mint sliders (U2): this coordinate isn't yours
// yet, so it borrows the same cool hue the field already uses for a
// recorded pin (R11) rather than the warm gold every other slider gets.
const ACCENT = {
  gold: {
    fill: 'rgba(201,168,124,0.12)',
    thumb: 'radial-gradient(circle at 40% 35%, #f0d9b5, var(--ui-gold) 62%)',
    ring: '0 0 0 4px rgba(201,168,124,0.12), 0 2px 8px rgba(201,168,124,0.35)',
  },
  recorded: {
    fill: 'rgba(124,147,168,0.12)',
    thumb: 'radial-gradient(circle at 40% 35%, #c3ceda, var(--ui-recorded) 62%)',
    ring: '0 0 0 4px rgba(124,147,168,0.12), 0 2px 8px rgba(124,147,168,0.35)',
  },
} as const;

function AxisSlider({
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
  origin: number;
  accent?: 'gold' | 'recorded';
  // U3/R9: the previous check-in's anchor value on this axis, rendered as a
  // second tick distinct from the origin tick above — recorded-dim rather
  // than text-3, and carrying `anchorLabel` (e.g. "TUE") so the two ticks
  // read as different *kinds* of thing, not two of the same. Omitted when
  // there's no previous check-in to compare against.
  anchorValue?: number;
  anchorLabel?: string;
  onGrab?: () => void;
  onDrag: (v: number) => void;
  onCommit: (v: number) => void;
  onCancel: () => void;
  // Faded while a sibling axis on this same card is the one being dragged
  // (see CoordinateCard's `draggingAxis`) — the axis actually being touched
  // stays at 1 so the user always has a clear, undimmed target.
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
          background: 'rgba(237,232,223,0.09)',
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
        {/* origin tick — where this pin was dropped */}
        <div style={{ position: 'absolute', top: -3, bottom: -3, width: 1, background: 'var(--ui-text-3)', left: `${pct(origin)}%` }} />
        {/* anchor tick — the previous check-in's own value on this axis
            (U3/R9). recorded-dim + a label, deliberately not styled like the
            plain origin tick above: two ticks that looked like the same kind
            of mark is exactly the overload the field-side decisions (U4/U5)
            were made to avoid. Renders even when it coincides with the
            origin tick — nothing doubles, since the origin tick never
            carries a label of its own. */}
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

export function CoordinateCard({ pin, isSelected, isEntering = false, onSelect, onRecognize, onDerecognize, onRemove, onAdjust, onAdjustDraft, dissolve, readOnly = false, onReopen, reopenLabel = 'Reopen', reopenDisabled = false, departure = false, onDepart, anchor = null, anchorLabel = null }: Props) {
  const recognizedSet = new Set(pin.recognizedWords);

  // The accent that marks this card as recorded rather than draft (R6) — the
  // same cool hue the field already uses for a recorded pin (U4), so the
  // treatment reads consistently between the two surfaces.
  const accentDim = readOnly ? 'var(--ui-recorded-dim)' : 'var(--ui-gold-dim)';

  // The slot dissolve on a coordinate commit — tunable, and collapsed to an
  // instant swap when the viewer prefers reduced motion.
  const reduced = useReducedMotion();
  const fadeOut = reduced ? 0 : dissolve?.fadeOut ?? 0.26;
  const fadeIn = reduced ? 0 : dissolve?.fadeIn ?? 0.3;
  const hold = reduced ? 0 : dissolve?.hold ?? 0.05;
  const slotAnim = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: fadeOut } },
    transition: { duration: fadeIn, delay: hold },
  };
  // Hold off the selected look while the card is still animating in, so the
  // highlight eases in as the tether lands rather than popping on arrival.
  const showSelected = isSelected && !isEntering;

  // The caption's neighborhood: the two nearest words are the guesses, the rest
  // are the tags. Keyed to the committed coordinate (not the live draft) so the
  // words hold steady while a slider is dragged and only resolve on release.
  const near = nearbyEmotions(pin.x, pin.y, emotions, 2 + NEARBY_TAG_COUNT);
  const guesses = near.slice(0, 2);
  const nearbyTags = near.slice(2);

  // "None of these" hides the suggestion until the pin moves again. Keyed to the
  // committed coordinate (rather than a bare boolean reset in an effect) so a new
  // position clears the dismissal on its own.
  const coordKey = `${pin.x},${pin.y}`;
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const dismissed = dismissedAt === coordKey;

  // Which of the three captions is showing. Keyed on the branch itself and not
  // on the words inside it, so swapping words still dissolves only the slots
  // while the "Does … fit?" frame holds still — but going quiet (dismissed, or
  // drifted out of range of every word) dissolves the whole caption instead of
  // cutting to the quiet line in a single frame.
  const captionMode = guesses.length === 0 ? 'wordless' : dismissed ? 'dismissed' : 'question';

  // The caption changes height when it swaps kind — three rows of question down
  // to a single quiet line, and back. Animate the *real* height rather than a
  // transform, so the card's own box follows in normal flow; framer's `layout`
  // would scale the box instead, squashing the text and leaving the card border
  // out of sync with it. The drawer's `layout` spring can't cover this either:
  // it only re-measures when the drawer re-renders, and the dismissal is local
  // state in here, so the drawer never hears about it.
  const captionRef = useRef<HTMLDivElement>(null);
  const [captionHeight, setCaptionHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    // observe() fires once immediately, which supplies the initial measurement —
    // so no setState in the effect body.
    const ro = new ResizeObserver(() => setCaptionHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toggleName = (id: string) => {
    if (recognizedSet.has(id)) onDerecognize(id);
    else onRecognize(id);
  };

  // A guess word inside the question — tappable to name (or un-name).
  const renderGuess = (e: NearbyEmotion) => {
    const named = recognizedSet.has(e.id);
    return (
      <button
        onClick={(ev) => { ev.stopPropagation(); toggleName(e.id); }}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: FIELD_SERIF,
          fontSize: 15.5,
          letterSpacing: '0.01em',
          color: named ? 'var(--ui-gold)' : 'var(--ui-text-1)',
          borderBottom: named ? '1px solid var(--ui-gold-dim)' : '1px dotted var(--ui-gold-dim)',
          padding: '0 1px 1px',
        }}
      >
        {e.label.toLowerCase()}{named ? ' ✓' : ''}
      </button>
    );
  };

  // A neighborhood tag beneath the question — tappable to name (or un-name).
  const renderTag = (e: NearbyEmotion) => {
    const named = recognizedSet.has(e.id);
    return (
      <button
        key={e.id}
        onClick={(ev) => { ev.stopPropagation(); toggleName(e.id); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 11px',
          borderRadius: 6,
          cursor: 'pointer',
          border: named ? '1px solid var(--ui-gold-dim)' : '1px solid rgba(237,232,223,0.12)',
          background: named ? 'rgba(201,168,124,0.16)' : 'rgba(237,232,223,0.04)',
          color: named ? 'var(--ui-gold)' : 'var(--ui-text-2)',
          fontSize: 12,
          letterSpacing: '0.01em',
        }}
      >
        {e.label.toLowerCase()}{named ? ' ✓' : ''}
      </button>
    );
  };

  // While a slider is dragged, the thumbs follow this local draft; the committed
  // pin coordinate (and its words) hold until release. draftRef mirrors the draft
  // and is read (and written) only inside the pointer handlers — never during
  // render — so the untouched axis is taken from the latest in-flight value even
  // when both axis sliders are dragged at once, not a stale render closure.
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const draftRef = useRef<{ x: number; y: number } | null>(null);
  const curX = draft?.x ?? pin.x;
  const curY = draft?.y ?? pin.y;
  const originX = pin.origin?.x ?? pin.x;
  const originY = pin.origin?.y ?? pin.y;
  // Which axis is actively being dragged, so the card can fade everything
  // except the one slider actually being touched — set on every drag frame
  // (not just grab) so it's always correct even if a pointer capture is lost
  // and re-grabbed. `draft !== null` alone can't answer *which* axis; this
  // can.
  const [draggingAxis, setDraggingAxis] = useState<'x' | 'y' | null>(null);

  const nextFrom = (axis: 'x' | 'y', v: number) => {
    const base = draftRef.current ?? { x: pin.x, y: pin.y };
    return { x: axis === 'x' ? v : base.x, y: axis === 'y' ? v : base.y };
  };
  const dragAxis = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = next;
    setDraft(next);
    setDraggingAxis(axis);
    onAdjustDraft?.({ pinId: pin.id, ...next });
  };
  // Abandon an unfinished drag: drop the draft so the thumbs snap back to the
  // committed coordinate and the field's ghost/travel overlay clears. Cancelling
  // one axis abandons the whole adjustment rather than just that axis — a
  // cancel almost always takes every active pointer with it, and a half-kept
  // draft is harder to reason about than a clean revert to the last committed
  // position.
  const cancelAxis = () => {
    draftRef.current = null;
    setDraft(null);
    setDraggingAxis(null);
    onAdjustDraft?.(null);
  };
  const commitAxis = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = null;
    setDraft(null);
    setDraggingAxis(null);
    onAdjustDraft?.(null);
    onAdjust(pin.id, next.x, next.y);
  };

  // U2: departure mode's own drag/commit pair — reuses the same local
  // draft/draggingAxis state as dragAxis/commitAxis (so the thumb still
  // follows the pointer smoothly) but never calls onAdjust or onAdjustDraft:
  // `pin` here is the anchor, a recorded pin outside the draft array, and
  // there is no draft pin yet for the field's live ghost to key on. The
  // card's own thumb is the only live feedback until release, when
  // onDepart mints the real pin — see App's handleDepart.
  const dragDeparture = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = next;
    setDraft(next);
    setDraggingAxis(axis);
  };
  const commitDeparture = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = null;
    setDraft(null);
    setDraggingAxis(null);
    onDepart?.(next.x, next.y);
  };

  return (
    <div
      onClick={onSelect}
      style={{
        // `--ui-surface` (#161820) diluted to CARD_DRAG_BACKGROUND — matching
        // the tray's own background-fade treatment so the field reads
        // through the card's body too, not just around it. The active
        // slider stays undimmed via its own `opacity` prop below, since CSS
        // opacity on this outer div would fade it too.
        background: draggingAxis !== null ? CARD_DRAG_BACKGROUND : 'var(--ui-surface)',
        border: draggingAxis !== null
          ? CARD_DRAG_BORDER
          : `1px solid ${showSelected ? accentDim : 'var(--ui-border)'}`,
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        // showSelected's own ring (`0 0 0 1px accentDim`) would otherwise
        // outline the card the same way the border did — drop it too while
        // dragging, since the card is almost always selected at that point.
        boxShadow: draggingAxis !== null
          ? 'none'
          : showSelected
            ? `0 0 0 1px ${accentDim}, 0 6px 22px rgba(201,168,124,0.12)`
            : 'none',
        transition: reduced ? 'none' : 'box-shadow 0.35s ease, background 0.25s ease-out',
      }}
    >
      {/* Header band */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px 0',
          opacity: draggingAxis !== null ? CARD_DRAG_CONTENT_OPACITY : 1,
          transition: reduced ? 'none' : 'opacity 0.25s ease-out',
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: accentDim,
          }}
        >
          Emotional State
        </span>
        {readOnly && departure ? (
          // LC1: departure mode's corner carries no control at all — Reopen
          // lives below the sliders instead (see the departure body below).
          // Nothing button-shaped sits next to the continuous control.
          null
        ) : readOnly ? (
          // The reopen/expand control (R22) — see reopenLabel above for what
          // distinguishes the two uses. Always rendered while readOnly
          // (never hidden); reopenDisabled only disables it, per the plan's
          // "renders disabled until the draft is recorded or discarded."
          <button
            onClick={(e) => { e.stopPropagation(); onReopen?.(); }}
            disabled={reopenDisabled}
            style={{
              background: 'none',
              border: `1px solid ${reopenDisabled ? 'var(--ui-border)' : accentDim}`,
              borderRadius: 6,
              padding: '4px 10px',
              color: reopenDisabled ? 'var(--ui-text-3)' : 'var(--ui-recorded)',
              fontSize: 9.5,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: reopenDisabled ? 'default' : 'pointer',
              lineHeight: 1,
            }}
          >
            {reopenLabel}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ui-text-3)',
              fontSize: 16,
              cursor: 'pointer',
              padding: '0 0 0 8px',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              minWidth: 32,
              minHeight: 32,
              justifyContent: 'center',
            }}
            aria-label="Remove"
          >
            ×
          </button>
        )}
      </div>

      {readOnly && departure ? (
        /* Departure body (U2/R1-R4): pre-positioned sliders, live and
           interactive, in the recorded hue — touching one mints a *new*
           draft pin (onDepart) rather than editing this one. No Save, no
           Remove, no recognize/derecognize; the caption stays the same
           plain relational line the ordinary read-only card shows. Reopen
           relocates below as a plain link (LC1) — still the same
           onReopen/reopenDisabled wiring, only its position changes. */
        <div style={{ padding: '10px 14px 14px' }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 15 }}
          >
            <AxisSlider
              labelLow="Calm"
              labelHigh="Activated"
              value={curX}
              origin={pin.x}
              accent="recorded"
              onGrab={onSelect}
              onDrag={(v) => dragDeparture('x', v)}
              onCommit={(v) => commitDeparture('x', v)}
              onCancel={cancelAxis}
              opacity={draggingAxis !== null && draggingAxis !== 'x' ? CARD_DRAG_CONTENT_OPACITY : 1}
              reducedMotion={!!reduced}
            />
            <AxisSlider
              labelLow="Negative"
              labelHigh="Positive"
              value={curY}
              origin={pin.y}
              accent="recorded"
              onGrab={onSelect}
              onDrag={(v) => dragDeparture('y', v)}
              onCommit={(v) => commitDeparture('y', v)}
              onCancel={cancelAxis}
              opacity={draggingAxis !== null && draggingAxis !== 'y' ? CARD_DRAG_CONTENT_OPACITY : 1}
              reducedMotion={!!reduced}
            />
          </div>
          <p style={{ margin: 0, fontFamily: FIELD_SERIF, fontSize: 13.5, color: 'var(--ui-text-3)', fontStyle: 'italic' }}>
            {pin.regionDescription.relational}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onReopen?.(); }}
            disabled={reopenDisabled}
            style={{
              display: 'block',
              marginTop: 13,
              background: 'none',
              border: 'none',
              padding: 0,
              color: reopenDisabled ? 'var(--ui-text-3)' : 'var(--ui-text-2)',
              fontSize: 11,
              letterSpacing: '0.01em',
              textAlign: 'left',
              cursor: reopenDisabled ? 'default' : 'pointer',
            }}
          >
            reopen this entry instead →
          </button>
        </div>
      ) : readOnly ? (
        /* Read-only body: no sliders (R5), no tap-to-recognize, and never
           expands — a recorded card is always exactly this one-line summary.
           It used to reveal a fuller caption on tap, but that caption reused
           the same nearby-word/tag styling as the draft's tappable question
           even though nothing here responds to a tap, which read as broken
           rather than read-only. Collapsed-only removes the ambiguity. */
        <div style={{ padding: '10px 14px 14px' }}>
          <p style={{ margin: 0, fontFamily: FIELD_SERIF, fontSize: 13.5, color: 'var(--ui-text-3)', fontStyle: 'italic' }}>
            {guesses.length === 0
              ? pin.regionDescription.relational
              : `near ${guesses[0].label.toLowerCase()}${guesses[1] ? ` or ${guesses[1].label.toLowerCase()}` : ''}`}
          </p>
          {pin.recognizedWords.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10.5, color: accentDim, letterSpacing: '0.02em' }}>named:</span>
              {pin.recognizedWords.map((id) => (
                <span
                  key={id}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, border: `1px solid ${accentDim}`, background: 'rgba(124,147,168,0.14)', color: 'var(--ui-recorded)', fontSize: 11 }}
                >
                  {labelForId(id)}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
      /* Main metric block — sliders on top, then the (read-only for now) words */
      <div style={{ padding: '10px 14px 14px' }}>
        {/* Adjust sliders — nudge the pin after the fact; commit on release */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 15 }}
        >
          <AxisSlider
            labelLow="Calm"
            labelHigh="Activated"
            value={curX}
            origin={originX}
            anchorValue={anchor?.x}
            anchorLabel={anchorLabel ?? undefined}
            onGrab={onSelect}
            onDrag={(v) => dragAxis('x', v)}
            onCommit={(v) => commitAxis('x', v)}
            onCancel={cancelAxis}
            opacity={draggingAxis !== null && draggingAxis !== 'x' ? CARD_DRAG_CONTENT_OPACITY : 1}
            reducedMotion={!!reduced}
          />
          <AxisSlider
            labelLow="Negative"
            labelHigh="Positive"
            value={curY}
            origin={originY}
            anchorValue={anchor?.y}
            anchorLabel={anchorLabel ?? undefined}
            onGrab={onSelect}
            onDrag={(v) => dragAxis('y', v)}
            onCommit={(v) => commitAxis('y', v)}
            onCancel={cancelAxis}
            opacity={draggingAxis !== null && draggingAxis !== 'y' ? CARD_DRAG_CONTENT_OPACITY : 1}
            reducedMotion={!!reduced}
          />
        </div>

        {/* Honest-question caption — words as an optional, dismissable suggestion.
            Only the guess slots + tags dissolve on a coordinate commit; the
            "Does … or … fit?" frame holds still. Swapping between the question
            and either quiet caption dissolves the whole block on the same
            tunable timings. `popLayout` pulls the outgoing caption out of flow
            so the card eases down to its new height once, instead of collapsing
            into the gap and springing back. */}
        <motion.div
          animate={{ height: reduced ? 'auto' : captionHeight ?? 'auto' }}
          transition={{ duration: reduced ? 0 : fadeOut, ease: 'easeOut' }}
          style={{
            overflow: 'hidden',
            opacity: draggingAxis !== null ? CARD_DRAG_CONTENT_OPACITY : 1,
            transition: reduced ? 'none' : 'opacity 0.25s ease-out',
          }}
        >
        <div ref={captionRef}>
        <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={captionMode} {...slotAnim}>
        {captionMode === 'wordless' ? (
          <p style={{ margin: 0, fontFamily: FIELD_SERIF, fontSize: 14, color: 'var(--ui-text-3)', fontStyle: 'italic' }}>
            {pin.regionDescription.relational}
          </p>
        ) : captionMode === 'dismissed' ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ui-text-3)', fontStyle: 'italic' }}>
            where you landed is enough.
          </p>
        ) : (
          <>
            <div style={{ fontFamily: FIELD_SERIF, fontSize: 15.5, color: 'var(--ui-text-2)', lineHeight: 1.55 }}>
              Does{' '}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={guesses[0].id} {...slotAnim} style={{ display: 'inline-block' }}>
                  {renderGuess(guesses[0])}
                </motion.span>
              </AnimatePresence>
              {guesses[1] && (
                <>
                  {' '}<span style={{ color: 'var(--ui-text-3)' }}>or</span>{' '}
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={guesses[1].id} {...slotAnim} style={{ display: 'inline-block' }}>
                      {renderGuess(guesses[1])}
                    </motion.span>
                  </AnimatePresence>
                </>
              )}
              {' '}fit?
            </div>

            {nearbyTags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <span style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--ui-text-3)', marginRight: 2 }}>
                  or nearby
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={near.map((n) => n.id).join(',')} {...slotAnim} style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                    {nearbyTags.map(renderTag)}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); setDismissedAt(coordKey); }}
              style={{ display: 'inline-block', marginTop: 13, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--ui-text-3)', padding: '3px 0' }}
            >
              none of these
            </button>
          </>
        )}
        </motion.div>
        </AnimatePresence>
        </div>
        </motion.div>

        {/* Across-time delta (U3/R9) — grouped with the caption rather than
            the "your words" summary below, since it's still describing the
            same anchor the tick above shows. Suppressed rather than printing
            describeDelta's neutral phrasing when the two ticks coincide —
            that would just restate a tick position already on screen. Reads
            from the pin's committed coordinate, not the live drag draft, so
            it holds steady mid-drag the same way the caption's words do. */}
        {anchor && anchorLabel && hasNotableDelta(anchor, pin) && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ui-recorded)', lineHeight: 1.5 }}>
            {describeDelta(anchor, pin, anchorLabel)}
          </p>
        )}

        {pin.recognizedWords.length > 0 && (
          <div style={{ marginTop: 13, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--ui-gold-dim)', letterSpacing: '0.02em' }}>your words:</span>
            {pin.recognizedWords.map((id) => (
              <button
                key={id}
                onClick={(e) => { e.stopPropagation(); onDerecognize(id); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--ui-gold-dim)', background: 'rgba(201,168,124,0.14)', color: 'var(--ui-gold)', fontSize: 11.5 }}
              >
                {labelForId(id)}<span style={{ opacity: 0.5, fontSize: 13 }}>×</span>
              </button>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
