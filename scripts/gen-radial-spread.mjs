// One-shot authoring generator for the radial-spread framework — a proposal
// to replace radial-intensity's layout.
//
// radial-intensity kept circumplex-custom's angles, and those sit almost all on
// the four diagonals (78% within ±12°), leaving every axis wedge empty and the
// median nearest-neighbour gap at 0.04. This keeps what the words *mean* —
// quadrant, cluster, and each word's intensity rank inside its cluster — and
// re-lays the geometry:
//
//   1. Every cluster owns an angular sector chosen for its quality, and the
//      sectors of a quadrant tile the whole 90° (edges overlap a little so
//      neighbouring clusters mingle instead of meeting at a hard seam).
//   2. Radius follows intensity rank, equal-area (r² linear in rank), so the
//      outer rings, which have more room, take more words.
//   3. Angle within the sector comes from a golden-ratio sequence on rank, so
//      rank-adjacent words don't line up on one spoke.
//   4. A relaxation pass enforces a minimum distance between every pair,
//      surface and deep alike (surface words get extra clearance), while a
//      weak spring holds each word near its target and a clamp keeps it in its
//      quadrant and out of the wordless core.
//
// Two variants, differing only in how hard clusters hold together:
//   node scripts/gen-radial-spread.mjs              → radial-spread (even sky)
//   node scripts/gen-radial-spread.mjs --clustered  → radial-clustered (islands)
//   node scripts/gen-radial-spread.mjs --organic    → radial-organic (star-like)
// Deterministic + re-runnable.
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'src/data/frameworks/radial-intensity.ts';
const CLUSTERED = process.argv.includes('--clustered');
const ORGANIC = process.argv.includes('--organic');
const VARIANT = ORGANIC
  ? { id: 'radial-organic', exportName: 'radialOrganic', name: 'Radial organic', same: 0.07, cross: 0.09 }
  : CLUSTERED
    ? { id: 'radial-clustered', exportName: 'radialClustered', name: 'Radial clustered (proposal)', same: 0.09, cross: 0.15 }
    : { id: 'radial-spread', exportName: 'radialSpread', name: 'Radial spread (proposal)', same: 0.10, cross: 0.13 };

// Organic variant. One minimum gap for every pair relaxes into a lattice
// (Clark–Evans R ≈ 1.8; real star fields sit near 1). Instead, deep words are
// gathered into small knots that sit close together, and the spacing between
// knots swells and shrinks with a smooth noise field, leaving dense patches
// and dark voids. Tips, corners, landmarks and pins are untouched.
const KNOT_GAP = 0.055;          // two words in one knot
const SPACING_FLOOR = 0.05;      // no two words closer than this, whatever the noise says
const KNOT_SIZES = [1, 2, 2, 3, 3, 4, 4, 5]; // drawn per knot; 1 = a lone star
const KNOT_REACH = 0.26;         // knot members come from within this of the seed word
const KNOT_PULL = 0.7;           // how far members' targets move toward the knot's centre
const SPACE_MIN = 0.6;           // noise scales the between-knot gap from ×0.6 ...
const SPACE_MAX = 1.6;           // ... to ×1.6
const DRIFT = 0.25;             // how far deep words drift toward the noise field's dense patches
const SEED = 7;
const OUT = `src/data/frameworks/${VARIANT.id}.ts`;

const R_INNER = 0.22;
const R_OUTER = 0.97;
const MIN_DIST = VARIANT.same;       // two words of the same cluster, field units
const MIN_DIST_CROSS = VARIANT.cross; // words of different clusters — the gap that lets clusters read
const MIN_DIST_SURFACE = 0.15; // any pair involving a surface word
// Two surface words are always on screen together, so they need room for
// their labels, not just their stars. lint-emotion-spacing's box model is the
// real check; this is the relaxation's stand-in for it.
const MIN_DIST_SURFACE_PAIR = 0.22;
const AXIS_MARGIN = (3 * Math.PI) / 180;
const SPRING = 0.04;
const ITER = 600;

// Degrees counter-clockwise from +x (Activated): 0 = activated, 90 = positive,
// 180 = calm, 270 = negative. Each quadrant's sectors tile its 90°.
const SECTORS = {
  // activated + positive
  energized:  [3, 22],
  curious:    [18, 42],
  courageous: [38, 62],
  joyful:     [56, 87],
  // calm + positive
  hopeful:    [93, 108],
  loving:     [104, 131],
  grateful:   [125, 150],
  peaceful:   [145, 177],
  // calm + negative
  numb:       [183, 214],
  sad:        [210, 245],
  powerless:  [238, 256],
  guilt:      [251, 262],
  shame:      [256, 268],
  // activated + negative
  unsettled:  [282, 306],
  angry:      [291, 322],
  fear:       [316, 340],
  stressed:   [334, 357],
};

// Intensity ceilings. Radius is intensity rank *within* a cluster, which
// would put every cluster's top word on the rim — even for clusters whose
// strongest word is mild (Optimistic, Ungrounded). These clusters stop short.
const CLUSTER_MAX_R = {
  hopeful: 0.7,
  unsettled: 0.8,
  guilt: 0.75,
  curious: 0.85,
  grateful: 0.88,
  energized: 0.9,
  peaceful: 0.9,
  shame: 0.9,
};

// Inner radii. Every cluster's mildest word would otherwise target R_INNER,
// and the clamp holds anything pushed inward at the same floor, so the words
// nearest the core sat on a perfect circle. These give the innermost words a
// radius by how far each one actually sits from neutral (activation and
// valence), and each one's floor follows its own target, so the edge of the
// still point is ragged rather than round.
const INNER_R = {
  present: 0.23,
  interested: 0.24,
  unsure: 0.24,
  centered: 0.25,
  sensitive: 0.26,
  questioning: 0.27,
  inhibited: 0.27,
  humbled: 0.28,
  grouchy: 0.28,
  cynical: 0.3,
  teary: 0.3,
  sorry: 0.3,
  worthy: 0.3,
  renewed: 0.33,
  yearning: 0.34,
  free: 0.36,
};
// How far inside its own target radius a word may be pushed.
const FLOOR_SLACK = 0.02;

// Hand-placed words: degrees (0 activated, 90 positive, 180 calm, 270
// negative) and radius (intensity). Held within PIN_BAND of the angle and
// PIN_R_BAND of the radius. Radius > 1 reaches into the square's corners,
// which is where a pin lands when both sliders sit at an end.
const PIN_BAND = (6 * Math.PI) / 180;
// Tips (r ≥ 0.95) hold their radius tightly so they stay outermost; other
// pins may drift further to make room.
const PIN_R_BAND_TIP = 0.03;
const PIN_R_BAND = 0.1;
const CORNER_R = 1.27; // 0.16 from the corner: inside the 0.35 reveal radius
const PINS = {
  // Axis tips — the purest, strongest form of each axis alone.
  astonished: [7, 0.95],     // rated mildly pleasant, so just above the axis
  elated: [90, 0.95],
  sleepy: [180, 0.95],
  miserable: [270, 0.95],
  // Corner tips — both sliders at an end.
  ecstatic: [45, CORNER_R],   // activated + positive
  serene: [135, CORNER_R],    // calm + positive
  depressed: [225, CORNER_R], // calm + negative
  terrified: [315, CORNER_R], // activated + negative
  // Corner shoulders, 8° either side and within reveal range of the corner,
  // so a corner pin shows a few words rather than one.
  thrilled: [37, 1.18],
  passionate: [53, 1.18],
  bliss: [127, 1.18],
  peaceful: [143, 1.18],
  despondent: [217, 1.18],
  hopeless: [233, 1.18],
  furious: [307, 1.18],
  panic: [323, 1.18],
  // Activated axis, mild → strong: Alert, Surprised, Shocked, Astonished.
  alert: [1, 0.36],
  surprised: [6, 0.6],
  shocked: [354, 0.8],
  invigorated: [11, 0.8],
  restless: [350, 0.5],
  overwhelmed: [336, 0.9],   // was crowding the Astonished tip
  // Positive axis: Glad, Happy, Delighted, Elated.
  glad: [92, 0.38],
  delighted: [86, 0.8],
  content: [121, 0.38],
  // Calm axis: Still, Reflective, Calm, Sleepy.
  still: [179, 0.42],
  reflective: [185, 0.3],
  calm: [177, 0.7],
  lethargic: [194, 0.78],  // keeps Sleepy the calm tip
  // Negative axis: Unhappy, Hurt, Upset, Miserable.
  unhappy: [262, 0.32],
  upset: [276, 0.66],
  // Low-arousal exhaustion words, filed under "stressed" but not activated:
  // they belong with the calm-negative feelings.
  weary: [198, 0.55],
  'worn-out': [206, 0.72],
  depleted: [213, 0.82],
  'burned-out': [220, 0.92],
  // Moved off an axis they don't belong on.
  ungrounded: [300, 0.4],    // mild; was near the Negative tip
  // Rated agitated, not low-energy (grief and shame are aroused states): just
  // past the Negative axis on the activated side, short of fear and anger.
  'self-conscious': [282, 0.32],
  ashamed: [286, 0.74],
  victim: [292, 0.56],
  anguish: [283, 0.92],
  heartbroken: [294, 0.9],
  // Rated low-arousal in the Warriner et al. (2013) norms but filed under
  // activated families (fear, unsettled, angry): moved to calm-negative.
  hesitant: [196, 0.3],
  reluctant: [205, 0.42],
  concerned: [214, 0.5],
  disdain: [203, 0.62],
  disgruntled: [221, 0.58],
  // Innermost words whose cluster put them on the wrong side of the
  // Activated axis.
  grounded: [142, 0.36],     // settled, not energized: calm-positive
  expectant: [80, 0.3],      // anticipation carries some charge
  uneasy: [306, 0.3],        // low-level anxiety, not numbness
  moody: [248, 0.42],        // sulky and low, not activated
  // Rated restful, not energetic: calm-positive.
  refreshed: [157, 0.42],
  vulnerable: [250, 0.36],   // exposed, not mildly positive
  'shut-down': [203, 0.9],   // dissociative, clearly negative
  fulfilled: [140, 0.78],    // positive, not pure calm
  // Surface landmarks: everyday words, mid-intensity, ~20° apart.
  energized: [18, 0.62],
  curious: [30, 0.48],
  confident: [49, 0.66],
  excited: [66, 0.58],
  happy: [89, 0.6],
  hopeful: [106, 0.52],
  loving: [126, 0.64],
  grateful: [145, 0.52],
  relaxed: [166, 0.64],
  bored: [191, 0.55],
  sad: [210, 0.62],
  helpless: [229, 0.5],
  regret: [246, 0.64],
  hurt: [266, 0.56],
  embarrassed: [283, 0.44],
  confused: [301, 0.64],
  frustrated: [313, 0.5],
  anxious: [326, 0.62],
  stressed: [334, 0.52],
};
// Organic variant: corner shoulders at uneven offsets, so the four corners
// aren't mirror images. Each stays within reveal range of its corner.
const ORGANIC_PINS = {
  thrilled: [35, 1.2],
  passionate: [52, 1.12],
  bliss: [125, 1.17],
  peaceful: [146, 1.2],
  despondent: [214, 1.2],
  hopeless: [231, 1.14],
  furious: [305, 1.17],
  panic: [326, 1.2],
};
if (ORGANIC) Object.assign(PINS, ORGANIC_PINS);
// The always-visible words. Everything else is deep.
const SURFACE = new Set([
  'energized', 'curious', 'confident', 'excited', 'happy', 'hopeful', 'loving', 'grateful', 'relaxed',
  'bored', 'sad', 'helpless', 'regret', 'embarrassed', 'hurt', 'confused', 'frustrated', 'anxious',
  'stressed', 'restless',
]);
// New words, placed through PINS.
const NEW_WORDS = [
  { id: 'alert',      label: 'Alert',      cluster: 'energized' },
  { id: 'surprised',  label: 'Surprised',  cluster: 'unsettled' },
  { id: 'astonished', label: 'Astonished', cluster: 'unsettled' },
  { id: 'glad',       label: 'Glad',       cluster: 'joyful' },
  { id: 'elated',     label: 'Elated',     cluster: 'joyful' },
  { id: 'still',      label: 'Still',      cluster: 'peaceful' },
  { id: 'sleepy',     label: 'Sleepy',     cluster: 'numb' },
  { id: 'hurt',       label: 'Hurt',       cluster: 'sad' },
  { id: 'miserable',  label: 'Miserable',  cluster: 'sad' },
];

const src = readFileSync(SRC, 'utf8');
const re = /id:\s*'([^']+)',\s*label:\s*'([^']+)',\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+),\s*depth:\s*'(\w+)',\s*cluster:\s*'([^']+)'/g;
const rows = [...src.matchAll(re)].map((m) => ({
  id: m[1], label: m[2], x0: +m[3], y0: +m[4], depth: m[5], cluster: m[6],
}));
const rawCount = (src.match(/\{\s*id:\s*'[^']+',\s*label:/g) ?? []).length;
if (rows.length === 0 || rows.length < rawCount) {
  console.error(`gen-radial-spread: parsed ${rows.length} of ${rawCount} rows — aborting.`);
  process.exit(1);
}

const byCluster = {};
for (const r of rows) (byCluster[r.cluster] ??= []).push(r);
const newIds = new Set(NEW_WORDS.map((w) => w.id));
for (const id of [...Object.keys(PINS), ...SURFACE, ...Object.keys(INNER_R)]) {
  if (!newIds.has(id) && !rows.some((r) => r.id === id)) { console.error(`gen-radial-spread: word "${id}" not found`); process.exit(1); }
}
for (const w of NEW_WORDS) {
  if (!PINS[w.id]) { console.error(`gen-radial-spread: new word "${w.id}" has no pin`); process.exit(1); }
}
for (const c of Object.keys(byCluster)) {
  if (!SECTORS[c]) { console.error(`gen-radial-spread: no sector for cluster "${c}"`); process.exit(1); }
}

// 1–3. Targets.
const PHI = (Math.sqrt(5) - 1) / 2;
for (const [cluster, list] of Object.entries(byCluster)) {
  const [a0, a1] = SECTORS[cluster].map((d) => (d * Math.PI) / 180);
  // Intensity rank = radius in radial-intensity; ties broken by id for stability.
  list.sort((p, q) => Math.hypot(p.x0, p.y0) - Math.hypot(q.x0, q.y0) || p.id.localeCompare(q.id));
  const n = list.length;
  list.forEach((r, i) => {
    const u = n === 1 ? 0.5 : i / (n - 1);
    r.rmax = CLUSTER_MAX_R[cluster] ?? R_OUTER;
    const t = (0.5 + i * PHI) % 1;
    let rad = INNER_R[r.id] ?? Math.sqrt(R_INNER ** 2 + u * (r.rmax ** 2 - R_INNER ** 2));
    r.rmin = r.id in INNER_R ? rad - FLOOR_SLACK : R_INNER;
    let ang = a0 + (0.12 + 0.76 * t) * (a1 - a0);
    const pin = PINS[r.id];
    if (pin) {
      ang = (pin[0] * Math.PI) / 180;
      rad = pin[1];
      r.band = ang;
      r.pinR = rad;
    }
    r.depth = SURFACE.has(r.id) ? 'surface' : 'deep';
    r.tx = rad * Math.cos(ang);
    r.ty = rad * Math.sin(ang);
    r.x = r.tx;
    r.y = r.ty;
    r.sx = Math.sign(r.x0) || 1;
    r.sy = Math.sign(r.y0) || 1;
  });
}

// New axis words join after their cluster's last row, so the file keeps its grouping.
for (const w of NEW_WORDS) {
  if (rows.some((r) => r.id === w.id)) { console.error(`gen-radial-spread: new word "${w.id}" already exists`); process.exit(1); }
  const [deg, rad] = PINS[w.id];
  const ang = (deg * Math.PI) / 180;
  const row = {
    id: w.id, label: w.label, depth: SURFACE.has(w.id) ? 'surface' : 'deep', cluster: w.cluster,
    isNew: true, band: ang, pinR: rad, tx: rad * Math.cos(ang), ty: rad * Math.sin(ang),
  };
  row.x = row.tx; row.y = row.ty;
  let at = -1;
  rows.forEach((r, i) => { if (r.cluster === w.cluster) at = i; });
  rows.splice(at + 1, 0, row);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise over the field square, in [0, 1].
function valueNoise(rand, cells) {
  const n = cells + 1;
  const g = Array.from({ length: n * n }, rand);
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = ((Math.max(-1.3, Math.min(1.3, x)) + 1.3) / 2.6) * cells;
    const fy = ((Math.max(-1.3, Math.min(1.3, y)) + 1.3) / 2.6) * cells;
    const i = Math.min(cells - 1, Math.floor(fx)), j = Math.min(cells - 1, Math.floor(fy));
    const u = fade(fx - i), v = fade(fy - j);
    const at = (a, b) => g[b * n + a];
    const top = at(i, j) * (1 - u) + at(i + 1, j) * u;
    const bot = at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u;
    return top * (1 - v) + bot * v;
  };
}

if (ORGANIC) {
  const rand = mulberry32(SEED);
  const density = valueNoise(rand, 4);
  // Relaxation fills any gap it can, so voids have to be built into the
  // targets: deep, unpinned words drift up the density field's slope, emptying
  // the sparse patches into dark sky. Gaps there are wide, knots here are tight.
  const h = 0.02;
  for (const r of rows) {
    if (r.band !== undefined || r.depth !== 'deep') continue;
    const gx = (density(r.tx + h, r.ty) - density(r.tx - h, r.ty)) / (2 * h);
    const gy = (density(r.tx, r.ty + h) - density(r.tx, r.ty - h)) / (2 * h);
    const g = Math.hypot(gx, gy) || 1;
    const amt = DRIFT * Math.min(1, g / 1.5);
    r.tx += (gx / g) * amt;
    r.ty += (gy / g) * amt;
    r.x = r.tx;
    r.y = r.ty;
  }
  // Dense patches pack tighter; sparse ones keep their few words far apart.
  for (const r of rows) r.space = SPACE_MAX - (SPACE_MAX - SPACE_MIN) * density(r.tx, r.ty);
  // Knots: deep, unpinned words of one cluster, seeded in a fixed order.
  let knotId = 0;
  for (const cluster of Object.keys(byCluster)) {
    const free = rows.filter((r) => r.cluster === cluster && r.band === undefined && r.depth === 'deep');
    while (free.length) {
      const seed = free.shift();
      const size = KNOT_SIZES[Math.floor(rand() * KNOT_SIZES.length)];
      const near = free
        .map((r) => [Math.hypot(r.tx - seed.tx, r.ty - seed.ty), r])
        .filter(([d]) => d < KNOT_REACH)
        .sort((p, q) => p[0] - q[0])
        .slice(0, size - 1)
        .map(([, r]) => r);
      const knot = [seed, ...near];
      for (const r of near) free.splice(free.indexOf(r), 1);
      if (knot.length < 2) continue;
      const cx = knot.reduce((s, r) => s + r.tx, 0) / knot.length;
      const cy = knot.reduce((s, r) => s + r.ty, 0) / knot.length;
      // Nudge the whole knot a little, so knots don't sit on the sector's grid.
      const jr = rand() * 0.05, ja = rand() * Math.PI * 2;
      for (const r of knot) {
        r.knot = knotId;
        r.tx += (cx - r.tx) * KNOT_PULL + jr * Math.cos(ja);
        r.ty += (cy - r.ty) * KNOT_PULL + jr * Math.sin(ja);
        r.x = r.tx;
        r.y = r.ty;
      }
      knotId++;
    }
  }
}

// Keep a point in its quadrant (with a margin off both axes) and inside the
// annulus [R_INNER, its cluster's ceiling].
function constrain(r) {
  let rad = Math.hypot(r.x, r.y);
  if (r.band !== undefined) {
    // Pinned words: near their angle (either side of an axis) and intensity.
    let off = Math.atan2(r.y, r.x) - r.band;
    off = Math.atan2(Math.sin(off), Math.cos(off));
    const ang = r.band + Math.max(-PIN_BAND, Math.min(PIN_BAND, off));
    const band = r.pinR >= 0.95 ? PIN_R_BAND_TIP : PIN_R_BAND;
    rad = Math.max(Math.max(R_INNER, r.pinR - band), Math.min(r.pinR + band, rad));
    // Stay inside the square the sliders can reach.
    r.x = Math.max(-R_OUTER, Math.min(R_OUTER, rad * Math.cos(ang)));
    r.y = Math.max(-R_OUTER, Math.min(R_OUTER, rad * Math.sin(ang)));
    return;
  }
  let ang = Math.atan2(Math.abs(r.y), Math.abs(r.x));
  ang = Math.max(AXIS_MARGIN, Math.min(Math.PI / 2 - AXIS_MARGIN, ang));
  rad = Math.max(r.rmin, Math.min(r.rmax, rad));
  r.x = r.sx * rad * Math.cos(ang);
  r.y = r.sy * rad * Math.sin(ang);
}

function gap(a, b) {
  if (a.depth === 'surface' && b.depth === 'surface') return MIN_DIST_SURFACE_PAIR;
  if (a.depth === 'surface' || b.depth === 'surface') return MIN_DIST_SURFACE;
  const base = a.cluster === b.cluster ? MIN_DIST : MIN_DIST_CROSS;
  if (!ORGANIC) return base;
  if (a.knot !== undefined && a.knot === b.knot) return KNOT_GAP;
  return Math.max(SPACING_FLOOR, (base * (a.space + b.space)) / 2);
}

// 4. Relax.
for (let it = 0; it < ITER; it++) {
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      const need = gap(a, b);
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= need) continue;
      if (d < 1e-6) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
      const push = (need - d) / 2 / d;
      a.x -= dx * push; a.y -= dy * push;
      b.x += dx * push; b.y += dy * push;
    }
  }
  // The spring fades so the last passes are pure separation — except in the
  // organic variant, which keeps a light hold so knots and voids survive.
  const k = SPRING * Math.max(ORGANIC ? 0.35 : 0, 1 - it / ITER);
  for (const r of rows) {
    r.x += (r.tx - r.x) * k;
    r.y += (r.ty - r.y) * k;
    constrain(r);
  }
}

// Report.
let minD = Infinity, minPair = '', violations = 0;
for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
  const a = rows[i], b = rows[j];
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  const need = gap(a, b);
  if (d < need - 0.006) violations++;
  if (d < minD) { minD = d; minPair = `${a.label}~${b.label}`; }
}
console.log(`gen-radial-spread (${VARIANT.id}): ${rows.length} words, min pair ${minD.toFixed(3)} (${minPair}), ${violations} under target.`);

const f = (v) => (v < 0 ? '-' : ' ') + Math.abs(v).toFixed(2);
const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));
let body = '';
let last = null;
for (const r of rows) {
  if (last && last !== r.cluster) body += '\n';
  last = r.cluster;
  body += `  { id: ${pad(`'${r.id}',`, 16)}label: ${pad(`'${r.label}',`, 17)}x: ${f(r.x)}, y: ${f(r.y)}, depth: '${r.depth}', cluster: '${r.cluster}' },${r.isNew ? ' // new' : ''}\n`;
}

writeFileSync(OUT, `import type { Emotion, Framework } from './types';

// ${VARIANT.name}: ${ORGANIC ? 'the active layout, a re-layout' : 'a proposed re-layout'} of radial-intensity. Each word keeps
// its cluster and its intensity rank (radius order) within the cluster, under a
// per-cluster intensity ceiling. Clusters get angular sectors that tile each
// quadrant, so the field no longer collapses onto the diagonals. Axis and corner
// tips are hand-placed (the corners, r > 1, are where both sliders at an end
// land), ${SURFACE.size} everyday surface words are spread ~20° apart as landmarks, and
// ${NEW_WORDS.length} new words (marked) fill the axes. ${ORGANIC
  ? `Deep words gather into knots of up to ${Math.max(...KNOT_SIZES)}
// (${KNOT_GAP} apart) and the gap between knots follows a noise field
// (×${SPACE_MIN}–${SPACE_MAX}), so the field reads as a sky rather than a grid; no two
// words sit closer than ${SPACING_FLOOR}, and surface words keep ${MIN_DIST_SURFACE} clear.`
  : `Every pair is held at least ${MIN_DIST}
// apart — ${MIN_DIST_CROSS} across clusters, ${MIN_DIST_SURFACE} next to a surface word.`}
// The core (r < ${R_INNER}) stays a wordless still point.
// Generated by scripts/gen-radial-spread.mjs — re-run to regenerate.
const emotions: Emotion[] = [
${body}];

export const ${VARIANT.exportName}: Framework = {
  id: '${VARIANT.id}',
  name: '${VARIANT.name}',
  emotions,
};
`);
console.log(`wrote ${OUT}`);
