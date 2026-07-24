// One-shot authoring generator for the radial-intensity framework.
// Reads the circumplex-custom set, keeps each word's angle, and redistributes
// radius by intra-cluster intensity rank (original radius = circumplex-native
// intensity proxy) across [R_INNER, R_OUTER]. Marks the median-rank word per
// cluster as the always-visible surface anchor. Deterministic + re-runnable.
import { readFileSync, writeFileSync } from 'node:fs';

const R_INNER = 0.18;
const R_OUTER = 1.0;

const src = readFileSync('src/data/frameworks/circumplex-custom.ts', 'utf8');
const re = /id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+),\s*depth:\s*'(\w+)',\s*cluster:\s*'([^']+)'/g;
let m; const rows = [];
while ((m = re.exec(src))) {
  rows.push({ id: m[1], label: m[2], x: +m[3], y: +m[4], cluster: m[6] });
}

// Guard: abort rather than overwrite the active framework file with an
// under-parsed set if the source format drifts (mirrors the spacing lint's
// parse guard). Count row-shaped entries and require the regex matched them all.
const rawCount = (src.match(/\{\s*id:\s*'[^']+',\s*label:/g) ?? []).length;
if (rows.length === 0 || rows.length < rawCount) {
  console.error(
    `gen-radial-intensity: parsed ${rows.length} of ${rawCount} rows from circumplex-custom.ts — aborting so radial-intensity.ts is not overwritten with an under-parsed set.`,
  );
  process.exit(1);
}

// preserve original file order for output; group for the radius transform
const order = rows.map(r => r.id);
const by = {};
for (const r of rows) {
  r.r0 = Math.hypot(r.x, r.y);
  r.ang = Math.atan2(r.y, r.x);
  (by[r.cluster] = by[r.cluster] || []).push(r);
}

const clusterOrder = [];
for (const r of rows) if (!clusterOrder.includes(r.cluster)) clusterOrder.push(r.cluster);

// Pass 1: keep angle, redistribute radius by intra-cluster intensity rank.
for (const c of clusterOrder) {
  const g = by[c].sort((a, b) => a.r0 - b.r0); // mild -> intense
  const n = g.length;
  g.forEach((w, k) => {
    const rNew = n === 1 ? (R_INNER + R_OUTER) / 2
                         : R_INNER + (R_OUTER - R_INNER) * (k / (n - 1));
    w.rNew = rNew;
    w.nx = Math.round(rNew * Math.cos(w.ang) * 100) / 100;
    w.ny = Math.round(rNew * Math.sin(w.ang) * 100) / 100;
    w.depth = 'deep';
  });
}

// Pass 2: pick one always-visible anchor per cluster (U3). Clusters bunch into
// four angular zones; picking every anchor at the same mid-radius makes the
// same-zone anchors collide. So within each zone we stagger the anchor's target
// radius across a mid band, and pick the cluster word nearest that target. This
// keeps anchors mid-intensity while spreading them into legible filled spokes.
const zoneOf = (deg) => deg >= 0 && deg < 90 ? 'PA'
                      : deg >= 90 ? 'PC'
                      : deg >= -90 ? 'NA' : 'NC';
const ANCHOR_BAND = [0.30, 0.78]; // mid-intensity band anchors are drawn from

// Pixel overlap model mirrors scripts/lint-emotion-spacing.mjs so anchor
// selection avoids exactly the surface-surface collisions the lint fails on.
const W = 870, H = 800, PAD = 8, LINE = 18, CHAR_W_SURFACE = 7.7;
const toPxX = (v) => (5 + ((v + 1) / 2) * 90) / 100 * W;
const toPxY = (v) => (5 + ((-v + 1) / 2) * 90) / 100 * H;
const anchorOverlap = (a, b) => {
  const dx = Math.abs(toPxX(a.nx) - toPxX(b.nx));
  const dy = Math.abs(toPxY(a.ny) - toPxY(b.ny));
  const hThreshold = (a.label.length + b.label.length) / 2 * CHAR_W_SURFACE + PAD;
  return dx < hThreshold && dy < LINE;
};

const zones = {};
for (const c of clusterOrder) {
  const meanDeg = (by[c].reduce((s, w) => s + w.ang, 0) / by[c].length) * 180 / Math.PI;
  (zones[zoneOf(meanDeg)] = zones[zoneOf(meanDeg)] || []).push({ c, meanDeg });
}
const placed = [];
for (const z of Object.keys(zones)) {
  const list = zones[z].sort((a, b) => a.meanDeg - b.meanDeg);
  const k = list.length;
  list.forEach((entry, i) => {
    const target = k === 1 ? (ANCHOR_BAND[0] + ANCHOR_BAND[1]) / 2
                           : ANCHOR_BAND[0] + (ANCHOR_BAND[1] - ANCHOR_BAND[0]) * (i / (k - 1));
    const g = by[entry.c]; // already sorted mild -> intense
    // Anchors must be genuinely mid-intensity: never a cluster's innermost
    // (mild, sits on the still-ring) or outermost (intense, sits at the edge)
    // word. Only fall back to the full set for tiny clusters (n < 3).
    const candidates = g.length >= 3 ? g.slice(1, -1) : g;
    // Choose the candidate nearest the target radius that does not collide with
    // an already-placed anchor; fall back to plain nearest if all collide.
    let best = null, bestErr = Infinity, bestClear = null, bestClearErr = Infinity;
    for (const w of candidates) {
      const err = Math.abs(w.rNew - target);
      if (err < bestErr) { bestErr = err; best = w; }
      const clear = placed.every((p) => !anchorOverlap(w, p));
      if (clear && err < bestClearErr) { bestClearErr = err; bestClear = w; }
    }
    const chosen = bestClear ?? best;
    chosen.depth = 'surface';
    placed.push(chosen);
  });
}

// ---- report ----
const bins = [0, 0.15, 0.2, 0.4, 0.7, 1.001, 9]; const names = ['0-.15','.15-.2','.2-.4','.4-.7','.7-1','>1'];
const h = new Array(6).fill(0);
for (const r of rows) { const rr = Math.hypot(r.nx, r.ny); for (let i=0;i<6;i++){ if (rr>=bins[i]&&rr<bins[i+1]){h[i]++;break;} } }
console.log('NEW radial hist:', names.map((n,i)=>n+':'+h[i]).join('  '));
const surf = rows.filter(r=>r.depth==='surface');
console.log('surface anchors:', surf.length);
console.log('anchors:', surf.map(s=>s.label+'('+Math.hypot(s.nx,s.ny).toFixed(2)+')').join(', '));
// angle preservation check
let maxAngErr = 0;
for (const r of rows){ const a0=r.ang, a1=Math.atan2(r.ny,r.nx); let d=Math.abs(a0-a1)*180/Math.PI; if(d>maxAngErr)maxAngErr=d; }
console.log('max angle drift (deg, from rounding):', maxAngErr.toFixed(2));

// ---- emit file ----
const byId = Object.fromEntries(rows.map(r=>[r.id,r]));
const fmt = (v) => (v>=0?' ':'') + v.toFixed(2);
const lines = [];
lines.push("import type { Emotion, Framework } from './types';");
lines.push('');
lines.push('// Radial-intensity re-audit of the custom circumplex set.');
lines.push('// angle = quality of feeling (preserved per word); radius = intensity,');
lines.push('// redistributed so each cluster spans a mild inner variant to an intense');
lines.push('// outer one. The core (r < ~0.15) is left a deliberate wordless still point.');
lines.push('// Generated by scripts/gen-radial-intensity.mjs — re-run to regenerate.');
lines.push('const emotions: Emotion[] = [');
let curCluster = null;
for (const id of order) {
  const r = byId[id];
  if (r.cluster !== curCluster) { curCluster = r.cluster; lines.push(''); }
  const idf = `'${r.id}',`.padEnd(15);
  const lbf = `'${r.label}',`.padEnd(17);
  lines.push(`  { id: ${idf} label: ${lbf} x: ${fmt(r.nx)}, y: ${fmt(r.ny)}, depth: '${r.depth}', cluster: '${r.cluster}' },`);
}
lines.push('];');
lines.push('');
lines.push('export const radialIntensity: Framework = {');
lines.push("  id: 'radial-intensity',");
lines.push("  name: 'Radial intensity',");
lines.push('  emotions,');
lines.push('};');
lines.push('');
writeFileSync('src/data/frameworks/radial-intensity.ts', lines.join('\n'));
console.log('\nwrote src/data/frameworks/radial-intensity.ts');
