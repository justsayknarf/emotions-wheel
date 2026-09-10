import { useState } from 'react';
import { useTheme, getShaderOverride, getAllShaderOverrides } from '../../config/theme';

// Writes a snapshot of the currently active theme (+ whatever shader tuning
// is layered on it) to docs/handoff/theme-settings.json via the dev-only
// /admin-api/save-theme endpoint (src/plugins/admin-save.ts) — a hand-off
// file meant to be read back in a later session and promoted into
// config/theme.ts's actual defaults, the same way localStorage tuning
// already previews live but code is what ships.
export function AdminThemeSaveButton() {
  const { id, theme } = useTheme();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/admin-api/save-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedAt: new Date().toISOString(),
          activeThemeId: id,
          activeThemeLabel: theme.label,
          // Fully resolved — catalogue default merged with any override —
          // ready to drop straight into a THEMES entry or SHADER_EXTRAS_DEFAULTS.
          vars: theme.vars,
          shader: theme.shader,
          // Just the patch, so it's clear what was actually changed from the
          // shipped catalogue entry rather than what's incidentally the same.
          shaderOverride: getShaderOverride(id) ?? {},
          // Every theme's override, in case tuning happened on more than one
          // before landing on the active one.
          allShaderOverrides: getAllShaderOverrides(),
        }, null, 2),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((body as { error?: string }).error ?? res.statusText);
      }
      setStatus('saved');
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const label = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? 'Error' : 'Save to file';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {error && (
        <span style={{ fontSize: 10.5, color: '#e57373', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={error}>
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={status === 'saving'}
        title="Writes the active theme + shader tuning to docs/handoff/theme-settings.json"
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          padding: '4px 10px',
          borderRadius: 5,
          border: '1px solid var(--ui-gold-dim)',
          background: status === 'saved' ? 'rgba(201,168,124,0.18)' : 'transparent',
          color: 'var(--ui-gold)',
          cursor: status === 'saving' ? 'default' : 'pointer',
        }}
      >
        {label}
      </button>
    </div>
  );
}
