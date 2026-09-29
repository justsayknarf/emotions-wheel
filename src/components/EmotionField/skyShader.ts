import type { ShaderTheme } from '../../config/theme';

// The night sky's fragment shader (docs/plans/2026-09-28-002-feat-living-sky-plan.md),
// lifted from the approved aurora study mock. Each pixel is turned back into a
// dome direction with the same camera frame the stars use (SkyFrame in
// skyProjection.ts), so the milky way and the aurora pan and tilt with the sky.

export const SKY_VERTEX = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';

export const SKY_FRAGMENT = `
  precision highp float;
  uniform vec2 uRes, uCenter; uniform float uRatio, uF, uTime, uIntensity, uReach, uBand, uSwell, uDim, uCap, uWarmth;
  uniform vec3 uFwd, uRight, uUp, uZen, uHor, uWarm, uA1, uA2, uBandCol;
  float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  void main(){
    // stage px (top-left origin) -> dome direction, exactly as the 2D stars
    vec2 px = vec2(gl_FragCoord.x / uRatio, uRes.y - gl_FragCoord.y / uRatio);
    vec2 s = vec2((px.x - uCenter.x) / uF, -(px.y - uCenter.y) / uF);
    vec3 d = normalize(uFwd + uRight * s.x + uUp * s.y);
    float el = asin(clamp(d.y, -1.0, 1.0));
    float t = uTime;

    // base sky: darkest overhead, lifting toward the horizon
    float h = 1.0 - clamp(d.y, 0.0, 1.0);
    vec3 col = mix(uZen, uHor, pow(h, 2.4));
    // a warm glow that only lives close to the horizon
    col += uWarm * exp(-abs(el) / 0.12) * uWarmth;

    // milky way: a noisy band with darker dust lanes along a tilted great circle
    vec3 n = normalize(vec3(0.42, 0.62, -0.66));
    float off = dot(d, n);
    float core = exp(-pow(off / 0.17, 2.0));
    float dust = fbm(d * 4.5 + vec3(0.0, t * 0.004, 0.0));
    float lanes = smoothstep(0.42, 0.7, fbm(d * 10.0 + 7.0));
    float mw = core * (0.3 + 0.7 * dust) * (1.0 - 0.6 * lanes * core);
    col += uBandCol * mw * uBand * 0.16;

    // aurora: curtains that rise from the horizon, seamless around the compass
    float az = atan(d.z, d.x);
    vec3 ring = vec3(cos(az), sin(az), 0.0);
    float curtains = smoothstep(0.36, 0.82, fbm(ring * 1.1 + vec3(0.0, 0.0, t * 0.020)));
    float lower = 0.03 + 0.05 * fbm(ring * 2.6 + vec3(t * 0.030, 0.0, 0.0));
    float rise = el - lower;
    float body = smoothstep(0.0, 0.10, rise) * exp(-max(rise, 0.0) / (uReach * 0.42));
    float rays = 0.3 + 0.7 * smoothstep(0.3, 0.75, fbm(vec3(ring.xy * 14.0, t * 0.050) + vec3(0.0, el * 0.8, 0.0)));
    float fadeTop = 1.0 - smoothstep(uReach * 0.55, uReach, el);
    float a = curtains * body * rays * fadeTop;
    vec3 aCol = mix(uA1, uA2, clamp(rise / uReach, 0.0, 1.0));
    // capped so no label ever sits on a bright patch
    col += aCol * min(a * uIntensity * (1.0 + uSwell) * uDim, uCap);

    // below the horizon: sink gently into the dark, no hard limb
    col = mix(col, uZen * 0.8, smoothstep(0.0, 0.35, -d.y));
    gl_FragColor = vec4(col, 1.0);
  }`;

export type Rgb = [number, number, number];

// #rrggbb -> [r, g, b] in 0..1, the form a vec3 uniform takes.
export function hexToRgb01(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// The theme-driven (not per-frame) uniform values for one theme's shader block.
export function skyThemeUniforms(s: ShaderTheme) {
  return {
    uZen: hexToRgb01(s.skyZenith),
    uHor: hexToRgb01(s.skyHorizon),
    uWarm: hexToRgb01(s.skyWarm),
    uA1: hexToRgb01(s.skyAuroraLow),
    uA2: hexToRgb01(s.skyAuroraHigh),
    uBandCol: hexToRgb01(s.skyBand),
    uIntensity: s.skyAuroraStrength,
    uReach: (s.skyAuroraReach * Math.PI) / 180,
    uBand: s.skyBandStrength,
    uCap: s.skyAuroraCap,
    uWarmth: s.skyWarmth,
  };
}

// Whether this browser can give us a WebGL context. Called once from the
// field; never at import (the check scripts run in Node).
export function canUseWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
