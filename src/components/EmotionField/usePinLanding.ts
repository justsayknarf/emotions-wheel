import { useLayoutEffect, useRef } from 'react';
import { animate, createSpring, stagger, utils } from 'animejs';
import { useAnimeScope } from '../../hooks/useAnimeScope';
import { themeRgba } from '../../config/themeColor';
import { toPercent } from '../../utils/fieldGeometry';
import type { Emotion } from '../../data/emotions';
import type { PinEntry } from '../../types';
import { LABEL_STANDOFF } from './EmotionWord';

// "Pin lands, field notices": when a pin is planted it settles on a soft
// spring, two thin gold rings spread out from it, and the nearby surface words
// lean toward it and warm, closest first. When the one pin moves (a second
// field press, a slider release) it springs over from where it was drawn and
// the rings replay at the destination. Subtle on purpose — a landing, not a
// celebration.
//
// The render side lives in EmotionField and carries data attributes this hook
// finds inside its scope root (the field container):
//   [data-field-pin] the React-positioned pin wrapper (left/top)
//   [data-pin-body]  inside it; anime owns its translate (the move spring)
//   [data-pin-dot]   inside the body; anime owns its scale/opacity (the settle)
//   [data-pin-ring]  inside the wrapper, NOT the body, so rings bloom at the
//                    destination rather than riding along with the spring
//   [data-lean-word] a zero-size wrapper around each surface EmotionWord;
//                    anime owns its translate + filter, framer never touches it

// Diameter the rings end at (px). They start scaled down and grow to 1, so the
// border is at its thinnest-final 1px where it is most visible, never a 5×
// thickened stroke.
export const PIN_RING_SIZE = 64;

const LAND_SPRING = createSpring({ stiffness: 170, damping: 11 });
const MOVE_SPRING = createSpring({ stiffness: 120, damping: 14 });

const RING = {
  fromScale: 0.12,
  peakOpacity: 0.55,
  duration: 1500,  // ms each ring takes to spread and fade
  stagger: 180,    // ms between the two rings
  landDelay: 120,  // ms after the plant before the first ring
  moveDelay: 260,  // ms after a move — the rings bloom as the dot arrives
};

const LEAN = {
  max: 7,           // px a word leans at full falloff
  radiusFrac: 0.5,  // falloff radius, as a share of the field's shorter side
  delay: 160,       // ms before the closest word moves
  msPerPx: 1.3,     // ripple speed: each px of distance adds this much delay
  duration: 1300,   // ms for the lean out and back
  glowBlur: 8,      // px drop-shadow blur at full falloff
  glowAlpha: 0.45,  // gold glow alpha at full falloff
};

type Seen = { x: number; y: number; left: number; top: number };

const glow = (blur: number, alpha: number) =>
  `drop-shadow(0px 0px ${blur.toFixed(2)}px ${themeRgba('gold', alpha)})`;

export function usePinLanding(
  pins: PinEntry[],
  size: { width: number; height: number },
  words: Emotion[],
) {
  const { root, scope } = useAnimeScope((s, reduced) => {
    const rootEl = s.root as HTMLElement;
    const q = (sel: string) => rootEl.querySelector<HTMLElement>(sel);
    const qa = (sel: string) => Array.from(rootEl.querySelectorAll<HTMLElement>(sel));
    const pinSel = (id: string) => `[data-field-pin="${CSS.escape(id)}"]`;

    const rings = (id: string, delay: number) => {
      const els = qa(`${pinSel(id)} [data-pin-ring]`);
      if (els.length === 0) return;
      animate(els, {
        scale: [RING.fromScale, 1],
        opacity: [RING.peakOpacity, 0],
        delay: stagger(RING.stagger, { start: delay }),
        duration: RING.duration,
        ease: 'out(3)',
      });
    };

    // Reduced motion: every method is a no-op. The resting render is already
    // the end state — dot visible, rings at opacity 0, body and words untranslated.
    s.add('land', (id: string) => {
      if (reduced) return;
      const dot = q(`${pinSel(id)} [data-pin-dot]`);
      if (dot) {
        animate(dot, {
          scale: [0, 1],
          // Opacity on its own short ease, so the spring's overshoot is size only.
          opacity: { from: 0, to: 1, duration: 280, ease: 'out(2)' },
          ease: LAND_SPRING,
        });
      }
      rings(id, RING.landDelay);
    });

    // `dx/dy`: where the pin was drawn, relative to where React now places it.
    s.add('move', (id: string, dx: number, dy: number) => {
      const body = q(`${pinSel(id)} [data-pin-body]`);
      if (reduced) {
        if (body) utils.set(body, { x: 0, y: 0 });
        return;
      }
      if (body && (dx !== 0 || dy !== 0)) {
        animate(body, { x: [dx, 0], y: [dy, 0], ease: MOVE_SPRING });
      }
      rings(id, RING.moveDelay);
    });

    // Nearby surface words lean toward (px, py) and warm, then settle back —
    // the delay grows with distance so the ripple leaves from the pin.
    s.add('lean', (px: number, py: number, w: number, h: number) => {
      if (reduced) return;
      const radius = Math.min(w, h) * LEAN.radiusFrac;
      for (const e of words) {
        const el = q(`[data-lean-word="${CSS.escape(e.id)}"]`);
        if (!el) continue;
        const dx = px - (toPercent(e.x) / 100) * w;
        const dy = py - ((toPercent(-e.y) / 100) * h - LABEL_STANDOFF);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.max(0, 1 - d / radius);
        if (k === 0) continue;
        const lx = (dx / d) * LEAN.max * k;
        const ly = (dy / d) * LEAN.max * k;
        animate(el, {
          x: [0, lx, 0],
          y: [0, ly, 0],
          filter: [glow(0, 0), glow(LEAN.glowBlur * k, LEAN.glowAlpha * k), glow(0, 0)],
          delay: LEAN.delay + d * LEAN.msPerPx,
          duration: LEAN.duration,
          ease: 'inOutSine',
          // A resting filter would keep a compositing layer alive per word.
          onComplete: () => el.style.removeProperty('filter'),
        });
      }
    });
  }, [words]);

  // Keyed on each pin's field coordinate, not its pixel position: a resize
  // moves every pin in px but is not a plant or a move, so it must not replay
  // (AxisRadiance's resize-restart bug). A layout effect so the dot is scaled
  // down, and the body offset back to its old spot, before the browser paints
  // the new render. Runs every render to keep `left/top` — where each pin was
  // actually drawn — fresh, so a move springs from the drawn position even if
  // something else was steering the wrapper.
  const seen = useRef<Map<string, Seen> | null>(null);
  useLayoutEffect(() => {
    const el = root.current;
    const prev = seen.current;
    const next = new Map<string, Seen>();
    let leanAt: { x: number; y: number } | null = null;

    for (const pin of pins) {
      const wrapper = el?.querySelector<HTMLElement>(`[data-field-pin="${CSS.escape(pin.id)}"]`);
      const left = wrapper ? parseFloat(wrapper.style.left) : (toPercent(pin.x) / 100) * size.width;
      const top = wrapper ? parseFloat(wrapper.style.top) : (toPercent(-pin.y) / 100) * size.height;
      next.set(pin.id, { x: pin.x, y: pin.y, left, top });
      // First sight (mount, or a remount with pins already set) only records.
      if (!prev || !wrapper || size.width === 0) continue;

      const was = prev.get(pin.id);
      const methods = scope.current?.methods;
      if (!was) {
        methods?.land(pin.id);
        leanAt = { x: left, y: top };
      } else if (was.x !== pin.x || was.y !== pin.y) {
        // Include any in-flight spring offset, so a move mid-move starts
        // from where the dot visibly is, not from its last resting spot.
        const body = wrapper.querySelector<HTMLElement>('[data-pin-body]');
        const ox = body ? utils.get(body, 'x', false) : 0;
        const oy = body ? utils.get(body, 'y', false) : 0;
        methods?.move(pin.id, was.left + ox - left, was.top + oy - top);
        leanAt = { x: left, y: top };
      }
    }
    seen.current = next;
    if (leanAt) scope.current?.methods.lean(leanAt.x, leanAt.y, size.width, size.height);
  });

  return root;
}
