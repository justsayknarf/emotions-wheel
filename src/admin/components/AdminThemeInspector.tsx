import { DEFAULT_THEME_ID, DERIVED_TOKENS, THEME_TOKENS, THEMES, deriveVars, useTheme } from '../../config/theme';
import { AdminShaderDetails } from './AdminShaderDetails';

// Answers "which color is this token actually using" for whichever theme is
// currently selected. The token list is THEME_TOKENS in config/theme.ts, the
// same registry the generated src/theme-tokens.css and the check script read,
// so a token added there shows up here with no edit to this file. The
// shader's full prop set (color1/2/3 + everything else ShaderGradient takes)
// lives in AdminShaderDetails below, since those aren't CSS — they're
// component props with their own Shape/Colors/Motion/View organization.

function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ui-gold-dim)' }}>{title}</div>
      <div style={{ fontSize: 10, color: 'var(--ui-text-3)' }}>{subtitle}</div>
    </div>
  );
}

function Row({ swatch, name, value, note }: { swatch: string | null; name: string; value: string; note?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--ui-surface)' }}>
      <span
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          borderRadius: 5,
          border: '1px solid rgba(255,255,255,0.12)',
          background: swatch ?? 'transparent',
        }}
      />
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, color: 'var(--ui-text-1)', width: 150, flexShrink: 0 }}>
        {name}
      </span>
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: 'var(--ui-text-2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </span>
      {note && <span style={{ fontSize: 10.5, color: 'var(--ui-text-3)', flexShrink: 0 }}>{note}</span>}
    </div>
  );
}

export function AdminThemeInspector() {
  const { id, theme } = useTheme();
  const derived = deriveVars(theme.vars);
  const shipped = THEMES[DEFAULT_THEME_ID].label;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <SectionLabel title="CSS custom properties" subtitle={`what "${theme.label}" sets on :root${id === DEFAULT_THEME_ID ? ' (the shipped default)' : ` — the shipped default is "${shipped}"`}`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--ui-border)', border: '1px solid var(--ui-border)', borderRadius: 8, overflow: 'hidden' }}>
          {THEME_TOKENS.map(({ key, note }) => (
            <Row key={key} swatch={theme.vars[key]} name={key} value={theme.vars[key]} note={note} />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel
          title="Derived channels"
          subtitle="computed from the tokens above, never authored: components write rgb(var(--ui-gold-rgb) / 0.3) to follow the theme"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--ui-border)', border: '1px solid var(--ui-border)', borderRadius: 8, overflow: 'hidden' }}>
          {DERIVED_TOKENS.map(({ key, from }) => (
            <Row key={key} swatch={theme.vars[from]} name={key} value={derived[key]} note={`from ${from}`} />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel title="Shader" subtitle="ShaderBackground's props — component props, not CSS, so they get their own panel below" />
        <AdminShaderDetails />
      </div>
    </div>
  );
}
