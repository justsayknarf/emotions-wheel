// Drift check for the theme system. Run: npm run check:theme
//
// The theme catalogue in src/config/theme.ts is the one source of truth. This
// script fails when anything that mirrors it has fallen behind:
//   1. src/theme-tokens.css (first paint, generated) matches the default theme;
//   2. every theme defines every token, and every value can be read as a color;
//   3. DESIGN.md's palette matches the default theme's tokens;
//   4. no source file hardcodes a theme color that should be a token.
// To change the shipped theme: edit the catalogue, `npm run sync:theme`, update
// DESIGN.md's colors, then re-run this.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DEFAULT_THEME_ID, THEMES, THEME_TOKENS, toRgbChannels, type ThemeVars } from '../src/config/theme';
import { renderTokensCss } from './lib/theme-tokens-css';

const root = new URL('..', import.meta.url).pathname;
let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// --- 1. generated CSS is current ---
const onDisk = readFileSync(join(root, 'src/theme-tokens.css'), 'utf-8');
check('theme-tokens.css in sync', onDisk === renderTokensCss(), onDisk === renderTokensCss() ? `default theme "${DEFAULT_THEME_ID}"` : 'run `npm run sync:theme`');

// --- 2. every theme complete and parseable ---
const bad: string[] = [];
for (const [id, theme] of Object.entries(THEMES)) {
  for (const { key } of THEME_TOKENS) {
    const v = (theme.vars as ThemeVars)[key];
    if (typeof v !== 'string' || v === '') bad.push(`${id} missing ${key}`);
    else {
      try {
        toRgbChannels(v);
      } catch {
        bad.push(`${id} ${key}="${v}" unreadable`);
      }
    }
  }
}
check('all themes complete', bad.length === 0, bad.length ? bad.join('; ') : `${Object.keys(THEMES).length} themes x ${THEME_TOKENS.length} tokens`);

// --- 3. DESIGN.md palette matches the default theme ---
const design = readFileSync(join(root, 'DESIGN.md'), 'utf-8');
const front = /^---\n([\s\S]*?)\n---/.exec(design)?.[1] ?? '';
const colorsBlock = /^colors:\n((?:  .*\n?)*)/m.exec(front)?.[1] ?? '';
const designColors = new Map([...colorsBlock.matchAll(/^  ([\w-]+): "([^"]+)"/gm)].map((m) => [m[1], m[2]]));
const DESIGN_KEYS: Record<string, keyof ThemeVars> = {
  'night-indigo': '--ui-bg',
  'midnight-surface': '--ui-surface',
  'starlight-gold': '--ui-gold',
  'starlight-gold-dim': '--ui-gold-dim',
  'tidal-teal': '--ui-recorded',
  'tidal-teal-dim': '--ui-recorded-dim',
  bone: '--ui-text-1',
  'bone-2': '--ui-text-2',
  'bone-3': '--ui-text-3',
  hairline: '--ui-border',
};
const norm = (c: string) => c.replace(/\s+/g, '').toLowerCase();
const mismatch: string[] = [];
for (const [dk, token] of Object.entries(DESIGN_KEYS)) {
  const want = THEMES[DEFAULT_THEME_ID].vars[token];
  const got = designColors.get(dk);
  if (got === undefined) mismatch.push(`${dk} missing`);
  else if (norm(got) !== norm(want)) mismatch.push(`${dk} ${got} != ${want}`);
}
check('DESIGN.md palette matches default theme', mismatch.length === 0, mismatch.length ? mismatch.join('; ') : `${Object.keys(DESIGN_KEYS).length} colors`);

// --- 4. no hardcoded theme colors in source ---
const literals = new Set<string>();
for (const theme of Object.values(THEMES)) {
  for (const key of ['--ui-bg', '--ui-surface', '--ui-gold', '--ui-recorded', '--ui-text-1'] as const) {
    const v = (theme.vars as ThemeVars)[key];
    if (v.startsWith('#')) literals.add(v.toLowerCase());
    literals.add(toRgbChannels(v).split(' ').join(','));
  }
}
const files: string[] = [];
(function walk(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx|css)$/.test(f)) files.push(p);
  }
})(join(root, 'src'));
const EXEMPT = new Set(['src/config/theme.ts', 'src/theme-tokens.css']);
const hits: string[] = [];
for (const file of files) {
  const rel = relative(root, file);
  if (EXEMPT.has(rel)) continue;
  readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
    const code = line.trimStart();
    if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
    const lower = line.toLowerCase();
    for (const lit of literals) {
      const found = lit.startsWith('#') ? lower.includes(lit) : new RegExp(`rgba?\\(\\s*${lit.split(',').join('\\s*,\\s*')}\\b`).test(lower);
      if (found) hits.push(`${rel}:${i + 1} ${lit}`);
    }
  });
}
check('no hardcoded theme colors in src', hits.length === 0, hits.length ? hits.slice(0, 8).join('; ') + (hits.length > 8 ? ` (+${hits.length - 8} more)` : '') : `${files.length} files scanned`);

process.exit(failures ? 1 : 0);
