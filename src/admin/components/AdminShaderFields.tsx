// Small presentational primitives shared by AdminShaderDetails — a numeric
// slider with an editable readout, a segmented (radio-like) toggle, a
// labeled group of native number steppers, and the rainbow hue bar. None of
// these know about theme.ts; they just take a value + onChange.

import { rowStyle, labelStyle } from './adminShaderStyles';

// Rendered once by AdminShaderDetails — the rainbow hue track and its thumb
// need real pseudo-elements (::-webkit-slider-runnable-track etc.), which
// inline styles can't reach, so this is the one scoped <style> tag in the
// admin app.
export function AdminHueSliderStyles() {
  return (
    <style>{`
      input.admin-hue-input {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 22px;
        background: transparent;
        margin: 0;
        cursor: pointer;
      }
      input.admin-hue-input::-webkit-slider-runnable-track {
        height: 10px;
        border-radius: 5px;
        background: linear-gradient(to right, hsl(0,90%,55%), hsl(60,90%,55%), hsl(120,90%,55%), hsl(180,90%,55%), hsl(240,90%,55%), hsl(300,90%,55%), hsl(360,90%,55%));
      }
      input.admin-hue-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        margin-top: -3px;
        border-radius: 50%;
        background: var(--thumb-color, #fff);
        border: 2px solid rgba(0,0,0,0.45);
        box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }
      input.admin-hue-input::-moz-range-track {
        height: 10px;
        border-radius: 5px;
        background: linear-gradient(to right, hsl(0,90%,55%), hsl(60,90%,55%), hsl(120,90%,55%), hsl(180,90%,55%), hsl(240,90%,55%), hsl(300,90%,55%), hsl(360,90%,55%));
      }
      input.admin-hue-input::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--thumb-color, #fff);
        border: 2px solid rgba(0,0,0,0.45);
        box-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }
      input.admin-number {
        -moz-appearance: textfield;
      }
    `}</style>
  );
}

const numberBoxStyle: React.CSSProperties = {
  width: 58,
  flexShrink: 0,
  padding: '4px 6px',
  borderRadius: 5,
  border: '1px solid var(--ui-border)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--ui-text-1)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  textAlign: 'right',
};

export function FieldSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={rowStyle}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
          <span style={labelStyle}>{label}</span>
          <input
            className="admin-number"
            type="number"
            value={value}
            step={step}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onChange(n);
            }}
            style={numberBoxStyle}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--ui-gold)', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}

export function FieldSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={rowStyle}>
      <span style={{ ...labelStyle, width: 100, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: active ? '1px solid var(--ui-gold)' : '1px solid var(--ui-border)',
                background: active ? 'rgba(201,168,124,0.14)' : 'transparent',
                color: active ? 'var(--ui-gold)' : 'var(--ui-text-2)',
                fontSize: 11.5,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FieldSteppers({
  label,
  fields,
}: {
  label: string;
  fields: { label: string; value: number; step: number; onChange: (v: number) => void }[];
}) {
  return (
    <div style={rowStyle}>
      <span style={{ ...labelStyle, width: 100, flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', gap: 14, flex: 1, flexWrap: 'wrap' }}>
        {fields.map((f) => (
          <label key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, color: 'var(--ui-text-3)' }}>{f.label}</span>
            <input
              className="admin-number"
              type="number"
              value={f.value}
              step={f.step}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) f.onChange(n);
              }}
              style={{ ...numberBoxStyle, width: 64 }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
