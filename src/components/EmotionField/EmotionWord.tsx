import { motion } from 'framer-motion';
import type { Emotion } from '../../data/emotions';
import type { ProximityResult } from '../../hooks/useProximity';

interface Props {
  emotion: Emotion;
  proximity: ProximityResult;
  isSelected: boolean;
  containerWidth: number;
  containerHeight: number;
}

// Map coordinate [-1, 1] to [5%, 95%] of container dimension
function toPercent(v: number): number {
  return 5 + ((v + 1) / 2) * 90;
}

export function EmotionWord({ emotion, proximity, isSelected, containerWidth, containerHeight }: Props) {
  const left = (toPercent(emotion.x) / 100) * containerWidth;
  const top = (toPercent(-emotion.y) / 100) * containerHeight; // invert Y: +arousal = up

  const { opacity, scale, isApproaching } = proximity;

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
      animate={{
        opacity: isSelected ? 1 : opacity,
        scale: isApproaching ? 1.08 : (isSelected ? 1 : scale),
      }}
      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
    >
      <span
        className={[
          emotion.depth === 'surface' ? 'text-sm' : 'text-xs',
          isSelected
            ? 'text-amber-300 font-semibold'
            : 'text-stone-300',
          'tracking-wide',
        ].join(' ')}
        style={{
          textShadow: isSelected
            ? '0 0 12px rgba(251, 191, 36, 0.6)'
            : undefined,
        }}
      >
        {emotion.label}
      </span>
    </motion.span>
  );
}
