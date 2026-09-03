import { motion, useReducedMotion } from 'framer-motion';
import { FIELD_FONT } from '../EmotionField/EmotionWord';

interface Props {
  cue: string;
  fieldCenterLeft: string;   // horizontal centre of the field plane (rail-aware)
  // EmotionDrawer's focus card's live measured top edge (px, same coordinate
  // space as this component's own `position: absolute`), or null before the
  // first measurement lands / when no focus card is mounted. See the anchor
  // comment below for why this replaces a fixed top offset.
  cardTop: number | null;
  exitDuration: number;      // seconds — calm on auto-dissolve, snappy on skip
}

// The grounding welcome: a single somatic cue floating over the field as the
// check-in opens. Deliberately not a card — borderless Palatino text in the
// warm off-white of the recording surface, so it reads as presence rather than
// a dialog. pointerEvents: none, so a touch falls straight through to the field
// (App tears the overlay down on that same touch). Mount/unmount is driven by
// AnimatePresence at the call site.
//
// Anchored above the focus card's own measured top edge (via `cardTop`,
// EmotionDrawer's onFocusCardTopChange) rather than dead-center: the desktop
// landing's focus card (EmotionDrawer's 'focus' variant) also centers on the
// field, at zIndex 40 — a vertically-centered cue at zIndex 35 rendered
// directly behind it, invisible for the whole landing (de09add). A *fixed*
// top offset (this component's original fix) only clears the card by luck —
// it assumes the card never grows taller than the gap, which nothing
// enforces. Anchoring by the card's real measured top instead, with
// `transform`'s translateY(-100%) placing this element's own *bottom* edge
// (not its top) at that point, holds regardless of either side's height:
// a longer cue wraps upward, away from the card, never into it. `cardTop`
// null (no measurement yet, or no focus card mounted this session) falls
// back to a fixed offset matching the original fix, so non-landing sessions
// (no focus card at all) keep today's placement.
const FALLBACK_TOP = 64;
const CARD_GAP = 32;

export function WelcomeOverlay({ cue, fieldCenterLeft, cardTop, exitDuration }: Props) {
  const reduce = useReducedMotion();
  const anchorTop = cardTop === null ? FALLBACK_TOP : cardTop - CARD_GAP;
  const anchorFromBottom = cardTop !== null;

  return (
    <div
      style={{
        position: 'absolute',
        top: anchorTop,
        left: fieldCenterLeft,
        transform: anchorFromBottom ? 'translate(-50%, -100%)' : 'translateX(-50%)',
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 45,
        maxWidth: '80%',
      }}
    >
      <motion.p
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
        // Entrance: a slow, gentle rise. Exit carries its own duration so the
        // parent can dissolve calmly (auto) or quickly (skip-on-touch).
        transition={{ delay: 0.3, duration: 0.7, ease: 'easeOut' }}
        exit={{
          opacity: 0,
          ...(reduce ? {} : { y: -6 }),
          transition: { duration: exitDuration, ease: 'easeOut' },
        }}
        style={{
          margin: 0,
          fontFamily: FIELD_FONT,
          fontSize: 30,
          fontWeight: 300,
          lineHeight: 1.35,
          letterSpacing: '0.01em',
          color: 'var(--ui-text-1)',
        }}
      >
        {cue}
      </motion.p>
    </div>
  );
}
