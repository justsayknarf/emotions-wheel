// The definition tooltip: a small card a standoff away from its star, joined
// to it by a hairline that runs bone at the star to gold at the card
// (docs/brainstorms/2026-09-30-word-definition-tooltips-requirements.md,
// R3/R13–R18). Mounted under AnimatePresence with a constant key by
// EmotionField: switching words re-targets this one instance.
import { useLayoutEffect, useRef, useState } from 'react';
import { motion, useAnimationFrame, useReducedMotion, useSpring } from 'framer-motion';
import type { Emotion } from '../../data/emotions';
import { definitionFor } from '../../data/descriptions';
import { FIELD_FONT } from './EmotionWord';
import {
  BAND_GUTTER,
  TIP_WIDTH,
  describeWordRegion,
  placeBand,
  placeTethered,
  tetherEnd,
  type Box,
  type Obstacle,
  type Point,
  type TipLayout,
} from './definitionPlacement';

export const DEFINITION_TIP_ID = 'definition-tip';

const DRAW_S = 0.22;
const FADE_IN_S = 0.26;
const FADE_OUT_S = 0.11;
const RETRACT_S = 0.13;
const REDUCED_FADE_S = 0.12;
const TEXT_SWAP_S = 0.16;
const LIFT_PX = 6;
// stiffness 400, damping 40: ζ = 40 / (2·√400) = 1, critically damped.
const SLIDE = { stiffness: 400, damping: 40 };
// The tether starts this far out from the star so it never sits on the dot.
const STAR_INSET = 6;
// Height used until the card has been measured (its first frame is invisible).
const ESTIMATED_HEIGHT = 96;

interface Props {
  emotion: Emotion;
  star: Point;
  layout: TipLayout;
  obstacles: Obstacle[];
  bounds: Box;
}

export function DefinitionTip({ emotion, star, layout, obstacles, bounds }: Props) {
  const reduce = !!useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const [height, setHeight] = useState(ESTIMATED_HEIGHT);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    // observe() fires once at once, which supplies the first measurement.
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = layout === 'band' ? bounds.w - 2 * BAND_GUTTER : TIP_WIDTH;
  const box = layout === 'band'
    ? placeBand(star, height, bounds)
    : placeTethered(star, { w: width, h: height }, obstacles, bounds);

  const bx = useSpring(box.x, SLIDE);
  const by = useSpring(box.y, SLIDE);
  // Only a new word slides; camera frames and re-measures jump, so the card
  // never trails the sky.
  const lastIdRef = useRef(emotion.id);
  useLayoutEffect(() => {
    const switched = lastIdRef.current !== emotion.id;
    lastIdRef.current = emotion.id;
    if (switched && !reduce) {
      bx.set(box.x);
      by.set(box.y);
    } else {
      bx.jump(box.x);
      by.jump(box.y);
    }
  }, [emotion.id, box.x, box.y, reduce, bx, by]);

  // The tether follows the card's live (springing) position every frame.
  const liveRef = useRef({ star, w: width, h: height });
  useLayoutEffect(() => {
    liveRef.current = { star, w: width, h: height };
  });
  useAnimationFrame(() => {
    const line = lineRef.current;
    const grad = gradRef.current;
    if (!line || !grad) return;
    const { star: s, w, h } = liveRef.current;
    const end = tetherEnd(s, { x: bx.get(), y: by.get(), w, h }, layout);
    const len = Math.hypot(end.x - s.x, end.y - s.y) || 1;
    const sx = s.x + ((end.x - s.x) / len) * STAR_INSET;
    const sy = s.y + ((end.y - s.y) / len) * STAR_INSET;
    for (const el of [line, grad]) {
      el.setAttribute('x1', String(sx));
      el.setAttribute('y1', String(sy));
      el.setAttribute('x2', String(end.x));
      el.setAttribute('y2', String(end.y));
    }
  });

  const definition = definitionFor(emotion.id);

  return (
    <>
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 19 }}
      >
        <defs>
          <linearGradient ref={gradRef} id="definition-tether" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: 'rgb(var(--ui-text-rgb))', stopOpacity: 0.12 }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--ui-gold-rgb))', stopOpacity: 0.75 }} />
          </linearGradient>
        </defs>
        <motion.line
          ref={lineRef}
          stroke="url(#definition-tether)"
          strokeWidth={1}
          strokeLinecap="round"
          initial={reduce ? { opacity: 0, pathLength: 1 } : { pathLength: 0 }}
          animate={reduce
            ? { opacity: 1, pathLength: 1, transition: { duration: REDUCED_FADE_S } }
            : { pathLength: 1, transition: { duration: DRAW_S, ease: 'easeOut' } }}
          exit={reduce
            ? { opacity: 0, transition: { duration: REDUCED_FADE_S } }
            : { pathLength: 0, transition: { duration: RETRACT_S, delay: FADE_OUT_S, ease: 'easeIn' } }}
        />
      </svg>
      <motion.div
        style={{ position: 'absolute', left: 0, top: 0, x: bx, y: by, width, zIndex: 20, pointerEvents: 'none' }}
      >
        <motion.div
          ref={cardRef}
          id={DEFINITION_TIP_ID}
          role="tooltip"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: LIFT_PX, scale: 0.97 }}
          animate={reduce
            ? { opacity: 1, transition: { duration: REDUCED_FADE_S } }
            : { opacity: 1, y: 0, scale: 1, transition: { delay: DRAW_S, duration: FADE_IN_S, ease: 'easeOut' } }}
          exit={{ opacity: 0, transition: { duration: reduce ? REDUCED_FADE_S : FADE_OUT_S } }}
          style={{
            boxSizing: 'border-box',
            padding: '12px 14px 13px',
            borderRadius: 10,
            background: 'rgb(var(--ui-surface-rgb) / 0.88)',
            border: '1px solid var(--ui-border)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 10px 30px -12px rgb(var(--ui-bg-rgb) / 0.8)',
          }}
        >
          <motion.div
            key={emotion.id}
            initial={{ opacity: reduce ? 1 : 0.15 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : TEXT_SWAP_S }}
          >
            <div style={{ fontFamily: FIELD_FONT, fontSize: 17, lineHeight: 1.2, color: 'var(--ui-gold-hi)' }}>
              {emotion.label}
            </div>
            <div style={{ marginTop: 3, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ui-text-3)' }}>
              {describeWordRegion(emotion.x, emotion.y)}
            </div>
            <div style={{ marginTop: 7, fontSize: 13, lineHeight: 1.5, color: 'rgb(var(--ui-text-rgb) / 0.86)' }}>
              {definition}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </>
  );
}
