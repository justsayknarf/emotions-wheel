import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { emotions, labelForId } from '../../data/emotions';
import { nearbyEmotions, type NearbyEmotion } from '../../data/regions';
import type { PinEntry } from '../../types';

// The caption offers the two nearest words as guesses and this many more beneath
// as a neighborhood of tags. (Made tunable in a later step.)
const NEARBY_TAG_COUNT = 5;
// The question is set in a warm serif — this surface is for recording a feeling,
// not reading data — matching the field's own words.
const FIELD_SERIF = "'Palatino', 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

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
  // Live draft coordinate during a slider drag (field preview only). Optional.
  onAdjustDraft?: (coord: { x: number; y: number } | null) => void;
  // Tunable timings (seconds) for the word/tag dissolve on a coordinate commit.
  dissolve?: { fadeOut: number; fadeIn: number; hold: number };
  // A previous (recorded) check-in's pin: no adjustment, no naming (R5), and
  // collapsed-by-default with tap-to-inspect (R4) rather than always-expanded.
  readOnly?: boolean;
  // U7: reopen this recorded check-in into the draft. Only meaningful when
  // readOnly is true — the sole explicit trigger for reopening (R22),
  // distinct from the tap-to-inspect the card body itself already does.
  onReopen?: () => void;
  // U7: disabled while the draft already holds pins — there is one draft, so
  // reopening into a non-empty one would either absorb unsaved pins into an
  // existing record on save or destroy them on abandon (R18/R27). Rendered
  // disabled rather than hidden, per the plan's "renders disabled until the
  // draft is recorded or discarded."
  reopenDisabled?: boolean;
}

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));
// Coordinate [-1, 1] → [0%, 100%] across a full-width slider track.
const pct = (v: number) => ((v + 1) / 2) * 100;

const endLabelStyle = {
  fontSize: 8,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'var(--oura-text-3)',
};

// A single draggable axis. Reports the value live while dragging (onDrag) and
// once more on release (onCommit) — the card commits on release. The origin tick
// marks where the pin was first dropped, so travel from the felt drop is visible.
// A gesture the user never finished (onCancel) reverts instead of committing.
function AxisSlider({
  labelLow,
  labelHigh,
  value,
  origin,
  onGrab,
  onDrag,
  onCommit,
  onCancel,
}: {
  labelLow: string;
  labelHigh: string;
  value: number;
  origin: number;
  onGrab?: () => void;
  onDrag: (v: number) => void;
  onCommit: (v: number) => void;
  onCancel: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const valueAt = (clientX: number) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return value;
    return clampUnit(((clientX - r.left) / r.width) * 2 - 1);
  };
  const p = pct(value);

  return (
    <div>
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
            background: 'rgba(201,168,124,0.12)',
            left: value >= 0 ? '50%' : `${p}%`,
            right: value >= 0 ? `${100 - p}%` : '50%',
          }}
        />
        {/* origin tick — where this pin was dropped */}
        <div style={{ position: 'absolute', top: -3, bottom: -3, width: 1, background: 'var(--oura-text-3)', left: `${pct(origin)}%` }} />
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
            background: 'radial-gradient(circle at 40% 35%, #f0d9b5, var(--oura-gold) 62%)',
            boxShadow: '0 0 0 4px rgba(201,168,124,0.12), 0 2px 8px rgba(201,168,124,0.35)',
            left: `${p}%`,
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
}

export function CoordinateCard({ pin, isSelected, isEntering = false, onSelect, onRecognize, onDerecognize, onRemove, onAdjust, onAdjustDraft, dissolve, readOnly = false, onReopen, reopenDisabled = false }: Props) {
  const recognizedSet = new Set(pin.recognizedWords);

  // Collapsed-by-default inspect state (R4). Local and only meaningful for a
  // read-only card — a draft card's rendering is unaffected and always shows
  // its full body, exactly as before this prop existed.
  const [expanded, setExpanded] = useState(false);

  // The accent that marks this card as recorded rather than draft (R6) — the
  // same cool hue the field already uses for a recorded pin (U4), so the
  // treatment reads consistently between the two surfaces.
  const accentDim = readOnly ? 'var(--oura-recorded-dim)' : 'var(--oura-gold-dim)';

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
          color: named ? 'var(--oura-gold)' : 'var(--oura-text-1)',
          borderBottom: named ? '1px solid var(--oura-gold-dim)' : '1px dotted var(--oura-gold-dim)',
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
          border: named ? '1px solid var(--oura-gold-dim)' : '1px solid rgba(237,232,223,0.12)',
          background: named ? 'rgba(201,168,124,0.16)' : 'rgba(237,232,223,0.04)',
          color: named ? 'var(--oura-gold)' : 'var(--oura-text-2)',
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

  const nextFrom = (axis: 'x' | 'y', v: number) => {
    const base = draftRef.current ?? { x: pin.x, y: pin.y };
    return { x: axis === 'x' ? v : base.x, y: axis === 'y' ? v : base.y };
  };
  const dragAxis = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = next;
    setDraft(next);
    onAdjustDraft?.(next);
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
    onAdjustDraft?.(null);
  };
  const commitAxis = (axis: 'x' | 'y', v: number) => {
    const next = nextFrom(axis, v);
    draftRef.current = null;
    setDraft(null);
    onAdjustDraft?.(null);
    onAdjust(pin.id, next.x, next.y);
  };

  return (
    <div
      onClick={() => {
        onSelect();
        // Tapping a read-only card inspects (expands) and selects — it never
        // reopens the card for editing (R17). A draft card has no expand
        // state, so this is a no-op there.
        if (readOnly) setExpanded((v) => !v);
      }}
      style={{
        background: 'var(--oura-surface)',
        border: showSelected ? `1px solid ${accentDim}` : '1px solid var(--oura-border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: showSelected ? `0 0 0 1px ${accentDim}, 0 6px 22px rgba(201,168,124,0.12)` : 'none',
        transition: 'border-color 0.35s ease, box-shadow 0.35s ease',
      }}
    >
      {/* Header band */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px 0',
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
        {readOnly ? (
          // The reopen control (R22) — the sole explicit trigger for
          // reopening this recorded check-in into the draft, distinct from
          // the card body's own tap-to-inspect. Always rendered while
          // readOnly (never hidden); reopenDisabled only disables it, per
          // the plan's "renders disabled until the draft is recorded or
          // discarded."
          <button
            onClick={(e) => { e.stopPropagation(); onReopen?.(); }}
            disabled={reopenDisabled}
            style={{
              background: 'none',
              border: `1px solid ${reopenDisabled ? 'var(--oura-border)' : accentDim}`,
              borderRadius: 6,
              padding: '4px 10px',
              color: reopenDisabled ? 'var(--oura-text-3)' : 'var(--oura-recorded)',
              fontSize: 9.5,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: reopenDisabled ? 'default' : 'pointer',
              lineHeight: 1,
            }}
          >
            Reopen
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--oura-text-3)',
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

      {readOnly ? (
        /* Read-only body: no sliders (R5), collapsed to a one-line summary
           until tapped, then an inspect-only expanded caption — never the
           tap-to-recognize affordance, which stays exclusive to the draft. */
        <div style={{ padding: '10px 14px 14px' }}>
          {expanded ? (
            <>
              {guesses.length === 0 ? (
                <p style={{ margin: 0, fontFamily: FIELD_SERIF, fontSize: 14, color: 'var(--oura-text-3)', fontStyle: 'italic' }}>
                  {pin.regionDescription.relational}
                </p>
              ) : (
                <div style={{ fontFamily: FIELD_SERIF, fontSize: 15.5, color: 'var(--oura-text-2)', lineHeight: 1.55 }}>
                  Does{' '}
                  <span style={{ color: 'var(--oura-text-1)' }}>{guesses[0].label.toLowerCase()}</span>
                  {guesses[1] && (
                    <>
                      {' '}<span style={{ color: 'var(--oura-text-3)' }}>or</span>{' '}
                      <span style={{ color: 'var(--oura-text-1)' }}>{guesses[1].label.toLowerCase()}</span>
                    </>
                  )}
                  {' '}fit?
                </div>
              )}

              {nearbyTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <span style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--oura-text-3)', marginRight: 2 }}>
                    or nearby
                  </span>
                  {nearbyTags.map((e) => (
                    <span
                      key={e.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 11px',
                        borderRadius: 6,
                        border: '1px solid rgba(237,232,223,0.12)',
                        background: 'rgba(237,232,223,0.04)',
                        color: 'var(--oura-text-2)',
                        fontSize: 12,
                        letterSpacing: '0.01em',
                      }}
                    >
                      {e.label.toLowerCase()}
                    </span>
                  ))}
                </div>
              )}

              {pin.recognizedWords.length > 0 && (
                <div style={{ marginTop: 13, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: accentDim, letterSpacing: '0.02em' }}>named:</span>
                  {pin.recognizedWords.map((id) => (
                    <span
                      key={id}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, border: `1px solid ${accentDim}`, background: 'rgba(124,147,168,0.14)', color: 'var(--oura-recorded)', fontSize: 11.5 }}
                    >
                      {labelForId(id)}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontFamily: FIELD_SERIF, fontSize: 13.5, color: 'var(--oura-text-3)', fontStyle: 'italic' }}>
              {guesses.length === 0
                ? pin.regionDescription.relational
                : `near ${guesses[0].label.toLowerCase()}${guesses[1] ? ` or ${guesses[1].label.toLowerCase()}` : ''}`}
            </p>
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
            onGrab={onSelect}
            onDrag={(v) => dragAxis('x', v)}
            onCommit={(v) => commitAxis('x', v)}
            onCancel={cancelAxis}
          />
          <AxisSlider
            labelLow="Negative"
            labelHigh="Positive"
            value={curY}
            origin={originY}
            onGrab={onSelect}
            onDrag={(v) => dragAxis('y', v)}
            onCommit={(v) => commitAxis('y', v)}
            onCancel={cancelAxis}
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
          style={{ overflow: 'hidden' }}
        >
        <div ref={captionRef}>
        <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={captionMode} {...slotAnim}>
        {captionMode === 'wordless' ? (
          <p style={{ margin: 0, fontFamily: FIELD_SERIF, fontSize: 14, color: 'var(--oura-text-3)', fontStyle: 'italic' }}>
            {pin.regionDescription.relational}
          </p>
        ) : captionMode === 'dismissed' ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--oura-text-3)', fontStyle: 'italic' }}>
            where you landed is enough.
          </p>
        ) : (
          <>
            <div style={{ fontFamily: FIELD_SERIF, fontSize: 15.5, color: 'var(--oura-text-2)', lineHeight: 1.55 }}>
              Does{' '}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={guesses[0].id} {...slotAnim} style={{ display: 'inline-block' }}>
                  {renderGuess(guesses[0])}
                </motion.span>
              </AnimatePresence>
              {guesses[1] && (
                <>
                  {' '}<span style={{ color: 'var(--oura-text-3)' }}>or</span>{' '}
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
                <span style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--oura-text-3)', marginRight: 2 }}>
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
              style={{ display: 'inline-block', marginTop: 13, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 10.5, letterSpacing: '0.06em', color: 'var(--oura-text-3)', padding: '3px 0' }}
            >
              none of these
            </button>
          </>
        )}
        </motion.div>
        </AnimatePresence>
        </div>
        </motion.div>

        {pin.recognizedWords.length > 0 && (
          <div style={{ marginTop: 13, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--oura-gold-dim)', letterSpacing: '0.02em' }}>your words:</span>
            {pin.recognizedWords.map((id) => (
              <button
                key={id}
                onClick={(e) => { e.stopPropagation(); onDerecognize(id); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 5, cursor: 'pointer', border: '1px solid var(--oura-gold-dim)', background: 'rgba(201,168,124,0.14)', color: 'var(--oura-gold)', fontSize: 11.5 }}
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
