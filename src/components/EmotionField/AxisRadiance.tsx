import { useRef, useEffect } from 'react';

interface Props {
  play: number;      // increments to trigger a play; the canvas replays on change
  delay: number;     // seconds before the vertical leg radiates
  stagger: number;   // seconds between the vertical and horizontal legs
  duration: number;  // seconds each leg takes to travel centre → label
  strength: number;  // 0..1 glow intensity
}

const DISSIPATE = 1.3;        // seconds the trail lingers after the last leg stops
const FADE_PER_FRAME = 0.055; // trail length — lower = longer trail
const EDGE_MARGIN = 26;       // px the orb stops short of the edge (by the labels)

// A soft radial glow blob, drawn additively to build the light trail — same
// warm-core recipe as the constellation replay (PulseTrace) so the two read
// as one visual language.
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,250,240,${a})`);
  g.addColorStop(0.3, `rgba(219,193,152,${a * 0.5})`);
  g.addColorStop(1, 'rgba(201,168,124,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// A soft pulse of light radiates from the field centre out along each axis to
// its labels: the vertical pair (Positive up / Negative down) first, then the
// horizontal pair (Calm left / Activated right) after the stagger. Rendered as
// an additive canvas trail so it reads as a continuous glow, not dots.
export function AxisRadiance({ play, delay, stagger, duration, strength }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || play === 0 || strength <= 0) return;
    // Measure synchronously at the start of the pulse. Size is deliberately NOT
    // a dependency: a pulse is a one-shot triggered by `play`, and the field
    // plane resizes for unrelated reasons (e.g. the mobile check-in tray docking
    // insets the field). Keying the animation off size would restart or clear
    // the pulse on every such resize — instead we snapshot the size once here.
    const w = root.clientWidth;
    const h = root.clientHeight;
    if (w === 0 || h === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const cx = w / 2;
    const cy = h / 2;
    // Each leg is a pair of endpoints radiating from the centre in opposite
    // directions along one axis.
    const legs = [
      { start: delay, ends: [{ x: cx, y: EDGE_MARGIN }, { x: cx, y: h - EDGE_MARGIN }] },
      { start: delay + stagger, ends: [{ x: EDGE_MARGIN, y: cy }, { x: w - EDGE_MARGIN, y: cy }] },
    ];
    const ease = (u: number) => u * u * (3 - 2 * u); // smoothstep
    const prev = legs.map((l) => l.ends.map(() => ({ x: cx, y: cy })));
    const total = delay + stagger + duration;

    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const t = (now - start) / 1000;

      // Fade the whole trail toward transparent — older glow dissipates.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = `rgba(0,0,0,${FADE_PER_FRAME})`;
      ctx.fillRect(0, 0, w, h);

      // Emit glow at each active orb's position, interpolated to avoid gaps.
      ctx.globalCompositeOperation = 'lighter';
      legs.forEach((leg, li) => {
        const lt = t - leg.start;
        if (lt < 0 || lt > duration) return;
        const p = ease(Math.min(lt / duration, 1));
        const inten = Math.min(lt / (duration * 0.15), 1) * strength; // gentle ignition
        leg.ends.forEach((end, ei) => {
          const cur = { x: cx + (end.x - cx) * p, y: cy + (end.y - cy) * p };
          const pv = prev[li][ei];
          const STEPS = 5;
          for (let k = 1; k <= STEPS; k++) {
            const ix = pv.x + (cur.x - pv.x) * (k / STEPS);
            const iy = pv.y + (cur.y - pv.y) * (k / STEPS);
            glow(ctx, ix, iy, 7, 0.4 * inten);
          }
          glow(ctx, cur.x, cur.y, 8, 0.5 * inten); // bloom
          glow(ctx, cur.x, cur.y, 2, 0.9 * inten); // hot core
          prev[li][ei] = cur;
        });
      });

      if (t < total + DISSIPATE) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, w, h);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, [play, delay, stagger, duration, strength]);

  return (
    <div ref={rootRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  );
}
