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
// color1/2/3 + brightness come from the active color theme (config/theme.ts)
// rather than being hardcoded — the shader is the single biggest colored
// surface in the app (full-bleed, behind a field that sets no background of
// its own), so every theme retints it rather than leaving the original
// indigo/plum/gray underneath whatever accent is picked.
export function ShaderBackground() {
  const { theme } = useTheme();
  return (
    <ShaderGradientCanvas
      style={{ position: 'absolute', inset: 0 }}
      pointerEvents="none"
      fov={30}
      pixelDensity={1}
    >
      <ShaderGradient
        animate="on"
        brightness={theme.shader.brightness}
        cAzimuthAngle={180}
        cDistance={9.79}
        cPolarAngle={47}
        cameraZoom={9.09}
        color1={theme.shader.color1}
        color2={theme.shader.color2}
        color3={theme.shader.color3}
        envPreset="city"
        grain="off"
        lightType="3d"
        positionX={0}
        positionY={0}
        positionZ={0}
        range="disabled"
        rangeEnd={40}
        rangeStart={0}
        reflection={0.1}
        rotationX={50}
        rotationY={0}
        rotationZ={-60}
        shader="defaults"
        type="plane"
        uAmplitude={0}
        uDensity={1.5}
        uFrequency={0}
        uSpeed={0.3}
        uStrength={1.5}
        uTime={8}
        wireframe={false}
        zoomOut={false}
      />
    </ShaderGradientCanvas>
  );
}
