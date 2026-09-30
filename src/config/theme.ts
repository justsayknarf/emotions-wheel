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

// The ten tokens every theme defines. This registry is the single list: the
// ThemeVars type, the admin inspector's rows, scripts/sync-theme-tokens.ts and
// scripts/test-theme.ts all read it, so adding an eleventh token is one edit
// here plus a value in each THEMES entry (the check script names any miss).
export const THEME_TOKENS = [
  { key: '--ui-bg', note: 'App ground' },
  { key: '--ui-surface', note: 'Cards, drawers, nav' },
  { key: '--ui-border', note: 'Hairlines' },
  { key: '--ui-gold', note: 'Primary accent' },
  { key: '--ui-gold-dim', note: 'Primary accent, backed off' },
  { key: '--ui-recorded', note: 'Secondary accent / recorded pins' },
  { key: '--ui-recorded-dim', note: 'Secondary accent, backed off' },
  { key: '--ui-text-1', note: 'Primary text' },
  { key: '--ui-text-2', note: 'Secondary text' },
  { key: '--ui-text-3', note: 'Tertiary text / labels' },
] as const;

export type ThemeVars = Record<(typeof THEME_TOKENS)[number]['key'], string>;

// Channel triplets derived from the tokens above ("201 168 124"), so any
// component can write `rgb(var(--ui-gold-rgb) / 0.3)` and follow the theme
// instead of hardcoding a color's RGB. They are computed, never authored: a
// theme only ever specifies the ten tokens.
export const DERIVED_TOKENS = [
  { key: '--ui-bg-rgb', from: '--ui-bg' },
  { key: '--ui-surface-rgb', from: '--ui-surface' },
  { key: '--ui-gold-rgb', from: '--ui-gold' },
  { key: '--ui-recorded-rgb', from: '--ui-recorded' },
  { key: '--ui-text-rgb', from: '--ui-text-1' },
] as const satisfies ReadonlyArray<{ key: string; from: keyof ThemeVars }>;

/** "#C9A87C" / "rgba(201,168,124,0.5)" -> "201 168 124". Alpha is dropped. */
export function toRgbChannels(color: string): string {
  const c = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (d) => d + d) : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => Math.round(Number(n))).join(' ');
  throw new Error(`toRgbChannels: cannot read "${color}"`);
}

/** The derived channel custom properties for a set of theme vars. */
export function deriveVars(vars: ThemeVars): Record<string, string> {
  return Object.fromEntries(DERIVED_TOKENS.map(({ key, from }) => [key, toRgbChannels(vars[from])]));
}

// The bone text ramp most themes share. Themes with a differently tinted
// ground (C, J, K) spell their own; everyone else takes these, so a contrast
// tweak to body text is one edit here, not one per theme.
const BONE_TEXT = {
  '--ui-text-1': '#EDE8DF',
  '--ui-text-2': 'rgba(237,232,223,0.5)',
  '--ui-text-3': 'rgba(237,232,223,0.22)',
} as const;

type TextKey = keyof typeof BONE_TEXT;

function mkVars(vars: Omit<ThemeVars, TextKey> & Partial<Pick<ThemeVars, TextKey>>): ThemeVars {
  return { ...BONE_TEXT, ...vars };
}

export interface ShaderTheme {
  // Colors — per theme, the reason this catalogue exists.
  color1: string;
  color2: string;
  color3: string;
  brightness: number;
  // Shape
  type: 'plane' | 'sphere' | 'waterPlane';
  uStrength: number;
  uDensity: number;
  pixelDensity: number;
  // Colors, extra
  grain: 'on' | 'off';
  /** 'off' omits the envPreset prop entirely rather than passing a preset. */
  envPreset: 'city' | 'off';
  // Motion
  animate: 'on' | 'off';
  uSpeed: number;
  range: 'enabled' | 'disabled';
  rangeStart: number;
  rangeEnd: number;
  // View
  cDistance: number;
  cAzimuthAngle: number;
  cPolarAngle: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  fov: number;
  // Night-sky field (docs/plans/2026-09-28-002-feat-living-sky-plan.md): the
  // shader sky drawn behind the stars when the skyField flag is on. Colors are
  // hex like the ShaderGradient stops above; the admin theme page edits them
  // through the same override mechanism.
  skyZenith: string;       // the sky straight overhead, darkest
  skyHorizon: string;      // the sky near the horizon
  skyWarm: string;         // a glow that only lives close to the horizon
  skyAuroraLow: string;    // aurora color at its base
  skyAuroraHigh: string;   // aurora color toward its top
  skyBand: string;         // milky way tint
  skyAuroraStrength: number; // 0..1.5
  skyAuroraSpeed: number;    // shader seconds per real second
  skyAuroraReach: number;    // degrees above the horizon the aurora fades out by
  skyAuroraCap: number;      // max brightness the aurora adds, so labels stay legible
  skyBandStrength: number;   // 0..2
  skyWarmth: number;         // 0..1
  skyMovingDim: number;      // aurora multiplier while the user is dragging (1 = no dim)
  skySwell: number;          // extra aurora brightness at the peak of the save swell
  skyRenderScale: number;    // WebGL resolution relative to the screen (soft content)
}

type ShaderColors = Pick<ShaderTheme, 'color1' | 'color2' | 'color3' | 'brightness'>;
type SkyColorKey = 'skyZenith' | 'skyHorizon' | 'skyWarm' | 'skyAuroraLow' | 'skyAuroraHigh' | 'skyBand';
export type SkyColors = Pick<ShaderTheme, SkyColorKey>;
type ShaderExtras = Omit<ShaderTheme, keyof ShaderColors | SkyColorKey>;

// Every field below Shape/Motion/View wasn't part of the original color-audit
// exploration — it's ShaderBackground's existing hardcoded prop values,
// lifted here so they become the shared default every theme's shader starts
// from. A theme's catalogue entry only ever specifies color1/2/3/brightness
// (via `mkShader`); these fill in the rest, and the admin theme page's
// "Details" panel can override any of them per theme the same way it
// already overrides a color stop's hue.
const SHADER_EXTRAS_DEFAULTS: ShaderExtras = {
  type: 'plane',
  uStrength: 1.5,
  uDensity: 1.5,
  pixelDensity: 1,
  grain: 'off',
  envPreset: 'city',
  animate: 'on',
  uSpeed: 0.3,
  range: 'disabled',
  rangeStart: 0,
  rangeEnd: 40,
  cDistance: 9.79,
  cAzimuthAngle: 180,
  cPolarAngle: 47,
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationX: 50,
  rotationY: 0,
  rotationZ: -60,
  fov: 30,
  // Night-sky motion and strength, feel-tested in the aurora study mock
  // (https://claude.ai/artifact/LgiPFHtqTVKcboqobmfKkB, 2026-09-28).
  skyAuroraStrength: 0.5,
  skyAuroraSpeed: 0.97,
  skyAuroraReach: 34,
  skyAuroraCap: 0.26,
  skyBandStrength: 0.96,
  skyWarmth: 0.26,
  skyMovingDim: 0.45,
  skySwell: 0.9,
  skyRenderScale: 0.5,
};

// Mix two #rrggbb colors; t = 0 gives a, 1 gives b.
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const out = [16, 8, 0].map((s) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t));
  return '#' + out.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// A theme that doesn't spell out its sky gets one from its shader stops:
// deepened color1 overhead, color2 at the horizon, color3 as the low warmth,
// and an aurora lifted out of color2 into color3. Starry Night and Northern
// Lights spell theirs out (the mock-tested values).
function deriveSky(c: ShaderColors): SkyColors {
  return {
    skyZenith: mixHex(c.color1, '#000000', 0.4),
    skyHorizon: c.color2,
    skyWarm: c.color3,
    skyAuroraLow: mixHex(c.color2, '#FFFFFF', 0.45),
    skyAuroraHigh: mixHex(c.color3, '#FFFFFF', 0.5),
    skyBand: mixHex(c.color2, '#FFFFFF', 0.7),
  };
}

function mkShader(colors: ShaderColors, sky?: SkyColors): ShaderTheme {
  return { ...SHADER_EXTRAS_DEFAULTS, ...colors, ...(sky ?? deriveSky(colors)) };
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
    label: 'Original (retired)',
    note: 'The palette this app first shipped with, before Starry Night became the default.',
    vars: mkVars({
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#161820',
      '--ui-border': 'rgba(255,255,255,0.06)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#7C93A8',
      '--ui-recorded-dim': 'rgba(124,147,168,0.5)',
    }),
    shader: mkShader({ color1: '#1e185c', color2: '#411a4b', color3: '#212121', brightness: 0.5 }),
  },
  a: {
    label: 'A · Single Ember',
    note: 'One accent hue, everywhere. Recorded pins dim the same gold instead of reaching for a second color.',
    vars: mkVars({
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#1B1E28',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': 'rgba(201,168,124,0.55)',
      '--ui-recorded-dim': 'rgba(201,168,124,0.3)',
    }),
    shader: mkShader({ color1: '#0D0F14', color2: '#171A22', color3: '#2A2419', brightness: 0.2 }),
  },
  b: {
    label: 'B · Warm/Cool Duet',
    note: 'Gold + slate-blue, tidied. Keeps a real color distinction for draft vs. recorded pins.',
    vars: mkVars({
      '--ui-bg': '#0F1116',
      '--ui-surface': '#1C1F29',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#7C93A8',
      '--ui-recorded-dim': 'rgba(124,147,168,0.5)',
    }),
    shader: mkShader({ color1: '#0F1116', color2: '#3C3021', color3: '#232B33', brightness: 0.3 }),
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
    shader: mkShader({ color1: '#17120D', color2: '#2E2013', color3: '#5C4527', brightness: 0.35 }),
  },
  d: {
    label: 'D · Ember & Plum',
    note: "Gold stays; the recorded hue is the shader's own original plum, desaturated and tamed rather than discarded.",
    vars: mkVars({
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#1A1926',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#9C7C93',
      '--ui-recorded-dim': 'rgba(156,124,147,0.5)',
    }),
    shader: mkShader({ color1: '#0D0F14', color2: '#3A2130', color3: '#3D2E1C', brightness: 0.3 }),
  },
  e: {
    label: 'E · Gold & Pine',
    note: 'Earthy near-complementary — forest-at-dusk instead of jewel-tone. No purple family at all.',
    vars: mkVars({
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#151E1B',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#6F9C8F',
      '--ui-recorded-dim': 'rgba(111,156,143,0.5)',
    }),
    shader: mkShader({ color1: '#0D0F14', color2: '#1E3B33', color3: '#3D2E1C', brightness: 0.28 }),
  },
  f: {
    label: 'F · Gold & Terracotta',
    note: 'The tightest pairing — ~18° from gold, both warm. Gentlest contrast of the two-hue options.',
    vars: mkVars({
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#1D1614',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#B98572',
      '--ui-recorded-dim': 'rgba(185,133,114,0.5)',
    }),
    shader: mkShader({ color1: '#0D0F14', color2: '#4A2A1F', color3: '#3D2E1C', brightness: 0.25 }),
  },
  g: {
    label: 'G · Gold & Sage',
    note: 'Quietest of the two-hue options — sage barely announces itself against the gold.',
    vars: mkVars({
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#181C15',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#92A378',
      '--ui-recorded-dim': 'rgba(146,163,120,0.5)',
    }),
    shader: mkShader({ color1: '#0D0F14', color2: '#33391F', color3: '#3D2E1C', brightness: 0.22 }),
  },
  h: {
    label: 'H · Gold & Denim',
    note: "Deeper/moodier than B's slate-blue — still a warm/cool split, just less primary-feeling.",
    vars: mkVars({
      '--ui-bg': '#0D0F14',
      '--ui-surface': '#171A24',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#C9A87C',
      '--ui-gold-dim': 'rgba(201,168,124,0.5)',
      '--ui-recorded': '#6E7AA3',
      '--ui-recorded-dim': 'rgba(110,122,163,0.5)',
    }),
    // Tuned live in the admin theme page and folded in from
    // docs/handoff/theme-settings.json (2026-09-10): a deeper, cooler
    // color1/2 and higher brightness than the original pairing, plus the
    // waterPlane shape instead of a flat plane.
    shader: { ...mkShader({ color1: '#0d1314', color2: '#4a2639', color3: '#3D2E1C', brightness: 0.66 }), type: 'waterPlane' },
  },
  i: {
    label: 'I · Starry Night',
    note: 'Gold survives, paler and looser, swirling through a cobalt-indigo sky instead of sitting on warm near-black.',
    vars: mkVars({
      '--ui-bg': '#0B1220',
      '--ui-surface': '#131B2E',
      '--ui-border': 'rgba(255,255,255,0.08)',
      '--ui-gold': '#EAD9A8',
      '--ui-gold-dim': 'rgba(234,217,168,0.5)',
      '--ui-recorded': '#8FC1C4',
      '--ui-recorded-dim': 'rgba(143,193,196,0.5)',
    }),
    // Tuned live in the admin theme page and folded in from
    // docs/handoff/theme-settings.json (2026-09-18): the flat plane becomes a
    // waterPlane, brighter, almost still (uSpeed 0.04) and viewed close (camera
    // distance 2.5, fov 58) so it reads as slow water under starlight.
    shader: {
      ...mkShader(
        { color1: '#0B1220', color2: '#1B3A5C', color3: '#5c4e1f', brightness: 0.5 },
        // The night sky's own colors, from the aurora study mock.
        { skyZenith: '#060B16', skyHorizon: '#16304D', skyWarm: '#5C4E1F', skyAuroraLow: '#8FC1C4', skyAuroraHigh: '#EAD9A8', skyBand: '#AFC0DC' },
      ),
      type: 'waterPlane',
      uSpeed: 0.04,
      cDistance: 2.5,
      fov: 58,
    },
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
    shader: mkShader(
      { color1: '#0A0C10', color2: '#1C4A3D', color3: '#3A2350', brightness: 0.4 },
      // Green-to-violet aurora, from the aurora study mock.
      { skyZenith: '#07090D', skyHorizon: '#133329', skyWarm: '#3A2350', skyAuroraLow: '#9FE0C2', skyAuroraHigh: '#B79FE0', skyBand: '#C8D6DA' },
    ),
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
    shader: mkShader({ color1: '#08090C', color2: '#141022', color3: '#0C1620', brightness: 0.15 }),
  },
} as const satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

// The shipped default. Changing it also means running `npm run sync:theme`
// (regenerates src/theme-tokens.css, the pre-JavaScript first paint) and
// updating DESIGN.md; `npm run check:theme` fails until both agree.
export const DEFAULT_THEME_ID: ThemeId = 'i';

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

/** Sets the ten `--ui-*` custom properties (plus their derived `-rgb` channels) on the document root. Safe to call
 *  before React mounts, so the very first paint already reflects the saved
 *  theme instead of flashing the shipped default. */
export function applyThemeVars(vars: ThemeVars): void {
  const root = document.documentElement.style;
  for (const [prop, value] of Object.entries({ ...vars, ...deriveVars(vars) })) {
    root.setProperty(prop, value);
  }
}

// Per-theme shader tuning (the admin theme page's hue + brightness sliders).
// Kept as a *patch* layered on top of the catalogue entry, keyed by theme id,
// rather than mutating THEMES itself — the shipped presets stay the source
// of truth in code, and a tweak is just a reversible localStorage overlay.
// Same write-triggers-an-event shape as the theme id above, on its own
// key/event pair so a shader tweak doesn't get confused with a theme switch.

export type ShaderOverride = Partial<ShaderTheme>;

const OVERRIDE_KEY = 'ui-theme-shader-overrides';
const OVERRIDE_EVENT = 'ui-theme-shader-change';

function loadShaderOverrides(): Partial<Record<ThemeId, ShaderOverride>> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<ThemeId, ShaderOverride>>) : {};
  } catch {
    return {};
  }
}

function saveShaderOverrides(overrides: Partial<Record<ThemeId, ShaderOverride>>): void {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides));
    window.dispatchEvent(new CustomEvent(OVERRIDE_EVENT));
  } catch {
    // localStorage unavailable — the tweak stays in-memory for this tab only.
  }
}

/** Merge a patch (one hue turn, a brightness drag) into a theme's shader override. */
export function setShaderOverride(id: ThemeId, patch: ShaderOverride): void {
  const all = loadShaderOverrides();
  saveShaderOverrides({ ...all, [id]: { ...all[id], ...patch } });
}

/** Clear a theme's shader override, reverting it to the catalogue default. */
export function resetShaderOverride(id: ThemeId): void {
  const all = loadShaderOverrides();
  if (!(id in all)) return;
  const next = { ...all };
  delete next[id];
  saveShaderOverrides(next);
}

/** Read one theme's raw shader override (the patch, not merged with the
 *  catalogue default) — for the admin "save settings to file" button, which
 *  wants to know exactly what changed rather than the fully-resolved value. */
export function getShaderOverride(id: ThemeId): ShaderOverride | undefined {
  return loadShaderOverrides()[id];
}

/** Read every theme's raw shader override, keyed by theme id. */
export function getAllShaderOverrides(): Partial<Record<ThemeId, ShaderOverride>> {
  return loadShaderOverrides();
}

/** Subscribe to the persisted theme (+ its shader override), updating on
 *  same-tab and cross-tab change, and keeping the root's CSS variables in
 *  sync as a side effect. Call this once near the app root; call it again
 *  wherever a component needs the theme's *non-CSS* values (ShaderBackground's
 *  shader props, or the admin theme inspector reading/writing them). */
export function useTheme(): { id: ThemeId; theme: Theme } {
  const [id, setId] = useState<ThemeId>(loadThemeId);
  const [overrides, setOverrides] = useState(loadShaderOverrides);

  useEffect(() => {
    const refresh = () => {
      setId(loadThemeId());
      setOverrides(loadShaderOverrides());
    };
    window.addEventListener('storage', refresh);
    window.addEventListener(EVENT, refresh);
    window.addEventListener(OVERRIDE_EVENT, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener(OVERRIDE_EVENT, refresh);
    };
  }, []);
  useEffect(() => {
    applyThemeVars(THEMES[id].vars);
  }, [id]);

  const base = THEMES[id];
  const theme: Theme = { ...base, shader: { ...base.shader, ...overrides[id] } };
  return { id, theme };
}
