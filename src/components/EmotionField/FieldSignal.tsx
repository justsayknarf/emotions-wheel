// Light-signaling for the radial-intensity field (U4). Two static, wordless
// cues that sit *beneath* the word/dot/tether layers (zIndex 0) so they never
// interfere with the PR #8 rendering:
//   1. a soft bone pool at the exact center — frames the deliberately empty
//      core (r < ~0.15) as a still point rather than a gap;
//   2. a faint warm radial gradient rising toward the edge — hints, without any
//      legend, that intensity grows outward.
// Both are static (no animation), so they are inherently reduced-motion-safe.

const STILL_CENTER =
  'radial-gradient(circle at 50% 50%, ' +
  'rgb(var(--ui-text-rgb) / 0.0125) 0%, ' +
  'rgb(var(--ui-text-rgb) / 0.005) 7%, ' +
  'rgb(var(--ui-text-rgb) / 0) 15%)';

const INTENSITY_GRADIENT =
  'radial-gradient(circle at 50% 50%, ' +
  'rgb(var(--ui-gold-rgb) / 0) 32%, ' +
  'rgb(var(--ui-gold-rgb) / 0.009) 72%, ' +
  'rgb(var(--ui-gold-rgb) / 0.02) 100%)';

const layer: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 0,
};

export function FieldSignal() {
  return (
    <>
      <div style={{ ...layer, background: INTENSITY_GRADIENT }} />
      <div style={{ ...layer, background: STILL_CENTER }} />
    </>
  );
}
