import { useEffect, useState } from 'react';

// Color-theme catalogue, mirroring the reveal-tuning pattern (see
// `revealTuning.ts`): persisted to localStorage so the admin page can drive
// it and the field — open in another tab — picks it up live via the
// `storage` event. Each theme maps the same ten `--ui-*` custom properties
// index.css defines, plus the three ShaderGradient color stops + brightness
// ShaderBackground renders, since those live as component props rather than
// CSS and need their own subscription (see `useTheme`).
//
// Explored as mockups first — see the "One Accent, Three Golds" color-audit
// artifact — before any of this was wired into the app.

export interface ThemeVars {
  '--ui-bg': string;
  '--ui-surface': string;
  '--ui-border': string;
  '--ui-gold': string;
  '--ui-gold-dim': string;
  '--ui-recorded': string;
  '--ui-recorded-dim': string;
  '--ui-text-1': string;
  '--ui-text-2': string;
  '--ui-text-3': string;
}

export interface ShaderTheme {
  color1: string;
  color2: string;
  color3: string;
  brightness: number;
}

export interface Theme {
  label: string;
  /** One line on what the pairing is / where it sits relative to today. */
  note: string;
  vars: ThemeVars;
  shader: ShaderTheme;
}

export const THEMES = {
  default: {
    label: 'Current (shipped)',
    note: 'What index.css and ShaderBackground actually ship today.',
    vars: {
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#161820',
      '--ui-border': 'rgba(255,255,255,0.06)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#7C93A8',
      '--ui-recorded-dim': 'rgba(124,147,168,0.5)',
      '--ui-text-1': '#EDE8DF',
      '--ui-text-2': 'rgba(237,232,223,0.5)',
      '--ui-text-3': 'rgba(237,232,223,0.22)',
    },
    shader: { color1: '#1e185c', color2: '#411a4b', color3: '#212121', brightness: 0.5 },
  },
  a: {
    label: 'A · Single Ember',
    note: 'One accent hue, everywhere. Recorded pins dim the same gold instead of reaching for a second color.',
    vars: {
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#1B1E28',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': 'rgba(201,168,124,0.55)',
      '--ui-recorded-dim': 'rgba(201,168,124,0.3)',
      '--ui-text-1': '#EDE8DF',
      '--ui-text-2': 'rgba(237,232,223,0.5)',
      '--ui-text-3': 'rgba(237,232,223,0.22)',
    },
    shader: { color1: '#0D0F14', color2: '#171A22', color3: '#2A2419', brightness: 0.2 },
  },
  b: {
    label: 'B · Warm/Cool Duet',
    note: 'Gold + slate-blue, tidied. Keeps a real color distinction for draft vs. recorded pins.',
    vars: {
      '--ui-bg': '#0F1116',
      '--ui-surface': '#1C1F29',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#7C93A8',
      '--ui-recorded-dim': 'rgba(124,147,168,0.5)',
      '--ui-text-1': '#EDE8DF',
      '--ui-text-2': 'rgba(237,232,223,0.5)',
      '--ui-text-3': 'rgba(237,232,223,0.22)',
    },
    shader: { color1: '#0F1116', color2: '#3C3021', color3: '#232B33', brightness: 0.3 },
  },
  c: {
    label: 'C · Sepia Field',
    note: 'The neutrals stop being neutral — background through text sits in one warm ramp.',
    vars: {
      '--ui-bg': '#17120D',
      '--ui-surface': '#241C14',
      '--ui-border': 'rgba(255,235,210,0.09)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#8A7860',
      '--ui-recorded-dim': 'rgba(138,120,96,0.5)',
      '--ui-text-1': '#F2E9DA',
      '--ui-text-2': 'rgba(242,233,218,0.5)',
      '--ui-text-3': 'rgba(242,233,218,0.22)',
    },
    shader: { color1: '#17120D', color2: '#2E2013', color3: '#5C4527', brightness: 0.35 },
  },
  d: {
    label: 'D · Ember & Plum',
    note: "Gold stays; the recorded hue is the shader's own original plum, desaturated and tamed rather than discarded.",
    vars: {
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#1A1926',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#9C7C93',
      '--ui-recorded-dim': 'rgba(156,124,147,0.5)',
      '--ui-text-1': '#EDE8DF',
      '--ui-text-2': 'rgba(237,232,223,0.5)',
      '--ui-text-3': 'rgba(237,232,223,0.22)',
    },
    shader: { color1: '#0D0F14', color2: '#3A2130', color3: '#3D2E1C', brightness: 0.3 },
  },
  e: {
    label: 'E · Gold & Pine',
    note: 'Earthy near-complementary — forest-at-dusk instead of jewel-tone. No purple family at all.',
    vars: {
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#151E1B',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#6F9C8F',
      '--ui-recorded-dim': 'rgba(111,156,143,0.5)',
      '--ui-text-1': '#EDE8DF',
      '--ui-text-2': 'rgba(237,232,223,0.5)',
      '--ui-text-3': 'rgba(237,232,223,0.22)',
    },
    shader: { color1: '#0D0F14', color2: '#1E3B33', color3: '#3D2E1C', brightness: 0.28 },
  },
  f: {
    label: 'F · Gold & Terracotta',
    note: 'The tightest pairing — ~18° from gold, both warm. Gentlest contrast of the two-hue options.',
    vars: {
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#1D1614',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#B98572',
      '--ui-recorded-dim': 'rgba(185,133,114,0.5)',
      '--ui-text-1': '#EDE8DF',
      '--ui-text-2': 'rgba(237,232,223,0.5)',
      '--ui-text-3': 'rgba(237,232,223,0.22)',
    },
    shader: { color1: '#0D0F14', color2: '#4A2A1F', color3: '#3D2E1C', brightness: 0.25 },
  },
  g: {
    label: 'G · Gold & Sage',
    note: 'Quietest of the two-hue options — sage barely announces itself against the gold.',
    vars: {
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#181C15',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#92A378',
      '--ui-recorded-dim': 'rgba(146,163,120,0.5)',
      '--ui-text-1': '#EDE8DF',
      '--ui-text-2': 'rgba(237,232,223,0.5)',
      '--ui-text-3': 'rgba(237,232,223,0.22)',
    },
    shader: { color1: '#0D0F14', color2: '#33391F', color3: '#3D2E1C', brightness: 0.22 },
  },
  h: {
    label: 'H · Gold & Denim',
    note: "Deeper/moodier than B's slate-blue — still a warm/cool split, just less primary-feeling.",
    vars: {
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#171A24',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#6E7AA3',
      '--ui-recorded-dim': 'rgba(110,122,163,0.5)',
      '--ui-text-1': '#EDE8DF',
      '--ui-text-2': 'rgba(237,232,223,0.5)',
      '--ui-text-3': 'rgba(237,232,223,0.22)',
    },
    shader: { color1: '#0D0F14', color2: '#26304A', color3: '#3D2E1C', brightness: 0.3 },
  },
  i: {
    label: 'I · Starry Night',
    note: 'Gold survives, paler and looser, swirling through a cobalt-indigo sky instead of sitting on warm near-black.',
    vars: {
      '--ui-bg': '#0B1220',
      '--ui-surface': '#131B2E',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#EAD9A8',
      '--ui-gold-dim': 'rgba(234,217,168,0.5)',
      '--ui-recorded': '#8FC1C4',
      '--ui-recorded-dim': 'rgba(143,193,196,0.5)',
      '--ui-text-1': '#EDE8DF',
      '--ui-text-2': 'rgba(237,232,223,0.5)',
      '--ui-text-3': 'rgba(237,232,223,0.22)',
    },
    shader: { color1: '#0B1220', color2: '#1B3A5C', color3: '#5C4A1F', brightness: 0.35 },
  },
  j: {
    label: 'J · Northern Lights',
    note: 'Gold retires. Pale cool starlight for pins; a green-to-violet aurora ribbon carries the color instead.',
    vars: {
      '--ui-bg': '#0A0C10',
      '--ui-surface': '#12151B',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#9FE0C2',
      '--ui-gold-dim': 'rgba(159,224,194,0.5)',
      '--ui-recorded': '#B79FE0',
      '--ui-recorded-dim': 'rgba(183,159,224,0.5)',
      '--ui-text-1': '#E9EDEC',
      '--ui-text-2': 'rgba(233,237,236,0.5)',
      '--ui-text-3': 'rgba(233,237,236,0.22)',
    },
    shader: { color1: '#0A0C10', color2: '#1C4A3D', color3: '#3A2350', brightness: 0.4 },
  },
  k: {
    label: 'K · Deep Space',
    note: 'The quiet one. A single pale starlight hue used everywhere; recorded pins just dim the same white.',
    vars: {
      '--ui-bg': '#08090C',
      '--ui-surface': '#101216',
      '--ui-border': 'rgba(255,255,255,0.07)',
      '--ui-gold': '#D8D4E8',
      '--ui-gold-dim': 'rgba(216,212,232,0.5)',
      '--ui-recorded': 'rgba(216,212,232,0.55)',
      '--ui-recorded-dim': 'rgba(216,212,232,0.3)',
      '--ui-text-1': '#E4E2E8',
      '--ui-text-2': 'rgba(228,226,232,0.5)',
      '--ui-text-3': 'rgba(228,226,232,0.22)',
    },
    shader: { color1: '#08090C', color2: '#141022', color3: '#0C1620', brightness: 0.15 },
  },
} as const satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME_ID: ThemeId = 'default';

const KEY = 'ui-theme';
const EVENT = 'ui-theme-change';

function sanitize(id: string | null): ThemeId {
  return id !== null && Object.prototype.hasOwnProperty.call(THEMES, id) ? (id as ThemeId) : DEFAULT_THEME_ID;
}

export function loadThemeId(): ThemeId {
  if (typeof localStorage === 'undefined') return DEFAULT_THEME_ID;
  try {
    return sanitize(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function saveThemeId(id: ThemeId): void {
  try {
    localStorage.setItem(KEY, id);
    // Notify listeners in *this* tab (storage events only fire in other tabs).
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    // localStorage unavailable — selection stays in-memory for this tab only.
  }
}

/** Sets the ten `--ui-*` custom properties on the document root. Safe to call
 *  before React mounts, so the very first paint already reflects the saved
 *  theme instead of flashing the shipped default. */
export function applyThemeVars(vars: ThemeVars): void {
  const root = document.documentElement.style;
  for (const [prop, value] of Object.entries(vars)) {
    root.setProperty(prop, value);
  }
}

/** Subscribe to the persisted theme, updating on same-tab and cross-tab
 *  change, and keeping the root's CSS variables in sync as a side effect.
 *  Call this once near the app root; call it again wherever a component
 *  needs the theme's *non-CSS* values (ShaderBackground's shader props). */
export function useTheme(): { id: ThemeId; theme: Theme } {
  const [id, setId] = useState<ThemeId>(loadThemeId);
  useEffect(() => {
    const refresh = () => setId(loadThemeId());
    window.addEventListener('storage', refresh);
    window.addEventListener(EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(EVENT, refresh);
    };
  }, []);
  useEffect(() => {
    applyThemeVars(THEMES[id].vars);
  }, [id]);
  return { id, theme: THEMES[id] };
}
