// Behavioural check for the night sky's theme block (the sky* fields on
// ShaderTheme in src/config/theme.ts) and its uniform mapping
// (src/components/EmotionField/skyShader.ts). Run: npm run check:skytheme
import { THEMES, mixHex, toRgbChannels, type ShaderTheme } from '../src/config/theme';
import { hexToRgb01, skyThemeUniforms } from '../src/components/EmotionField/skyShader';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const COLOR_KEYS = ['skyZenith', 'skyHorizon', 'skyWarm', 'skyAuroraLow', 'skyAuroraHigh', 'skyBand'] as const;
const RANGES: Array<[keyof ShaderTheme, number, number]> = [
  ['skyAuroraStrength', 0, 1.5],
  ['skyAuroraSpeed', 0, 5],
  ['skyAuroraReach', 5, 80],
  ['skyAuroraCap', 0, 1],
  ['skyBandStrength', 0, 2],
  ['skyWarmth', 0, 1],
  ['skyMovingDim', 0, 1],
  ['skySwell', 0, 3],
  ['skyRenderScale', 0.25, 1],
];

// Every theme carries a complete, readable sky.
{
  const bad: string[] = [];
  for (const [id, theme] of Object.entries(THEMES)) {
    const s = theme.shader as ShaderTheme;
    for (const k of COLOR_KEYS) {
      const v = s[k];
      if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) bad.push(`${id}.${k}="${String(v)}"`);
      else toRgbChannels(v);
    }
    for (const [k, lo, hi] of RANGES) {
      const v = s[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) bad.push(`${id}.${String(k)}=${String(v)}`);
    }
  }
  check('every theme has a complete sky', bad.length === 0, bad.length ? bad.join('; ') : `${Object.keys(THEMES).length} themes`);
}

// Starry Night ships the mock-tested sky.
{
  const s = THEMES.i.shader as ShaderTheme;
  const want = { skyZenith: '#060B16', skyHorizon: '#16304D', skyWarm: '#5C4E1F', skyAuroraLow: '#8FC1C4', skyAuroraHigh: '#EAD9A8', skyBand: '#AFC0DC' };
  const off = Object.entries(want).filter(([k, v]) => s[k as keyof ShaderTheme] !== v).map(([k]) => k);
  check('Starry Night sky colors', off.length === 0, off.length ? `differs: ${off.join(', ')}` : 'matches the aurora study');
  const motion = s.skyAuroraStrength === 0.5 && s.skyAuroraSpeed === 0.97 && s.skyAuroraReach === 34 && s.skyAuroraCap === 0.26;
  check('Starry Night sky motion', motion, `strength ${s.skyAuroraStrength}, speed ${s.skyAuroraSpeed}, reach ${s.skyAuroraReach}°, cap ${s.skyAuroraCap}`);
}

// Color helpers.
check('mixHex endpoints', mixHex('#102030', '#FFFFFF', 0) === '#102030' && mixHex('#102030', '#FFFFFF', 1) === '#FFFFFF', `${mixHex('#102030', '#FFFFFF', 0.5)} at 0.5`);
{
  const [r, g, b] = hexToRgb01('#FF8000');
  check('hexToRgb01', r === 1 && Math.abs(g - 128 / 255) < 1e-12 && b === 0, `${r},${g.toFixed(4)},${b}`);
}

// Uniform mapping carries every sky field across, reach in radians.
{
  const u = skyThemeUniforms(THEMES.i.shader as ShaderTheme);
  check('reach goes to radians', Math.abs(u.uReach - (34 * Math.PI) / 180) < 1e-12, `${u.uReach.toFixed(4)} rad`);
  check('aurora colors carried', u.uA1.join() === hexToRgb01('#8FC1C4').join() && u.uA2.join() === hexToRgb01('#EAD9A8').join(), 'low + high');
  check('strengths carried', u.uIntensity === 0.5 && u.uBand === 0.96 && u.uCap === 0.26 && u.uWarmth === 0.26, `int ${u.uIntensity}, band ${u.uBand}`);
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall passed');
