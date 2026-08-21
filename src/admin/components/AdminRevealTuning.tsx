import { useState } from 'react';
import {
  loadTuning,
  saveTuning,
  DEFAULT_TUNING,
  type RevealTuning,
} from '../../config/revealTuning';

// Live knobs for interaction feel. Writes to localStorage; the field (open in
// another tab/window) re-reads on change, so tuning updates in real time. This
// edits interaction feel only — it does not touch the vocabulary data, so it is
// independent of the Save button.

interface Knob {
  key: keyof RevealTuning;
  label: string;
  min: number;
  max: number;
  step: number;
  fmt?: (v: number) => string;
}

// Radial-fan reveal knobs.
const REVEAL_KNOBS: Knob[] = [
  { key: 'arcScale', label: 'Fan spread', min: 0.4, max: 1.6, step: 0.05, fmt: (v) => `${v.toFixed(2)}×` },
  { key: 'ringBase', label: 'Ring base', min: 20, max: 120, step: 2, fmt: (v) => `${v}px` },
  { key: 'ringGap', label: 'Ring gap', min: 0, max: 80, step: 2, fmt: (v) => `${v}px` },
  { key: 'tetherDuration', label: 'Tether fade', min: 0.6, max: 3, step: 0.1, fmt: (v) => `${v.toFixed(1)}s` },
  { key: 'staggerStep', label: 'Stagger', min: 0, max: 0.2, step: 0.01, fmt: (v) => `${Math.round(v * 1000)}ms` },
  { key: 'tagCount', label: 'Field words', min: 1, max: 12, step: 1, fmt: (v) => String(v) },
  { key: 'recedeStrength', label: 'Recede', min: 0, max: 1, step: 0.05, fmt: (v) => (v === 0 ? 'off' : `${Math.round(v * 100)}%`) },
];

// Check-in card knobs: the dissolve when the card's words re-resolve on release.
const CARD_KNOBS: Knob[] = [
  { key: 'captionFadeOut', label: 'Word fade out', min: 0, max: 1, step: 0.02, fmt: (v) => `${v.toFixed(2)}s` },
  { key: 'captionHold', label: 'Hold', min: 0, max: 1, step: 0.02, fmt: (v) => `${v.toFixed(2)}s` },
  { key: 'captionFadeIn', label: 'Word fade in', min: 0, max: 1, step: 0.02, fmt: (v) => `${v.toFixed(2)}s` },
];

// Grounding-welcome knobs: the axis emphasis fade and the guiding pulse.
const WELCOME_KNOBS: Knob[] = [
  { key: 'axisFade', label: 'Axis fade', min: 0.1, max: 2, step: 0.1, fmt: (v) => `${v.toFixed(1)}s` },
  { key: 'axisPulseDelay', label: 'Pulse delay', min: 0, max: 3, step: 0.1, fmt: (v) => `${v.toFixed(1)}s` },
  { key: 'axisPulseStagger', label: 'Pulse stagger', min: 0, max: 2, step: 0.1, fmt: (v) => `${v.toFixed(1)}s` },
  { key: 'axisPulseDuration', label: 'Pulse length', min: 0.4, max: 3, step: 0.1, fmt: (v) => `${v.toFixed(1)}s` },
  { key: 'axisPulseStrength', label: 'Pulse strength', min: 0, max: 1, step: 0.025, fmt: (v) => (v === 0 ? 'off' : `${+(v * 100).toFixed(1)}%`) },
];

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--ui-text-3)',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '10px 22px',
};

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4, minWidth: 96 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ui-gold-dim)' }}>
        {title}
      </div>
      <div style={{ fontSize: 10, color: 'var(--ui-text-3)' }}>{subtitle}</div>
    </div>
  );
}

export function AdminRevealTuning() {
  const [tuning, setTuning] = useState<RevealTuning>(loadTuning);

  const set = (patch: Partial<RevealTuning>) => {
    const next = { ...tuning, ...patch };
    setTuning(next);
    saveTuning(next);
  };

  const isDefault = (Object.keys(DEFAULT_TUNING) as Array<keyof RevealTuning>)
    .every((k) => tuning[k] === DEFAULT_TUNING[k]);

  const renderKnob = (k: Knob) => {
    const value = tuning[k.key] as number;
    return (
      <label key={k.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span style={labelStyle}>{k.label}</span>
          <span style={{ fontSize: 10, color: 'var(--ui-text-1)', fontVariantNumeric: 'tabular-nums' }}>
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
          style={{ width: 118, accentColor: 'var(--ui-gold)', cursor: 'pointer' }}
        />
      </label>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid var(--ui-border)',
        background: 'var(--ui-bg)',
        flexShrink: 0,
      }}
    >
      {/* Reveal feel */}
      <div style={rowStyle}>
        <SectionHeader title="Reveal feel" subtitle="open the app in another tab to see it live" />

        {REVEAL_KNOBS.map(renderKnob)}

        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={tuning.showTethers}
            onChange={(e) => set({ showTethers: e.target.checked })}
            style={{ accentColor: 'var(--ui-gold)', cursor: 'pointer' }}
          />
          <span style={labelStyle}>Show tethers</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: tuning.showTethers ? 'pointer' : 'default', opacity: tuning.showTethers ? 1 : 0.4 }}>
          <input
            type="checkbox"
            checked={tuning.keepTethers}
            disabled={!tuning.showTethers}
            onChange={(e) => set({ keepTethers: e.target.checked })}
            style={{ accentColor: 'var(--ui-gold)', cursor: tuning.showTethers ? 'pointer' : 'default' }}
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
            border: '1px solid var(--ui-border)',
            background: 'transparent',
            color: isDefault ? 'var(--ui-text-3)' : 'var(--ui-text-1)',
            cursor: isDefault ? 'default' : 'pointer',
            marginLeft: 'auto',
          }}
        >
          Reset all
        </button>
      </div>

      {/* Welcome */}
      <div style={{ ...rowStyle, borderTop: '1px solid var(--ui-border)', paddingTop: 12 }}>
        <SectionHeader title="Welcome" subtitle="grounding cue + axis pulse on load" />

        {WELCOME_KNOBS.map(renderKnob)}
      </div>

      {/* Check-in card */}
      <div style={{ ...rowStyle, borderTop: '1px solid var(--ui-border)', paddingTop: 12 }}>
        <SectionHeader title="Check-in card" subtitle="word dissolve when a slider is released" />

        {CARD_KNOBS.map(renderKnob)}
      </div>
    </div>
  );
}
