import { THEMES, useTheme, setShaderOverride, resetShaderOverride, type ShaderTheme } from '../../config/theme';
import { hexToHsl, hslToHex } from '../lib/color';
import { AdminHueSliderStyles, FieldSlider, FieldSegmented, FieldSteppers } from './AdminShaderFields';
import { rowStyle, swatchStyle, labelStyle } from './adminShaderStyles';

// The full ShaderGradient prop surface exposed the way shadergradient.co's
// own customize panel organizes it — Shape / Colors / Motion / View — under
// one collapsible <details>. A theme's catalogue entry only ever sets
// color1/2/3/brightness (config/theme.ts's `mkShader`); every field here
// beyond that is a per-theme override on top of ShaderBackground's existing
// hardcoded defaults, using the same mechanism the color hue sliders use.

function SectionLabel({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ui-gold-dim)', margin: '4px 0 6px' }}>
      {title}
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--ui-border)', border: '1px solid var(--ui-border)', borderRadius: 8, overflow: 'hidden' }}>
      {children}
    </div>
  );
}

// Turns the wheel while holding the stop's own saturation/lightness, so
// repeated turns compose instead of washing the color toward gray. (A fully
// desaturated stop has no hue to turn — the swatch won't move until some
// other edit gives it one.)
function HueField({ label, hex, onChange }: { label: string; hex: string; onChange: (hex: string) => void }) {
  const { h, s, l } = hexToHsl(hex);
  return (
    <div style={rowStyle}>
      <span style={{ ...swatchStyle, background: hex }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={labelStyle}>{label}</span>
          <span style={{ ...labelStyle, color: 'var(--ui-text-2)', fontVariantNumeric: 'tabular-nums' }}>
            {hex} · {Math.round(h)}°
          </span>
        </div>
        <input
          className="admin-hue-input"
          type="range"
          min={0}
          max={360}
          step={1}
          value={Math.round(h)}
          onChange={(e) => onChange(hslToHex(Number(e.target.value), s, l))}
          style={{ '--thumb-color': hex } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

const TYPE_OPTIONS: { value: ShaderTheme['type']; label: string }[] = [
  { value: 'plane', label: 'Plane' },
  { value: 'sphere', label: 'Sphere' },
  { value: 'waterPlane', label: 'Water' },
];
const ON_OFF: { value: 'on' | 'off'; label: string }[] = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];
const RANGE_OPTIONS: { value: 'enabled' | 'disabled'; label: string }[] = [
  { value: 'enabled', label: 'On' },
  { value: 'disabled', label: 'Off' },
];

export function AdminShaderDetails() {
  const { id, theme } = useTheme();
  const s = theme.shader;
  const base = THEMES[id].shader;
  const isDefault = (Object.keys(base) as (keyof ShaderTheme)[]).every((k) => s[k] === base[k]);

  const set = (patch: Partial<ShaderTheme>) => setShaderOverride(id, patch);

  return (
    <details open style={{ background: 'var(--ui-surface)', border: '1px solid var(--ui-border)', borderRadius: 8, padding: '10px 14px' }}>
      <AdminHueSliderStyles />
      <summary style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', listStyle: 'none' }}>
        <span style={{ fontSize: 12, color: 'var(--ui-text-1)', fontWeight: 500 }}>Details — full ShaderGradient prop set</span>
        {!isDefault && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              resetShaderOverride(id);
            }}
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '4px 10px',
              borderRadius: 5,
              border: '1px solid var(--ui-border)',
              background: 'transparent',
              color: 'var(--ui-text-1)',
              cursor: 'pointer',
            }}
          >
            Reset shader
          </button>
        )}
      </summary>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 14 }}>
        <div>
          <SectionLabel title="Shape" />
          <Group>
            <FieldSegmented label="Type" value={s.type} options={TYPE_OPTIONS} onChange={(v) => set({ type: v })} />
            <FieldSlider label="Noise Strength" value={s.uStrength} min={0} max={8} step={0.1} onChange={(v) => set({ uStrength: v })} />
            <FieldSlider label="Noise Density" value={s.uDensity} min={0} max={4} step={0.05} onChange={(v) => set({ uDensity: v })} />
            <FieldSlider label="Pixel Density" value={s.pixelDensity} min={0.5} max={2} step={0.1} onChange={(v) => set({ pixelDensity: v })} />
          </Group>
        </div>

        <div>
          <SectionLabel title="Colors" />
          <Group>
            <HueField label="color1" hex={s.color1} onChange={(hex) => set({ color1: hex })} />
            <HueField label="color2" hex={s.color2} onChange={(hex) => set({ color2: hex })} />
            <HueField label="color3" hex={s.color3} onChange={(hex) => set({ color3: hex })} />
            <FieldSegmented label="Grain" value={s.grain} options={ON_OFF} onChange={(v) => set({ grain: v })} />
            <FieldSegmented
              label="Environment"
              value={s.envPreset === 'off' ? 'off' : 'on'}
              options={ON_OFF}
              onChange={(v) => set({ envPreset: v === 'on' ? 'city' : 'off' })}
            />
            <FieldSlider label="Brightness" value={s.brightness} min={0} max={1.5} step={0.01} onChange={(v) => set({ brightness: v })} />
          </Group>
        </div>

        <div>
          <SectionLabel title="Motion" />
          <Group>
            <FieldSegmented label="Animate" value={s.animate} options={ON_OFF} onChange={(v) => set({ animate: v })} />
            <FieldSlider label="Speed" value={s.uSpeed} min={0} max={2} step={0.01} onChange={(v) => set({ uSpeed: v })} />
            <FieldSegmented label="Range" value={s.range} options={RANGE_OPTIONS} onChange={(v) => set({ range: v })} />
            <FieldSlider label="Range Start" value={s.rangeStart} min={0} max={100} step={1} onChange={(v) => set({ rangeStart: v })} />
            <FieldSlider label="Range End" value={s.rangeEnd} min={0} max={100} step={1} onChange={(v) => set({ rangeEnd: v })} />
          </Group>
        </div>

        <div>
          <SectionLabel title="View" />
          <Group>
            <FieldSlider label="Distance" value={s.cDistance} min={1} max={20} step={0.1} onChange={(v) => set({ cDistance: v })} />
            <FieldSteppers
              label="Camera Angle"
              fields={[
                { label: 'azimuth', value: s.cAzimuthAngle, step: 1, onChange: (v) => set({ cAzimuthAngle: v }) },
                { label: 'polar', value: s.cPolarAngle, step: 1, onChange: (v) => set({ cPolarAngle: v }) },
              ]}
            />
            <FieldSteppers
              label="Object Position"
              fields={[
                { label: 'x', value: s.positionX, step: 0.1, onChange: (v) => set({ positionX: v }) },
                { label: 'y', value: s.positionY, step: 0.1, onChange: (v) => set({ positionY: v }) },
                { label: 'z', value: s.positionZ, step: 0.1, onChange: (v) => set({ positionZ: v }) },
              ]}
            />
            <FieldSteppers
              label="Object Rotation"
              fields={[
                { label: 'x', value: s.rotationX, step: 1, onChange: (v) => set({ rotationX: v }) },
                { label: 'y', value: s.rotationY, step: 1, onChange: (v) => set({ rotationY: v }) },
                { label: 'z', value: s.rotationZ, step: 1, onChange: (v) => set({ rotationZ: v }) },
              ]}
            />
            <FieldSlider label="Field of view" value={s.fov} min={1} max={180} step={1} onChange={(v) => set({ fov: v })} />
          </Group>
        </div>
      </div>
    </details>
  );
}
