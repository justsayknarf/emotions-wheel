// Behavioural check for the anchor-mark label placement
// (src/components/EmotionField/anchorLabel.ts). Run: pnpm check:anchor
//
// Asserts which side of the ring the label lands on — not exact pixels — and
// exits non-zero on any violation.
import { placeAnchorLabel } from '../src/components/EmotionField/anchorLabel';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const ring = { x: 400, y: 300, size: 14 };
const halfW = 15; // "TODAY"
const wordAbove = { x: 400, y: 280, halfW: 40, halfH: 9 };
const wordBelow = { x: 400, y: 322, halfW: 40, halfH: 9 };

// Open space: the label keeps its resting spot above the ring.
{
  const p = placeAnchorLabel(ring, halfW, []);
  check('open: stays above', p.side === 'above' && p.dy < 0, `side ${p.side}, dy ${p.dy}`);
}

// A surface word where the label would rest: it drops below the ring.
{
  const p = placeAnchorLabel(ring, halfW, [wordAbove]);
  check('blocked above: moves below', p.side === 'below' && p.dy > 0, `side ${p.side}, dy ${p.dy}`);
}

// Words above and below: it moves beside the ring.
{
  const p = placeAnchorLabel(ring, halfW, [wordAbove, wordBelow]);
  check('blocked above+below: moves sideways', p.side === 'right' || p.side === 'left', `side ${p.side}, dx ${p.dx}`);
}

// Every side taken: fall back to the resting spot rather than wandering off.
{
  const p = placeAnchorLabel(ring, halfW, [{ x: 400, y: 300, halfW: 100, halfH: 40 }]);
  check('all blocked: falls back above', p.side === 'above', `side ${p.side}`);
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
