// Behavioural checks for the field's definition tooltip: the timing state
// machine (definitionTiming.ts) and its geometry (definitionPlacement.ts).
// Run: pnpm run check:tooltip
import {
  DEFINITION_DELAY_MS,
  DEFINITION_GRACE_MS,
  INITIAL_DEFINITION_STATE,
  stepDefinition,
  type DefinitionEvent,
  type DefinitionState,
  type TimerCommand,
} from '../src/components/EmotionField/definitionTiming';
import {
  BAND_GUTTER,
  describeWordRegion,
  hitTestWord,
  nearestWordId,
  placeBand,
  placeTethered,
  tetherEnd,
  type Box,
  type Obstacle,
  type WordTarget,
} from '../src/components/EmotionField/definitionPlacement';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// Run events in order, returning the final state and every timer command.
function run(events: DefinitionEvent[], from: DefinitionState = INITIAL_DEFINITION_STATE) {
  let state = from;
  const timers: TimerCommand[] = [];
  for (const e of events) {
    const r = stepDefinition(state, e);
    state = r.state;
    timers.push(r.timer);
  }
  return { state, timers };
}
const hover = (id: string | null): DefinitionEvent => ({ type: 'hover', id });
const timer: DefinitionEvent = { type: 'timer' };

// --- timing ---
check('delay is 500ms, grace 300ms', DEFINITION_DELAY_MS === 500 && DEFINITION_GRACE_MS === 300, `${DEFINITION_DELAY_MS}/${DEFINITION_GRACE_MS}`);
{
  const { state, timers } = run([hover('anxious')]);
  check('hover arms the delay', state.phase === 'waiting' && state.pendingId === 'anxious', state.phase);
  check('hover sets a 500ms timer', JSON.stringify(timers[0]) === JSON.stringify({ set: 500 }), JSON.stringify(timers[0]));
}
{
  const { state } = run([hover('anxious'), timer]);
  check('delay elapsing opens it (R4)', state.phase === 'open' && state.openId === 'anxious', `${state.phase} ${state.openId}`);
}
{
  // AE1: a sweep across words never opens anything.
  const { state, timers } = run([hover('a'), hover('b'), hover('c'), hover('d'), hover(null)]);
  check('sweep then leave: cold (AE1, R6)', state.phase === 'cold' && state.openId === null, state.phase);
  check('leaving cancels the timer', timers[timers.length - 1] === 'clear', String(timers[timers.length - 1]));
  check('each new word restarts the delay', timers.slice(0, 4).every((t) => typeof t === 'object' && t !== null), JSON.stringify(timers));
}
{
  const first = run([hover('anxious')]).state;
  const again = stepDefinition(first, hover('anxious'));
  check('re-hovering the pending word keeps the timer', again.state === first && again.timer === null, String(again.timer));
}
{
  // AE2: hand-off is instant once open.
  const { state, timers } = run([hover('anxious'), timer, hover('apprehensive')]);
  check('open: next word switches at once (AE2, R7)', state.phase === 'open' && state.openId === 'apprehensive', `${state.openId}`);
  check('switch sets no timer', timers[2] === null, String(timers[2]));
}
{
  // AE3: leaving everything closes after the grace and re-arms the delay.
  const left = run([hover('anxious'), timer, hover(null)]);
  check('leaving all targets starts the grace (R8)', left.state.phase === 'grace' && left.state.openId === 'anxious', left.state.phase);
  check('grace timer is 300ms', JSON.stringify(left.timers[2]) === JSON.stringify({ set: 300 }), JSON.stringify(left.timers[2]));
  const closed = stepDefinition(left.state, timer).state;
  check('grace elapsing closes (AE3)', closed.phase === 'cold' && closed.openId === null, closed.phase);
  const rearmed = stepDefinition(closed, hover('nervous'));
  check('after closing, the delay applies again', rearmed.state.phase === 'waiting', rearmed.state.phase);
  const rescued = stepDefinition(left.state, hover('nervous'));
  check('a word reached within the grace takes over', rescued.state.phase === 'open' && rescued.state.openId === 'nervous' && rescued.timer === 'clear', `${rescued.state.openId}`);
}
{
  // AE5: a press closes and suppresses.
  const { state, timers } = run([hover('anxious'), timer, { type: 'press' }]);
  check('press closes an open tooltip (AE5, R9)', state.phase === 'cold' && state.openId === null && state.pressed, state.phase);
  check('press clears the timer', timers[2] === 'clear', String(timers[2]));
  const during = stepDefinition(state, hover('nervous'));
  check('no hover while pressed', during.state === state, during.state.phase);
  const released = stepDefinition(state, { type: 'release', restId: null });
  check('release (no rest) ends suppression, stays closed', !released.state.pressed && released.state.phase === 'cold', released.state.phase);
  const again = stepDefinition(state, { type: 'press' });
  check('repeated press (every drag frame) changes nothing', again.state === state && again.timer === null, 'same state');
  const pending = run([hover('anxious'), { type: 'press' }]).state;
  check('press cancels a pending open', pending.phase === 'cold' && pending.pendingId === null, pending.phase);
}
{
  // AE6: the pin coming to rest in the tray layout.
  const { state, timers } = run([{ type: 'press' }, { type: 'release', restId: 'content' }]);
  check('pin rest arms the delay for the nearest word (R10)', state.phase === 'waiting' && state.pendingId === 'content' && !state.pressed, state.phase);
  check('pin rest timer is 500ms', JSON.stringify(timers[1]) === JSON.stringify({ set: 500 }), JSON.stringify(timers[1]));
  check('then opens', stepDefinition(state, timer).state.openId === 'content', 'content');
  const stray = stepDefinition(INITIAL_DEFINITION_STATE, { type: 'release', restId: null });
  check('a stray release changes nothing', stray.state === INITIAL_DEFINITION_STATE && stray.timer === null, 'same state');
}
{
  // R11: a tap opens immediately.
  const { state, timers } = run([{ type: 'tap', id: 'hopeful' }]);
  check('tap opens with no delay (R11)', state.phase === 'open' && state.openId === 'hopeful' && timers[0] === 'clear', state.phase);
  const switched = stepDefinition(state, { type: 'tap', id: 'touched' }).state;
  check('tap switches an open tooltip', switched.openId === 'touched', `${switched.openId}`);
}
{
  // Dismiss (Escape, tapping the card, save, clear, leaving the field).
  const dismiss: DefinitionEvent = { type: 'dismiss' };
  const open = run([hover('anxious'), timer]).state;
  const closed = stepDefinition(open, dismiss);
  check('dismiss closes an open tooltip', closed.state.phase === 'cold' && closed.state.openId === null && !closed.state.pressed, closed.state.phase);
  check('dismiss clears the timer', closed.timer === 'clear', String(closed.timer));
  const pending = stepDefinition(run([hover('anxious')]).state, dismiss);
  check('dismiss cancels a pending open', pending.state.phase === 'cold' && pending.state.pendingId === null && pending.timer === 'clear', pending.state.phase);
  const graceClosed = stepDefinition(run([hover('anxious'), timer, hover(null)]).state, dismiss);
  check('dismiss closes during the grace', graceClosed.state.phase === 'cold' && graceClosed.state.openId === null, graceClosed.state.phase);
  const tapped = stepDefinition(run([{ type: 'tap', id: 'hopeful' }]).state, dismiss);
  check('dismiss closes a tap-opened tooltip', tapped.state.openId === null, `${tapped.state.openId}`);
  const idle = stepDefinition(INITIAL_DEFINITION_STATE, dismiss);
  check('dismiss when closed keeps the same state', idle.state === INITIAL_DEFINITION_STATE, 'same state');
  const after = stepDefinition(closed.state, hover('nervous'));
  check('after a dismiss, the delay applies again', after.state.phase === 'waiting', after.state.phase);
}
{
  const stale = stepDefinition(INITIAL_DEFINITION_STATE, timer);
  check('a stale timer is ignored', stale.state === INITIAL_DEFINITION_STATE, stale.state.phase);
}

// --- geometry ---
const field: Box = { x: 0, y: 0, w: 1000, h: 700 };
const tip = { w: 236, h: 96 };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const inside = (a: Box, b: Box) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
{
  const star = { x: 500, y: 400 };
  const box = placeTethered(star, tip, [], field);
  check('open sky: tooltip goes above the star (R13)', box.y + box.h <= star.y, `box bottom ${box.y + box.h}, star ${star.y}`);
  check('open sky: within the field', inside(box, field), JSON.stringify(box));
  const gap = star.y - (box.y + box.h);
  check('open sky: standoff about 95px', gap > 80 && gap < 110, `gap ${gap.toFixed(1)}`);
}
{
  const star = { x: 500, y: 400 };
  const blockers: Obstacle[] = [{ x: 330, y: 150, w: 340, h: 160, weight: 30 }];
  const box = placeTethered(star, tip, blockers, field);
  check('labels above: tooltip avoids them', !overlaps(box, blockers[0]), JSON.stringify(box));
}
{
  const star = { x: 500, y: 60 };
  const box = placeTethered(star, tip, [], field);
  check('near the top edge: stays inside', inside(box, field), JSON.stringify(box));
}
{
  const star = { x: 970, y: 400 };
  const box = placeTethered(star, tip, [], field);
  check('near the right edge: stays inside', inside(box, field), JSON.stringify(box));
}
{
  const star = { x: 500, y: 400 };
  const pin: Obstacle = { x: 490, y: 190, w: 20, h: 20, weight: 80 };
  const box = placeTethered(star, tip, [pin], field);
  check('never covers the pin', !overlaps(box, pin), JSON.stringify(box));
}
{
  const band: Box = { x: 0, y: 0, w: 390, h: 480 };
  const low = placeBand({ x: 200, y: 400 }, 90, band);
  check('band: anchors to the top (R14)', low.y === BAND_GUTTER && low.x === BAND_GUTTER && low.w === 390 - 2 * BAND_GUTTER, JSON.stringify(low));
  const high = placeBand({ x: 200, y: 60 }, 90, band);
  check('band: star under the top spot moves it to the bottom', high.y + high.h === 480 - BAND_GUTTER, JSON.stringify(high));
}
{
  const star = { x: 200, y: 400 };
  const box: Box = { x: 12, y: 12, w: 366, h: 90 };
  const end = tetherEnd(star, box, 'band');
  check('band tether: drops straight to the bottom edge', end.x === 200 && end.y === 102, JSON.stringify(end));
  const edge = tetherEnd({ x: 5, y: 400 }, box, 'band');
  check('band tether: clamped inside the card', edge.x >= box.x + 18, JSON.stringify(edge));
}
{
  const star = { x: 500, y: 400 };
  const box: Box = { x: 382, y: 209, w: 236, h: 96 };
  const end = tetherEnd(star, box, 'tethered');
  check('tethered: meets the card edge facing the star', Math.abs(end.y - 305) < 0.01 && Math.abs(end.x - 500) < 0.01, JSON.stringify(end));
}
{
  const targets: WordTarget[] = [
    { id: 'anxious', dotX: 300, dotY: 300, labelX: 300, labelY: 289, halfW: 30, halfH: 9 },
    { id: 'nervous', dotX: 400, dotY: 300, labelX: 400, labelY: 289, halfW: 30, halfH: 9 },
  ];
  check('hit: on the label', hitTestWord({ x: 320, y: 286 }, targets) === 'anxious', 'anxious');
  check('hit: on the dot', hitTestWord({ x: 404, y: 304 }, targets) === 'nervous', 'nervous');
  check('hit: empty sky', hitTestWord({ x: 350, y: 400 }, targets) === null, 'null');
}
{
  check('region: calm pleasant mild', describeWordRegion(-0.2, 0.3) === 'calm · pleasant · mild', describeWordRegion(-0.2, 0.3));
  check('region: activated unpleasant intense', describeWordRegion(0.68, -0.64) === 'activated · unpleasant · intense', describeWordRegion(0.68, -0.64));
  check('region: steady neutral', describeWordRegion(0.05, -0.1) === 'steady · neutral · mild', describeWordRegion(0.05, -0.1));
}
{
  const words = [{ id: 'a', x: 0.3, y: 0.3 }, { id: 'b', x: 0.5, y: 0.5 }];
  check('nearest word within reach', nearestWordId({ x: 0.32, y: 0.31 }, words, 0.35) === 'a', 'a');
  check('nothing within reach', nearestWordId({ x: -0.8, y: -0.8 }, words, 0.35) === null, 'null');
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
