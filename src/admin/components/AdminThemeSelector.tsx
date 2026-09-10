import { THEMES, DEFAULT_THEME_ID, useTheme, saveThemeId, type ThemeId } from '../../config/theme';
import { AdminThemeSaveButton } from './AdminThemeSaveButton';

// Lets Frank pick a color theme and see it live in the field, open in another
// tab — the same "tune here, watch it there" pattern as AdminRevealTuning,
// just for config/theme.ts's palette catalogue instead of interaction knobs.
// Selecting a theme also repaints admin's own chrome immediately (via
// useTheme's effect), which doubles as a quick preview of the ten `--ui-*`
// tokens before switching tabs to see the field + retinted shader.

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--ui-text-3)',
};

export function AdminThemeSelector() {
  const { id } = useTheme();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '10px 16px',
        borderBottom: '1px solid var(--ui-border)',
        background: 'var(--ui-bg)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={labelStyle}>Color theme</span>
        <span style={{ fontSize: 10, color: 'var(--ui-text-3)' }}>open the app in another tab to see it live</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <AdminThemeSaveButton />
          {id !== DEFAULT_THEME_ID && (
            <button
              type="button"
              onClick={() => saveThemeId(DEFAULT_THEME_ID)}
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
              Reset to shipped
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(Object.keys(THEMES) as ThemeId[]).map((themeId) => {
          const t = THEMES[themeId];
          const active = themeId === id;
          return (
            <button
              key={themeId}
              type="button"
              onClick={() => saveThemeId(themeId)}
              title={t.note}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px 6px 6px',
                borderRadius: 8,
                border: active ? '1px solid var(--ui-gold)' : '1px solid var(--ui-border)',
                background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', borderRadius: 5, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
                <span style={{ width: 12, height: 20, background: t.vars['--ui-bg'] }} />
                <span style={{ width: 12, height: 20, background: t.vars['--ui-gold'] }} />
                <span style={{ width: 12, height: 20, background: t.vars['--ui-recorded'] }} />
              </span>
              <span style={{ fontSize: 11, color: active ? 'var(--ui-text-1)' : 'var(--ui-text-2)', whiteSpace: 'nowrap' }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
