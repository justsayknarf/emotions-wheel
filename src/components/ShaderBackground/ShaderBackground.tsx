import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react';
import { useTheme } from '../../config/theme';

// Experimental background layer (feat/shader-gradient-background) — an
// animated shadergradient.co plane sitting behind the field/rail. Settings
// copied from a shadergradient.co/customize export; that export includes a
// few props (bgColor1/bgColor2, destination, format, frameRate, axesHelper,
// gizmoHelper, embedMode) that belong to the editor tool's GIF/embed
// controls, not to @shadergradient/react's actual GradientT prop type, so
// they're dropped here. fov/pixelDensity are real props too, but they belong
// on ShaderGradientCanvas, not ShaderGradient.
//
// Every field below comes from the active color theme (config/theme.ts)
// rather than being hardcoded — the shader is the single biggest colored
// surface in the app (full-bleed, behind a field that sets no background of
// its own), so every theme retints and reshapes it rather than leaving the
// original indigo/plum/gray plane underneath whatever accent is picked.
// cameraZoom, lightType, reflection, the `shader` variant, uAmplitude,
// uFrequency, uTime, wireframe and zoomOut stay hardcoded — they're not part
// of the admin theme page's Shape/Colors/Motion/View panel.
export function ShaderBackground() {
  const { theme } = useTheme();
  const s = theme.shader;
  return (
    <ShaderGradientCanvas
      style={{ position: 'absolute', inset: 0 }}
      pointerEvents="none"
      fov={s.fov}
      pixelDensity={s.pixelDensity}
    >
      <ShaderGradient
        animate={s.animate}
        brightness={s.brightness}
        cAzimuthAngle={s.cAzimuthAngle}
        cDistance={s.cDistance}
        cPolarAngle={s.cPolarAngle}
        cameraZoom={9.09}
        color1={s.color1}
        color2={s.color2}
        color3={s.color3}
        {...(s.envPreset !== 'off' ? { envPreset: s.envPreset } : {})}
        grain={s.grain}
        lightType="3d"
        positionX={s.positionX}
        positionY={s.positionY}
        positionZ={s.positionZ}
        range={s.range}
        rangeEnd={s.rangeEnd}
        rangeStart={s.rangeStart}
        reflection={0.1}
        rotationX={s.rotationX}
        rotationY={s.rotationY}
        rotationZ={s.rotationZ}
        shader="defaults"
        type={s.type}
        uAmplitude={0}
        uDensity={s.uDensity}
        uFrequency={0}
        uSpeed={s.uSpeed}
        uStrength={s.uStrength}
        uTime={8}
        wireframe={false}
        zoomOut={false}
      />
    </ShaderGradientCanvas>
  );
}
