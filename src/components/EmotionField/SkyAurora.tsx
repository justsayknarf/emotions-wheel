import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ShaderMaterial, Vector2, Vector3, type Mesh } from 'three';
import { useTheme } from '../../config/theme';
import type { FieldProjection } from '../../utils/skyProjection';
import { SKY_FRAGMENT, SKY_VERTEX, skyThemeUniforms } from './skyShader';

export interface SkyAuroraInputs {
  proj: FieldProjection;
  // A field press or live draft is in progress: quiet the aurora (R5).
  moving: boolean;
  // 0..1 envelope of the save swell (Task 5 drives it; 0 until then).
  swell: number;
}

// The living sky behind the stars (docs/plans/2026-09-28-002-feat-living-sky-plan.md).
// One full-screen quad; the fragment shader turns each pixel into a dome
// direction with the projection's own camera frame, so the band and aurora
// move with the stars. Per-frame values come from `inputs` (a ref EmotionField
// writes every render), never from props, so neither this component nor App
// re-renders per frame.
export function SkyAurora({ inputs, invalidateRef, reducedMotion }: {
  inputs: RefObject<SkyAuroraInputs>;
  // Filled on create with R3F's invalidate, so the field can request a frame
  // when the camera moves under reduced motion (frameloop="demand").
  invalidateRef: RefObject<(() => void) | null>;
  reducedMotion: boolean;
}) {
  const { theme } = useTheme();
  const scale = theme.shader.skyRenderScale;
  const dpr = Math.min(2, window.devicePixelRatio || 1) * scale;
  return (
    <Canvas
      aria-hidden
      orthographic
      dpr={dpr}
      frameloop={reducedMotion ? 'demand' : 'always'}
      gl={{ antialias: false, alpha: false, powerPreference: 'low-power' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      onCreated={(st) => { invalidateRef.current = st.invalidate; }}
    >
      <SkyQuad inputs={inputs} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

function SkyQuad({ inputs, reducedMotion }: { inputs: RefObject<SkyAuroraInputs>; reducedMotion: boolean }) {
  const { theme } = useTheme();
  const s = theme.shader;
  const invalidate = useThree((st) => st.invalidate);
  const clock = useRef({ time: 0, dim: 1 });
  // Uniforms are written through the mounted mesh, not the memo: the React
  // compiler treats a memoized value as immutable after render.
  const mesh = useRef<Mesh>(null);
  const uniforms = () => (mesh.current?.material as ShaderMaterial | undefined)?.uniforms;
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uRes: { value: new Vector2(1, 1) }, uCenter: { value: new Vector2() }, uRatio: { value: 1 }, uF: { value: 1 },
          uFwd: { value: new Vector3(0, 1, 0) }, uRight: { value: new Vector3(1, 0, 0) }, uUp: { value: new Vector3(0, 0, 1) },
          uTime: { value: 0 }, uSwell: { value: 0 }, uDim: { value: 1 },
          uIntensity: { value: 0 }, uReach: { value: 0.6 }, uBand: { value: 0 }, uCap: { value: 0.26 }, uWarmth: { value: 0 },
          uZen: { value: new Vector3() }, uHor: { value: new Vector3() }, uWarm: { value: new Vector3() },
          uA1: { value: new Vector3() }, uA2: { value: new Vector3() }, uBandCol: { value: new Vector3() },
        },
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Theme-driven uniforms: only when the theme or its sky override changes.
  useEffect(() => {
    const t = skyThemeUniforms(s);
    const u = uniforms();
    if (!u) return;
    for (const k of ['uZen', 'uHor', 'uWarm', 'uA1', 'uA2', 'uBandCol'] as const) u[k].value.set(...t[k]);
    u.uIntensity.value = t.uIntensity; u.uReach.value = t.uReach; u.uBand.value = t.uBand; u.uCap.value = t.uCap; u.uWarmth.value = t.uWarmth;
    invalidate();
  }, [s, invalidate]);

  useFrame((state, delta) => {
    const inp = inputs.current;
    const fr = inp?.proj.frame;
    const u = uniforms();
    if (!inp || !fr || !u) return;
    const dt = Math.min(0.05, delta);
    if (!reducedMotion) clock.current.time += dt * s.skyAuroraSpeed;
    const dimGoal = inp.moving ? s.skyMovingDim : 1;
    clock.current.dim += (dimGoal - clock.current.dim) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 2.2));
    u.uRes.value.set(state.size.width, state.size.height);
    u.uRatio.value = state.gl.getPixelRatio();
    u.uCenter.value.set(fr.cx, fr.cy);
    u.uF.value = fr.F;
    u.uFwd.value.set(...fr.f); u.uRight.value.set(...fr.r); u.uUp.value.set(...fr.u);
    u.uTime.value = clock.current.time;
    u.uDim.value = clock.current.dim;
    u.uSwell.value = inp.swell * s.skySwell;
  });

  return (
    <mesh ref={mesh} frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
