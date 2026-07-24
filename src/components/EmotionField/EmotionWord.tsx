import { motion } from 'framer-motion';
import type { Emotion } from '../../data/emotions';
import type { ProximityResult } from '../../hooks/useProximity';

interface Props {
  emotion: Emotion;
  proximity: ProximityResult;
  isSelected: boolean;
  isHighlighted: boolean;
  containerWidth: number;
  containerHeight: number;
  enterDelay?: number;
  animateIn?: boolean;
  // De-overlap displacement (px) applied to the label on top of the standoff.
  // The dot never moves; only the label callout slides. (U3)
  offset?: { dx: number; dy: number };
}

// Map coordinate [-1, 1] to [5%, 95%] of container dimension
function toPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}

// The label sits this many pixels above its dot. The dot marks the true
// coordinate; the label is a callout anchored to it. A small, uniform standoff
// keeps the dot visible at rest and primes the "label attached to a point"
// grammar, so a later de-overlap nudge (which grows this offset) reads as the
// same gesture rather than a relocation. (KTD4)
export const LABEL_STANDOFF = 11;

// The field words are set in Palatino — a warm humanist serif. Oura uses a
// neutral sans for reading data; this surface is for *recording* a feeling, so
// it wants a softer, more human voice. Falls back through the common Palatino
// aliases to a generic serif.
const FIELD_FONT = "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

export function EmotionWord({ emotion, proximity, isSelected, isHighlighted, containerWidth, containerHeight, enterDelay = 0, animateIn = false, offset }: Props) {
  const left = (toPercent(emotion.x) / 100) * containerWidth;
  const top = (toPercent(-emotion.y) / 100) * containerHeight; // invert Y: +valence = up

  const { opacity, scale, isCandidate, nearness } = proximity;

  const resolvedOpacity = isSelected || isHighlighted ? 1 : opacity;
  const resolvedScale = isCandidate ? 1.3 : (isSelected ? 1 : (isHighlighted ? 1.05 : scale));

  // Warm toward the gold accent as the cursor nears, so proximity reads in
  // colour as well as size — for surface anchors and revealed deep words alike.
  const n = Math.max(0, Math.min(1, nearness)) * 0.85;
  const mix = (bone: number, gold: number) => Math.round(bone + (gold - bone) * n);
  const proximityColor = `rgb(${mix(237, 201)}, ${mix(232, 168)}, ${mix(223, 124)})`;
  const proximityGlow =
    n > 0.04 ? `0 0 ${Math.round(12 * n)}px rgba(201, 168, 124, ${(0.35 * n).toFixed(2)})` : undefined;

  // The coordinate dot is the word's true anchor: it sits at the point and holds
  // a steady, depth-encoded presence, independent of the label's proximity
  // opacity (KTD3). Surface dots are the brighter/larger tier; deep dots — which
  // only render when revealed — are quieter. Bone-toned, so they stay distinct
  // from the user's gold pins (KTD2).
  const isSurface = emotion.depth === 'surface';
  const dotSize = isSurface ? 3 : 2;
  const dotOpacity = isSurface ? 0.32 : 0.16;

  return (
    <motion.span
      style={{
        position: 'absolute',
        left,
        top,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        willChange: 'opacity, transform',
        whiteSpace: 'nowrap',
      }}
      // The container carries only the reveal enter/exit fade (deep words, via
      // AnimatePresence). The label owns proximity opacity + scale; the dot holds
      // its own steady opacity. So a deep word's dot+label arrive and leave
      // together, while a surface dot never ramps with the cursor.
      initial={animateIn ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1.5, ease: 'easeOut' } }}
      transition={animateIn ? { opacity: { duration: 2, ease: 'easeOut', delay: enterDelay } } : undefined}
    >
      {/* Coordinate dot — self-contained fragment so a future soft "zone" halo
          can swap in here without touching the label/anchor grammar (KTD8). */}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: dotSize,
          height: dotSize,
          marginLeft: -dotSize / 2,
          marginTop: -dotSize / 2,
          borderRadius: '50%',
          background: `rgba(237, 232, 223, ${dotOpacity})`,
          pointerEvents: 'none',
        }}
      />
      <motion.span
        className={[
          emotion.depth === 'surface' ? 'text-sm' : 'text-xs',
          'tracking-wide',
        ].join(' ')}
        style={{
          display: 'inline-block',
          fontFamily: FIELD_FONT,
          color: isSelected
            ? '#C9A87C'
            : isHighlighted
              ? 'rgba(201, 168, 124, 0.7)'
              : proximityColor,
          // Depth tiers (U5): surface words are the landmarks — the larger size
          // (text-sm), kept light and airy. Deep words stay a step smaller
          // (text-xs) but carry more weight so they read at that size once
          // revealed. Surface stays at its tuned width (the data is spaced right
          // to the edge, so widening it would collide). Selected/highlighted gold
          // treatment is unchanged.
          fontWeight: isSelected ? 500 : isHighlighted ? 400 : isSurface ? 300 : 400,
          letterSpacing: isSelected ? '0.01em' : '0.02em',
          textShadow: isSelected
            ? '0 0 16px rgba(201, 168, 124, 0.4)'
            : isHighlighted
              ? '0 0 10px rgba(201, 168, 124, 0.2)'
              : proximityGlow,
        }}
        initial={animateIn ? { opacity: 0, x: offset?.dx ?? 0, y: -LABEL_STANDOFF + (offset?.dy ?? 0) } : false}
        animate={{ opacity: resolvedOpacity, scale: resolvedScale, x: offset?.dx ?? 0, y: -LABEL_STANDOFF + (offset?.dy ?? 0) }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        {emotion.label}
      </motion.span>
    </motion.span>
  );
}
