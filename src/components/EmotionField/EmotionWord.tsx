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
  // While a check-in card is selected, the two emotions it names are lifted
  // ('pair') and everyone else revealed is pushed back ('recede'), so the card's
  // "between X and Y" reads against the geometry. null = the resting field.
  emphasis?: 'pair' | 'recede' | null;
  // How firmly a 'recede' word steps back (0–1). Ignored otherwise.
  recedeStrength?: number;
}

// Recede floors: even at full strength a pushed-back word keeps this share of
// its opacity/scale, so the surrounding context never disappears.
const RECEDE_MIN_OPACITY = 0.4;
const RECEDE_MIN_SCALE = 0.85;
// The named pair grows slightly past its resting size to claim the eye.
const PAIR_SCALE_BOOST = 1.16;
// text-sm (14px) over text-xs (12px): what a selected deep word scales by to
// match a primary (surface) word.
const DEEP_TO_PRIMARY_SCALE = 14 / 12;

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

// The field words are set in Palatino — a warm humanist serif. Wellness-tracker
// apps tend toward a neutral sans for reading data; this surface is for
// *recording* a feeling, so it wants a softer, more human voice. Falls back
// through the common Palatino aliases to a generic serif.
export const FIELD_FONT = "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif";

export function EmotionWord({ emotion, proximity, isSelected, isHighlighted, containerWidth, containerHeight, enterDelay = 0, animateIn = false, offset, emphasis = null, recedeStrength = 0 }: Props) {
  const left = (toPercent(emotion.x) / 100) * containerWidth;
  const top = (toPercent(-emotion.y) / 100) * containerHeight; // invert Y: +valence = up

  const { opacity, scale, isCandidate, nearness } = proximity;

  const resolvedOpacity = isSelected || isHighlighted ? 1 : opacity;
  // A recognized (tagged) word steps up to the primary tier's size: deep words
  // are text-xs, surface words text-sm, so a selected deep word scales by the
  // ratio. Done as a spring-animated scale rather than a class swap so the word
  // grows smoothly when the tag is picked. Surface words are already primary.
  const selectedScale = emotion.depth === 'deep' ? DEEP_TO_PRIMARY_SCALE : 1;
  const resolvedScale = isCandidate ? 1.3 : (isSelected ? selectedScale : (isHighlighted ? 1.05 : scale));

  // Card emphasis, layered on top of the resting treatment. 'pair' forces the
  // gold, lifted read even for a word that wasn't otherwise highlighted;
  // 'recede' scales opacity + size down toward the floors above.
  // A tagged word never recedes — it's the one the user just picked.
  const receding = emphasis === 'recede' && !isSelected;
  const s = Math.max(0, Math.min(1, recedeStrength));
  const emphasisOpacity =
    receding ? resolvedOpacity * (1 - s * (1 - RECEDE_MIN_OPACITY)) : resolvedOpacity;
  const emphasisScale =
    emphasis === 'pair'
      ? resolvedScale * PAIR_SCALE_BOOST
      : receding
        ? resolvedScale * (1 - s * (1 - RECEDE_MIN_SCALE))
        : resolvedScale;

  // Warm toward the gold accent as the cursor nears, so proximity reads in
  // colour as well as size — for surface anchors and revealed deep words alike.
  const n = Math.max(0, Math.min(1, nearness)) * 0.85;
  const proximityColor = `color-mix(in srgb, var(--ui-gold) ${Math.round(n * 100)}%, var(--ui-text-1))`;
  const proximityGlow =
    n > 0.04 ? `0 0 ${Math.round(12 * n)}px rgb(var(--ui-gold-rgb) / ${(0.35 * n).toFixed(2)})` : undefined;

  // The coordinate dot is the word's true anchor: it sits at the point and holds
  // a steady, depth-encoded presence, independent of the label's proximity
  // opacity (KTD3). Surface dots are the brighter/larger tier; deep dots — which
  // only render when revealed — are quieter. Bone-toned, so they stay distinct
  // from the user's gold pins (KTD2).
  const isSurface = emotion.depth === 'surface';
  // The named pair's coordinate dots lift to a gold, formerly-dropped-pin-sized
  // point (smaller than the selected pin) so the two "between" coordinates stay
  // clearly anchored — matching the kept gold tether, and following the selected
  // card via the same `emphasis` signal. Every other dot keeps its quiet bone
  // presence.
  const isPair = emphasis === 'pair';
  const dotSize = isPair ? 4 : isSurface ? 3 : 2;
  const dotOpacity = isSurface ? 0.32 : 0.16;
  const dotColor = isPair ? 'rgb(var(--ui-gold-rgb) / 0.7)' : `rgb(var(--ui-text-rgb) / ${dotOpacity})`;

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
          background: dotColor,
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
          // A selected tag takes the cool recorded hue so it stands apart from
          // every gold (pair/highlighted) and bone (ambient) word on the field.
          color: isSelected
            ? 'var(--ui-recorded)'
            : emphasis === 'pair'
              ? 'var(--ui-gold)'
              : isHighlighted
              ? 'rgb(var(--ui-gold-rgb) / 0.7)'
              : proximityColor,
          // Depth tiers (U5): surface words are the landmarks — the larger size
          // (text-sm), kept light and airy. Deep words stay a step smaller
          // (text-xs) but carry more weight so they read at that size once
          // revealed. Surface stays at its tuned width (the data is spaced right
          // to the edge, so widening it would collide). Selected/highlighted gold
          // treatment is unchanged.
          fontWeight: emphasis === 'pair' || isSelected ? 500 : isHighlighted ? 400 : isSurface ? 300 : 400,
          letterSpacing: isSelected ? '0.01em' : '0.02em',
          textShadow: isSelected
            ? '0 0 16px rgb(var(--ui-recorded-rgb) / 0.4)'
            : emphasis === 'pair'
              ? '0 0 14px rgb(var(--ui-gold-rgb) / 0.45)'
              : isHighlighted
                ? '0 0 10px rgb(var(--ui-gold-rgb) / 0.2)'
                : proximityGlow,
        }}
        initial={animateIn ? { opacity: 0, x: offset?.dx ?? 0, y: -LABEL_STANDOFF + (offset?.dy ?? 0) } : false}
        animate={{ opacity: emphasisOpacity, scale: emphasisScale, x: offset?.dx ?? 0, y: -LABEL_STANDOFF + (offset?.dy ?? 0) }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
      >
        {emotion.label}
      </motion.span>
    </motion.span>
  );
}
