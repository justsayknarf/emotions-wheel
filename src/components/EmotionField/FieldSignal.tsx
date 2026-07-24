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
  'rgba(237,232,223,0.055) 0%, ' +
  'rgba(237,232,223,0.02) 7%, ' +
  'rgba(237,232,223,0) 15%)';

const INTENSITY_GRADIENT =
  'radial-gradient(circle at 50% 50%, ' +
  'rgba(201,168,124,0) 32%, ' +
  'rgba(201,168,124,0.018) 72%, ' +
  'rgba(201,168,124,0.04) 100%)';

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
