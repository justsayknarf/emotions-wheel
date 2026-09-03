import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CoordinateCard } from './CoordinateCard';
import { DepartureFloat } from './DepartureFloat';
import { isDepartureEligible } from '../../data/departure';
import { useRevealTuning } from '../../config/revealTuning';
import { RhythmStrip } from '../EmotionMirror/RhythmStrip';
import { formatRelative } from '../../utils/formatDate';
import type { DiaryEntry, PinEntry } from '../../types';

// Shared so App can size the field plane to `calc(100% - RAIL_WIDTH)` and keep
// the two planes flush at any width.
export const RAIL_WIDTH = 'clamp(340px, 32%, 420px)';

// Collapsed mobile peek geometry — moved here from the now-deleted
// EmotionMirror/MirrorCard.tsx (U8). The returning mirror's peek/collapse
// behavior now lives on this drawer's sheet variant instead of a separate
// surface, so the field can still end exactly at the top of the peek. The
// collapsed tray height is PEEK_BAR_HEIGHT (the handle button) plus
// PEEK_SAFE_PAD (the tray's safe-area bottom padding).
export const PEEK_BAR_HEIGHT = 52;
export const PEEK_SAFE_PAD = 'max(8px, env(safe-area-inset-bottom))';
// The sheet's expanded height cap — shared between the static CSS value
// (isReopened, which never toggles) and the JS clamp used to compute the
// peek/expand transition's one-shot target height.
const SHEET_MAX_VH = 0.46;
// The tray's background/blur while a slider drag is active — low enough to
// see a pin move on the field underneath, not just the general glow.
// Tune here.
const TRAY_DRAG_BACKGROUND = 'rgba(12, 14, 18, 0.08)';
const TRAY_DRAG_BLUR = 'blur(0px)';
// Resting (not dragging) values, for reference/tuning alongside the above.
const TRAY_RESTING_BACKGROUND = 'rgba(12, 14, 18, 0.97)';
const TRAY_RESTING_BLUR = 'blur(20px)';

const MICRO_LABEL: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ui-text-3)',
};

// U2 (docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md): a
// third variant, 'focus' — the desktop landing's front-and-center card.
// Reuses every prop and handler 'rail' already has (Save/Discard/history/
// reopen chrome, the departure card's pre-positioned sliders); only its
// final positioning/sizing branch near the bottom of this file differs from
// 'rail's — see isFocus/isSheet below for how the two share 'rail's content
// structure while excluding the mobile sheet's own peek/collapse/drag-shrink
// mechanics.
type Variant = 'sheet' | 'rail' | 'focus';

interface Props {
  pins: PinEntry[];
  // The previous check-in — the most recent diary entry, derived at render in
  // App.tsx (derivePreviousCheckIn). Its pins render as their own collapsed,
  // read-only group above the draft (R4, R5, R6), and its summary (relative
  // time, recent rhythm) is carried into this drawer's returning-summary
  // block above that group (U8/R9). Null when there is no history.
  previousCheckIn: DiaryEntry | null;
  // The most recent diary entry regardless of any active reopen — unlike
  // previousCheckIn, this never excludes the entry currently being edited.
  // Sources the returning-summary's time label so that block stays visible
  // and correct through an edit, instead of disappearing along with
  // previousCheckIn the moment editing starts. Null when there is no history.
  mostRecentEntry: DiaryEntry | null;
  // Full diary history, for the returning-summary's rhythm strip (U8).
  entries: DiaryEntry[];
  variant: Variant;
  onRecognize: (emotionId: string) => void;
  onDerecognize: (emotionId: string) => void;
  onPinRemove: (pinId: string) => void;
  // Commit an adjusted coordinate for a pin (a card slider was released).
  onAdjust: (pinId: string, x: number, y: number) => void;
  // Live draft coordinate while a card slider is dragged (field preview only),
  // carrying the pin id so App.tsx can derive which card is dragging.
  // Optional: wired once the field overlay consumes it.
  onAdjustDraft?: (coord: { pinId: string; x: number; y: number } | null) => void;
  // Tunable timings (seconds) for the card's word dissolve on a coordinate commit.
  dissolve?: { fadeOut: number; fadeIn: number; hold: number };
  onDone: () => void;
  // review-fix (product direction, 2nd pass): the 'focus' variant's own
  // ending — actionBar's Save button calls this instead of `onDone` while
  // `isFocus`, so the landing's own persist+reveal-rail flow
  // (App.tsx's handleLandingSave) fires instead of the ordinary
  // record-and-celebrate path. Optional and unused by 'rail'/'sheet',
  // which keep calling `onDone` exactly as before.
  onLandingSave?: () => void;
  onClear: () => void;
  // Reopen the previous check-in (by its entry id) into the draft, expanding
  // only the specific pin that was clicked — its siblings move into the
  // draft too (the check-in is still one save unit) but stay collapsed
  // until individually expanded via onExpandPin.
  onReopen: (entryId: string, pinId: string) => void;
  // U2: mints a new draft pin departing from the previous check-in's anchor
  // (its newest pin) — fired by that one card's pre-positioned sliders when
  // the draft is empty. Never touches the anchor itself (R2/R3).
  onDepart: (x: number, y: number) => void;
  // docs/plans/2026-09-02-001-feat-newtab-departure-float-plan.md, U5: the
  // live coordinate while the pre-mint DepartureFloat landing's own slider
  // is dragged. Only meaningful for the new pre-mint branch below. (This
  // used to sit alongside a sibling callback, onDepartureDragProgress,
  // threaded to CoordinateCard's own departure body — removed as part of
  // the "full continuity" follow-up to this same plan: the departure card
  // that callback drove progress for is now unreachable while isFocus, see
  // that branch's own comment, so nothing anywhere ever passed it a real
  // value any more.)
  onDepartureDrag?: (coord: { x: number; y: number } | null) => void;
  // U3: how far the 'focus' variant's own position/size has settled toward
  // the rail (0 = resting/centered, 1 = rail). Ignored by 'rail'/'sheet'
  // (neither is receded); defaults to 0 so those callers don't need to pass
  // it. review-fix: deliberately NOT the same live value that drives App's
  // recedeProgress during a drag — App only updates this prop on release
  // (commit/cancel), never while a drag is in flight, so the card holds
  // still (only the field recedes into view) while the user's finger is
  // still on a departure slider inside it. Always animates with the normal
  // eased CSS transition below; there is no "live, no-easing" state for the
  // card to be in anymore (see `focusInstant`, which no longer branches on
  // anything drag-related — only reduced-motion).
  cardFocusProgress?: number;
  // U3/R9: the same anchor coordinate + relative-day label, resolved once
  // in App (departureAnchor/relativeDayLabel) and threaded into each
  // *draft* card's own anchor tick + delta — not the previous check-in's
  // own (already-anchored) card, and not a reopened check-in's cards, whose
  // comparison would be against a different, older check-in (out of scope).
  anchor: PinEntry | null;
  anchorLabel: string | null;
  // True while a previous check-in is being edited in place (App.tsx's
  // draftId is set). The draft's pins ARE that check-in's pins at this
  // point — this flag only changes how they're presented: in the previous
  // check-in's slot rather than a separate "Draft check-in" group, with
  // Discard Draft relabeled (there is no fresh draft to discard, but there
  // is an edit to abandon) and Save relabeled to say what it actually does.
  isReopened: boolean;
  // Which of the reopened check-in's pins are currently expanded/editable —
  // seeded with just the clicked pin on reopen (see onReopen). A sibling not
  // in this set still renders collapsed, with its own control to expand it.
  expandedPinIds: Set<string>;
  // Expand one more sibling pin within an already-active reopen, without
  // starting a new one — the check-in is already in the draft.
  onExpandPin: (pinId: string) => void;
  selectedPinId: string | null;
  onSelectPin: (pinId: string) => void;
  // The just-dropped pin, still animating in — its card holds off the selected
  // highlight until it settles, so selection eases in rather than popping.
  enteringPinId: string | null;
  // The rail's scroll container, so the tether can find the selected card by
  // data-pin-id and track it through scroll.
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  // Sheet variant only: whether the tray is expanded past its peek, and a
  // toggle for the peek handle — the same shape MirrorCard used to take.
  // Ignored by the rail (never collapsible).
  expanded?: boolean;
  onToggle?: () => void;
  // U5: the pin whose card slider is currently being dragged, or null. Sheet
  // variant only (rail never shrinks — it sits beside the field, not over
  // it) and never applies while isReopened (matching R1-R3's exclusion) —
  // see dragShrinkActive below.
  draggingPinId?: string | null;
}

export function EmotionDrawer({
  pins,
  previousCheckIn,
  mostRecentEntry,
  entries,
  variant,
  onRecognize,
  onDerecognize,
  onPinRemove,
  onAdjust,
  onAdjustDraft,
  dissolve,
  onDone,
  onLandingSave,
  onClear,
  onReopen,
  onDepart,
  onDepartureDrag,
  cardFocusProgress = 0,
  anchor,
  anchorLabel,
  isReopened,
  expandedPinIds,
  onExpandPin,
  selectedPinId,
  onSelectPin,
  enteringPinId,
  scrollRef,
  expanded = false,
  onToggle,
  draggingPinId = null,
}: Props) {
  const previousPins = previousCheckIn?.pins ?? [];
  const reversedPins = [...pins].reverse();
  const reversedPreviousPins = [...previousPins].reverse();
  const isRail = variant === 'rail';
  // U2: 'focus' shares 'rail's content structure (group headers, the
  // previous/draft split, never hiding history behind a draft) — it only
  // differs in the final positioning branch below. `isSheet` is the mobile
  // bottom sheet specifically, the only variant with peek/collapse and
  // drag-shrink chrome; `isPanelLayout` (`!isSheet`) is the two variants
  // that share 'rail's content decisions.
  const isFocus = variant === 'focus';
  const isSheet = !isRail && !isFocus;
  const isPanelLayout = !isSheet;
  const reduce = useReducedMotion();
  // U3: only consulted by the 'focus' return branch below (its
  // fieldRecedeDuration keeps the card's own settle transition in sync with
  // the field's — see that branch's own comment) — reading it
  // unconditionally here, rather than only within `if (isFocus)`, keeps
  // this a plain hook call rather than one gated behind a runtime
  // condition, which hook-order rules require anyway.
  const tuning = useRevealTuning();
  // U2: on mount as 'focus', move focus onto the card's own root so the next
  // Tab press lands on the card's first focusable descendant (the departure
  // card's Reopen link, or the draft actionBar's Discard/Save once a pin is
  // dropped) rather than wherever focus happened to be — consistent with
  // the front-and-center card being the primary landing element. Only ever
  // attached to the 'focus' return branch's root below; harmless (never
  // fires) on the other two branches since `focusRootRef.current` stays
  // null there.
  const focusRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocus) focusRootRef.current?.focus();
  }, [isFocus]);
  // U3: the sheet's peek <-> expand toggle used to be two separate
  // `motion.div` returns, each replaying its own mount-only enter
  // animation on toggle, so the height change between them snapped
  // instead of animating. This merges them into one persistent container
  // whose `sheetHeight` is the only JS-driven dimension. It's computed on
  // each discrete transition that changes what's mounted or how many
  // cards there are (the effect below) — not on every render — so
  // per-pixel content wobble (a caption's word list changing at the same
  // pin count) doesn't retrigger it and double up with CoordinateCard's
  // own per-card height animation reacting to that same DOM change.
  // These hooks run on every render regardless of `isRail`/`isReopened`
  // (hook order can't depend on props) even though only the sheet's
  // non-reopened toggle uses them.
  //
  // This is a deliberate exception to AGENTS.md's "derive at render rather
  // than reconciling in an effect" — that guidance targets values
  // *computable* from existing props/state (like the selected-pin
  // resolution it cites), not a real DOM pixel size, which isn't knowable
  // until the browser has laid out the content. `CoordinateCard.tsx:232-242`
  // already measures+reconciles for the same reason (`captionHeight`); this
  // follows the same precedent. A continuously-observing `ResizeObserver`
  // (as `CoordinateCard` uses) was considered and rejected here: the body
  // this container measures is itself a flex item whose *own* size is a
  // result of the JS height being set, so observing it directly risks a
  // feedback loop — the discrete triggers below (isPeeked toggle, a drag
  // starting/ending, the pin count changing, a viewport resize) cover the
  // transitions that matter in practice without that risk. A content-size
  // change from something outside that list (e.g. a webfont finishing load
  // mid-session) won't retrigger a remeasure — accepted as a narrow,
  // low-impact gap rather than reworked into a `ResizeObserver`.
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);
  const sheetHandleRef = useRef<HTMLButtonElement>(null);
  const sheetActionBarRef = useRef<HTMLDivElement>(null);
  // Mirrors the old isPeeked=false condition: body (action bar + card
  // list, or editingSection while isReopened) is showing. Never true for
  // the rail or the focus card (U2), neither of which has a peek/collapse
  // concept — only the mobile sheet does.
  const sheetBodyVisible = isSheet && (isReopened || expanded);
  // Shared precondition for every sheet-only, non-reopened derivation below
  // (dragShrinkActive, hideHistory, handleAlreadyShowsTime) — named once
  // rather than repeated per condition. U2: scoped to `isSheet` (not
  // `!isRail`) so the focus card doesn't inherit the mobile sheet's
  // drag-shrink/history-hiding behavior — it shares 'rail's content
  // decisions instead (isPanelLayout above).
  const isDraftSheet = isSheet && !isReopened;
  // R7-R10: while a slider drag is active on the sheet's ordinary draft-cards
  // path, hide everything but the actively-dragged card so more of the
  // field shows through. Derived at render, not stored state —
  // draggingPinId is already the single source of truth.
  const dragShrinkActive = isDraftSheet && draggingPinId !== null;
  useLayoutEffect(() => {
    // isReopened renders at a static height (see the sheet return below)
    // — it never toggles isPeeked, so it never needs this measurement.
    // U2: same for the focus card — it has no peek/collapse either.
    if (!isSheet || isReopened) return;
    const measure = () => {
      const handleHeight = sheetHandleRef.current?.offsetHeight ?? PEEK_BAR_HEIGHT;
      if (!sheetBodyVisible) {
        setSheetHeight(handleHeight);
        return;
      }
      // `actionBar`'s offsetHeight is accurate even while the container is
      // still small mid-transition: a flex item with `overflow: visible`
      // (the default, which actionBar has) won't shrink below its content
      // size. `cardList` sets `overflow-y: auto`, which lets it shrink
      // below content size — so its `scrollHeight` is used instead, which
      // reports the full, unclipped content height regardless of how much
      // the container currently constrains its visible box.
      const actionBarHeight = sheetActionBarRef.current?.offsetHeight ?? 0;
      const cardListHeight = scrollRef?.current?.scrollHeight ?? 0;
      const viewportCap = window.innerHeight * SHEET_MAX_VH;
      setSheetHeight(Math.min(handleHeight + actionBarHeight + cardListHeight, viewportCap));
    };
    measure();
    // Re-measure on a real viewport size change (orientation flip, browser
    // chrome showing/hiding, on-screen keyboard) — the target height was
    // clamped against `window.innerHeight` at measurement time, and unlike
    // the static `maxHeight: '46vh'` this replaces for the expanded case,
    // a JS pixel value doesn't renegotiate itself when the viewport does.
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // `dragShrinkActive` is included: it changes what's actually mounted
    // (siblings, actionBar, returningSummary all disappear once a drag
    // starts), so the sheet must re-measure and shrink to match — this is
    // what U5's chrome-hide depends on to actually reduce the sheet's
    // footprint, not just what's visible inside a footprint that stays
    // the same size. `pins.length` is included too: before this container
    // existed, the expanded sheet's height was CSS content-driven
    // (`maxHeight: '46vh'`, no explicit height) and grew on its own as
    // pins were added — an explicit JS height has to be told to do the
    // same, or a second pin dropped into an already-expanded sheet would
    // silently sit below the fold instead of growing the sheet to show
    // it. Deliberately excludes everything else about a pin's content
    // (coordinate, recognized words, caption state) — those change
    // continuously during a slider drag or word pick, and retriggering
    // this measurement for each one would double-animate the same visual
    // change CoordinateCard already animates internally.
  }, [isSheet, isReopened, sheetBodyVisible, dragShrinkActive, pins.length, scrollRef]);
  // Save reflects the draft's count only (R21) and is unavailable when the
  // draft holds nothing new (R19) — `pins` here is always the draft array,
  // unaffected by the previous check-in's pins.
  const canSave = pins.length > 0;
  // U2/KTD1: the landing state. Matches App's `showMirror` exactly (this
  // component only ever mounts within that same view); derived locally via
  // the shared predicate rather than threaded as its own prop, since every
  // piece it needs is already here.
  const departureEligible = isDepartureEligible(isReopened, pins.length, previousCheckIn);
  // The pin departure sliders apply to (LC2) — the check-in's newest pin,
  // matching departureAnchor's own fallback (src/data/departure.ts) so this
  // card and the field's anchor ring can't disagree about which pin it is.
  const anchorPinId = previousPins.length > 0 ? previousPins[previousPins.length - 1].id : null;
  // Desktop-check-in-focus plan's own U2 (distinct from the "U2/KTD1" label
  // just above, which is the earlier departure-mark plan's unit): the
  // neutral-centered first-time landing (R2). `isDepartureEligible` above
  // always requires a real `previousCheckIn` (every other caller of it needs
  // one to depart *from*), so it's structurally false whenever there is no
  // previous check-in at all — this is the separate condition for that case,
  // gating the synthetic (0, 0) anchor card in cardList below. Focus-only:
  // 'rail'/'sheet' never had anywhere to show a card with no previous
  // check-in and no draft pins, and still don't outside the landing.
  const neutralDepartureEligible = isFocus && !isReopened && pins.length === 0 && !previousCheckIn;
  // Once a fresh draft has pins on the sheet, previous-check-in content
  // (the returning-summary block and the previous check-in's read-only
  // cards) hides so the draft renders as the top and only content —
  // requiring a scroll to see a just-dropped pin was the bug this fixes.
  // isDraftSheet already excludes isReopened: `pins` there holds the whole
  // reopened check-in, not a fresh draft, and the returning-summary block
  // is deliberately kept visible throughout an edit (see its own comment
  // below) — this condition must not undo that. Subsumes dragShrinkActive,
  // which only ever hides this same content under a narrower, drag-only
  // condition — a drag can only be active on a card already in the draft,
  // so dragShrinkActive being true always implies hideHistory is too.
  const hideHistory = isDraftSheet && canSave;

  // Returning-summary content, carried forward from the retired MirrorCard
  // (U8/R9): the relative time and the recent-rhythm strip. The relational
  // line that used to sit between them is gone — it only ever described
  // pins[0], sourced from that pin's *stored* regionDescription.relational
  // rather than the live coordinate-nearest-word computation every
  // collapsed card below it uses (CoordinateCard's `guesses`/`nearbyTags`),
  // so it could read as a different, contradicting summary of the same
  // check-in rather than useful context of its own. This block is now
  // purely "when" and "how often," never a content preview. Deduped
  // recognized-word pills from the old MirrorCard are deliberately not
  // carried forward either — each individual read-only card (U6) already
  // shows its own recognized words, so a second, deduped set here would
  // read as redundant rather than informative.
  // Drives the sheet's peek/collapse handles only (both gated !isReopened,
  // where previousCheckIn and mostRecentEntry always agree) — kept separate
  // from the returning-summary's own time label below, which must stay
  // correct even while previousCheckIn is excluding the entry being edited.
  const timeLabel = previousCheckIn ? formatRelative(previousCheckIn.timestamp) : null;
  const summaryTimeLabel = mostRecentEntry ? formatRelative(mostRecentEntry.timestamp) : null;
  // On the sheet, a peek-style handle is showing (and already carries the
  // time) whenever the draft is empty and nothing is being edited — both the
  // peeked state and the manually-expanded-with-empty-draft state render
  // one. Skip the summary's own time line only then, to avoid saying it
  // twice; show it in every other case, including throughout an edit, where
  // no handle ever renders (see handleButton below).
  const handleAlreadyShowsTime = isDraftSheet && !canSave;
  // Sourced from mostRecentEntry, not previousCheckIn, and rendered
  // unconditionally in cardList below (not nested inside the isReopened
  // branch) — so it keeps showing the same "when" and "how often" through
  // an edit instead of disappearing the moment editing starts, which is
  // what made editing read as a different view rather than something
  // happening in place.
  const returningSummary = mostRecentEntry && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 0 4px' }}>
      {!handleAlreadyShowsTime && (
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ui-text-2)', letterSpacing: '0.01em' }}>
          {summaryTimeLabel}
        </span>
      )}
      {/* docs/plans/2026-09-02-001-feat-newtab-departure-float-plan.md, "full
          continuity" follow-up (round 6): dropped for the centered post-mint
          card specifically — the time label above stays (product direction:
          revisit its phrasing later, but keep it for now), everything else
          in this landing is meant to be just the draft and its Save/Discard
          choice. 'rail'/'sheet' keep the rhythm strip exactly as before. */}
      {!isFocus && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={MICRO_LABEL}>Recent rhythm</div>
          <RhythmStrip entries={entries} />
        </div>
      )}
    </div>
  );

  const actionBar = (
    <div
      // U3: measures this bar's natural height once per sheet peek/expand
      // transition (see the effect near the top of the component). Also
      // renders on the rail, where the ref is simply unused.
      ref={sheetActionBarRef}
      style={{
        padding: '11px 16px',
        // On the sheet, this is now the sheet's bottom-most element (U2) —
        // it needs the safe-area-bottom accommodation cardList used to
        // provide when it was last. Neither the rail nor the focus card
        // (desktop-only, U2 desktop-check-in-focus) has a safe-area inset to
        // account for.
        paddingBottom: isPanelLayout ? '11px' : 'max(11px, env(safe-area-inset-bottom))',
        // Both variants now render this after `cardList` (U2), so a top
        // border separates it from the scrollable content above rather
        // than a bottom border that would sit at the sheet's own edge.
        borderTop: '1px solid var(--ui-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {/* This bar only ever renders in the non-reopened state now (see the
          rail/sheet returns below) — while editing a previous check-in, its
          own local action row inside editingSection owns Discard Edit /
          Update Check-in instead, so this one stays fixed to the draft. */}
      {canSave ? (
        <button
          onClick={onClear}
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
      ) : (
        <span />
      )}
      <button
        // review-fix (product direction, 2nd pass): the 'focus' variant's
        // own Save ends the landing (reveal rail + animate this card to the
        // right) instead of the ordinary record-and-celebrate path — see
        // onLandingSave's own prop comment. 'rail'/'sheet' keep calling
        // onDone exactly as before.
        onClick={isFocus && onLandingSave ? onLandingSave : onDone}
        disabled={!canSave}
        style={{
          background: canSave ? 'var(--ui-gold)' : 'var(--ui-border)',
          border: 'none',
          borderRadius: 6,
          padding: '7px 18px',
          color: canSave ? '#0D0F14' : 'var(--ui-text-3)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: canSave ? 'pointer' : 'default',
        }}
      >
        {`Save  ·  ${pins.length}`}
      </button>
    </div>
  );

  const groupHeaderStyle: React.CSSProperties = {
    fontSize: 8.5,
    fontWeight: 500,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--ui-text-3)',
    padding: '6px 0 2px',
  };

  // The draft's cards — fully editable, gold-accented. Used for the ordinary
  // "Draft check-in" group below (a fresh pin was dropped) — every pin here
  // is genuinely unsaved, so every card is simply expanded. During
  // dragShrinkActive, siblings are filtered out of this array entirely (not
  // CSS-hidden) so AnimatePresence's own exit transition animates them out
  // and the sheet's rendered height actually shrinks — a hidden-but-mounted
  // sibling would leave the sheet's stopPropagation footprint unchanged. The
  // one remaining (active) card gets `layout={false}` instead of the
  // unconditional `layout` every other card keeps, so removing its siblings
  // never triggers framer-motion's layout reflow on the card the user's
  // finger is on mid-drag.
  const visibleDraftPins = dragShrinkActive
    ? reversedPins.filter((pin) => pin.id === draggingPinId)
    : reversedPins;
  // Review fix (P1, anchor-tick leak): `anchor` is departureAnchor's
  // synthetic (0, 0) neutral pin (src/data/departure.ts) whenever there's no
  // real previousCheckIn — that pin exists only to feed the
  // neutralDepartureEligible departure card below (which reads `anchor`
  // directly, unfiltered). An ordinary draft card below must never receive
  // it as its comparison anchor: CoordinateCard/AxisSlider render the anchor
  // tick whenever `anchorValue !== undefined`, with no dependency on
  // anchorLabel, so the synthetic pin's always-defined (0, 0) coordinate was
  // drawing an unlabeled tick on every axis of every draft card for any
  // first-time user (mobile and new-tab included, not just this desktop
  // landing). `previousCheckIn` truthiness is the same condition
  // departureAnchor itself branches on to decide real-vs-synthetic, so it's
  // the correct signal here too, with no new prop needed.
  const realAnchor = previousCheckIn ? anchor : null;

  // docs/plans/2026-09-02-001-feat-newtab-departure-float-plan.md, U5: the
  // pre-mint departure-float landing — a card-less pair of sliders on a
  // frosted strip, replacing the opaque `shared` panel entirely for this
  // one moment. Checked before any of the panel content below is built
  // (cardList/actionBar), so none of it is constructed only to be
  // discarded. The instant a pin mints (pins.length > 0), this stops
  // matching and the ordinary `isFocus` branch further below takes over
  // completely unchanged — same opaque panel, same cardList/actionBar,
  // same recedeProgress behind it. No hooks are declared after this point
  // in the component, so an early return here is safe.
  //
  // No `onReopen` passed here (round 5 of this same follow-up): centered
  // and alone, this landing has nothing to distinguish "reopen instead"
  // from — that CTA stays meaningful on the rail's own departure-mark card
  // (below, in cardList), which is one docked option among others. The
  // previous check-in itself is still reachable once this landing hands
  // off post-mint: its read-only card (with its own Reopen button) keeps
  // rendering in cardList throughout.
  if (isFocus && pins.length === 0 && (neutralDepartureEligible || departureEligible)) {
    return (
      <DepartureFloat
        ref={focusRootRef}
        anchor={neutralDepartureEligible ? anchor! : previousPins[previousPins.length - 1]}
        onDepart={onDepart}
        onDepartureDrag={onDepartureDrag}
      />
    );
  }

  const draftCards = (
    <AnimatePresence initial={false}>
      {visibleDraftPins.map((pin) => (
        <motion.div
          key={pin.id}
          layout={!dragShrinkActive}
          data-pin-id={pin.id}
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        >
          <CoordinateCard
            pin={pin}
            isSelected={pin.id === selectedPinId}
            isEntering={pin.id === enteringPinId}
            onSelect={() => onSelectPin(pin.id)}
            onRecognize={onRecognize}
            onDerecognize={onDerecognize}
            onRemove={() => onPinRemove(pin.id)}
            onAdjust={onAdjust}
            onAdjustDraft={onAdjustDraft}
            dissolve={dissolve}
            anchor={realAnchor}
            anchorLabel={anchorLabel}
            frosted={isFocus}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );

  // While isReopened, `pins` holds the whole reopened check-in — but only
  // the pins in expandedPinIds should render editable. A sibling not yet
  // individually expanded stays collapsed, with its own control to expand
  // it (readOnly's "Edit" mode) rather than jumping straight to editable —
  // reopening a check-in with several pins used to expand all of them at
  // once, which read as several drafts appearing rather than the one card
  // that was actually clicked.
  const editingCards = (
    <AnimatePresence initial={false}>
      {reversedPins.map((pin) => {
        const isExpanded = expandedPinIds.has(pin.id);
        return (
          <motion.div
            key={pin.id}
            layout
            data-pin-id={pin.id}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            {isExpanded ? (
              <CoordinateCard
                pin={pin}
                isSelected={pin.id === selectedPinId}
                isEntering={pin.id === enteringPinId}
                onSelect={() => onSelectPin(pin.id)}
                onRecognize={onRecognize}
                onDerecognize={onDerecognize}
                onRemove={() => onPinRemove(pin.id)}
                onAdjust={onAdjust}
                onAdjustDraft={onAdjustDraft}
                dissolve={dissolve}
                frosted={isFocus}
              />
            ) : (
              <CoordinateCard
                pin={pin}
                isSelected={pin.id === selectedPinId}
                isEntering={false}
                onSelect={() => onSelectPin(pin.id)}
                onRecognize={onRecognize}
                onDerecognize={onDerecognize}
                // Not individually expanded, so nothing here can trigger a
                // remove — same as the unreached-prop note on the genuinely
                // read-only previous-check-in cards below.
                onRemove={() => {}}
                onAdjust={onAdjust}
                onAdjustDraft={onAdjustDraft}
                dissolve={dissolve}
                frosted={isFocus}
                readOnly
                onReopen={() => onExpandPin(pin.id)}
                reopenLabel="Edit"
              />
            )}
          </motion.div>
        );
      })}
    </AnimatePresence>
  );

  // The edit's own Discard/Save row, local to editingSection below rather
  // than the panel-wide actionBar — so both controls read as scoped to this
  // one check-in, not to the drawer as a whole. Always enabled to discard
  // (there is always a way back to the unedited check-in); Save disabled at
  // zero pins, same rule as the draft's Save.
  const editingActionBar = (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        borderTop: '1px solid var(--ui-gold-dim)',
      }}
    >
      <button
        onClick={onClear}
        style={{
          background: 'none',
          border: '1px solid var(--ui-border)',
          borderRadius: 6,
          padding: '6px 12px',
          color: 'var(--ui-text-2)',
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
      >
        Discard Edit
      </button>
      <button
        onClick={onDone}
        disabled={!canSave}
        style={{
          background: canSave ? 'var(--ui-gold)' : 'var(--ui-border)',
          border: 'none',
          borderRadius: 6,
          padding: '6px 16px',
          color: canSave ? '#0D0F14' : 'var(--ui-text-3)',
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          cursor: canSave ? 'pointer' : 'default',
        }}
      >
        Update Check-in
      </button>
    </div>
  );

  // Editing lives in its own bordered container, in the position the
  // previous-check-in group normally occupies, rather than taking over the
  // whole panel — the border and its own Discard Edit / Update Check-in row
  // (above) are what make clear the edit is scoped to this one check-in.
  // Also handles the case where every pin has been removed mid-edit: the
  // cards area goes empty, but the box (and Discard Edit inside it) keeps
  // rendering, since App.tsx's mount condition now keeps the drawer around
  // for as long as a reopen is active, regardless of pin count.
  const editingSection = (
    <div
      style={{
        border: '1px solid var(--ui-gold-dim)',
        borderRadius: 12,
        background: 'rgba(201, 168, 124, 0.03)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Same label the section carries when it isn't being edited — the
          section stays "Previous check-in" throughout; editing is a state
          it enters, not a different section that replaces it. The border,
          the gold cards, and the local Discard Edit / Update Check-in row
          already say "you're editing this" without the label itself having
          to change. */}
      {isPanelLayout && (
        <div style={{ ...groupHeaderStyle, padding: '10px 12px 2px' }}>
          {`Previous check-in  ·  ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'}`}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px' }}>
        {editingCards}
        {pins.length === 0 && (
          <p style={{ margin: 0, padding: '4px 2px', fontSize: 12.5, color: 'var(--ui-text-3)', fontStyle: 'italic' }}>
            No pins left in this check-in. Discard to restore it as it was, or add one back on the field.
          </p>
        )}
      </div>
      {editingActionBar}
    </div>
  );

  const cardList = (
    <div
      ref={scrollRef}
      style={{
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        flex: 1,
        padding: '8px 16px',
        // Both variants now render actionBar after this list for the
        // ordinary draft/previous-check-in content (U2), so actionBar
        // carries the safe-area-bottom accommodation there and this only
        // needs a small gap before it. isReopened is the exception: its
        // own editingActionBar (inside editingSection, rendered in this
        // same slot) has no safe-area padding of its own, so this list
        // still needs to provide it when reopened.
        paddingBottom: isSheet && isReopened ? 'max(16px, env(safe-area-inset-bottom))' : 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Renders whether or not a reopen is active — editing happens in
          place, so the same "when" and "how often" context stays on screen
          throughout rather than disappearing the moment editing starts.
          Hidden once a fresh draft has pins (hideHistory, which also covers
          the old drag-only case): it mounts in this same scroll container
          as the draft cards, so leaving it up would keep the sheet too tall
          to reveal much of the field, and would bury a just-dropped pin's
          card below it. */}
      {!hideHistory && returningSummary}
      {isReopened ? (
        // Editing in place: the check-in that was the previous check-in's
        // group now renders here, in that group's position, inside its own
        // bordered box (editingSection) rather than spreading across the
        // whole panel. No separate "Draft check-in" group appears below
        // (there's nothing fresh to put there; reopening is refused while
        // the draft holds pins).
        editingSection
      ) : (
        <>
          {isPanelLayout && !isFocus && previousPins.length > 0 && (
            <div style={groupHeaderStyle}>
              {`Previous check-in  ·  ${previousPins.length} ${previousPins.length === 1 ? 'pin' : 'pins'}`}
            </div>
          )}
          {/* docs/plans/2026-09-02-001-feat-newtab-departure-float-plan.md:
              the neutral-centered first-time departure card that used to
              render here (U2 of the desktop-check-in-focus plan, R2) is
              gone — `neutralDepartureEligible` structurally requires
              `isFocus`, and every state where it's true is now caught by
              the early return above, before cardList is ever built. It
              stays computed (used there) purely so this comment can say,
              accurately, that this block never runs. */}
          {/* Round 6 of the same follow-up: the previous check-in's own
              card is dropped entirely from the centered post-mint view too
              — this landing is meant to show only the draft and its
              Save/Discard choice. 'rail'/'sheet' are unaffected (`!isFocus`
              is always true there); reopening the previous check-in is
              simply not offered from this screen any more — it stays
              reachable from the rail/sheet the same way it always has. */}
          {!hideHistory && !isFocus && previousPins.length > 0 && (
            <AnimatePresence initial={false}>
              {reversedPreviousPins.map((pin) => (
                <motion.div
                  key={pin.id}
                  layout
                  data-pin-id={pin.id}
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                >
                  <CoordinateCard
                    pin={pin}
                    isSelected={pin.id === selectedPinId}
                    isEntering={false}
                    onSelect={() => onSelectPin(pin.id)}
                    onRecognize={onRecognize}
                    onDerecognize={onDerecognize}
                    // A read-only card never renders the remove control —
                    // this is unreachable, kept only to satisfy the prop's
                    // type.
                    onRemove={() => {}}
                    onAdjust={onAdjust}
                    onAdjustDraft={onAdjustDraft}
                    dissolve={dissolve}
                    frosted={isFocus}
                    readOnly
                    onReopen={() => onReopen(previousCheckIn!.id, pin.id)}
                    reopenDisabled={canSave}
                    // U2: only the anchor gets the departure presentation,
                    // and only while the landing state applies — a sibling
                    // pin in a multi-pin check-in, or this same anchor while
                    // the rail keeps history visible alongside an active
                    // draft, stays the plain read-only summary above.
                    departure={departureEligible && pin.id === anchorPinId}
                    onDepart={onDepart}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Round 6: the "Draft check-in" label is dropped too when
              centered — with the previous check-in and rhythm strip both
              gone, the draft card is the only thing left on screen; a
              group header labeling it as one of several groups no longer
              matches what's actually there. 'rail'/'sheet' keep it. */}
          {isPanelLayout && !isFocus && (
            <div style={groupHeaderStyle}>
              {`Draft check-in  ·  ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'}`}
            </div>
          )}
          {draftCards}
        </>
      )}
    </div>
  );

  // docs/plans/2026-09-02-001-feat-newtab-departure-float-plan.md, "full
  // continuity" follow-up: the post-mint 'focus' panel is now frosted, not
  // opaque — the same resting values DepartureFloat.tsx uses for its own
  // strip, so committing a pin doesn't hand off into the field vanishing
  // behind a solid wall again, undoing the whole point of the pre-mint
  // landing. 'rail'/'sheet' keep today's opaque, near-solid panel
  // unchanged — neither is part of this landing, and 'sheet' in particular
  // sits over a field that isn't meant to read as legible chrome-behind-glass.
  // Each individual CoordinateCard inside cardList keeps its own solid
  // `--ui-surface` background regardless (unaffected by this), so the
  // actual review content (recognize/derecognize, tags) stays exactly as
  // legible as it always was — only the surrounding chrome (header gutter,
  // action bar) now shows the field through.
  const shared: React.CSSProperties = {
    position: 'absolute',
    background: isFocus ? 'rgba(13,15,20,0.42)' : 'rgba(12, 14, 18, 0.97)',
    backdropFilter: isFocus ? 'blur(18px) saturate(1.15)' : 'blur(20px)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 40,
  };

  if (isRail) {
    return (
      <motion.div
        initial={{ x: '100%' }}
        // `height: 'auto'` is required, not decorative: React reconciles
        // this motion.div as the SAME DOM node across an isRail toggle
        // (same element type, same position in the tree, regardless of
        // which `return` produced it) — resizing the window from sheet to
        // rail mid-session left this panel frozen at the sheet's last
        // JS-driven pixel height (framer leaves a stale inline height in
        // place when a later `animate` call omits that key, same as the
        // isReopened case above). Explicit 'auto' lets `top`/`bottom` (in
        // `style` below) govern the height again, as they always did
        // before the sheet's animated height existed.
        //
        // Review fix (P1, scale leak): `scale`/`opacity` are set explicitly
        // here for the same reason `height: 'auto'` is above — the 'focus'
        // branch's own `animate` (below) interpolates `scale` down toward
        // ~0.92 during its recede state and always targets `opacity: 1`;
        // omitting either key here left framer's last-applied inline value
        // in place on this reused DOM node, freezing the rail permanently
        // shrunk at whatever scale the focus card last animated to when a
        // drag-commit/field-press/breakpoint resize swapped 'focus' -> 'rail'.
        animate={{ x: 0, height: 'auto', scale: 1, opacity: 1 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        style={{
          ...shared,
          top: 0,
          right: 0,
          bottom: 0,
          width: RAIL_WIDTH,
          borderLeft: '1px solid var(--ui-border)',
          touchAction: 'pan-y',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {cardList}
        {/* Never renders while isReopened — editingSection above owns its
            own Discard Edit / Update Check-in row instead. */}
        {!isReopened && actionBar}
      </motion.div>
    );
  }

  // Focus (U2, docs/plans/2026-08-27-001-feat-desktop-check-in-focus-plan.md):
  // the desktop landing's front-and-center card — same cardList/actionBar
  // content as 'rail' above (isPanelLayout keeps their group headers and
  // history-visibility identical), positioned as a centered overlay instead
  // of a docked side rail. `tabIndex={-1}` + the mount-focus effect above
  // make this the keyboard landing point (R1/R2's card is the primary
  // element) without adding a stop of its own to the page's ordinary tab
  // sequence — the very next Tab reaches the card's own first focusable
  // descendant (the departure card's Reopen link, or Discard/Save once a
  // pin lands), not wherever focus happened to be before the landing mounted.
  //
  // U3 (drag-triggered progressive transition): `cardFocusProgress` (0 =
  // resting centered overlay, 1 = about to swap to 'rail' — App.tsx clears
  // desktopLandingActive once the settle transition below has had time to
  // finish, so this never has to literally land on 'rail's own layout
  // pixel-for-pixel, just visibly move toward it — see the plan's own U3
  // scope note: "proportionate... not pixel-perfect") drives a plain,
  // continuous lerp of this card's own translate offset / width /
  // border-radius. Framer's own `animate` keeps its original job here —
  // mount/exit opacity + a scale "pop" — but its `scale` target is now fed
  // from the SAME progress (`focusScale`).
  //
  // review-fix: `cardFocusProgress` only ever changes on release now (App's
  // handleDepartureDragProgress sets it on 'commit'/'cancel', never on
  // 'drag') — R7's "the layout eases toward today's side-rail arrangement"
  // used to be read as "field AND card move together, live, during the
  // drag," but that made the card resize/reposition under the user's own
  // finger while they were still dragging a slider mounted on it (reported
  // live: "the slider is fighting the drag"). The card now holds its
  // resting position/size for the whole drag — only the field recedes into
  // view during that phase — and animates to the rail in one eased motion
  // only after release. Because of that, there is no longer a "live,
  // no-easing" state for the card to be in — `focusInstant` below no longer
  // branches on drag-liveness, only reduced-motion, and the CSS `transition`
  // is always active for this card's own position/size interpolation. The
  // position/size offset itself is still carried on the CSS `translate`
  // property — distinct from `transform`, so it composes independently of
  // framer's own `transform` output (which owns `scale` via `animate`)
  // rather than colliding with it, the same way a second `transform` source
  // would.
  if (isFocus) {
    const focusP = Math.max(0, Math.min(1, cardFocusProgress));
    const lerp = (a: number, b: number) => a + (b - a) * focusP;
    // % of the card's own width/height — drifts from dead-center toward the
    // upper-right, roughly where 'rail' docks (top-right, full height).
    const focusTranslateX = lerp(-50, 20);
    const focusTranslateY = lerp(-50, -44);
    const focusScale = lerp(1, 0.92);
    const focusWidthPx = lerp(420, 372); // eases toward RAIL_WIDTH's own ~340-420px clamp range
    const focusRadius = lerp(16, 0); // 'rail' docks flush — no rounding
    const focusInstant = reduce;

    return (
      <motion.div
        ref={focusRootRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: focusScale }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={focusInstant ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 35 }}
        style={{
          ...shared,
          top: '50%',
          left: '50%',
          translate: `${focusTranslateX}% ${focusTranslateY}%`,
          width: `min(${focusWidthPx}px, 92vw)`,
          maxHeight: '86vh',
          borderRadius: focusRadius,
          border: '1px solid var(--ui-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
          outline: 'none',
          touchAction: 'pan-y',
          transition: focusInstant
            ? 'none'
            : `translate ${tuning.fieldRecedeDuration}s ease-out, width ${tuning.fieldRecedeDuration}s ease-out, border-radius ${tuning.fieldRecedeDuration}s ease-out`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {cardList}
        {/* Never renders while isReopened — editingSection above owns its
            own Discard Edit / Update Check-in row instead, same as 'rail'. */}
        {!isReopened && actionBar}
      </motion.div>
    );
  }

  // Sheet (mobile). Peek is reachable any time the draft isn't mid-reopen —
  // both the empty-draft "returning mirror" state and an active draft with
  // pins can collapse to the handle. `previousCheckIn` is no longer
  // guaranteed present here (a peeked draft can have no prior check-in at
  // all), so the bar content below branches on `canSave` and falls back
  // gracefully when `previousCheckIn`/`timeLabel` are null.
  //
  // Never peeks while isReopened, regardless of pin count — peeking is for
  // "returning, nothing to add" or "stepping back from a draft," not for an
  // edit in progress. Without this, removing every pin mid-edit (canSave
  // false) would collapse the sheet to the peek handle and hide
  // editingSection's Discard Edit along with it.
  //
  // U3: peeked and expanded used to be two separate `motion.div` returns
  // here — this is now one persistent container (`sheetBodyVisible`
  // computed near the top of the component, alongside the hooks driving
  // `sheetHeight`) so the height change between them animates instead of
  // snapping. The handle button is a persistent element inside it, never
  // unmounted by the toggle — dropping it would drop keyboard/screen-reader
  // focus from the control just activated — and never rendered at all
  // while isReopened, matching the guard it already had. isReopened
  // renders at the same static `maxHeight: 46vh` every expanded case used
  // to use: it never toggles `sheetBodyVisible`, so it never needs the
  // animated height.
  //
  // Bar content (both the collapsed and toggled handle) shows "Last
  // check-in" + timeLabel when there's nothing new to add, or a
  // draft-in-progress label once the draft has pins — so the handle never
  // misdescribes an active edit as history, for sighted and screen-reader
  // users alike (aria-label mirrors the visible text).
  const peekMicroLabel = canSave ? 'Draft' : 'Last check-in';
  const peekDetailLabel = canSave ? `${pins.length} pin${pins.length === 1 ? '' : 's'}` : timeLabel;
  const peekAriaSubject = canSave ? `draft, ${peekDetailLabel}` : 'last check-in';
  const handleButton = !isReopened && (
    <button
      ref={sheetHandleRef}
      type="button"
      onClick={onToggle}
      disabled={dragShrinkActive}
      aria-expanded={sheetBodyVisible}
      aria-label={`${sheetBodyVisible ? 'Collapse' : 'Expand'} ${peekAriaSubject}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 7,
        width: '100%',
        height: PEEK_BAR_HEIGHT,
        padding: '0 18px',
        background: 'transparent',
        border: 'none',
        borderBottom: sheetBodyVisible ? '1px solid var(--ui-border)' : 'none',
        cursor: dragShrinkActive ? 'default' : 'pointer',
        opacity: dragShrinkActive ? 0.4 : 1,
        color: 'inherit',
        textAlign: 'left',
        font: 'inherit',
        flexShrink: 0,
      }}
    >
      {/* Grabber */}
      <span
        aria-hidden
        style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, background: 'var(--ui-border)' }}
      />
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={MICRO_LABEL}>{peekMicroLabel}</span>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ui-text-2)', letterSpacing: '0.01em' }}>
            {peekDetailLabel}
          </span>
        </span>
        {/* Points up while peeked (inviting expand), down while expanded (inviting collapse) */}
        <motion.span
          aria-hidden
          animate={{ rotate: sheetBodyVisible ? 0 : 180 }}
          transition={reduce ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
          style={{ display: 'inline-flex', color: 'var(--ui-text-3)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3.5 8.5L7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      </span>
    </button>
  );

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{
        y: 0,
        // Always set explicitly, never omitted: framer-motion leaves a
        // previously-animated inline style in place when a later `animate`
        // call drops that key, rather than clearing it — so switching to
        // isReopened right after a small peeked height would otherwise
        // freeze the container at that stale pixel value instead of
        // sizing to the static `maxHeight: '46vh'` below.
        height: isReopened ? 'auto' : sheetHeight ?? (sheetBodyVisible ? undefined : PEEK_BAR_HEIGHT),
        // Review fix (P1, scale leak): same reasoning as `height` just
        // above, and as the 'rail' branch's own `animate` — the 'focus'
        // branch interpolates `scale` toward ~0.92 and always targets
        // `opacity: 1`; setting both explicitly here keeps a
        // 'focus' -> 'sheet' swap (a breakpoint-crossing resize mid-landing)
        // from freezing this tray at focus's last-animated scale.
        scale: 1,
        opacity: 1,
      }}
      exit={{ y: '100%' }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 35 }}
      style={{
        ...shared,
        bottom: 0,
        left: 0,
        right: 0,
        overflow: 'hidden',
        touchAction: 'pan-y',
        borderTop: '1px solid var(--ui-border)',
        // Peeked keeps the rounded top corners MirrorCard originally used;
        // expanded/reopened has always been square-top with just the
        // border above.
        borderRadius: sheetBodyVisible ? undefined : '16px 16px 0 0',
        paddingBottom: sheetBodyVisible ? undefined : PEEK_SAFE_PAD,
        maxHeight: isReopened ? `${SHEET_MAX_VH * 100}vh` : undefined,
        // While a slider drag is active, the tray's own background fades
        // toward transparent (independent of U5's sibling/actionBar/history
        // hide above) so the field is visible even behind the active card,
        // not just in the area siblings used to occupy. The card and its
        // slider keep their own styling untouched, so they stay legible
        // against whatever the field shows through underneath. Plain CSS
        // transition rather than framer's `animate` — this container's
        // `animate` prop already drives `height`/`y` via spring physics,
        // and layering a per-key transition override for these two
        // properties on top of that didn't take reliably; a CSS transition
        // is simpler and independent of the height/y spring.
        background: dragShrinkActive ? TRAY_DRAG_BACKGROUND : TRAY_RESTING_BACKGROUND,
        backdropFilter: dragShrinkActive ? TRAY_DRAG_BLUR : TRAY_RESTING_BLUR,
        transition: reduce ? 'none' : 'background 0.25s ease-out, backdrop-filter 0.25s ease-out',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {handleButton}
      <AnimatePresence>
        {sheetBodyVisible && (
          <motion.div
            key="body"
            // minHeight: 0 is load-bearing: without it, this wrapper's
            // automatic minimum size is its own min-content height (its
            // `overflow` is visible, so it doesn't get the same "shrink
            // below content size" exemption cardList's `overflow-y: auto`
            // gives it) — that block propagates down through this extra
            // level of nesting, so cardList never actually gets squeezed
            // enough to engage its own internal scroll.
            style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
            exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.15 } }}
          >
            {/* cardList already branches on isReopened internally (to
                render editingSection in place of the draft/previous
                groups) while staying the one scrollable div that also
                carries returningSummary above it — render it
                unconditionally here rather than re-deciding isReopened at
                this level, which would bypass both. */}
            {cardList}
            {!isReopened && !dragShrinkActive && actionBar}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
