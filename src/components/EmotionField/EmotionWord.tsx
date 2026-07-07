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
}

// Map coordinate [-1, 1] to [5%, 95%] of container dimension
function toPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}

export function EmotionWord({ emotion, proximity, isSelected, isHighlighted, containerWidth, containerHeight, enterDelay = 0, animateIn = false }: Props) {
  const left = (toPercent(emotion.x) / 100) * containerWidth;
  const top = (toPercent(-emotion.y) / 100) * containerHeight; // invert Y: +valence = up

  const { opacity, scale, isCandidate } = proximity;

  const resolvedOpacity = isSelected || isHighlighted ? 1 : opacity;
  const resolvedScale = isCandidate ? 1.3 : (isSelected ? 1 : (isHighlighted ? 1.05 : scale));

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
      initial={animateIn ? { opacity: 0, scale: 1 } : false}
      animate={{ opacity: resolvedOpacity, scale: resolvedScale }}
      exit={{ opacity: 0, transition: { duration: 1.5, ease: 'easeOut' } }}
      transition={animateIn
        ? { opacity: { duration: 2, ease: 'easeOut', delay: enterDelay }, scale: { type: 'spring', stiffness: 120, damping: 20 } }
        : { type: 'spring', stiffness: 120, damping: 20 }
      }
    >
      <span
        className={[
          emotion.depth === 'surface' ? 'text-sm' : 'text-xs',
          'tracking-wide',
        ].join(' ')}
        style={{
          color: isSelected
            ? '#C9A87C'
            : isHighlighted
              ? 'rgba(201, 168, 124, 0.7)'
              : 'rgba(237, 232, 223, 1)',
          fontWeight: isSelected ? 500 : isHighlighted ? 400 : 300,
          letterSpacing: isSelected ? '0.01em' : '0.02em',
          textShadow: isSelected
            ? '0 0 16px rgba(201, 168, 124, 0.4)'
            : isHighlighted
              ? '0 0 10px rgba(201, 168, 124, 0.2)'
              : undefined,
        }}
      >
        {emotion.label}
      </span>
    </motion.span>
  );
}
