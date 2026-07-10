import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { emotions } from '../../data/emotions';
import { getRegionDescription } from '../../data/regions';
import { useProximity, VISIBILITY_RADIUS, DEEP_REVEAL_CAP } from '../../hooks/useProximity';
import { useFieldGesture } from '../../hooks/useFieldGesture';
import { EmotionWord } from './EmotionWord';
import { toPercent } from '../../utils/fieldGeometry';
import type { PinEntry } from '../../types';

const AXIS_LABEL: React.CSSProperties = {
  position: 'absolute',
  pointerEvents: 'none',
  zIndex: 5,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

// Partition once at module load — emotions array is a static import constant
const surfaceEmotions = emotions.filter(e => e.depth === 'surface');
const deepEmotions = emotions.filter(e => e.depth === 'deep');

interface Props {
  pins: PinEntry[];
  highlightedIds: Set<string>;
  onPinRelease: (entry: PinEntry, highlightedIds: string[]) => void;
  onFirstInteraction?: () => void;
  hasInteracted: boolean;
  // When true (e.g. the first-run demo), the axes brighten above their
  // resting level and settle back when it clears.
  axisEmphasis?: boolean;
}

export function EmotionField({
  pins,
  highlightedIds,
  onPinRelease,
  onFirstInteraction,
  hasInteracted,
  axisEmphasis = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleRelease = useCallback((center: { x: number; y: number }) => {
    const regionDescription = getRegionDescription(center.x, center.y, emotions);

    const nearby: Array<{ id: string; dist: number }> = [];
    for (const em of emotions) {
      const d = Math.sqrt((em.x - center.x) ** 2 + (em.y - center.y) ** 2);
      if (d <= VISIBILITY_RADIUS) {
        nearby.push({ id: em.id, dist: d });
      }
    }
    nearby.sort((a, b) => a.dist - b.dist);
    const newHighlightedIds = nearby.slice(0, 3).map((n) => n.id);

    const entry: PinEntry = {
      id: uuidv4(),
      x: center.x,
      y: center.y,
      recognizedWords: [],
      regionDescription,
    };

    onPinRelease(entry, newHighlightedIds);
  }, [onPinRelease]);

  const { isRevealed, revealCenter, dwellCenter, handlers } = useFieldGesture({
    containerRef,
    size,
    onRelease: handleRelease,
    onFirstInteraction,
    hasInteracted,
  });

  const selectedIds = new Set(pins.flatMap((p) => p.recognizedWords));
  const proximity = useProximity(surfaceEmotions, revealCenter, isRevealed, selectedIds);

  // Pin-based proximity for deep emotions — each pin reveals its nearest
  // DEEP_REVEAL_CAP words; overlapping pins merge by max opacity
  const deepOpacityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const pin of pins) {
      const eligible: Array<{ id: string; t: number; dist: number }> = [];
      for (const e of deepEmotions) {
        const dist = Math.sqrt((e.x - pin.x) ** 2 + (e.y - pin.y) ** 2);
        if (dist <= VISIBILITY_RADIUS) {
          eligible.push({ id: e.id, t: 1 - dist / VISIBILITY_RADIUS, dist });
        }
      }
      eligible.sort((a, b) => a.dist - b.dist);
      for (const { id, t } of eligible.slice(0, DEEP_REVEAL_CAP)) {
        if (t > (map.get(id) ?? 0)) map.set(id, t);
      }
    }
    return map;
  }, [pins]);

  // Dwell-based proximity for deep emotions — follows cursor, transient
  const dwellOpacityMap = useMemo(() => {
    const map = new Map<string, { opacity: number; rank: number }>();
    if (!dwellCenter) return map;
    const eligible: Array<{ id: string; opacity: number; dist: number }> = [];
    for (const e of deepEmotions) {
      const dist = Math.sqrt((e.x - dwellCenter.x) ** 2 + (e.y - dwellCenter.y) ** 2);
      if (dist <= VISIBILITY_RADIUS) {
        eligible.push({ id: e.id, opacity: 1 - dist / VISIBILITY_RADIUS, dist });
      }
    }
    // Sort key is dwellCenter (the frozen anchor), not the live cursor —
    // the capped set must not churn as the cursor drifts after dwell fires
    eligible.sort((a, b) => a.dist - b.dist);
    eligible.slice(0, DEEP_REVEAL_CAP).forEach(({ id, opacity }, rank) => {
      map.set(id, { opacity, rank });
    });
    return map;
  }, [dwellCenter]);

  // Axes read legibly at rest (well above the old 0.04 crosshair) and brighten
  // further while the demo runs.
  const crosshairColor = `rgba(201,168,124,${axisEmphasis ? 0.22 : 0.1})`;
  const axisLabelColor = axisEmphasis ? 'rgba(237,232,223,0.75)' : 'rgba(237,232,223,0.45)';

  return (
    <div
      ref={containerRef}
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={handlers.onPointerLeave}
      onPointerDown={handlers.onPointerDown}
      onPointerMove={handlers.onPointerMove}
      onPointerUp={handlers.onPointerUp}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: 'none', overscrollBehavior: 'none', cursor: 'crosshair' }}
    >
      {/* Crosshairs */}
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: crosshairColor, pointerEvents: 'none', zIndex: 1, transition: 'background 0.6s ease' }} />
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: crosshairColor, pointerEvents: 'none', zIndex: 1, transition: 'background 0.6s ease' }} />

      {/* Axis labels */}
      <div style={{ ...AXIS_LABEL, color: axisLabelColor, top: 16, left: '50%', transform: 'translateX(-50%)' }}>
        Positive
      </div>
      <div style={{ ...AXIS_LABEL, color: axisLabelColor, bottom: 16, left: '50%', transform: 'translateX(-50%)' }}>
        Negative
      </div>
      <div style={{ ...AXIS_LABEL, color: axisLabelColor, left: 16, top: '50%', transform: 'translateY(-50%) rotate(-90deg)' }}>
        Calm
      </div>
      <div style={{ ...AXIS_LABEL, color: axisLabelColor, right: 16, top: '50%', transform: 'translateY(-50%) rotate(90deg)' }}>
        Activated
      </div>

      {/* Axis position indicators — visible only while dragging */}
      {isRevealed && revealCenter && (
        <>
          {/* Arousal: slides left–right along the bottom edge */}
          <div style={{
            position: 'absolute',
            left: `${toPercent(revealCenter.x)}%`,
            bottom: 6,
            transform: 'translateX(-50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'rgba(201,168,124,0.55)',
            pointerEvents: 'none',
            zIndex: 6,
          }} />
          {/* Valence: slides up–down along the right edge */}
          <div style={{
            position: 'absolute',
            top: `${toPercent(-revealCenter.y)}%`,
            right: 6,
            transform: 'translateY(-50%)',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'rgba(201,168,124,0.55)',
            pointerEvents: 'none',
            zIndex: 6,
          }} />
        </>
      )}

      {size.width > 0 && (
        <>
          {/* Surface emotions — always ambient at low opacity, brighten near cursor */}
          {surfaceEmotions.map((emotion) => (
            <EmotionWord
              key={emotion.id}
              emotion={emotion}
              proximity={proximity.get(emotion.id)!}
              isSelected={selectedIds.has(emotion.id)}
              isHighlighted={highlightedIds.has(emotion.id)}
              containerWidth={size.width}
              containerHeight={size.height}
            />
          ))}

          {/* Deep emotions — revealed near dwell/pins; fade in on mount, out on unmount */}
          <AnimatePresence>
            {deepEmotions
              .filter(e =>
                dwellOpacityMap.has(e.id) ||
                deepOpacityMap.has(e.id) ||
                selectedIds.has(e.id) ||
                highlightedIds.has(e.id)
              )
              .map(e => {
                const isFixed = selectedIds.has(e.id) || highlightedIds.has(e.id);
                const pinOpacity = deepOpacityMap.get(e.id) ?? 0;
                const dwell = dwellOpacityMap.get(e.id);
                const dwellOpacity = dwell?.opacity ?? 0;
                const opacity = isFixed ? 1 : Math.max(dwellOpacity, pinOpacity);
                const enterDelay = !isFixed && dwell ? dwell.rank * 0.08 : 0;
                return (
                  <EmotionWord
                    key={e.id}
                    emotion={e}
                    proximity={{ opacity, scale: 1.0, isCandidate: false }}
                    isSelected={selectedIds.has(e.id)}
                    isHighlighted={highlightedIds.has(e.id)}
                    containerWidth={size.width}
                    containerHeight={size.height}
                    enterDelay={enterDelay}
                    animateIn
                  />
                );
              })}
          </AnimatePresence>

          {pins.map((pin) => {
            const px = (toPercent(pin.x) / 100) * size.width;
            const py = (toPercent(-pin.y) / 100) * size.height;
            return (
              <div
                key={pin.id}
                style={{
                  position: 'absolute',
                  left: px,
                  top: py,
                  pointerEvents: 'none',
                  zIndex: 10,
                  width: 0,
                  height: 0,
                }}
              >
                {/* Pulse ring — one-shot on mount */}
                <motion.div
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 4, opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    border: '1px solid rgba(201, 168, 124, 0.6)',
                    top: -4,
                    left: -4,
                  }}
                />
                {/* Dot */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  style={{
                    position: 'absolute',
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: 'rgba(201, 168, 124, 0.7)',
                    top: -2,
                    left: -2,
                  }}
                />
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
