import { useState } from 'react';
import {
  loadTuning,
  saveTuning,
  DEFAULT_TUNING,
  type RevealTuning,
} from '../../config/revealTuning';

// Live knobs for the radial-fan reveal. Writes to localStorage; the field
// (open in another tab/window) re-reads on change, so tuning updates the reveal
// in real time. This edits interaction feel only — it does not touch the
// vocabulary data, so it is independent of the Save button.

interface Knob {
  key: keyof RevealTuning;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt?: (v: number) => string;
}

const KNOBS: Knob[] = [
  { key: 'arcScale', label: 'Fan spread', min: 0.4, max: 1.6, step: 0.05, fmt: (v) => `${v.toFixed(2)}×` },
  { key: 'ringBase', label: 'Ring base', min: 20, max: 120, step: 2, fmt: (v) => `${v}px` },
  { key: 'ringGap', label: 'Ring gap', min: 0, max: 80, step: 2, fmt: (v) => `${v}px` },
  { key: 'tetherDuration', label: 'Tether fade', min: 0.6, max: 3, step: 0.1, fmt: (v) => `${v.toFixed(1)}s` },
  { key: 'staggerStep', label: 'Stagger', min: 0, max: 0.2, step: 0.01, fmt: (v) => `${Math.round(v * 1000)}ms` },
  { key: 'tagCount', label: 'Nearby tags', min: 1, max: 12, step: 1, fmt: (v) => String(v) },
  { key: 'recedeStrength', label: 'Recede', min: 0, max: 1, step: 0.05, fmt: (v) => (v === 0 ? 'off' : `${Math.round(v * 100)}%`) },
];

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--oura-text-3)',
};

export function AdminRevealTuning() {
  const [tuning, setTuning] = useState<RevealTuning>(loadTuning);

  const set = (patch: Partial<RevealTuning>) => {
    const next = { ...tuning, ...patch };
    setTuning(next);
    saveTuning(next);
  };

  const isDefault = (Object.keys(DEFAULT_TUNING) as Array<keyof RevealTuning>)
    .every((k) => tuning[k] === DEFAULT_TUNING[k]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px 22px',
        padding: '9px 16px',
        borderBottom: '1px solid var(--oura-border)',
        background: 'var(--oura-bg)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--oura-gold-dim)' }}>
          Reveal feel
        </div>
        <div style={{ fontSize: 10, color: 'var(--oura-text-3)' }}>
          open the app in another tab to see it live
        </div>
      </div>

      {KNOBS.map((k) => {
        const value = tuning[k.key] as number;
        return (
          <label key={k.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={labelStyle}>{k.label}</span>
              <span style={{ fontSize: 10, color: 'var(--oura-text-1)', fontVariantNumeric: 'tabular-nums' }}>
                {k.fmt ? k.fmt(value) : String(value)}
              </span>
            </div>
            <input
              type="range"
              min={k.min}
              max={k.max}
              step={k.step}
              value={value}
              onChange={(e) => set({ [k.key]: Number(e.target.value) } as Partial<RevealTuning>)}
              style={{ width: 118, accentColor: 'var(--oura-gold)', cursor: 'pointer' }}
            />
          </label>
        );
      })}

      <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={tuning.showTethers}
          onChange={(e) => set({ showTethers: e.target.checked })}
          style={{ accentColor: 'var(--oura-gold)', cursor: 'pointer' }}
        />
        <span style={labelStyle}>Show tethers</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: tuning.showTethers ? 'pointer' : 'default', opacity: tuning.showTethers ? 1 : 0.4 }}>
        <input
          type="checkbox"
          checked={tuning.keepTethers}
          disabled={!tuning.showTethers}
          onChange={(e) => set({ keepTethers: e.target.checked })}
          style={{ accentColor: 'var(--oura-gold)', cursor: tuning.showTethers ? 'pointer' : 'default' }}
        />
        <span style={labelStyle}>Keep tethers</span>
      </label>

      <button
        type="button"
        onClick={() => { setTuning(DEFAULT_TUNING); saveTuning(DEFAULT_TUNING); }}
        disabled={isDefault}
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '5px 12px',
          borderRadius: 5,
          border: '1px solid var(--oura-border)',
          background: 'transparent',
          color: isDefault ? 'var(--oura-text-3)' : 'var(--oura-text-1)',
          cursor: isDefault ? 'default' : 'pointer',
        }}
      >
        Reset
      </button>
    </div>
  );
}
