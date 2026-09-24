import { useEffect, useRef, useState } from 'react';
import { animate, createAnimatable, utils } from 'animejs';
import { useAnimeScope } from '../../hooks/useAnimeScope';

// "Sliders with weight": the field's marker for a slider-driven drag glides
// after the slider's draft coordinate instead of snapping to each input
// event, and a single soft ring marks the commit on release.
//
// Visual only. The draft coordinate itself (App's adjustDraft /
// departureDraftCoord) stays exact, and so does everything else that reads
// it — word reveal, the fan foci, proximity — so only this marker lags.
// Those readers never draw anything *at* the pin's position (word tethers
// run label → word dot), so there is nothing attached to the marker that
// the lag could tear away from.

// Glide tuning — how long the marker takes to catch up to the draft.
const GLIDE_MS = 650;
const GLIDE_EASE = 'out(4)';
// The commit ring.
const RING_MS = 1200;
const RING_EASE = 'out(3)';
const RING_SCALE: [number, number] = [0.6, 4.5];
const RING_OPACITY: [number, number] = [0.6, 0];
const RING_SIZE = 12;
// Marker fade: quick in when a drag starts, slower out after release so the
// marker finishes settling onto the committed spot as it goes.
const FADE_IN_S = 0.12;
const FADE_OUT_S = 0.45;
const GLOW_SIZE = 130;

type Accent = 'gold' | 'recorded';

const GLOW_BACKGROUND: Record<Accent, string> = {
  recorded: 'radial-gradient(circle, rgb(var(--ui-recorded-rgb) / 0.45) 0%, rgb(var(--ui-recorded-rgb) / 0.18) 42%, transparent 72%)',
  gold: 'radial-gradient(circle, color-mix(in srgb, var(--ui-gold-hi) 50%, transparent) 0%, rgb(var(--ui-gold-rgb) / 0.2) 42%, transparent 72%)',
};

interface Props {
  // The live draft in container px, or null when no slider is being dragged.
  target: { x: number; y: number } | null;
  // Gold for adjusting a pin that's already yours, the recorded hue pre-mint.
  accent: Accent;
  // One-shot: bumps once per slider commit (App's handleAdjustPin).
  commitPlay: number;
  // Field-space coordinate the commit landed on, converted at play time.
  commitAt: { x: number; y: number } | null;
  toPx: (c: { x: number; y: number }) => { x: number; y: number };
  reducedMotion: boolean;
}

export function LiveDraftGlow({ target, accent, commitPlay, commitAt, toPx, reducedMotion }: Props) {
  const { root, scope } = useAnimeScope((self, reduced) => {
    const glideMs = reduced ? 0 : GLIDE_MS;
    const glide = createAnimatable('.live-draft-glide', { x: glideMs, y: glideMs, ease: GLIDE_EASE });
    // `jump` places the marker without gliding — used when a drag starts,
    // so it never sweeps in from wherever the previous drag left it. The
    // duration is passed on every call, not just the jump: an animatable
    // setter's duration argument sticks for the calls after it.
    self.add('glide', (x: number, y: number, jump: boolean) => {
      const ms = jump ? 0 : glideMs;
      glide.x(x, ms, GLIDE_EASE);
      glide.y(y, ms, GLIDE_EASE);
    });
    self.add('pulse', (x: number, y: number) => {
      // Reduced motion: the ring's end state is invisible, so skip it.
      if (reduced) return;
      utils.set('.slider-commit-ring', { x, y });
      animate('.slider-commit-ring', {
        scale: RING_SCALE,
        opacity: RING_OPACITY,
        duration: RING_MS,
        ease: RING_EASE,
      });
    });
  }, []);

  // Hold the last accent through the fade-out: the pre-mint drag's
  // departureDraft clears on release, which would otherwise flip the fading
  // marker from the recorded hue to gold.
  const [shownAccent, setShownAccent] = useState<Accent>(accent);
  if (target && accent !== shownAccent) setShownAccent(accent);

  const tx = target?.x ?? null;
  const ty = target?.y ?? null;
  const activeRef = useRef(false);
  useEffect(() => {
    if (tx === null || ty === null) {
      // Released or cancelled: the marker keeps easing toward the last draft
      // (the committed coordinate) while it fades out.
      activeRef.current = false;
      return;
    }
    scope.current?.methods.glide(tx, ty, !activeRef.current);
    activeRef.current = true;
  }, [tx, ty, scope]);

  // Keyed on the counter, measured at play time (AGENTS.md → Motion).
  useEffect(() => {
    if (commitPlay === 0 || !commitAt) return;
    const { x, y } = toPx(commitAt);
    scope.current?.methods.pulse(x, y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitPlay]);

  const visible = target !== null;
  const fade = reducedMotion ? 'none' : `opacity ${visible ? FADE_IN_S : FADE_OUT_S}s ease`;

  return (
    <div ref={root} style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, opacity: visible ? 1 : 0, transition: fade, zIndex: 4 }}>
        {/* anime owns this element's transform (x/y); centring is by margin. */}
        <div
          className="live-draft-glide"
          style={{
            position: 'absolute',
            width: GLOW_SIZE,
            height: GLOW_SIZE,
            marginLeft: -GLOW_SIZE / 2,
            marginTop: -GLOW_SIZE / 2,
            borderRadius: '50%',
            background: GLOW_BACKGROUND[shownAccent],
            filter: 'blur(2px)',
          }}
        />
      </div>
      <div
        className="slider-commit-ring"
        style={{
          position: 'absolute',
          width: RING_SIZE,
          height: RING_SIZE,
          marginLeft: -RING_SIZE / 2,
          marginTop: -RING_SIZE / 2,
          borderRadius: '50%',
          border: '1px solid rgb(var(--ui-gold-rgb) / 0.8)',
          opacity: 0,
          zIndex: 10,
        }}
      />
    </div>
  );
}
