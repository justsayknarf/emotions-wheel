import { DEFAULT_THEME_ID, THEMES, deriveVars } from './theme';

// `rgb(var(--ui-gold-rgb) / a)` covers every CSS and SVG surface, but a canvas
// gradient stop cannot resolve `var()`. Canvas code asks for the theme's actual
// channels here, at draw time, so a theme switch in the admin page recolors it
// on the next play like everything else.
export type ThemeChannel = 'bg' | 'surface' | 'gold' | 'recorded' | 'text';

const FALLBACK = deriveVars(THEMES[DEFAULT_THEME_ID].vars);

export function themeRgba(channel: ThemeChannel, alpha: number): string {
  const name = `--ui-${channel}-rgb`;
  let raw = '';
  try {
    raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    // No DOM (a check script): fall through to the default theme.
  }
  const [r, g, b] = (raw || FALLBACK[name]).split(/\s+/);
  return `rgba(${r},${g},${b},${alpha})`;
}
