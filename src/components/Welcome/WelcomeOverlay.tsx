import { motion, useReducedMotion } from 'framer-motion';
import { FIELD_FONT } from '../EmotionField/EmotionWord';

interface Props {
  cue: string;
  fieldCenterLeft: string;   // horizontal centre of the field plane (rail-aware)
  exitDuration: number;      // seconds — calm on auto-dissolve, snappy on skip
}

// The grounding welcome: a single somatic cue floating over the field as the
// check-in opens. Deliberately not a card — borderless Palatino text in the
// warm off-white of the recording surface, so it reads as presence rather than
// a dialog. pointerEvents: none, so a touch falls straight through to the field
// (App tears the overlay down on that same touch). Mount/unmount is driven by
// AnimatePresence at the call site.
//
// Anchored to the top rather than dead-center: the desktop landing's focus
// card (EmotionDrawer's 'focus' variant) also centers on the field, at
// zIndex 40 — a vertically-centered cue at zIndex 35 rendered directly behind
// it, invisible for the whole landing. Top-center clears the card regardless
// of its height, and sits above it (zIndex 45) so it's never occluded.
export function WelcomeOverlay({ cue, fieldCenterLeft, exitDuration }: Props) {
  const reduce = useReducedMotion();

  return (
    <div
      style={{
        position: 'absolute',
        top: 64,
        left: fieldCenterLeft,
        transform: 'translateX(-50%)',
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
