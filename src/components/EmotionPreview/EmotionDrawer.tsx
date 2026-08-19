import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CoordinateCard } from './CoordinateCard';
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

const MICRO_LABEL: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--oura-text-3)',
};

type Variant = 'sheet' | 'rail';

interface Props {
  pins: PinEntry[];
  // The previous check-in — the most recent diary entry, derived at render in
  // App.tsx (derivePreviousCheckIn). Its pins render as their own collapsed,
  // read-only group above the draft (R4, R5, R6), and its summary (relative
  // time, recent rhythm) is carried into this drawer's returning-summary
  // block above that group (U8/R9). Null when there is no history.
  previousCheckIn: DiaryEntry | null;
  // Full diary history, for the returning-summary's rhythm strip (U8).
  entries: DiaryEntry[];
  variant: Variant;
  onRecognize: (emotionId: string) => void;
  onDerecognize: (emotionId: string) => void;
  onPinRemove: (pinId: string) => void;
  // Commit an adjusted coordinate for a pin (a card slider was released).
  onAdjust: (pinId: string, x: number, y: number) => void;
  // Live draft coordinate while a card slider is dragged (field preview only).
  // Optional: wired once the field overlay consumes it.
  onAdjustDraft?: (coord: { x: number; y: number } | null) => void;
  // Tunable timings (seconds) for the card's word dissolve on a coordinate commit.
  dissolve?: { fadeOut: number; fadeIn: number; hold: number };
  onDone: () => void;
  onClear: () => void;
  // Reopen the previous check-in (by its entry id) into the draft, expanding
  // only the specific pin that was clicked — its siblings move into the
  // draft too (the check-in is still one save unit) but stay collapsed
  // until individually expanded via onExpandPin.
  onReopen: (entryId: string, pinId: string) => void;
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
}

export function EmotionDrawer({
  pins,
  previousCheckIn,
  entries,
  variant,
  onRecognize,
  onDerecognize,
  onPinRemove,
  onAdjust,
  onAdjustDraft,
  dissolve,
  onDone,
  onClear,
  onReopen,
  isReopened,
  expandedPinIds,
  onExpandPin,
  selectedPinId,
  onSelectPin,
  enteringPinId,
  scrollRef,
  expanded = false,
  onToggle,
}: Props) {
  const previousPins = previousCheckIn?.pins ?? [];
  const reversedPins = [...pins].reverse();
  const reversedPreviousPins = [...previousPins].reverse();
  const isRail = variant === 'rail';
  const reduce = useReducedMotion();
  // Save reflects the draft's count only (R21) and is unavailable when the
  // draft holds nothing new (R19) — `pins` here is always the draft array,
  // unaffected by the previous check-in's pins.
  const canSave = pins.length > 0;

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
  const timeLabel = previousCheckIn ? formatRelative(previousCheckIn.timestamp) : null;
  // Shown in both variants, above the previous-check-in group's header/rows
  // (not gated by isRail like the pin-count headers below) — this is exactly
  // what the old mirror's sheet variant showed on mobile, so it needs to
  // reach mobile too.
  const returningSummary = previousCheckIn && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 0 4px' }}>
      {/* On the sheet with an empty draft, a peek handle is always showing
          (peeked, or expanded-with-empty-draft) and already carries the
          time — skip it here to avoid saying it twice. The rail has no
          handle, and the sheet-with-a-draft state has no handle either, so
          both of those keep showing time as their own line. */}
      {(isRail || canSave) && (
        <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--oura-text-2)', letterSpacing: '0.01em' }}>
          {timeLabel}
        </span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={MICRO_LABEL}>Recent rhythm</div>
        <RhythmStrip entries={entries} />
      </div>
    </div>
  );

  const actionBar = (
    <div
      style={{
        padding: '11px 16px',
        borderBottom: isRail ? 'none' : '1px solid var(--oura-border)',
        borderTop: isRail ? '1px solid var(--oura-border)' : 'none',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {/* This bar only ever renders in the non-reopened state now (see the
          rail/sheet returns below) — while editing a previous check-in, its
          own local action row inside editingSection owns Discard Edit /
          Update Check-in instead, so this one stays fixed to the draft. */}
      <button
        onClick={onClear}
        style={{
          background: 'none',
          border: '1px solid var(--oura-border)',
          borderRadius: 6,
          padding: '7px 14px',
          color: 'var(--oura-text-2)',
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
        onClick={onDone}
        disabled={!canSave}
        style={{
          background: canSave ? 'var(--oura-gold)' : 'var(--oura-border)',
          border: 'none',
          borderRadius: 6,
          padding: '7px 18px',
          color: canSave ? '#0D0F14' : 'var(--oura-text-3)',
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
    color: 'var(--oura-text-3)',
    padding: '6px 0 2px',
  };

  // The draft's cards — fully editable, gold-accented. Used for the ordinary
  // "Draft check-in" group below (a fresh pin was dropped) — every pin here
  // is genuinely unsaved, so every card is simply expanded.
  const draftCards = (
    <AnimatePresence initial={false}>
      {reversedPins.map((pin) => (
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
            isEntering={pin.id === enteringPinId}
            onSelect={() => onSelectPin(pin.id)}
            onRecognize={onRecognize}
            onDerecognize={onDerecognize}
            onRemove={() => onPinRemove(pin.id)}
            onAdjust={onAdjust}
            onAdjustDraft={onAdjustDraft}
            dissolve={dissolve}
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
        borderTop: '1px solid var(--oura-gold-dim)',
      }}
    >
      <button
        onClick={onClear}
        style={{
          background: 'none',
          border: '1px solid var(--oura-border)',
          borderRadius: 6,
          padding: '6px 12px',
          color: 'var(--oura-text-2)',
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
          background: canSave ? 'var(--oura-gold)' : 'var(--oura-border)',
          border: 'none',
          borderRadius: 6,
          padding: '6px 16px',
          color: canSave ? '#0D0F14' : 'var(--oura-text-3)',
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
        border: '1px solid var(--oura-gold-dim)',
        borderRadius: 12,
        background: 'rgba(201, 168, 124, 0.03)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {isRail && (
        <div style={{ ...groupHeaderStyle, padding: '10px 12px 2px' }}>
          {`Editing check-in  ·  ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'}`}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px' }}>
        {editingCards}
        {pins.length === 0 && (
          <p style={{ margin: 0, padding: '4px 2px', fontSize: 12.5, color: 'var(--oura-text-3)', fontStyle: 'italic' }}>
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
        paddingBottom: isRail ? 8 : 'max(16px, env(safe-area-inset-bottom))',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {isReopened ? (
        // Editing in place: the check-in that was the previous check-in's
        // group now renders here, in that group's position, inside its own
        // bordered box (editingSection) rather than spreading across the
        // whole panel. No separate "Draft check-in" group appears below
        // (there's nothing fresh to put there; reopening is refused while
        // the draft holds pins), and no collapsed summary/previous-check-in
        // group renders above it, since this *is* that check-in.
        editingSection
      ) : (
        <>
          {returningSummary}
          {isRail && previousPins.length > 0 && (
            <div style={groupHeaderStyle}>
              {`Previous check-in  ·  ${previousPins.length} ${previousPins.length === 1 ? 'pin' : 'pins'}`}
            </div>
          )}
          {previousPins.length > 0 && (
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
                    readOnly
                    onReopen={() => onReopen(previousCheckIn!.id, pin.id)}
                    reopenDisabled={canSave}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {isRail && (
            <div style={groupHeaderStyle}>
              {`Draft check-in  ·  ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'}`}
            </div>
          )}
          {draftCards}
        </>
      )}
    </div>
  );

  const shared: React.CSSProperties = {
    position: 'absolute',
    background: 'rgba(12, 14, 18, 0.97)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 40,
  };

  if (isRail) {
    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        style={{
          ...shared,
          top: 0,
          right: 0,
          bottom: 0,
          width: RAIL_WIDTH,
          borderLeft: '1px solid var(--oura-border)',
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

  // Sheet (mobile). When the draft is empty and the tray hasn't been manually
  // expanded, collapse to a peek handle so the field stays pinnable — the
  // geometry MirrorCard's sheet variant used to own, moved here (U8).
  // `previousCheckIn` is guaranteed present whenever this branch is reached:
  // App.tsx only mounts this drawer when `pins.length > 0 || previousCheckIn
  // || draftId !== null`, and this branch additionally requires !isReopened
  // (so draftId is null) and !canSave (pins is empty), leaving previousCheckIn
  // as the only clause that can be true.
  //
  // Never peeks while isReopened, regardless of pin count — peeking is for
  // "returning, nothing to add," not for an edit in progress. Without this,
  // removing every pin mid-edit (canSave false) would collapse the sheet to
  // the peek handle and hide editingSection's Discard Edit along with it.
  const isPeeked = !isReopened && !canSave && !expanded;
  if (isPeeked) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        style={{
          ...shared,
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: '1px solid var(--oura-border)',
          borderRadius: '16px 16px 0 0',
          paddingBottom: PEEK_SAFE_PAD,
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-label="Expand last check-in"
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
            cursor: 'pointer',
            color: 'inherit',
            textAlign: 'left',
            font: 'inherit',
          }}
        >
          {/* Grabber */}
          <span
            aria-hidden
            style={{
              alignSelf: 'center',
              width: 34,
              height: 4,
              borderRadius: 2,
              background: 'var(--oura-border)',
            }}
          />
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={MICRO_LABEL}>Last check-in</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--oura-text-2)', letterSpacing: '0.01em' }}>
                {timeLabel}
              </span>
            </span>
            {/* Chevron — points up while peeked, inviting expand */}
            <motion.span
              aria-hidden
              animate={{ rotate: 180 }}
              transition={reduce ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
              style={{ display: 'inline-flex', color: 'var(--oura-text-3)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 8.5L7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          </span>
        </button>
      </motion.div>
    );
  }

  // Draft has pins, the tray has been manually expanded past its peek, or a
  // reopen is active — the full sheet, exactly as before U8, with one
  // addition: when the draft is empty (canSave false) but the tray is
  // manually expanded, the peek handle stays visible at the top so there's a
  // discoverable, tappable way back to peeked — matching MirrorCard's
  // original sheet, where the handle was always present and toggling, not
  // just a field-press dismiss. Hidden when the draft has pins (never had a
  // peek concept) and while isReopened (peeking doesn't apply to an edit in
  // progress, and there is no previousCheckIn/timeLabel to show in the
  // handle then anyway — see isPeeked above).
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      style={{
        ...shared,
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: '46vh',
        borderTop: '1px solid var(--oura-border)',
        touchAction: 'pan-y',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {!isReopened && !canSave && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={true}
          aria-label="Collapse last check-in"
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
            borderBottom: '1px solid var(--oura-border)',
            cursor: 'pointer',
            color: 'inherit',
            textAlign: 'left',
            font: 'inherit',
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{ alignSelf: 'center', width: 34, height: 4, borderRadius: 2, background: 'var(--oura-border)' }}
          />
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={MICRO_LABEL}>Last check-in</span>
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--oura-text-2)', letterSpacing: '0.01em' }}>
                {timeLabel}
              </span>
            </span>
            {/* Chevron — points down while expanded, inviting collapse */}
            <motion.span
              aria-hidden
              animate={{ rotate: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
              style={{ display: 'inline-flex', color: 'var(--oura-text-3)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 8.5L7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          </span>
        </button>
      )}
      {!isReopened && actionBar}
      {cardList}
    </motion.div>
  );
}
