import { useEffect, useId, useRef } from 'react';
import { createDrawable, createMotionPath, createSpring, createTimeline, utils, type Timeline } from 'animejs';
import { useAnimeScope } from '../../hooks/useAnimeScope';

type Pt = { x: number; y: number };

interface Props {
  // Increments once per departure commit (App's handlePinRelease) — the
  // one-shot trigger, same shape as AxisRadiance's `play`. Geometry-only
  // re-renders (a resize recomputing px, an unrelated field re-render) leave
  // this unchanged and never retrigger the animation.
  play: number;
  from: Pt | null; // anchor, field-space [-1,1]
  to: Pt | null;   // the newly committed pin, field-space
  size: { width: number; height: number };
  toPx: (c: Pt) => Pt;
  travel: number;   // seconds — the head's flight, anchor to pin
  trail: number;    // decay (0..1) — how fast the tail catches the head
  hold: number;     // seconds — steady bloom once it arrives
  fadeOut: number;  // seconds — the bloom's final dissolve
  strength: number; // glow width/opacity multiplier
}

type Timing = Pick<Props, 'travel' | 'trail' | 'hold' | 'fadeOut' | 'strength'>;

// The arc bows to the left of travel by this fraction of the distance, so
// every departure curves the same way and none reads as a chart line.
const BOW = 0.24;
// Below this many px there is nothing to connect — the pin landed on the ring.
const MIN_DIST = 6;
// Arrival spring for the bloom, as tuned in the anime.js sketch.
const settle = createSpring({ stiffness: 170, damping: 11 });

// The old canvas streak erased `trail` of itself every frame (~60fps); its
// visible length was the time until that decay left ~5%. The tail's catch-up
// reuses that lifetime, so the admin slider keeps its meaning: higher
// `trail` → shorter streak.
function tailMs(trail: number) {
  const d = Math.min(Math.max(trail, 0.01), 0.9);
  const frames = Math.log(0.05) / Math.log(1 - d);
  return Math.min(Math.max((frames / 60) * 1000, 150), 2500);
}

// Says "you moved from here" once, on commit, as a comet arcing from the
// anchor to the newly departed pin — replacing an earlier arrow after a live
// comparison (chosen: "comet, with a trail" —
// wiki/concepts/emotion-selector/prototype-departure-pulse.html), later
// redrawn from a straight additive-canvas streak into a curve (anime.js
// sketch "C · the comet"). One timeline: a gradient stroke draws in behind a
// glowing head riding the path, the tail then catches up and vanishes, and
// the pin blooms on arrival. Still one-shot keyed on `play`: geometry is
// measured once at play-start and written imperatively, so re-renders or a
// resize mid-flight never restart or reshape it (KTD3/KTD4 — never a
// persistent stroke; the whole group rests at opacity 0, and a revert
// returns it there).
export function DepartureTrace({ play, from, to, size, toPx, travel, trail, hold, fadeOut, strength }: Props) {
  const uid = useId().replace(/:/g, '');
  const gradId = `dt-grad-${uid}`;
  const blurId = `dt-blur-${uid}`;
  const groupRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const bloomRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const tlRef = useRef<Timeline | null>(null);

  // Registered once; a reduced-motion flip re-runs this (reverting any
  // flight). Reduced motion plays nothing — the pin and ring already say
  // where you went, and there is no end state to jump to.
  const { root, scope } = useAnimeScope<SVGSVGElement>((self, reduced) => {
    self.add('play', (a: Pt, b: Pt, t: Timing) => {
      tlRef.current?.revert();
      tlRef.current = null;
      if (reduced) return;
      const g = groupRef.current, path = pathRef.current, glowPath = glowRef.current;
      const grad = gradRef.current, head = headRef.current, core = coreRef.current;
      const bloom = bloomRef.current, halo = haloRef.current;
      if (!g || !path || !glowPath || !grad || !head || !core || !bloom || !halo) return;

      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (dist < MIN_DIST) return;
      // Control point: the midpoint pushed perpendicular (left of travel).
      const cx = (a.x + b.x) / 2 + dy * BOW;
      const cy = (a.y + b.y) / 2 - dx * BOW;
      const d = `M${a.x} ${a.y} Q${cx} ${cy} ${b.x} ${b.y}`;
      path.setAttribute('d', d);
      glowPath.setAttribute('d', d);
      grad.setAttribute('x1', `${a.x}`);
      grad.setAttribute('y1', `${a.y}`);
      grad.setAttribute('x2', `${b.x}`);
      grad.setAttribute('y2', `${b.y}`);
      for (const c of [bloom, halo]) {
        c.setAttribute('cx', `${b.x}`);
        c.setAttribute('cy', `${b.y}`);
      }

      // 0.40 is the tuned default strength; normalize so it reproduces the
      // sketch's proportions, then scale glow widths and opacities from there.
      const s = Math.max(t.strength, 0.05) / 0.4;
      glowPath.setAttribute('stroke-width', `${7 * s}`);
      head.setAttribute('r', `${4.5 * s}`);
      core.setAttribute('r', `${Math.max(1.4, 2.2 * Math.sqrt(s))}`);
      bloom.setAttribute('r', `${6 * s}`);
      halo.setAttribute('r', `${16 * s}`);
      const glowA = Math.min(0.35 * s, 0.8);
      const haloA = Math.min(0.5 * s, 0.85);

      const T = Math.max(t.travel, 0.05) * 1000;
      const arrive = T - 50;
      const holdEnd = arrive + t.hold * 1000;
      const fade = Math.max(t.fadeOut * 1000, 1);
      const haloMs = Math.max(600, fade * 0.9);
      const tail = tailMs(t.trail);
      const end = Math.max(T + tail, holdEnd + fade, arrive + 50 + haloMs);

      const draws = createDrawable([path, glowPath]);
      utils.set(draws, { draw: '0 0' });
      utils.set([head, core, bloom], { opacity: 0 });
      utils.set(bloom, { scale: 0 });
      utils.set(halo, { opacity: 0, scale: 0.3 });
      utils.set(glowPath, { opacity: glowA });
      const motion = createMotionPath(path);

      tlRef.current = createTimeline()
        .add(g, { opacity: [0, 1], duration: 1 }, 0)
        // Head travels, then the tail catches up and the stroke is gone.
        .add(draws, { draw: [{ to: '0 1', duration: T, ease: 'inOut(2)' }, { to: '1 1', duration: tail, ease: 'in(2)' }] }, 0)
        .add([head, core], { translateX: motion.translateX, translateY: motion.translateY, duration: T, ease: 'inOut(2)' }, 0)
        .add([head, core], { opacity: [0, 1], duration: Math.min(150, T * 0.2) }, 0)
        .add([head, core], { opacity: 0, duration: 450 }, arrive)
        // Arrival: the head hands off to a bloom that holds, then dissolves.
        .add(bloom, { scale: [0, 1], ease: settle }, arrive)
        .add(bloom, { opacity: [0, 0.9], duration: 180 }, arrive)
        .add(bloom, { opacity: 0, duration: fade, ease: 'out(2)' }, holdEnd)
        .add(halo, { scale: [0.3, 2.2], opacity: [haloA, 0], duration: haloMs, ease: 'out(3)' }, arrive + 50)
        .add(g, { opacity: 0, duration: 1 }, end);
    });
  }, []);

  useEffect(() => {
    if (play === 0 || !from || !to) return;
    // Measured synchronously at play-start, not a dependency — size/toPx are
    // deliberately not in this effect's deps. A resize mid-flight recomputing
    // them would restart or distort the comet, the exact PR #17 failure mode
    // AxisRadiance's own comment warns about.
    if (size.width === 0 || size.height === 0) return;
    scope.current?.methods.play(toPx(from), toPx(to), { travel, trail, hold, fadeOut, strength });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  // Always mounted: the scope needs its root at mount. Geometry is px in the
  // field's own space, written at play-start, so a later resize leaves an
  // in-flight comet where it was measured.
  return (
    <svg
      ref={root}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 8 }}
      aria-hidden="true"
    >
      <defs>
        {/* Teal tail → gold → a text-white head, laid anchor → pin. */}
        <linearGradient id={gradId} ref={gradRef} gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'rgb(var(--ui-recorded-rgb))', stopOpacity: 0.25 }} />
          <stop offset="0.55" style={{ stopColor: 'rgb(var(--ui-recorded-rgb))', stopOpacity: 0.8 }} />
          <stop offset="0.85" style={{ stopColor: 'rgb(var(--ui-gold-rgb))', stopOpacity: 0.95 }} />
          <stop offset="1" style={{ stopColor: 'rgb(var(--ui-text-rgb))', stopOpacity: 1 }} />
        </linearGradient>
        {/* userSpaceOnUse: an objectBoundingBox region collapses on a
            near-straight arc whose bbox has ~zero height. */}
        <filter id={blurId} filterUnits="userSpaceOnUse" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g ref={groupRef} style={{ opacity: 0 }}>
        <path ref={glowRef} fill="none" stroke={`url(#${gradId})`} strokeLinecap="round" filter={`url(#${blurId})`} />
        <path ref={pathRef} fill="none" stroke={`url(#${gradId})`} strokeWidth={1.75} strokeLinecap="round" />
        <circle ref={haloRef} r={16} style={{ fill: 'rgb(var(--ui-gold-rgb))', transformBox: 'fill-box', transformOrigin: 'center' }} />
        <circle ref={bloomRef} r={6} filter={`url(#${blurId})`} style={{ fill: 'rgb(var(--ui-text-rgb))', transformBox: 'fill-box', transformOrigin: 'center' }} />
        <circle ref={headRef} cx={0} cy={0} r={4.5} filter={`url(#${blurId})`} style={{ fill: 'rgb(var(--ui-text-rgb))' }} />
        <circle ref={coreRef} cx={0} cy={0} r={2.2} style={{ fill: 'rgb(var(--ui-text-rgb))' }} />
      </g>
    </svg>
  );
}
