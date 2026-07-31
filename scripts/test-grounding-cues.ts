// Behavioural check for grounding-cue rotation (src/data/groundingCues.ts).
// Run: pnpm check:cues
//
// Exercises the pure selector's no-immediate-repeat + coverage invariants and
// exits non-zero on any violation (this repo has no test runner, so this is the
// only automated exercise of the rotation logic). The localStorage-backed
// nextCue() wrapper is verified live in the app.
import { pickCueIndex, GROUNDING_CUES } from '../src/data/groundingCues';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const N = GROUNDING_CUES.length;

// Deterministic LCG holding integer state (feeding the normalized fraction back
// collapses the sequence — keep the integer seed).
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// No immediate repeat: across a long simulated run of loads, the next index is
// never equal to the previous one.
{
  const rand = lcg(1);
  let prev: number | null = null;
  let repeats = 0;
  for (let i = 0; i < 5000; i++) {
    const next = pickCueIndex(prev, N, rand);
    if (prev !== null && next === prev) repeats++;
    if (next < 0 || next >= N) { repeats++; break; }
    prev = next;
  }
  check('no immediate repeat', repeats === 0, `${repeats} repeats / out-of-range over 5000 loads`);
}

// Coverage: every cue in the pool is reachable across many draws.
{
  const rand = lcg(42);
  const seen = new Set<number>();
  let prev: number | null = null;
  for (let i = 0; i < 5000; i++) {
    const next = pickCueIndex(prev, N, rand);
    seen.add(next);
    prev = next;
  }
  check('full coverage', seen.size === N, `${seen.size}/${N} cues reachable`);
}

// Uniformity of exclusion: with prev fixed, sweeping the random draw across its
// range never yields prev and covers all other indices.
{
  const prev = 3;
  const got = new Set<number>();
  for (let k = 0; k < 1000; k++) {
    got.add(pickCueIndex(prev, N, () => k / 1000));
  }
  check('excludes prev under full sweep', !got.has(prev), `prev=${prev} never returned`);
  check('covers all non-prev under sweep', got.size === N - 1, `${got.size}/${N - 1} others hit`);
}

// Edge: single-cue pool returns 0 and never loops/throws.
{
  const only = pickCueIndex(0, 1, () => 0.999);
  check('single-cue pool', only === 0, `returned ${only}`);
}

// Edge: first-ever call (prev null) returns a valid in-range index.
{
  const first = pickCueIndex(null, N, () => 0.5);
  check('first call in range', first >= 0 && first < N, `returned ${first}`);
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
