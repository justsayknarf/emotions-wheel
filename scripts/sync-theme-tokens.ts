// Regenerates src/theme-tokens.css from the shipped default theme in
// src/config/theme.ts. That file is the pre-JavaScript first paint for every
// page (app, landing, admin) and the CSS side of the token contract; the
// TypeScript catalogue stays the single source of truth.
// Run: npm run sync:theme   (npm run check:theme fails when it is out of date)
import { writeFileSync } from 'node:fs';
import { renderTokensCss } from './lib/theme-tokens-css';

const out = new URL('../src/theme-tokens.css', import.meta.url);
writeFileSync(out, renderTokensCss(), 'utf-8');
console.log(`wrote ${out.pathname}`);
