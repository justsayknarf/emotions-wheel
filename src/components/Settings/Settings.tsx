import type { CSSProperties } from 'react';
import { saveTuning, useRevealTuning, loadTuning } from '../../config/revealTuning';

interface Props {
  onBack: () => void;
}

// The field views a person can pick between. Both record the same flat
// (x, y); only how the field is drawn differs.
const FIELD_VIEWS = [
  { sky: false, label: 'Flat field', detail: 'The whole field at once, like a map.' },
  { sky: true, label: 'Night sky', detail: 'Look up into a dome where every word is a star.' },
] as const;

// Full-surface overlay (view === 'settings'), laid out like DiaryHistory: a
// phone-width column with a back button and a small gold heading.
export function Settings({ onBack }: Props) {
  const tuning = useRevealTuning();

  // Writes the same persisted flag as ?field=sky|flat and the admin toggle,
  // so all three stay in agreement. saveTuning notifies this tab, so the
  // field behind the overlay switches live.
  const pick = (sky: boolean) => {
    if (sky !== tuning.skyField) saveTuning({ ...loadTuning(), skyField: sky });
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--ui-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: 430, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '20px 20px 12px', borderBottom: '1px solid var(--ui-border)' }}>
          <button onClick={onBack} style={BACK}>
            ← Back
          </button>
          <h1 style={HEADING}>Settings</h1>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <h2 id="field-view-label" style={SECTION}>
            Field view
          </h2>
          <div role="radiogroup" aria-labelledby="field-view-label" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FIELD_VIEWS.map((v) => {
              const on = tuning.skyField === v.sky;
              return (
                <button
                  key={v.label}
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(v.sky)}
                  style={{
                    ...OPTION,
                    borderColor: on ? 'var(--ui-gold-dim)' : 'var(--ui-border)',
                    background: on ? 'rgb(var(--ui-gold-rgb) / 0.06)' : 'rgb(var(--ui-surface-rgb) / 0.6)',
                  }}
                >
                  <span style={{ ...DOT, borderColor: on ? 'var(--ui-gold)' : 'var(--ui-text-3)' }}>
                    {on && <span style={DOT_FILL} />}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: 14, color: on ? 'var(--ui-text)' : 'var(--ui-text-2)' }}>{v.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 300, color: 'var(--ui-text-3)' }}>{v.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p style={{ margin: '12px 2px 0', fontSize: 11, fontWeight: 300, color: 'var(--ui-text-3)' }}>
            Your check-ins look the same in either view. This is saved on this device.
          </p>
        </div>

        {/* Advanced: the admin tool. Dev server only; admin.html isn't part of
            the production build. Deliberately quiet: no heading, faint text. */}
        {import.meta.env.DEV && (
          <div style={{ padding: '12px 20px 24px', textAlign: 'center' }}>
            <a href={`${import.meta.env.BASE_URL}admin.html`} target="_blank" rel="noreferrer" style={ADVANCED}>
              Advanced settings
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const BACK: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--ui-text-2)',
  cursor: 'pointer',
  fontSize: 13,
  padding: '6px 0',
  marginRight: 12,
  letterSpacing: '0.01em',
};
const HEADING: CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ui-gold-dim)',
  margin: 0,
};
const SECTION: CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--ui-text-3)',
  margin: '0 2px 10px',
};
const OPTION: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  width: '100%',
  padding: '14px 16px',
  border: '1px solid',
  borderRadius: 10,
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  transition: 'border-color 0.2s ease-out, background 0.2s ease-out',
};
const DOT: CSSProperties = {
  flex: 'none',
  width: 14,
  height: 14,
  marginTop: 2,
  borderRadius: '50%',
  border: '1px solid',
  display: 'grid',
  placeItems: 'center',
};
const DOT_FILL: CSSProperties = { width: 6, height: 6, borderRadius: '50%', background: 'var(--ui-gold)' };
const ADVANCED: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  color: 'var(--ui-text-3)',
  opacity: 0.55,
  textDecoration: 'none',
};
