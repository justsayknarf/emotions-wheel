import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { emotions } from '../../data/emotions';
import { getRegionDescription } from '../../data/regions';
import { useProximity, VISIBILITY_RADIUS, DEEP_REVEAL_CAP } from '../../hooks/useProximity';
import { useFieldGesture } from '../../hooks/useFieldGesture';
import { EmotionWord, LABEL_STANDOFF } from './EmotionWord';
import { labelHalfWidth, LABEL_LINE_H } from './deoverlap';
import { computeRadialFan, type FanBox } from './radialFan';
import { WordTethers, type TetherSegment } from './WordTethers';
import { FieldSignal } from './FieldSignal';
import { useRevealTuning } from '../../config/revealTuning';
import { toPercent } from '../../utils/fieldGeometry';

// A revealed label draws a tether back to its dot once it sits this far from the
// coordinate. Above the resting standoff (so a merely-lifted label has none),
// below a real de-overlap displacement. (U4, tune per Q3)
const TETHER_THRESHOLD = 26;
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
  onPinRelease: (entry: PinEntry) => void;
  onFirstInteraction?: () => void;
  hasInteracted: boolean;
  // When true (e.g. the first-run demo), the axes brighten above their
  // resting level and settle back when it clears.
  axisEmphasis?: boolean;
  // A quiet marker at the user's most recent coordinate, shown in the
  // returning-mirror state. A single point today; the shared geometry keeps a
  // future multi-point constellation cheap to add.
  ghostPin?: { x: number; y: number } | null;
  // The pin whose card is currently selected in the tray — rendered larger and
  // brighter so the card↔point link reads both ways.
  emphasizedPinId?: string | null;
}

export function EmotionField({
  pins,
  highlightedIds,
  onPinRelease,
  onFirstInteraction,
  hasInteracted,
  axisEmphasis = false,
  ghostPin = null,
  emphasizedPinId = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const tuning = useRevealTuning();

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
    // The pin carries only its coordinate + narrative. Which emotions it
    // highlights is derived from the pin (in App), so the highlighted set can
    // never drift from the pin — see nearestTagIds / the selected-pin memo.
    const entry: PinEntry = {
      id: uuidv4(),
      x: center.x,
      y: center.y,
      recognizedWords: [],
      regionDescription: getRegionDescription(center.x, center.y, emotions),
    };
    onPinRelease(entry);
  }, [onPinRelease]);

  const { isRevealed, revealCenter, dwellCenter, handlers } = useFieldGesture({
    containerRef,
    size,
    onRelease: handleRelease,
    onFirstInteraction,
    hasInteracted,
  });

  const selectedIds = useMemo(
    () => new Set(pins.flatMap((p) => p.recognizedWords)),
    [pins],
  );
  const proximity = useProximity(surfaceEmotions, revealCenter, isRevealed, selectedIds);

  // The two emotions the selected card names ("between X and Y") — the nearest
  // pair, within range, to the emphasized pin. Recomputed from the pin itself
  // (not the highlighted set) so it stays correct when an older card is
  // reselected. While these two are lifted, everyone else revealed recedes,
  // so the card's phrase reads against the geometry.
  const pairIds = useMemo(() => {
    const set = new Set<string>();
    if (!emphasizedPinId) return set;
    const pin = pins.find((p) => p.id === emphasizedPinId);
    if (!pin) return set;
    const nearby: Array<{ id: string; dist: number }> = [];
    for (const e of emotions) {
      const dist = Math.sqrt((e.x - pin.x) ** 2 + (e.y - pin.y) ** 2);
      if (dist <= VISIBILITY_RADIUS) nearby.push({ id: e.id, dist });
    }
    nearby.sort((a, b) => a.dist - b.dist);
    for (const n of nearby.slice(0, 2)) set.add(n.id);
    return set;
  }, [emphasizedPinId, pins]);

  // Recede only kicks in when the card actually names a pair (≥2 words in
  // range) and the knob is above zero.
  const recedeActive = pairIds.size === 2 && tuning.recedeStrength > 0;

  // Pin-based proximity for deep emotions — the emphasized (selected) pin
  // reveals its nearest DEEP_REVEAL_CAP words. Only the selected pin reveals a
  // deep neighbourhood: other pins' deep words would clutter the field and make
  // it harder to anchor what the selected card names. (Other pins keep their
  // dots — rendered below — just not their word labels.) With no pin emphasized
  // we fall back to the full constellation.
  const deepOpacityMap = useMemo(() => {
    const map = new Map<string, number>();
    const source = emphasizedPinId ? pins.filter((p) => p.id === emphasizedPinId) : pins;
    for (const pin of source) {
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
  }, [pins, emphasizedPinId]);

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

  // The deep words currently on screen: revealed by dwell, by a pin, or fixed
  // because they are selected/highlighted.
  const revealedDeep = useMemo(
    () =>
      deepEmotions.filter(
        (e) =>
          dwellOpacityMap.has(e.id) ||
          deepOpacityMap.has(e.id) ||
          selectedIds.has(e.id) ||
          highlightedIds.has(e.id),
      ),
    [dwellOpacityMap, deepOpacityMap, selectedIds, highlightedIds],
  );

  // Live cursor proximity for the revealed deep words, so they react to the
  // cursor (size + colour) the way surface anchors do. Only the scale/nearness
  // are used — a deep word's visibility stays reveal-driven, not cursor-driven.
  const deepProximity = useProximity(revealedDeep, revealCenter, isRevealed, selectedIds);

  // Reveal foci in pixel space: the dwell centre (when dwelling) and the
  // emphasized pin. Each revealed word fans out of its nearest focus — scoped to
  // the selected pin so the fan matches the words we actually reveal (above),
  // and no other pin pulls a label toward it. Full constellation when nothing
  // is emphasized.
  const fociPx = useMemo(() => {
    if (size.width === 0) return [] as Array<{ x: number; y: number }>;
    const toPx = (c: { x: number; y: number }) => ({
      x: (toPercent(c.x) / 100) * size.width,
      y: (toPercent(-c.y) / 100) * size.height,
    });
    const arr: Array<{ x: number; y: number }> = [];
    if (dwellCenter) arr.push(toPx(dwellCenter));
    const source = emphasizedPinId ? pins.filter((p) => p.id === emphasizedPinId) : pins;
    for (const p of source) arr.push(toPx(p));
    return arr;
  }, [dwellCenter, pins, emphasizedPinId, size.width, size.height]);

  // Lay the revealed labels out as a fan around their nearest focus: each rides
  // a ray out of the cursor/pin, with a no-crossing pass so their tethers never
  // tangle. Surface labels are fixed obstacles; dots never move — only the
  // label callouts. (Q3 radial-fan reveal)
  const deepLabelOffsets = useMemo(() => {
    if (size.width === 0 || revealedDeep.length === 0) {
      return new Map<string, { dx: number; dy: number }>();
    }
    const fanBox = (
      e: (typeof emotions)[number],
      movable: boolean,
    ): FanBox => {
      const dotX = (toPercent(e.x) / 100) * size.width;
      const dotY = (toPercent(-e.y) / 100) * size.height;
      return {
        id: e.id,
        dotX,
        dotY,
        cx: dotX,
        cy: dotY - LABEL_STANDOFF,
        halfW: labelHalfWidth(e.label, e.depth),
        halfH: LABEL_LINE_H / 2,
        movable,
      };
    };
    const boxes: FanBox[] = [
      ...surfaceEmotions.map((e) => fanBox(e, false)),
      ...revealedDeep.map((e) => fanBox(e, true)),
    ];
    return computeRadialFan(boxes, fociPx, tuning);
  }, [revealedDeep, fociPx, size.width, size.height, tuning]);

  // A tether is drawn (and then faded) from each fanned label back to its dot,
  // staggered so the nearest word to a focus draws first.
  const wordTethers = useMemo<TetherSegment[]>(() => {
    if (size.width === 0) return [];
    const raw: Array<{ seg: TetherSegment; d: number }> = [];
    for (const e of revealedDeep) {
      const o = deepLabelOffsets.get(e.id) ?? { dx: 0, dy: 0 };
      const dispX = o.dx;
      const dispY = o.dy - LABEL_STANDOFF;
      if (Math.hypot(dispX, dispY) <= TETHER_THRESHOLD) continue;
      const cx = (toPercent(e.x) / 100) * size.width;
      const cyCoord = (toPercent(-e.y) / 100) * size.height;
      const d = fociPx.length
        ? Math.min(...fociPx.map((f) => Math.hypot(cx - f.x, cyCoord - f.y)))
        : 0;
      // Aim the tether at the label's centre but terminate at the edge of its
      // bounding box (plus a small gap), along the ray from the centre toward
      // the dot. So the line points at the word without ever running under the
      // glyphs — regardless of which side the dot sits on.
      const lcx = cx + o.dx;
      const lcy = cyCoord - LABEL_STANDOFF + o.dy;
      const halfW = labelHalfWidth(e.label, e.depth);
      const halfH = LABEL_LINE_H / 2;
      const gap = 4;
      const toDotX = cx - lcx;
      const toDotY = cyCoord - lcy;
      const tX = toDotX !== 0 ? (halfW + gap) / Math.abs(toDotX) : Infinity;
      const tY = toDotY !== 0 ? (halfH + gap) / Math.abs(toDotY) : Infinity;
      const t = Math.min(tX, tY, 1);
      raw.push({
        d,
        seg: {
          id: e.id,
          x1: cx,
          y1: cyCoord,
          x2: lcx + toDotX * t,
          y2: lcy + toDotY * t,
        },
      });
    }
    raw.sort((a, b) => a.d - b.d);
    return raw.map(({ seg }, i) => ({ ...seg, delay: i * tuning.staggerStep }));
  }, [revealedDeep, deepLabelOffsets, fociPx, size.width, size.height, tuning]);

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
      {/* Light-signaling — still-center pool + outward intensity gradient,
          beneath every other layer (U4) */}
      <FieldSignal />

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
          {/* Word tethers — beneath the labels, above the crosshairs: a hairline
              from each displaced label back to its dot. */}
          {/* All tethers draw-then-fade when tethers are on; the pair's two
              always persist (warmed to gold), so even with tethers globally off
              the two named feelings stay linked to their true coordinates. */}
          <WordTethers
            segments={tuning.showTethers ? wordTethers : wordTethers.filter((s) => pairIds.has(s.id))}
            duration={tuning.tetherDuration}
            keep={tuning.keepTethers}
            keepIds={pairIds}
          />

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
              emphasis={pairIds.has(emotion.id) ? 'pair' : null}
            />
          ))}

          {/* Deep emotions — revealed near dwell/pins; fade in on mount, out on unmount */}
          <AnimatePresence>
            {revealedDeep.map(e => {
                const isFixed = selectedIds.has(e.id) || highlightedIds.has(e.id);
                const pinOpacity = deepOpacityMap.get(e.id) ?? 0;
                const dwell = dwellOpacityMap.get(e.id);
                const dwellOpacity = dwell?.opacity ?? 0;
                const opacity = isFixed ? 1 : Math.max(dwellOpacity, pinOpacity);
                const enterDelay = !isFixed && dwell ? dwell.rank * 0.08 : 0;
                // Reveal drives opacity; the live cursor drives size + colour.
                const live = deepProximity.get(e.id);
                return (
                  <EmotionWord
                    key={e.id}
                    emotion={e}
                    proximity={{ opacity, scale: live?.scale ?? 1, isCandidate: false, nearness: live?.nearness ?? 0 }}
                    isSelected={selectedIds.has(e.id)}
                    isHighlighted={highlightedIds.has(e.id)}
                    containerWidth={size.width}
                    containerHeight={size.height}
                    enterDelay={enterDelay}
                    animateIn
                    offset={deepLabelOffsets.get(e.id)}
                    emphasis={pairIds.has(e.id) ? 'pair' : recedeActive ? 'recede' : null}
                    recedeStrength={tuning.recedeStrength}
                  />
                );
              })}
          </AnimatePresence>

          {pins.map((pin) => {
            const px = (toPercent(pin.x) / 100) * size.width;
            const py = (toPercent(-pin.y) / 100) * size.height;
            const isEmphasized = pin.id === emphasizedPinId;
            const dotSize = isEmphasized ? 7 : 4;
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
                {/* Emphasis pulse — two staggered sonar rings on the selected
                    pin, echoing the replay's expanding ring pulses */}
                {isEmphasized &&
                  [0, 1.1].map((delay, k) => (
                    <motion.div
                      key={k}
                      initial={{ scale: 0.7, opacity: 0.5 }}
                      animate={{ scale: 3.4, opacity: 0 }}
                      transition={{ duration: 1.9, ease: 'easeOut', repeat: Infinity, repeatDelay: 0.3, delay }}
                      style={{
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        border: '1px solid rgba(201, 168, 124, 0.6)',
                        top: -6,
                        left: -6,
                      }}
                    />
                  ))}
                {/* Dot — larger and brighter when its card is selected */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  style={{
                    position: 'absolute',
                    width: dotSize,
                    height: dotSize,
                    borderRadius: '50%',
                    background: isEmphasized ? 'rgba(201, 168, 124, 1)' : 'rgba(201, 168, 124, 0.7)',
                    boxShadow: isEmphasized ? '0 0 8px 1px rgba(201, 168, 124, 0.7)' : 'none',
                    top: -dotSize / 2,
                    left: -dotSize / 2,
                  }}
                />
              </div>
            );
          })}

          {/* Ghost pin — quiet marker at the last recorded coordinate */}
          {ghostPin && pins.length === 0 && (
            <div
              style={{
                position: 'absolute',
                left: (toPercent(ghostPin.x) / 100) * size.width,
                top: (toPercent(-ghostPin.y) / 100) * size.height,
                pointerEvents: 'none',
                zIndex: 9,
                width: 0,
                height: 0,
              }}
            >
              {/* Soft breathing halo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0.25 }}
                animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.25, 0.08, 0.25] }}
                transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity }}
                style={{
                  position: 'absolute',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  border: '1px solid rgba(201, 168, 124, 0.5)',
                  top: -5,
                  left: -5,
                }}
              />
              {/* Quiet dot */}
              <div
                style={{
                  position: 'absolute',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'rgba(201, 168, 124, 0.4)',
                  top: -2,
                  left: -2,
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
