import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

// A soft, slowly drifting watercolor aura centred in the field — pure ambience
// beneath every other layer (zIndex 0, pointer-events none), a companion to the
// FieldSignal cues. A few large, heavily-feathered blobs in warm gold/rose with
// one cool counterpoint, blended as *light* on the dark field (mix-blend screen)
// so where they overlap they bloom rather than muddy. Each blob drifts, breathes
// and shifts opacity on its own slow, offset cycle, so the wash is never static
// but never asks for attention. Under reduced motion the same wash is held still.
//
// The whole cluster also leans, very gently, toward the cursor — a soft parallax
// that makes the field feel welcoming without ever being distracting: the shift
// is small, springed so it lags and eases, and eases back to centre when the
// pointer leaves.

interface Blob {
  // Centre colour of the radial gradient (fades to transparent by 70%).
  color: string;
  // Diameter as a % of the field width (kept circular via aspect-ratio).
  size: number;
  // Rest position, % of the field.
  left: number;
  top: number;
  // Drift amplitude in px, and the peak breathing scale.
  dx: number;
  dy: number;
  scale: number;
  // Seconds for one breath; delay so the blobs fall out of phase.
  dur: number;
  delay: number;
}

// A loose, off-centre cluster of hued blobs — warm gold + amber leading, with a
// cool periwinkle and a soft violet for the watercolour hue-shift. They overlap
// into an uneven, multi-tonal wash (rather than one concentric glow) and, as
// they drift out of phase, the bloom slowly wanders. Low-alpha throughout so it
// stays ambience, not a light show.
const BLOBS: Blob[] = [
  { color: 'rgba(201,168,124,0.17)', size: 72, left: 47, top: 46, dx: 12, dy: -9, scale: 1.12, dur: 21, delay: 0 },
  { color: 'rgba(212,146,116,0.13)', size: 58, left: 57, top: 41, dx: -13, dy: 10, scale: 1.15, dur: 25, delay: 1.7 },
  { color: 'rgba(140,158,205,0.11)', size: 62, left: 55, top: 60, dx: 11, dy: 12, scale: 1.13, dur: 29, delay: 3.4 },
  { color: 'rgba(176,150,196,0.09)', size: 54, left: 42, top: 57, dx: -9, dy: -8, scale: 1.18, dur: 17, delay: 0.9 },
];

// Max cursor-lean, in px. Kept subtle — the aura acknowledges the cursor without
// chasing it — but present enough to feel. Vertical is gentler than horizontal.
const LEAN_X = 34;
const LEAN_Y = 25;

export function FieldAura() {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  // Cursor-lean offset, springed so it lags and eases rather than snapping. A
  // soft, slightly over-damped spring keeps it welcoming, never twitchy.
  const leanX = useMotionValue(0);
  const leanY = useMotionValue(0);
  const springOpts = { stiffness: 42, damping: 22, mass: 1 };
  const x = useSpring(leanX, springOpts);
  const y = useSpring(leanY, springOpts);

  useEffect(() => {
    if (reduce) return; // no cursor reactivity under reduced motion
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onMove = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const nx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2));
      const ny = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2));
      leanX.set(nx * LEAN_X);
      leanY.set(ny * LEAN_Y);
    };
    // Ease back to centre when the pointer leaves the window.
    const onLeave = () => { leanX.set(0); leanY.set(0); };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [reduce, leanX, leanY]);

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }} aria-hidden="true">
      <motion.div style={{ position: 'absolute', inset: 0, x, y }}>
        {BLOBS.map((b, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: `${b.size}%`,
              aspectRatio: '1',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            <motion.div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: `radial-gradient(circle at 50% 50%, ${b.color} 0%, transparent 70%)`,
                filter: 'blur(26px)',
                mixBlendMode: 'screen',
                willChange: 'transform, opacity',
              }}
              initial={false}
              animate={
                reduce
                  ? { opacity: 0.85 }
                  : {
                      x: [0, b.dx, 0],
                      y: [0, b.dy, 0],
                      scale: [1, b.scale, 1],
                      opacity: [0.7, 1, 0.7],
                    }
              }
              transition={
                reduce
                  ? undefined
                  : { duration: b.dur, delay: b.delay, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
              }
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
}
