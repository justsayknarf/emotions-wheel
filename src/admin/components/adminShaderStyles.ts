import type { CSSProperties } from 'react';

// Shared style constants for the shader detail fields — split out of
// AdminShaderFields.tsx because Fast Refresh needs a component file to only
// export components.

export const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 12px',
  background: 'var(--ui-surface)',
};

export const labelStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11.5,
  color: 'var(--ui-text-1)',
};

export const swatchStyle: CSSProperties = {
  width: 22,
  height: 22,
  flexShrink: 0,
  borderRadius: 5,
  border: '1px solid rgba(255,255,255,0.12)',
};
