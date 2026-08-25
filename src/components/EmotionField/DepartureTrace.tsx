import { useRef, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Props {
  // Increments once per departure commit (App's handlePinRelease) — the
  // one-shot trigger, same shape as AxisRadiance's `play`. Geometry-only
  // re-renders (a resize recomputing px, an unrelated field re-render) leave
  // this unchanged and never retrigger the animation.
  play: number;
  from: { x: number; y: number } | null; // anchor, field-space [-1,1]
  to: { x: number; y: number } | null;   // the newly committed pin, field-space
  size: { width: number; height: number };
  toPx: (c: { x: number; y: number }) => { x: number; y: number };
  travel: number;   // seconds — anchor to pin
  trail: number;    // per-frame decay (0..1) — the streak's own length
  hold: number;     // seconds — steady bloom once it arrives
  fadeOut: number;  // seconds — final dissolve
  strength: number; // glow intensity/size multiplier
}

const REC: [number, number, number] = [124, 147, 168]; // --ui-recorded
const ease = (u: number) => u * u * (3 - 2 * u); // smoothstep, matches AxisRadiance

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(235,240,245,${a})`);
  g.addColorStop(0.32, `rgba(${REC[0]},${REC[1]},${REC[2]},${a * 0.55})`);
  g.addColorStop(1, `rgba(${REC[0]},${REC[1]},${REC[2]},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Says "you moved from here" once, on commit, as a soft light traveling from
// the anchor to the newly departed pin — replacing an earlier arrow after a
// live canvas comparison (chosen: "comet, with a trail" —
// wiki/concepts/emotion-selector/prototype-departure-pulse.html). Reuses
// AxisRadiance's own additive-canvas technique (the field's guiding-light
// pulse), aimed point-to-point instead of radiating outward, and its
// one-shot-keyed-on-play shape: the whole lifecycle lives in one rAF loop
// started by the `play` effect, decoupled from React's render cycle, so
// re-renders during a later drag never restart or retrigger it (KTD3/KTD4 —
// never a persistent stroke).
export function DepartureTrace({ play, from, to, size, toPx, travel, trail, hold, fadeOut, strength }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || play === 0 || !from || !to || reducedMotion) return;
    // Measured synchronously at play-start, not a dependency — size/toPx are
    // deliberately not in this effect's deps (see below). A resize mid-
    // dissolve recomputing them would restart or distort the trail, the
    // exact PR #17 failure mode AxisRadiance's own comment warns about.
    const w = size.width;
    const h = size.height;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.opacity = '1';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const fromPx = toPx(from);
    const toPxPos = toPx(to);
    const total = travel + hold + fadeOut;
    const start = performance.now();
    let prev = { ...fromPx };
    let raf = 0;

    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const inFadeOut = t > travel + hold;

      // Continuous decay — always running, independent of phase. This is
      // what makes the streak a streak; the opacity ramp below only governs
      // whatever's left once travel+hold are over.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${trail})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      if (!inFadeOut) {
        if (t <= travel) {
          const p = ease(travel > 0 ? Math.min(t / travel, 1) : 1);
          const cur = { x: fromPx.x + (toPxPos.x - fromPx.x) * p, y: fromPx.y + (toPxPos.y - fromPx.y) * p };
          const ignite = Math.min(t / (travel * 0.18 + 0.001), 1);
          const STEPS = 6;
          for (let k = 1; k <= STEPS; k++) {
            const ix = prev.x + (cur.x - prev.x) * (k / STEPS);
            const iy = prev.y + (cur.y - prev.y) * (k / STEPS);
            glow(ctx, ix, iy, 9 * strength, 0.30 * ignite * strength);
          }
          glow(ctx, cur.x, cur.y, 11 * strength, 0.5 * ignite * strength);
          glow(ctx, cur.x, cur.y, 3 * strength, 0.9 * ignite * strength);
          prev = cur;
        } else {
          // Holding at the pin — a steady bloom, re-emitted each frame so it
          // doesn't fade against the ongoing decay above.
          glow(ctx, toPxPos.x, toPxPos.y, 11 * strength, 0.5 * strength);
          glow(ctx, toPxPos.x, toPxPos.y, 3 * strength, 0.9 * strength);
        }
      }
      // During fadeOut, nothing new is emitted — the decay above erodes
      // whatever remains, paired with the canvas-level opacity ramp below.
      ctx.globalCompositeOperation = 'source-over';

      if (inFadeOut) {
        const u = fadeOut > 0 ? (t - travel - hold) / fadeOut : 1;
        canvas.style.opacity = String(Math.max(0, 1 - u));
      }

      if (t < total) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h); // leaves no residual content once dissolved
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  if (size.width === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: size.width, height: size.height, pointerEvents: 'none', zIndex: 8 }}
      aria-hidden="true"
    />
  );
}
