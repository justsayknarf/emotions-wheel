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
  // time, relational line, recent rhythm) is carried into this drawer's
  // returning-summary block above that group (U8/R9). Null when there is no
  // history.
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
  // U7: reopen the previous check-in (by its entry id) into the draft.
  onReopen: (entryId: string) => void;
  // True while a previous check-in is being edited in place (App.tsx's
  // draftId is set). The draft's pins ARE that check-in's pins at this
  // point — this flag only changes how they're presented: in the previous
  // check-in's slot rather than a separate "Draft check-in" group, with
  // Discard Draft hidden (there is no fresh draft to discard) and Save
  // relabeled to say what it actually does.
  isReopened: boolean;
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
  // (U8/R9): the relative time and relational line of the previous check-in,
  // plus the recent-rhythm strip. Deduped recognized-word pills from the old
  // MirrorCard are deliberately not carried forward — each individual
  // read-only card (U6) already shows its own recognized words, so a second,
  // deduped set here would read as redundant rather than informative.
  const relational = previousCheckIn?.pins[0]?.regionDescription.relational.replace(/\*/g, '');
  const timeLabel = previousCheckIn ? formatRelative(previousCheckIn.timestamp) : null;
  const relationalLine = relational && (
    <span style={{ fontSize: 15, fontWeight: 300, color: 'var(--oura-text-1)', lineHeight: 1.45 }}>
      {relational}
    </span>
  );
  // Shown in both variants, above the previous-check-in group's header/rows
  // (not gated by isRail like the pin-count headers below) — this is exactly
  // what the old mirror's sheet variant showed on mobile, so it needs to
  // reach mobile too.
  const returningSummary = previousCheckIn && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 0 4px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
        {relationalLine}
      </div>
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
        // While editing a reopened check-in there is no fresh draft to
        // discard, so Discard Draft doesn't render at all rather than
        // rendering disabled or renamed — right-align Save on its own
        // rather than leaving a gap where the other button used to sit.
        justifyContent: isReopened ? 'flex-end' : 'space-between',
        alignItems: 'center',
      }}
    >
      {!isReopened && (
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
      )}
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
        {isReopened ? 'Update Check-in' : `Save  ·  ${pins.length}`}
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

  // The draft's cards — fully editable, gold-accented. Shared between two
  // positions: the ordinary "Draft check-in" group below (a fresh pin was
  // dropped), and, while isReopened, the "Editing check-in" group that takes
  // over the previous check-in's own slot instead — same cards, same
  // handlers, only the surrounding header/position differs.
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
        // Editing in place: the same pins that were the previous check-in's
        // collapsed row now render here, in that row's position, as ordinary
        // editable draft cards — no separate "Draft check-in" group appears
        // below (there's nothing fresh to put there; reopening is refused
        // while the draft holds pins), and no collapsed summary/previous-
        // check-in group renders above it, since this *is* that check-in.
        <>
          {isRail && (
            <div style={groupHeaderStyle}>
              {`Editing check-in  ·  ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'}`}
            </div>
          )}
          {draftCards}
        </>
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
                    onReopen={() => onReopen(previousCheckIn!.id)}
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
        {actionBar}
      </motion.div>
    );
  }

  // Sheet (mobile). When the draft is empty and the tray hasn't been manually
  // expanded, collapse to a peek handle so the field stays pinnable — the
  // geometry MirrorCard's sheet variant used to own, moved here (U8).
  // `previousCheckIn` is guaranteed present whenever this branch is reached:
  // App.tsx only mounts this drawer when `pins.length > 0 || previousCheckIn`,
  // and `canSave` is false only when `pins` is empty, so an empty-draft peek
  // always has a previous check-in to summarize.
  const isPeeked = !canSave && !expanded;
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

  // Draft has pins, or the tray has been manually expanded past its peek —
  // the full sheet, exactly as before U8, with one addition: when the draft
  // is empty (canSave false) but the tray is manually expanded, the peek
  // handle stays visible at the top so there's a discoverable, tappable way
  // back to peeked — matching MirrorCard's original sheet, where the handle
  // was always present and toggling, not just a field-press dismiss. Hidden
  // when the draft has pins, since that state never had a peek concept.
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
      {!canSave && (
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
      {actionBar}
      {cardList}
    </motion.div>
  );
}
